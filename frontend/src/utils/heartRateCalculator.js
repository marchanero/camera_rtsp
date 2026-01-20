/**
 * Heart Rate Calculator v4 - Professional PPG Processing
 * 
 * Based on research from:
 * - NIH PPG processing guidelines
 * - IEEE signal processing papers
 * - Clinical PPG algorithm benchmarks
 * 
 * KEY IMPROVEMENTS:
 * 1. Use GREEN channel (G) preferentially - less motion artifact
 * 2. Butterworth Bandpass Filter 0.5-4 Hz (order 2, cascade for order 4)
 * 3. Slope Sum Function (SSF) for peak enhancement
 * 4. Adaptive threshold based on signal statistics
 */

// ============================================================
//                    CONFIGURATION
// ============================================================
const CONFIG = {
  // EmotiBit PPG sample rate
  SAMPLE_RATE_HZ: 75,
  
  // Butterworth bandpass filter parameters
  // 0.5-4 Hz captures heart rate range (30-240 BPM) and removes noise
  FILTER_LOW_CUTOFF_HZ: 0.5,   // Removes baseline wander
  FILTER_HIGH_CUTOFF_HZ: 4.0,  // Removes high-freq noise, motion artifacts
  
  // Physiological limits
  MIN_HR_BPM: 40,
  MAX_HR_BPM: 180,
  MIN_IBI_MS: 333,   // 180 BPM
  MAX_IBI_MS: 1500,  // 40 BPM
  
  // Peak detection
  REFRACTORY_PERIOD_MS: 333,  // Minimum time between beats (180 BPM max)
  SSF_WINDOW_SAMPLES: 8,      // Slope Sum Function window
  ADAPTIVE_THRESHOLD_FACTOR: 0.4,  // Threshold = mean + factor * (max - mean)
  
  // IBI validation
  IBI_CHANGE_THRESHOLD: 0.20,  // Max 20% change from median
  IBI_HISTORY_SIZE: 8,
  
  // Output
  HR_SMOOTHING_FACTOR: 0.12,
  MIN_VALID_PEAKS: 4,
  
  // Buffer
  BUFFER_SECONDS: 8,
}

// ============================================================
//                    BUTTERWORTH FILTER
// ============================================================

/**
 * Second-order Butterworth filter coefficients calculator
 * Creates a biquad filter section
 */
function calculateBiquadCoefficients(fs, fc, type) {
  const omega = 2 * Math.PI * fc / fs
  const cosOmega = Math.cos(omega)
  const sinOmega = Math.sin(omega)
  const alpha = sinOmega / (2 * Math.sqrt(2))  // Q = sqrt(2)/2 for Butterworth
  
  let b0, b1, b2, a0, a1, a2
  
  if (type === 'lowpass') {
    b0 = (1 - cosOmega) / 2
    b1 = 1 - cosOmega
    b2 = (1 - cosOmega) / 2
    a0 = 1 + alpha
    a1 = -2 * cosOmega
    a2 = 1 - alpha
  } else if (type === 'highpass') {
    b0 = (1 + cosOmega) / 2
    b1 = -(1 + cosOmega)
    b2 = (1 + cosOmega) / 2
    a0 = 1 + alpha
    a1 = -2 * cosOmega
    a2 = 1 - alpha
  }
  
  // Normalize coefficients
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0
  }
}

/**
 * Biquad filter implementation (Direct Form II Transposed)
 */
class BiquadFilter {
  constructor(coeffs) {
    this.b0 = coeffs.b0
    this.b1 = coeffs.b1
    this.b2 = coeffs.b2
    this.a1 = coeffs.a1
    this.a2 = coeffs.a2
    this.z1 = 0
    this.z2 = 0
  }
  
  process(input) {
    const output = this.b0 * input + this.z1
    this.z1 = this.b1 * input - this.a1 * output + this.z2
    this.z2 = this.b2 * input - this.a2 * output
    return output
  }
  
  reset() {
    this.z1 = 0
    this.z2 = 0
  }
}

