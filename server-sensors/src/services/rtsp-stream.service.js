const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const rtspConfig = require('../config/rtsp.config');
const rtspLogger = require('../utils/rtsp-logger');

/**
 * Servicio para manejar streams RTSP con auto-reconexión
 * Convierte streams RTSP a HLS usando ffmpeg
 */
class RTSPStreamService extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map(); // Map<cameraId, { process, url, status, attempts, maxAttempts }>
    this.outputDir = path.resolve(rtspConfig.hls.outputDir);
  }

  /**
   * Inicializar directorio de salida
   */
  async initializeOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Construir URL RTSP completa
   */
  buildRTSPUrl(camera) {
    const { ip, port = 554, username = '', password = '', path: cameraPath = '/stream' } = camera;
    
    if (username && password) {
      return `rtsp://${username}:${password}@${ip}:${port}${cameraPath}`;
    }
    
    return `rtsp://${ip}:${port}${cameraPath}`;
  }

  /**
   * Iniciar stream de una cámara
   */
  async startStream(cameraId, camera, options = {}) {
    try {
      // Validar configuración de cámara
      const validation = rtspConfig.validateCameraConfig(camera);
      if (!validation.isValid) {
        throw new Error(`Configuración de cámara inválida: ${validation.errors.join(', ')}`);
      }

      await this.initializeOutputDir();

      const rtspUrl = this.buildRTSPUrl(camera);
      const hlsPath = path.join(this.outputDir, `camera_${cameraId}.m3u8`);
      const hlsUrl = `/api/stream/hls/${cameraId}`;

      // Si ya existe un stream, detenerlo
      if (this.streams.has(cameraId)) {
        await this.stopStream(cameraId);
      }

      // Crear entrada para el stream
      const streamData = {
        cameraId,
        rtspUrl,
        hlsPath,
        hlsUrl,
        status: 'connecting',
        attempts: 0,
        maxAttempts: rtspConfig.ffmpeg.reconnect.maxAttempts,
        process: null,
        lastError: null,
        createdAt: new Date(),
        quality: options.quality || 'medium',
        options: options
      };

      this.streams.set(cameraId, streamData);

      // Iniciar proceso ffmpeg
      this._startFFmpegProcess(cameraId, streamData);

      if (rtspConfig.logging.logConnections) {
        rtspLogger.connection(`Stream iniciado para cámara ${cameraId}`, cameraId, {
          rtspUrl,
          quality: streamData.quality
        });
      }
      this.emit('stream:started', { cameraId, hlsUrl });

      return { 
        success: true, 
        hlsUrl, 
        cameraId,
        message: 'Stream iniciado correctamente',
        quality: streamData.quality
      };
    } catch (error) {
      rtspLogger.error(`Error al iniciar stream para cámara ${cameraId}`, {
        cameraId,
        error: error.message,
        stack: error.stack
      });
      this.emit('stream:error', { cameraId, error: error.message });
      throw error;
    }
  }

  /**
   * Iniciar proceso ffmpeg para RTSP a HLS
   */
  _startFFmpegProcess(cameraId, streamData) {
    try {
      const { rtspUrl, hlsPath, quality, options } = streamData;

      // Usar configuración centralizada con opciones específicas
      const ffmpegArgs = rtspConfig.buildFFmpegArgs(rtspUrl, hlsPath, quality, options);

      rtspLogger.ffmpeg(`Iniciando proceso para cámara ${cameraId}`, cameraId, {
        args: ffmpegArgs.join(' '),
        quality,
        options
      });

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: rtspConfig.logging.enableFFmpegLogs ? 'inherit' : ['ignore', 'pipe', 'pipe']
      });

      streamData.process = ffmpegProcess;
      streamData.status = 'connecting';

      // Manejar salida solo si los logs están habilitados
      if (rtspConfig.logging.enableFFmpegLogs) {
        ffmpegProcess.stderr.on('data', (data) => {
          const output = data.toString();
          rtspLogger.ffmpeg(`Output: ${output.substring(0, 100)}`, cameraId);
        });
      }

      // Manejar cierre del proceso
      ffmpegProcess.on('close', (code) => {
        rtspLogger.warn(`Proceso ffmpeg cerrado`, cameraId, {
          exitCode: code,
          status: streamData.status
        });

        streamData.status = 'disconnected';

        // Intentar reconectar
        this._attemptReconnect(cameraId, streamData);
      });

      // Manejar errores del proceso
      ffmpegProcess.on('error', (err) => {
        rtspLogger.error(`Error en proceso ffmpeg`, cameraId, {
          error: err.message,
          stack: err.stack
        });

        streamData.status = 'error';
        streamData.lastError = err.message;
        this._attemptReconnect(cameraId, streamData);
      });

      // Considerar stream conectado después de un tiempo configurable
      setTimeout(() => {
        if (streamData.process && !streamData.process.killed && streamData.status !== 'error') {
          streamData.status = 'connected';
          streamData.attempts = 0; // Reset intentos
          this.emit('stream:connected', { cameraId, hlsUrl: streamData.hlsUrl });
          rtspLogger.connection(`Stream conectado exitosamente`, cameraId);
        }
      }, 3000); // 3 segundos para inicializar

    } catch (error) {
      rtspLogger.error(`Error al crear proceso ffmpeg`, cameraId, {
        error: error.message,
        stack: error.stack
      });

      streamData.status = 'error';
      streamData.lastError = error.message;
      this._attemptReconnect(cameraId, streamData);
    }
  }

  /**
   * Intentar reconectar
   */
  _attemptReconnect(cameraId, streamData) {
    streamData.attempts += 1;

    if (streamData.attempts <= rtspConfig.ffmpeg.reconnect.maxAttempts) {
      // Calcular delay con exponential backoff
      const delay = Math.min(
        rtspConfig.ffmpeg.reconnect.initialDelay * Math.pow(rtspConfig.ffmpeg.reconnect.backoffMultiplier, streamData.attempts - 1),
        rtspConfig.ffmpeg.reconnect.maxDelay
      );

      rtspLogger.reconnect(`Intentando reconectar`, cameraId, streamData.attempts, {
        delay,
        lastError: streamData.lastError
      });

      this.emit('stream:reconnecting', { 
        cameraId, 
        attempt: streamData.attempts,
        maxAttempts: rtspConfig.ffmpeg.reconnect.maxAttempts
      });

      // Esperar antes de reconectar
      setTimeout(() => {
        if (this.streams.has(cameraId)) {
          const data = this.streams.get(cameraId);
          if (data.status !== 'connected' && !data.process?.killed) {
            this._startFFmpegProcess(cameraId, data);
          }
        }
      }, delay);
    } else {
      rtspLogger.error(`Máximo de reintentos alcanzado`, cameraId, {
        attempts: streamData.attempts,
        lastError: streamData.lastError
      });

      streamData.status = 'failed';
      this.emit('stream:failed', { 
        cameraId, 
        attempts: streamData.attempts,
        error: streamData.lastError 
      });
    }
  }

  /**
   * Detener stream de una cámara
   */
  async stopStream(cameraId) {
    try {
      const streamData = this.streams.get(cameraId);

      if (!streamData) {
        console.warn(`Stream no encontrado para cámara ${cameraId}`);
        return { success: false, message: 'Stream no encontrado' };
      }

      // Matar proceso ffmpeg
      if (streamData.process && !streamData.process.killed) {
        streamData.process.kill();
        console.log(`⛔ Stream detenido para cámara ${cameraId}`);
      }

      // Eliminar archivos HLS
      try {
        if (fs.existsSync(streamData.hlsPath)) {
          fs.unlinkSync(streamData.hlsPath);
        }
        // Eliminar segmentos
        const dir = path.dirname(streamData.hlsPath);
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          if (file.startsWith(`camera_${cameraId}`) && file.endsWith('.ts')) {
            fs.unlinkSync(path.join(dir, file));
          }
        });
      } catch (e) {
        console.warn(`Advertencia al eliminar archivos HLS:`, e.message);
      }

      // Remover del mapa
      this.streams.delete(cameraId);
      this.emit('stream:stopped', { cameraId });

      return { success: true, message: 'Stream detenido correctamente' };
    } catch (error) {
      console.error(`Error al detener stream para cámara ${cameraId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener estado de todos los streams
   */
  getStreamStatus(cameraId = null) {
    if (cameraId) {
      const streamData = this.streams.get(cameraId);
      if (!streamData) return null;

      return {
        cameraId: streamData.cameraId,
        status: streamData.status,
        hlsUrl: streamData.hlsUrl,
        attempts: streamData.attempts,
        maxAttempts: streamData.maxAttempts,
        lastError: streamData.lastError,
        createdAt: streamData.createdAt,
        uptime: new Date() - streamData.createdAt
      };
    }

    // Retornar estado de todos los streams
    const allStatus = [];
    this.streams.forEach((streamData, cameraId) => {
      allStatus.push({
        cameraId: streamData.cameraId,
        status: streamData.status,
        hlsUrl: streamData.hlsUrl,
        attempts: streamData.attempts,
        maxAttempts: streamData.maxAttempts,
        lastError: streamData.lastError,
        createdAt: streamData.createdAt,
        uptime: new Date() - streamData.createdAt
      });
    });

    return allStatus;
  }

  /**
   * Detener todos los streams
   */
  async stopAllStreams() {
    const promises = [];
    this.streams.forEach((_, cameraId) => {
      promises.push(this.stopStream(cameraId));
    });

    return Promise.all(promises);
  }

  /**
   * Obtener ruta del archivo HLS para una cámara
   */
  getHLSPath(cameraId) {
    const streamData = this.streams.get(cameraId);
    return streamData ? streamData.hlsPath : null;
  }

  /**
   * Verificar si hay un stream activo para una cámara
   */
  isStreamActive(cameraId) {
    const streamData = this.streams.get(cameraId);
    return streamData && streamData.status === 'connected';
  }
}

module.exports = new RTSPStreamService();
