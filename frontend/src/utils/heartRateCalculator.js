/**
 * Heart Rate Calculator using PPG Peak Detection v2
 * 
 * Improved algorithm with:
 * - Better signal filtering (moving average + derivative)
 * - More robust peak detection
 * - IBI outlier rejection
 * - Heavier smoothing for stable output
 */

// Configuration - tuned for EmotiBit PPG at 75Hz
const CONFIG = {
  // PPG sample rate from EmotiBit
  SAMPLE_RATE_HZ: 75,
  
  // Valid heart rate range (physiological limits)
  MIN_HR_BPM: 40,
  MAX_HR_BPM: 110,   // Further reduced - we'll be conservative
  
  // Corresponding IBI limits  
  MIN_IBI_MS: 545,   // 110 BPM - only accept slower beats initially
  MAX_IBI_MS: 1500,  // 40 BPM
  
  // Signal processing
  MOVING_AVG_WINDOW: 9,       // More smoothing
  DERIVATIVE_WINDOW: 7,       // Larger window
  
  // Peak detection - VERY conservative to avoid false peaks
  REFRACTORY_PERIOD_MS: 550,  // 550ms minimum between peaks (~109 BPM max)
  PEAK_PROMINENCE_FACTOR: 0.7, // Peak must be 70% above baseline
  
  // IBI validation - strict
  IBI_CHANGE_THRESHOLD: 0.15, // Only 15% variation allowed
  IBI_HISTORY_SIZE: 12,       // More history for stable median
  
  // Output smoothing - very heavy
  HR_SMOOTHING_FACTOR: 0.08,  // Very slow changes
  MIN_PEAKS_FOR_OUTPUT: 5,    // Need 5 valid peaks
  
  // Buffer size
  SIGNAL_BUFFER_SECONDS: 10,  // 10 seconds of data
}

/**
 * Simple moving average filter
 */
function movingAverage(data, windowSize) {
  const result = []
  for (let i = 0; i < data.length; i++) {
    let sum = 0
    let count = 0
    for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
      sum += data[j]
      count++
    }
    result.push(sum / count)
  }
  return result
}

/**
 * Calculate derivative (rate of change)
 */
function derivative(data, windowSize = 1) {
  const result = []
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize) {
      result.push(0)
    } else {
      result.push(data[i] - data[i - windowSize])
    }
  }
  return result
}

/**
 * Find peaks in signal using derivative zero-crossing
 */
function findPeaks(signal, derivative, minDistance, threshold) {
  const peaks = []
  
  for (let i = 2; i < signal.length - 1; i++) {
    // Peak: derivative goes from positive to negative
    if (derivative[i - 1] > 0 && derivative[i] <= 0) {
      // Check if peak is above threshold
      if (signal[i] > threshold) {
        // Check minimum distance from last peak
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) {
          peaks.push(i)
        }
      }
    }
  }
  
  return peaks
}

/**
 * Validate IBI against history
 */
function isValidIBI(newIBI, ibiHistory) {
  // Check physiological limits
  if (newIBI < CONFIG.MIN_IBI_MS || newIBI > CONFIG.MAX_IBI_MS) {
    return false
  }
  
  // If no history, accept
  if (ibiHistory.length === 0) {
    return true
  }
  
  // Check against median of recent IBIs
  const sorted = [...ibiHistory].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  
  // Allow some variation but reject outliers
  const change = Math.abs(newIBI - median) / median
  return change <= CONFIG.IBI_CHANGE_THRESHOLD
}

/**
 * Calculate median of array
 */
function median(arr) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * HeartRateCalculator class
 */
class HeartRateCalculator {
  constructor() {
    this.reset()
  }
  
  reset() {
    // Signal buffer
    this.signalBuffer = []
    this.maxBufferSize = CONFIG.SAMPLE_RATE_HZ * CONFIG.SIGNAL_BUFFER_SECONDS
    
    // IBI history (validated IBIs only)
    this.ibiHistory = []
    
    // Output values
    this.currentHR = 0
    this.currentIBI = 0
    this.smoothedHR = 0
    
    // Quality metrics
    this.signalQuality = 0
    this.validPeakCount = 0
    this.totalPeakCount = 0
    
    // Timestamps
    this.lastPeakTime = 0
    this.sampleCount = 0
  }
  