/**
 * Bandpass filter using cascaded highpass + lowpass
 */
class BandpassFilter {
  constructor(fs, lowCutoff, highCutoff) {
    // Highpass at low cutoff
    const hpCoeffs = calculateBiquadCoefficients(fs, lowCutoff, 'highpass')
    this.highpass = new BiquadFilter(hpCoeffs)
    
    // Lowpass at high cutoff
    const lpCoeffs = calculateBiquadCoefficients(fs, highCutoff, 'lowpass')
    this.lowpass = new BiquadFilter(lpCoeffs)
  }
  
  process(input) {
    // First highpass, then lowpass
    const hp = this.highpass.process(input)
    return this.lowpass.process(hp)
  }
  
  reset() {
    this.highpass.reset()
    this.lowpass.reset()
  }
}

// ============================================================
//                    SIGNAL PROCESSING
// ============================================================

/**
 * Slope Sum Function (SSF) - enhances upward slopes for peak detection
 * This is a key technique in professional PPG processing
 */
function slopeSumFunction(signal, windowSize) {
  const result = new Array(signal.length).fill(0)
  
  for (let i = windowSize; i < signal.length; i++) {
    let ssfSum = 0
    for (let j = 0; j < windowSize; j++) {
      const slope = signal[i - j] - signal[i - j - 1]
      if (slope > 0) {
        ssfSum += slope
      }
    }
    result[i] = ssfSum
  }
  
  return result
}

/**
 * Find peaks using SSF and adaptive threshold
 */
function findPeaksSSF(ssf, originalSignal, minDistance, adaptiveThreshold) {
  const peaks = []
  
  for (let i = 2; i < ssf.length - 1; i++) {
    // Local maximum in SSF
    if (ssf[i] > ssf[i - 1] && ssf[i] >= ssf[i + 1]) {
      // Above adaptive threshold
      if (ssf[i] > adaptiveThreshold) {
        // Respect minimum distance
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) {
          peaks.push(i)
        }
      }
    }
  }
  
  return peaks
}

/**
 * Calculate adaptive threshold from signal statistics
 */
