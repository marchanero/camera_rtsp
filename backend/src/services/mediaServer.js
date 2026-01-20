import NodeMediaServer from 'node-media-server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import videoProcessor from './videoProcessor.js'

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

  /**
   * Mata todos los procesos FFmpeg huérfanos (limpieza al iniciar)
   */
  async killOrphanProcesses() {
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execPromise = promisify(exec)
      
      // Buscar procesos FFmpeg que estén grabando en nuestra carpeta
      const { stdout } = await execPromise('ps aux | grep ffmpeg | grep recordings | grep -v grep || true')
      
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n')
        console.log(`⚠️ Encontrados ${lines.length} procesos FFmpeg huérfanos, limpiando...`)
        
        for (const line of lines) {
          const pid = line.trim().split(/\s+/)[1]
          if (pid && !isNaN(pid)) {
            try {
              process.kill(parseInt(pid), 'SIGTERM')
              console.log(`🧹 Proceso FFmpeg ${pid} terminado`)
            } catch (error) {
              console.log(`⚠️ No se pudo terminar proceso ${pid}:`, error.message)
            }
          }
        }
        
        // Esperar 1 segundo para que terminen
        await new Promise(resolve => setTimeout(resolve, 1000))
        console.log('✅ Limpieza de procesos completada')
      } else {
        console.log('✅ No hay procesos FFmpeg huérfanos')
      }
    } catch (error) {
      console.error('❌ Error limpiando procesos:', error.message)
    }
  }

  async start() {
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

    this.recordingProcesses.forEach((recordingData, key) => {
      console.log(`🛑 Deteniendo grabación: ${key}`)
      recordingData.process.kill('SIGTERM')
    })
    this.recordingProcesses.clear()

    if (this.nms && typeof this.nms.stop === 'function') {
      this.nms.stop()
      console.log('🛑 Media Server detenido')
    }
  }

  /**
   * Inicia SOLO grabación de una cámara (sin HLS streaming)
   * Grabación continua sin pérdida de calidad usando codec copy
   */
  startCamera(camera, scenarioId = null, scenarioName = null) {
    const streamKey = `camera_${camera.id}`
    
    console.log('🎥 mediaServer.startCamera llamado:', {
      cameraId: camera.id,
      cameraName: camera.name,
      scenarioId,
      scenarioName,
      hasScenarioId: !!scenarioId,
      hasScenarioName: !!scenarioName
    })
    
    // Verificar si ya está grabando
    const recordKey = `${streamKey}_recording`
    if (this.recordingProcesses.has(recordKey)) {
      console.log(`⚠️ Grabación ya activa para ${camera.name}`)
      return { streamKey, message: 'Ya está grabando' }
    }

    const scenarioInfo = scenarioName ? ` (Escenario: ${scenarioName})` : ''
    console.log(`💾 Iniciando grabación continua: ${camera.name}${scenarioInfo}`)
    
    // Solo iniciar grabación (sin HLS)
    this.startRecording(camera, streamKey, { scenarioId, scenarioName })

    return {
      streamKey,
      message: 'Grabación iniciada (sin pérdida de calidad)',
      recording: true,
      scenarioId: scenarioId,
      scenarioName: scenarioName
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
   * @param {Object} camera - Objeto cámara con id y name
   * @param {string} streamKey - Key del stream (ej: camera_1)
   * @param {Object} options - Opciones de grabación
   * @param {number} options.scenarioId - ID del escenario
   * @param {string} options.scenarioName - Nombre del escenario
   */
  startRecording(camera, streamKey, options = {}) {
    const { scenarioId, scenarioName } = options
    
    console.log('📹 mediaServer.startRecording llamado:', {
      cameraId: camera.id,
      cameraName: camera.name,
      options,
      scenarioId,
      scenarioName,
      hasScenarioId: !!scenarioId,
      hasScenarioName: !!scenarioName
    })
    
    // Nueva estructura: recordings/{scenarioName}/{fecha}/camera_{id}/
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const scenarioFolder = scenarioName ? scenarioName.replace(/[^a-zA-Z0-9]/g, '_') : 'sin_escenario'
    const cameraDir = path.join(RECORDINGS_DIR, scenarioFolder, today, `camera_${camera.id}`)
    
    console.log('📂 Estructura de carpetas:', {
      scenarioFolder,
      cameraDir,
      RECORDINGS_DIR
    })
    
    if (!fs.existsSync(cameraDir)) {
      fs.mkdirSync(cameraDir, { recursive: true })
    }

    // Nuevo formato: {scenarioName}_{cameraName}_{YYYY-MM-DD_HH-MM-SS}_XXX.mp4
    // Ejemplo: Aula_A_Camara_Principal_2025-11-17_14-30-45_001.mp4
    const scenarioPrefix = scenarioName ? `${scenarioName.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''
    const cameraNameClean = camera.name.replace(/[^a-zA-Z0-9]/g, '_')
    const outputPattern = path.join(cameraDir, `${scenarioPrefix}${cameraNameClean}_%Y-%m-%d_%H-%M-%S_%%03d.mp4`)

    const scenarioInfo = scenarioName ? ` (Escenario: ${scenarioName})` : ''
    console.log(`💾 Iniciando grabación: ${camera.name}${scenarioInfo}`)
    console.log(`📁 Guardando en: ${cameraDir}`)

    const recordArgs = [
      '-rtsp_transport', 'tcp',
      '-i', camera.rtspUrl,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-f', 'segment',
      '-segment_time', '1200', // 20 minutos por archivo
      '-segment_format', 'mp4',
      '-segment_format_options', 'movflags=+faststart', // Optimizar para streaming
      '-reset_timestamps', '1',
      '-strftime', '1',
      '-avoid_negative_ts', 'make_zero', // Evitar timestamps negativos
      '-max_muxing_queue_size', '9999', // Prevenir pérdida de paquetes
      outputPattern
    ]

    const recordProcess = spawn('ffmpeg', recordArgs, {
      stdio: ['pipe', 'pipe', 'pipe'] // Habilitar stdin para poder enviar 'q'
    })

    recordProcess.stderr.on('data', (data) => {
      const output = data.toString()
      if (output.includes('Opening') && output.includes('.mp4')) {
        console.log(`💾 Nuevo archivo de grabación creado para ${camera.name}${scenarioInfo}`)
      }
    })

    recordProcess.on('error', (error) => {
      console.error(`❌ Error grabación ${camera.name}:`, error.message)
    })

    recordProcess.on('close', (code) => {
      console.log(`🔴 Grabación ${camera.name} cerrada. Código: ${code}`)
      this.recordingProcesses.delete(`${streamKey}_recording`)
    })

    this.recordingProcesses.set(`${streamKey}_recording`, {
      process: recordProcess,
      cameraId: camera.id,
      scenarioId,
      scenarioName,
      startTime: new Date(),
      outputDir: cameraDir
    })
  }

  /**
   * Detiene grabación de una cámara específica
   */
  stopCamera(cameraId) {
    const streamKey = `camera_${cameraId}`
    
    // Detener grabación
    const recordKey = `${streamKey}_recording`
    const recordingData = this.recordingProcesses.get(recordKey)
    if (recordingData) {
      const { process: recordProcess, scenarioName } = recordingData
      const scenarioInfo = scenarioName ? ` (Escenario: ${scenarioName})` : ''
      console.log(`🛑 Deteniendo grabación: camera_${cameraId}${scenarioInfo}`)
      
      // Enviar 'q' a FFmpeg para cerrar limpiamente el archivo
      try {
        recordProcess.stdin.write('q')
        recordProcess.stdin.end()
      } catch (error) {
        console.log(`⚠️ No se pudo enviar 'q' a FFmpeg, usando SIGTERM`)
      }
      
      // Timeout de seguridad: si no se cierra en 3 segundos, forzar
      const timeout = setTimeout(() => {
        if (this.recordingProcesses.has(recordKey)) {
          console.log(`⚠️ Forzando cierre de grabación: camera_${cameraId}`)
          recordProcess.kill('SIGKILL')
          this.recordingProcesses.delete(recordKey)
        }
      }, 3000)
      
      // Limpiar timeout cuando el proceso termine
      recordProcess.on('close', () => {
        clearTimeout(timeout)
        this.recordingProcesses.delete(recordKey)
        console.log(`✅ Grabación guardada correctamente: camera_${cameraId}${scenarioInfo}`)
        
        // Generar thumbnail automáticamente
        if (recordingData.outputDir) {
          this._generateThumbnailsForRecording(recordingData.outputDir, cameraId)
        }
      })
      
      return recordingData
    } else {
      console.log(`⚠️ No hay grabación activa para camera_${cameraId}`)
      return null
    }
  }

  /**
   * Genera thumbnails para los videos de una grabación
   * @private
   */
  async _generateThumbnailsForRecording(outputDir, cameraId) {
    try {
      // Esperar un momento para que el archivo se escriba completamente
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      if (!fs.existsSync(outputDir)) {
        console.log(`⚠️ Directorio de grabación no encontrado: ${outputDir}`)
        return
      }
      
      const files = fs.readdirSync(outputDir)
        .filter(f => f.endsWith('.mp4'))
        .sort() // Ordenar para obtener el más reciente
      
      if (files.length === 0) {
        console.log(`⚠️ No se encontraron videos en: ${outputDir}`)
        return
      }
      
      // Generar thumbnail del video más reciente
      const latestVideo = files[files.length - 1]
      const videoPath = path.join(outputDir, latestVideo)
      
      console.log(`🖼️ Generando thumbnail para: ${latestVideo}`)
      
      // Añadir a la cola de procesamiento con prioridad alta
      videoProcessor.addToQueue({
        type: 'thumbnail',
        videoPath,
        options: { timestamp: '00:00:03' },
        priority: 1,
        cameraId
      })
      
      console.log(`✅ Thumbnail añadido a la cola para camera_${cameraId}`)
    } catch (error) {
      console.error(`❌ Error generando thumbnail para camera_${cameraId}:`, error.message)
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
   * Busca en todas las carpetas de escenarios
   */
  getRecordings(cameraId, scenarioName = null) {
    const recordings = []
    
    // Si se especifica escenario, buscar solo en ese
    if (scenarioName) {
      const scenarioFolder = scenarioName.replace(/[^a-zA-Z0-9]/g, '_')
      const scenarioDir = path.join(RECORDINGS_DIR, scenarioFolder)
      
      if (fs.existsSync(scenarioDir)) {
        this._scanRecordingsInDir(scenarioDir, cameraId, recordings, scenarioName)
      }
    } else {
      // Buscar en todos los escenarios
      if (fs.existsSync(RECORDINGS_DIR)) {
        const scenarios = fs.readdirSync(RECORDINGS_DIR)
        
        for (const scenario of scenarios) {
          const scenarioPath = path.join(RECORDINGS_DIR, scenario)
          if (fs.statSync(scenarioPath).isDirectory()) {
            this._scanRecordingsInDir(scenarioPath, cameraId, recordings, scenario)
          }
        }
      }
    }

    return recordings.sort((a, b) => b.created - a.created)
  }

  /**
   * Escanea un directorio de escenario buscando grabaciones
   * @private
   */
  _scanRecordingsInDir(scenarioDir, cameraId, recordings, scenarioName) {
    // Recorrer fechas
    const dates = fs.readdirSync(scenarioDir)
    
    for (const date of dates) {
      const datePath = path.join(scenarioDir, date)
      if (!fs.statSync(datePath).isDirectory()) continue
      
      const cameraDir = path.join(datePath, `camera_${cameraId}`)
      
      if (fs.existsSync(cameraDir)) {
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
              path: filePath,
              scenarioName: scenarioName.replace(/_/g, ' '),
              date
            }
          })
        
        recordings.push(...files)
      }
    }
  }

  /**
   * Estado de las cámaras activas con información detallada
   */
  getStatus() {
    // Información detallada de grabaciones
    const recordingDetails = []
    for (const [key, data] of this.recordingProcesses.entries()) {
      // Extraer camera_X del key (ej: 'camera_1_recording' -> 'camera_1')
      const cameraKey = key.replace('_recording', '')
      recordingDetails.push({
        key: cameraKey,
        cameraId: data.cameraId,
        scenarioId: data.scenarioId,
        scenarioName: data.scenarioName,
        startTime: data.startTime?.toISOString(),
        elapsedSeconds: data.startTime ? Math.floor((Date.now() - data.startTime.getTime()) / 1000) : 0,
        outputDir: data.outputDir
      })
    }

    return {
      streaming: Array.from(this.rtspProcesses.keys()),
      recording: Array.from(this.recordingProcesses.keys()),
      recordingDetails,
      mediaServer: this.nms ? 'running' : 'stopped'
    }
  }

  /**
   * Verifica si una cámara está grabando
   */
  isRecording(cameraId) {
    return this.recordingProcesses.has(`camera_${cameraId}`)
  }

  /**
   * Obtiene información detallada de una grabación
   */
  getRecordingInfo(cameraId) {
    const recordKey = `camera_${cameraId}_recording`
    const data = this.recordingProcesses.get(recordKey)
    if (!data) return null
    
    return {
      cameraId: data.cameraId,
      scenarioId: data.scenarioId,
      scenarioName: data.scenarioName,
      startTime: data.startTime?.toISOString(),
      elapsedSeconds: data.startTime ? Math.floor((Date.now() - data.startTime.getTime()) / 1000) : 0,
      outputDir: data.outputDir
    }
  }

  /**
   * Verifica si una cámara está streaming
   */
  isStreaming(cameraId) {
    return this.rtspProcesses.has(`camera_${cameraId}`)
  }

  /**
   * Cierre graceful: detiene todas las grabaciones limpiamente
   */
  async gracefulStop() {
    console.log('🛑 Iniciando cierre graceful de grabaciones...')
    
    const recordingKeys = Array.from(this.recordingProcesses.keys())
    const stopPromises = []

    for (const key of recordingKeys) {
      const recordingData = this.recordingProcesses.get(key)
      if (recordingData) {
        const promise = new Promise((resolve) => {
          // Enviar 'q' para cerrar limpiamente
          try {
            recordingData.process.stdin.write('q')
            recordingData.process.stdin.end()
          } catch (error) {
            console.log(`⚠️ Error enviando 'q' a ${key}:`, error.message)
          }

          // Timeout de 5 segundos para cada proceso
          const timeout = setTimeout(() => {
            if (this.recordingProcesses.has(key)) {
              console.log(`⚠️ Forzando cierre de ${key}`)
              recordingData.process.kill('SIGKILL')
            }
            resolve()
          }, 5000)

          recordingData.process.on('close', () => {
            clearTimeout(timeout)
            console.log(`✅ Grabación cerrada: ${key}`)
            resolve()
          })
        })
        
        stopPromises.push(promise)
      }
    }

    // Esperar a que todas las grabaciones se cierren
    await Promise.all(stopPromises)
    
    // Limpiar Map
    this.recordingProcesses.clear()
    console.log('✅ Todas las grabaciones cerradas correctamente')
  }
}

// Singleton
const mediaServerManager = new MediaServerManager()

export default mediaServerManager
