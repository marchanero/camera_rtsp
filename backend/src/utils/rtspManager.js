import { spawn } from 'child_process'
import { EventEmitter } from 'events'

class RTSPStreamManager extends EventEmitter {
  constructor() {
    super()
    this.streams = new Map()
    this.processes = new Map()
  }

  startStream(cameraId, rtspUrl, outputPort) {
    if (this.streams.has(cameraId)) {
      console.log(`⚠️  Stream ${cameraId} ya está activo`)
      return this.streams.get(cameraId)
    }

    try {
      console.log(`🎬 Iniciando stream para cámara ${cameraId}`)
      console.log(`📡 URL RTSP: ${rtspUrl}`)
      console.log(`🔌 Puerto: ${outputPort}`)

      // Usar ffmpeg para convertir RTSP a HLS
      const ffmpegArgs = [
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_list_size', '3',
        '-hls_flags', 'delete_segments',
        `pipe:1`
      ]

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      const streamData = {
        cameraId,
        rtspUrl,
        outputPort,
        startTime: new Date(),
        status: 'running',
        frameCount: 0
      }

      this.streams.set(cameraId, streamData)
      this.processes.set(cameraId, ffmpegProcess)

      ffmpegProcess.on('error', (error) => {
        console.error(`❌ Error en stream ${cameraId}:`, error.message)
        this.stopStream(cameraId)
        this.emit('error', { cameraId, error: error.message })
      })

      ffmpegProcess.on('exit', (code) => {
        if (code !== 0) {
          console.warn(`⚠️  Proceso ffmpeg ${cameraId} terminado con código ${code}`)
          this.streams.delete(cameraId)
          this.processes.delete(cameraId)
        }
      })

      console.log(`✅ Stream ${cameraId} iniciado correctamente`)
      return streamData
    } catch (error) {
      console.error(`❌ Error al iniciar stream ${cameraId}:`, error)
      throw error
    }
  }

  stopStream(cameraId) {
    const process = this.processes.get(cameraId)
    if (process) {
      process.kill('SIGTERM')
      this.processes.delete(cameraId)
    }
    this.streams.delete(cameraId)
    console.log(`🛑 Stream ${cameraId} detenido`)
  }

  getStream(cameraId) {
    return this.streams.get(cameraId)
  }

  getAllStreams() {
    return Array.from(this.streams.values())
  }

  stopAllStreams() {
    for (const cameraId of this.processes.keys()) {
      this.stopStream(cameraId)
    }
  }
}

export default new RTSPStreamManager()
