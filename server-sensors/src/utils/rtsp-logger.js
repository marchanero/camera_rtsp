/**
 * Logger específico para operaciones RTSP
 * Proporciona logging estructurado y niveles configurables
 */

const rtspConfig = require('../config/rtsp.config');

class RTSPLogger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    this.currentLevel = this.levels[rtspConfig.logging.level] || this.levels.info;
  }

  /**
   * Log de error
   */
  error(message, data = {}) {
    if (this.currentLevel >= this.levels.error) {
      console.error(`[RTSP ERROR] ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }

  /**
   * Log de advertencia
   */
  warn(message, data = {}) {
    if (this.currentLevel >= this.levels.warn) {
      console.warn(`[RTSP WARN] ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }

  /**
   * Log informativo
   */
  info(message, data = {}) {
    if (this.currentLevel >= this.levels.info) {
      console.log(`[RTSP INFO] ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }

  /**
   * Log de debug
   */
  debug(message, data = {}) {
    if (this.currentLevel >= this.levels.debug) {
      console.debug(`[RTSP DEBUG] ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }

  /**
   * Log de conexión
   */
  connection(message, cameraId, data = {}) {
    if (rtspConfig.logging.logConnections) {
      this.info(`[CONNECTION] ${message}`, {
        cameraId,
        ...data
      });
    }
  }

  /**
   * Log de reconexión
   */
  reconnect(message, cameraId, attempt, data = {}) {
    if (rtspConfig.logging.logReconnects) {
      this.warn(`[RECONNECT] ${message}`, {
        cameraId,
        attempt,
        maxAttempts: rtspConfig.ffmpeg.reconnect.maxAttempts,
        ...data
      });
    }
  }

  /**
   * Log de error de FFmpeg
   */
  ffmpeg(message, cameraId, data = {}) {
    if (rtspConfig.logging.enableFFmpegLogs) {
      this.debug(`[FFMPEG] ${message}`, {
        cameraId,
        ...data
      });
    }
  }
}

module.exports = new RTSPLogger();