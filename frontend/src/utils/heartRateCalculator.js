/**
 * Heart Rate Calculator using PPG Peak Detection
 * 
 * Implements a simple but robust peak detection algorithm
 * to calculate Heart Rate (BPM) and Inter-Beat Interval (IBI)
 * from PPG (photoplethysmography) data.
 * 
 * This runs in the frontend as an alternative/complement to
 * the EmotiBit's built-in HR calculation.
 */

// Configuration
const CONFIG = {
  // PPG sample rate from EmotiBit
  SAMPLE_RATE_HZ: 75,
  
  // Peak detection parameters
  MIN_PEAK_DISTANCE_MS: 300,   // Minimum time between peaks (200 BPM max)
  MAX_PEAK_DISTANCE_MS: 2000,  // Maximum time between peaks (30 BPM min)
  
  // Valid HR range
  MIN_HR_BPM: 40,
  MAX_HR_BPM: 200,
  
  // Smoothing
  HR_SMOOTHING_FACTOR: 0.3,   // Lower = more smoothing
  IBI_BUFFER_SIZE: 5,         // Number of IBIs to average
  
  // Threshold for peak detection (adaptive)
  PEAK_THRESHOLD_FACTOR: 0.6, // Peak must be > mean + factor * (max - mean)
  
  // Signal quality
  MIN_SAMPLES_FOR_CALCULATION: 50,  // Need at least this many samples
}

/**
 * HeartRateCalculator class
 * Maintains state for continuous HR calculation from PPG stream
 */
class HeartRateCalculator {
  constructor() {
    this.reset()
  }
  
  reset() {
    // Signal buffer for peak detection
    this.signalBuffer = []
    this.maxBufferSize = CONFIG.SAMPLE_RATE_HZ * 5  // 5 seconds of data
    
    // Peak detection state
    this.lastPeakIndex = -1
    this.lastPeakTime = 0
    
    // IBI history for averaging
    this.ibiHistory = []
    
    // Calculated values
    this.currentHR = 0
    this.currentIBI = 0
    this.rawHR = 0
    
    // Timestamps
    this.lastUpdateTime = 0
    this.sampleCount = 0
    
    // Signal quality metrics
    this.signalQuality = 0  // 0-100%
    this.peakCount = 0
  }
  
  /**
   * Process new PPG samples and calculate HR/IBI
   * @param {number[]} samples - Array of PPG values (typically IR or Green channel)
   * @param {number} timestamp - Timestamp of the last sample (ms)
   * @returns {{ hr: number, ibi: number, quality: number, rawHr: number }}
   */
  processSamples(samples, timestamp) {
    if (!samples || samples.length === 0) {
      return this.getResult()
    }
    
    // Add samples to buffer
    for (const sample of samples) {
      this.signalBuffer.push(sample)
      this.sampleCount++
    }
    
    // Keep buffer size limited
    while (this.signalBuffer.length > this.maxBufferSize) {
      this.signalBuffer.shift()
    }
    
    // Need minimum samples for calculation
    if (this.signalBuffer.length < CONFIG.MIN_SAMPLES_FOR_CALCULATION) {
      return this.getResult()
    }
    
    // Detect peaks and calculate HR
    this.detectPeaksAndCalculateHR(timestamp)
    
    this.lastUpdateTime = timestamp
    
    return this.getResult()
  }
  
  /**
   * Detect peaks in the signal buffer and calculate HR
   */
  detectPeaksAndCalculateHR(currentTime) {
    const buffer = this.signalBuffer
    const len = buffer.length
    
    // Calculate signal statistics for adaptive thresholding
    let sum = 0, min = Infinity, max = -Infinity
    for (let i = 0; i < len; i++) {
      sum += buffer[i]
      if (buffer[i] < min) min = buffer[i]
      if (buffer[i] > max) max = buffer[i]
    }
    const mean = sum / len
    const amplitude = max - min
    
    // Check signal quality (amplitude should be significant)
    if (amplitude < 100) {  // Very low signal
      this.signalQuality = Math.max(0, this.signalQuality - 5)
      return
    }
    
    // Adaptive threshold for peak detection
    const threshold = mean + CONFIG.PEAK_THRESHOLD_FACTOR * (max - mean)
    
    // Minimum samples between peaks
    const minPeakDistance = Math.floor(CONFIG.MIN_PEAK_DISTANCE_MS / 1000 * CONFIG.SAMPLE_RATE_HZ)
    
    // Find peaks in the most recent portion of the buffer
    // We only look at the last 2 seconds to find new peaks
    const lookbackSamples = Math.floor(CONFIG.SAMPLE_RATE_HZ * 2)
    const startIdx = Math.max(0, len - lookbackSamples)
    
    const peaks = []
    for (let i = startIdx + 1; i < len - 1; i++) {
      // Peak: higher than neighbors and above threshold
      if (buffer[i] > buffer[i - 1] && 
          buffer[i] > buffer[i + 1] && 
          buffer[i] > threshold) {
        
        // Check minimum distance from last peak
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minPeakDistance) {
          peaks.push(i)
        }
      }
    }
    
