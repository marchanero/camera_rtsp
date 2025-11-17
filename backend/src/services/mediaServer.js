import NodeMediaServer from 'node-media-server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Directorios para grabaciones y streaming
const RECORDINGS_DIR = path.join(process.cwd(), 'recordings')
const MEDIA_ROOT = path.join(process.cwd(), 'media')

// Crear directorios si no existen
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
}
if (!fs.existsSync(MEDIA_ROOT)) {
  fs.mkdirSync(MEDIA_ROOT, { recursive: true })
}

// Configuración del Node Media Server
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8889, // Puerto para HLS
    mediaroot: MEDIA_ROOT,
    allow_origin: '*',
    cors: {
      origin: '*',
      credentials: true
    }
  },
  trans: {
    ffmpeg: '/usr/local/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=4:hls_list_size=5:hls_flags=delete_segments+append_list]',
        hlsKeep: true, // Mantener archivos
        dash: false
      }
    ]
  }
}

class MediaServerManager {
  constructor() {
    this.nms = null
    this.rtspProcesses = new Map() // Procesos FFmpeg RTSP → RTMP
    this.recordingProcesses = new Map() // Procesos de grabación
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.nms = new NodeMediaServer(config)
        
        this.nms.on('preConnect', (id, args) => {
          console.log('🔌 Cliente conectando:', id)
        })

        this.nms.on('postConnect', (id, args) => {
          console.log('✅ Cliente conectado:', id)
        })

        this.nms.on('doneConnect', (id, args) => {
          console.log('👋 Cliente desconectado:', id)
        })

        this.nms.on('prePublish', (id, StreamPath, args) => {
          console.log('📡 Stream iniciado:', StreamPath)
        })

        this.nms.on('donePublish', (id, StreamPath, args) => {
          console.log('🛑 Stream detenido:', StreamPath)
        })

        this.nms.run()
        console.log('🎬 Node Media Server iniciado')
        console.log(`📺 RTMP: rtmp://localhost:${config.rtmp.port}`)
        console.log(`🌐 HLS: http://localhost:${config.http.port}`)
        resolve()
      } catch (error) {
        console.error('❌ Error iniciando Media Server:', error)
        reject(error)
      }
    })
  }

  stop() {
    // Detener todos los procesos FFmpeg
    this.rtspProcesses.forEach((process, key) => {
      console.log(`🛑 Deteniendo stream RTSP: ${key}`)
      process.kill('SIGTERM')
    })
    this.rtspProcesses.clear()

    this.recordingProcesses.forEach((process, key) => {
      console.log(`🛑 Deteniendo grabación: ${key}`)
      process.kill('SIGTERM')
    })
    this.recordingProcesses.clear()

    if (this.nms) {
      this.nms.stop()
      console.log('🛑 Media Server detenido')
    }
  }

  /**
   * Inicia SOLO grabación de una cámara (sin HLS streaming)
   * Grabación continua sin pérdida de calidad usando codec copy
   */
  startCamera(camera) {
    const streamKey = `camera_${camera.id}`
    
    // Verificar si ya está grabando
    const recordKey = `${streamKey}_recording`
    if (this.recordingProcesses.has(recordKey)) {
      console.log(`⚠️ Grabación ya activa para ${camera.name}`)
      return { streamKey, message: 'Ya está grabando' }
    }

    console.log(`💾 Iniciando grabación continua: ${camera.name}`)
    
    // Solo iniciar grabación (sin HLS)
    this.startRecording(camera, streamKey)

    return {
      streamKey,
      message: 'Grabación iniciada (sin pérdida de calidad)',
      recording: true
    }
  }

  /**
   * Inicia HLS streaming (solo cuando se requiere visualización HLS)
   * Usado como fallback si WebRTC no funciona
   */
  startHLSStream(camera) {
    const streamKey = `camera_${camera.id}`
    const hlsDir = path.join(MEDIA_ROOT, 'live', streamKey)
    
    // Verificar si ya está streaming HLS
    if (this.rtspProcesses.has(streamKey)) {
      console.log(`⚠️ Stream HLS ya activo para ${camera.name}`)
      return { streamKey, hlsUrl: `http://localhost:${config.http.port}/live/${streamKey}/index.m3u8` }
    }
    
    // Crear directorio HLS si no existe
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true })
    }

    console.log(`🎥 Iniciando stream HLS: ${camera.name}`)
    const hlsOutputPath = path.join(hlsDir, 'index.m3u8')
    
    const streamArgs = [
      '-rtsp_transport', 'tcp',
      '-i', camera.rtspUrl,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_list_size', '5',
      '-hls_flags', 'delete_segments+append_list',
      '-hls_segment_filename', path.join(hlsDir, 'segment%03d.ts'),
      hlsOutputPath
    ]

    const streamProcess = spawn('ffmpeg', streamArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    streamProcess.stderr.on('data', (data) => {
      const output = data.toString()
      if (output.includes('frame=')) {
        const match = output.match(/frame=\s*(\d+)/)
        if (match && parseInt(match[1]) % 100 === 0) {
          console.log(`📹 HLS ${camera.name}: Frame ${match[1]}`)
        }
      }
      if (output.includes('Opening') && output.includes('.ts')) {
        console.log(`📦 ${camera.name}: Nuevo segmento HLS generado`)
      }
    })

    streamProcess.on('error', (error) => {
      console.error(`❌ Error stream HLS ${camera.name}:`, error.message)
    })

    streamProcess.on('close', (code) => {
      console.log(`🔴 Stream HLS ${camera.name} cerrado. Código: ${code}`)
      this.rtspProcesses.delete(streamKey)
    })

    this.rtspProcesses.set(streamKey, streamProcess)

    return {
      streamKey,
      hlsUrl: `http://localhost:${config.http.port}/live/${streamKey}/index.m3u8`
    }
  }

  /**
   * Inicia grabación continua en segmentos
   */
  startRecording(camera, streamKey) {
    const cameraDir = path.join(RECORDINGS_DIR, `camera_${camera.id}`)
    
    if (!fs.existsSync(cameraDir)) {
      fs.mkdirSync(cameraDir, { recursive: true })
    }

    // Formato: YYYY-MM-DD_HH-MM-SS_XXX.mp4
    // Ejemplo: 2025-11-03_14-30-45_001.mp4
    const outputPattern = path.join(cameraDir, '%Y-%m-%d_%H-%M-%S_%%03d.mp4')

    console.log(`💾 Iniciando grabación: ${camera.name}`)
    console.log(`📁 Guardando en: ${cameraDir}`)

    const recordArgs = [
      '-rtsp_transport', 'tcp',
      '-i', camera.rtspUrl,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-f', 'segment',
      '-segment_time', '3600', // 1 hora por archivo
      '-segment_format', 'mp4',
      '-reset_timestamps', '1',
      '-strftime', '1',
      outputPattern
    ]

    const recordProcess = spawn('ffmpeg', recordArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    recordProcess.stderr.on('data', (data) => {
      const output = data.toString()
      if (output.includes('Opening') && output.includes('.mp4')) {
        console.log(`💾 Nuevo archivo de grabación creado para ${camera.name}`)
      }
    })

    recordProcess.on('error', (error) => {
      console.error(`❌ Error grabación ${camera.name}:`, error.message)
    })

    recordProcess.on('close', (code) => {
      console.log(`🔴 Grabación ${camera.name} cerrada. Código: ${code}`)
      this.recordingProcesses.delete(`${streamKey}_recording`)
    })

    this.recordingProcesses.set(`${streamKey}_recording`, recordProcess)
  }

  /**
   * Detiene grabación de una cámara específica
   */
  stopCamera(cameraId) {
    const streamKey = `camera_${cameraId}`
    
    // Detener grabación
    const recordKey = `${streamKey}_recording`
    const recordProcess = this.recordingProcesses.get(recordKey)
    if (recordProcess) {
      recordProcess.kill('SIGTERM')
      this.recordingProcesses.delete(recordKey)
      console.log(`🛑 Grabación detenida: camera_${cameraId}`)
    }
  }

  /**
   * Detiene stream HLS de una cámara específica
   */
  stopHLSStream(cameraId) {
    const streamKey = `camera_${cameraId}`
    
    // Detener stream HLS
    const streamProcess = this.rtspProcesses.get(streamKey)
    if (streamProcess) {
      streamProcess.kill('SIGTERM')
      this.rtspProcesses.delete(streamKey)
      console.log(`🛑 Stream HLS detenido: camera_${cameraId}`)
    }
  }

  /**
   * Obtiene lista de grabaciones de una cámara
   */
  getRecordings(cameraId) {
    const cameraDir = path.join(RECORDINGS_DIR, `camera_${cameraId}`)
    
    if (!fs.existsSync(cameraDir)) {
      return []
    }

    const files = fs.readdirSync(cameraDir)
      .filter(file => file.endsWith('.mp4'))
      .map(file => {
        const filePath = path.join(cameraDir, file)
        const stats = fs.statSync(filePath)
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          path: filePath
        }
      })
      .sort((a, b) => b.created - a.created)

    return files
  }

  /**
   * Estado de las cámaras activas
   */
  getStatus() {
    return {
      streaming: Array.from(this.rtspProcesses.keys()),
      recording: Array.from(this.recordingProcesses.keys()),
      mediaServer: this.nms ? 'running' : 'stopped'
    }
  }
}

// Singleton
const mediaServerManager = new MediaServerManager()

export default mediaServerManager