function calculateAdaptiveThreshold(signal, factor) {
  if (signal.length === 0) return 0
  
  let sum = 0, max = -Infinity
  for (let i = 0; i < signal.length; i++) {
    sum += signal[i]
    if (signal[i] > max) max = signal[i]
  }
  const mean = sum / signal.length
  
  return mean + factor * (max - mean)
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
 * Validate IBI against physiological limits and history
 */
function isValidIBI(ibi, ibiHistory, changeThreshold) {
  // Check absolute limits
  if (ibi < CONFIG.MIN_IBI_MS || ibi > CONFIG.MAX_IBI_MS) {
    return false
  }
  
  // First IBI is always valid
  if (ibiHistory.length === 0) {
    return true
  }
  
  // Check against median of history
  const med = median(ibiHistory)
  const change = Math.abs(ibi - med) / med
  return change <= changeThreshold
}

// ============================================================
//                    HEART RATE CALCULATOR
// ============================================================

class HeartRateCalculator {
  constructor() {
    this.reset()
  }
  
  reset() {
    // Bandpass filter (0.5-4 Hz)
    this.bandpassFilter = new BandpassFilter(
      CONFIG.SAMPLE_RATE_HZ,
      CONFIG.FILTER_LOW_CUTOFF_HZ,
      CONFIG.FILTER_HIGH_CUTOFF_HZ
    )
    
    // Signal buffers
    this.rawBuffer = []
    this.filteredBuffer = []
    this.maxBufferSize = CONFIG.SAMPLE_RATE_HZ * CONFIG.BUFFER_SECONDS
    
    // IBI history
    this.ibiHistory = []
    
    // Output values
    this.currentHR = 0
    this.currentIBI = 0
    this.smoothedHR = 0
    
    // Quality metrics
    this.signalQuality = 0
    this.validPeakCount = 0
    
    // Sample counter
    this.sampleCount = 0
  }
  
  /**
   * Process new PPG samples
   * Prefers Green channel (less motion artifact), then IR
   */
  processSamples(samples, timestamp) {
    if (!samples || samples.length === 0) {
      return this.getResult()
    }
    
    // Process each sample through bandpass filter
    for (const sample of samples) {
      const filtered = this.bandpassFilter.process(sample)
      this.rawBuffer.push(sample)
      this.filteredBuffer.push(filtered)
      this.sampleCount++
    }
    
    // Trim buffers
    while (this.rawBuffer.length > this.maxBufferSize) {
      this.rawBuffer.shift()
      this.filteredBuffer.shift()
    }
    
    // Need minimum data for processing
    if (this.filteredBuffer.length < CONFIG.SAMPLE_RATE_HZ * 3) {
      return this.getResult()
    }
    
    // Process signal for peaks
    this.detectPeaksAndCalculateHR()
    
    return this.getResult()
  }
  
  /**
   * Main peak detection and HR calculation
   */
  detectPeaksAndCalculateHR() {
    const filtered = this.filteredBuffer
    
    // Step 1: Apply Slope Sum Function (SSF)
    const ssf = slopeSumFunction(filtered, CONFIG.SSF_WINDOW_SAMPLES)
    
    // Step 2: Calculate adaptive threshold
    const threshold = calculateAdaptiveThreshold(ssf, CONFIG.ADAPTIVE_THRESHOLD_FACTOR)
    
    // Step 3: Minimum samples between peaks
    const minPeakDistance = Math.floor(CONFIG.REFRACTORY_PERIOD_MS / 1000 * CONFIG.SAMPLE_RATE_HZ)
    
    // Step 4: Find peaks
    const peaks = findPeaksSSF(ssf, filtered, minPeakDistance, threshold)
    
    // Step 5: Calculate IBIs and validate
    if (peaks.length >= 2) {
      for (let i = 1; i < peaks.length; i++) {
        const peakDistance = peaks[i] - peaks[i - 1]
        const ibiMs = (peakDistance / CONFIG.SAMPLE_RATE_HZ) * 1000
        
        // Validate IBI
        if (isValidIBI(ibiMs, this.ibiHistory, CONFIG.IBI_CHANGE_THRESHOLD)) {
          this.ibiHistory.push(ibiMs)
          this.validPeakCount++
          
          // Keep history limited
          while (this.ibiHistory.length > CONFIG.IBI_HISTORY_SIZE) {
            this.ibiHistory.shift()
          }
        }
      }
    }
    
    // Step 6: Calculate HR from validated IBIs
    if (this.ibiHistory.length >= CONFIG.MIN_VALID_PEAKS) {
      // Use median for robustness
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
      
      // Update quality (based on peak regularity)
      const ibiStdDev = this.calculateIBIStdDev()
      const regularityScore = Math.max(0, 100 - (ibiStdDev / 10))
      this.signalQuality = Math.min(100, regularityScore)
    }
  }
  
  /**
   * Calculate IBI standard deviation for quality assessment
   */
  calculateIBIStdDev() {
    if (this.ibiHistory.length < 2) return 100
    
    const mean = this.ibiHistory.reduce((a, b) => a + b, 0) / this.ibiHistory.length
    const variance = this.ibiHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.ibiHistory.length
    return Math.sqrt(variance)
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

// ============================================================
//                    EXPORTS
// ============================================================

// Singleton instance
const heartRateCalculator = new HeartRateCalculator()

/**
 * Process PPG data and return calculated HR/IBI
 * 
 * IMPORTANT: Uses GREEN (g) channel preferentially
 * Green light has less motion artifact and better signal quality for HR
 */
export function calculateHeartRate(ppgData, timestamp) {
  if (!ppgData) {
    return heartRateCalculator.getResult()
  }
  
  // PREFER GREEN CHANNEL (research shows it's best for HR)
  // Then IR, then Red (worst for HR)
  const samples = ppgData.g || ppgData.ir || ppgData.r
  
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