  /**
   * Process new PPG samples
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
    
    // Trim buffer
    while (this.signalBuffer.length > this.maxBufferSize) {
      this.signalBuffer.shift()
    }
    
    // Need minimum data
    if (this.signalBuffer.length < CONFIG.SAMPLE_RATE_HZ * 2) {
      return this.getResult()
    }
    
    // Process signal
    this.processSignal(timestamp)
    
    return this.getResult()
  }
  
  /**
   * Main signal processing
   */
  processSignal(currentTime) {
    const raw = this.signalBuffer
    
    // Step 1: Apply moving average filter to smooth noise
    const smoothed = movingAverage(raw, CONFIG.MOVING_AVG_WINDOW)
    
    // Step 2: Calculate derivative for peak detection
    const deriv = derivative(smoothed, CONFIG.DERIVATIVE_WINDOW)
    
    // Step 3: Calculate adaptive threshold
    const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length
    const max = Math.max(...smoothed)
    const threshold = mean + CONFIG.PEAK_PROMINENCE_FACTOR * (max - mean)
    
    // Step 4: Minimum samples between peaks
    const minPeakDistance = Math.floor(CONFIG.REFRACTORY_PERIOD_MS / 1000 * CONFIG.SAMPLE_RATE_HZ)
    
    // Step 5: Find peaks
    const peaks = findPeaks(smoothed, deriv, minPeakDistance, threshold)
    
    this.totalPeakCount = peaks.length
    
    // Step 6: Calculate IBIs from consecutive peaks
    if (peaks.length >= 2) {
      for (let i = 1; i < peaks.length; i++) {
        const peakDistance = peaks[i] - peaks[i - 1]
        const ibiMs = (peakDistance / CONFIG.SAMPLE_RATE_HZ) * 1000
        
        // Validate IBI
        if (isValidIBI(ibiMs, this.ibiHistory)) {
          this.ibiHistory.push(ibiMs)
          this.validPeakCount++
          
          // Keep history limited
          while (this.ibiHistory.length > CONFIG.IBI_HISTORY_SIZE) {
            this.ibiHistory.shift()
          }
        }
      }
    }
    
    // Step 7: Calculate HR from IBI history
    if (this.ibiHistory.length >= CONFIG.MIN_PEAKS_FOR_OUTPUT) {
      // Use median IBI for robustness
      const medianIBI = median(this.ibiHistory)
      this.currentIBI = Math.round(medianIBI)
      
      // Calculate HR
      const hr = 60000 / medianIBI
      this.currentHR = hr
      
      // Smooth output
      if (this.smoothedHR === 0) {
        this.smoothedHR = hr
      } else {
        this.smoothedHR = this.smoothedHR * (1 - CONFIG.HR_SMOOTHING_FACTOR) + 
                          hr * CONFIG.HR_SMOOTHING_FACTOR
      }
      
      // Clamp to valid range
      this.smoothedHR = Math.max(CONFIG.MIN_HR_BPM, Math.min(CONFIG.MAX_HR_BPM, this.smoothedHR))
      
      // Update quality based on consistency
      this.signalQuality = Math.min(100, this.validPeakCount * 10)
    }
  }
  
  /**
   * Get current result
   */
  getResult() {
    return {
      hr: Math.round(this.smoothedHR * 10) / 10,
      ibi: this.currentIBI,
      quality: Math.round(this.signalQuality),
      rawHr: Math.round(this.currentHR * 10) / 10,
      peakCount: this.validPeakCount,
      sampleCount: this.sampleCount
    }
  }
}

// Singleton instance
const heartRateCalculator = new HeartRateCalculator()

/**
 * Process PPG data and return calculated HR/IBI
 */
export function calculateHeartRate(ppgData, timestamp) {
  if (!ppgData) {
    return heartRateCalculator.getResult()
  }
  
  // Prefer IR channel, then Green (Red is worst for HR)
  const samples = ppgData.ir || ppgData.g
  
  if (!samples || !Array.isArray(samples)) {
    return heartRateCalculator.getResult()
  }
  
  return heartRateCalculator.processSamples(samples, timestamp || Date.now())
}

/**
 * Reset the calculator
 */
export function resetHeartRateCalculator() {
  heartRateCalculator.reset()
}

/**
 * Get current HR without processing
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