    // Calculate IBIs from consecutive peaks
    if (peaks.length >= 2) {
      for (let i = 1; i < peaks.length; i++) {
        const peakDistance = peaks[i] - peaks[i - 1]
        const ibiMs = (peakDistance / CONFIG.SAMPLE_RATE_HZ) * 1000
        
        // Validate IBI is in reasonable range
        if (ibiMs >= CONFIG.MIN_PEAK_DISTANCE_MS && ibiMs <= CONFIG.MAX_PEAK_DISTANCE_MS) {
          this.addIBI(ibiMs)
          this.peakCount++
        }
      }
      
      // Update signal quality based on peak regularity
      this.signalQuality = Math.min(100, this.signalQuality + 2)
    } else {
      this.signalQuality = Math.max(0, this.signalQuality - 1)
    }
    
    // Calculate HR from IBI history
    if (this.ibiHistory.length > 0) {
      // Average IBI
      const avgIBI = this.ibiHistory.reduce((a, b) => a + b, 0) / this.ibiHistory.length
      this.currentIBI = Math.round(avgIBI)
      
      // Calculate raw HR from average IBI
      const rawHR = 60000 / avgIBI
      this.rawHR = rawHR
      
      // Smooth HR
      if (this.currentHR === 0) {
        this.currentHR = rawHR
      } else {
        this.currentHR = this.currentHR * (1 - CONFIG.HR_SMOOTHING_FACTOR) + 
                         rawHR * CONFIG.HR_SMOOTHING_FACTOR
      }
      
      // Clamp to valid range
      this.currentHR = Math.max(CONFIG.MIN_HR_BPM, Math.min(CONFIG.MAX_HR_BPM, this.currentHR))
    }
  }
  
  /**
   * Add an IBI to the history buffer
   */
  addIBI(ibiMs) {
    this.ibiHistory.push(ibiMs)
    
    // Keep history limited
    while (this.ibiHistory.length > CONFIG.IBI_BUFFER_SIZE) {
      this.ibiHistory.shift()
    }
  }
  
  /**
   * Get current calculated values
   */
  getResult() {
    return {
      hr: Math.round(this.currentHR * 10) / 10,  // 1 decimal
      ibi: this.currentIBI,
      quality: Math.round(this.signalQuality),
      rawHr: Math.round(this.rawHR * 10) / 10,
      peakCount: this.peakCount,
      sampleCount: this.sampleCount
    }
  }
  
  /**
   * Get signal quality (0-100%)
   */
  getSignalQuality() {
    return this.signalQuality
  }
}

// Create singleton instance
const heartRateCalculator = new HeartRateCalculator()

/**
 * Process PPG data and return calculated HR/IBI
 * This is the main function to call from React components
 * 
 * @param {Object} ppgData - PPG data object with ir, g, r arrays
 * @param {number} timestamp - Timestamp of the data
 * @returns {{ hr: number, ibi: number, quality: number }}
 */
export function calculateHeartRate(ppgData, timestamp) {
  if (!ppgData) {
    return heartRateCalculator.getResult()
  }
  
  // Prefer IR channel, then Green, then Red
  // IR is typically best for HR detection
  const samples = ppgData.ir || ppgData.g || ppgData.r
  
  if (!samples || !Array.isArray(samples)) {
    return heartRateCalculator.getResult()
  }
  
  return heartRateCalculator.processSamples(samples, timestamp || Date.now())
}

/**
 * Reset the calculator (e.g., when sensor disconnects)
 */
export function resetHeartRateCalculator() {
  heartRateCalculator.reset()
}

/**
 * Get current HR without processing new samples
 */
export function getCurrentHeartRate() {
  return heartRateCalculator.getResult()
}

export default {
  calculateHeartRate,
  resetHeartRateCalculator,
  getCurrentHeartRate,
  HeartRateCalculator
}
