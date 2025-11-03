class FrameCache {
  constructor() {
    this.cache = new Map()
    this.processes = new Map()
  }

  // Obtener o crear un frame en caché
  getOrCreateFrame(cameraId, rtspUrl, captureFrame) {
    const cacheKey = `cam_${cameraId}`
    const now = Date.now()

    // Si existe y es menor a 200ms, devolverlo
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (now - cached.timestamp < 200) {
        return Promise.resolve(cached.buffer)
      }
    }

    // Si hay un proceso en curso, esperar
    if (this.processes.has(cacheKey)) {
      return this.processes.get(cacheKey)
    }

    // Capturar nuevo frame
    const promise = captureFrame(rtspUrl)
      .then(buffer => {
        this.cache.set(cacheKey, { buffer, timestamp: Date.now() })
        this.processes.delete(cacheKey)
        return buffer
      })
      .catch(error => {
        this.processes.delete(cacheKey)
        throw error
      })

    this.processes.set(cacheKey, promise)
    return promise
  }

  clear(cameraId) {
    const cacheKey = `cam_${cameraId}`
    this.cache.delete(cacheKey)
  }

  clearAll() {
    this.cache.clear()
    this.processes.clear()
  }
}

export default new FrameCache()
