import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'

// Directorio de grabaciones
const RECORDINGS_DIR = path.join(process.cwd(), 'recordings')

/**
 * RecordingManager - Gestión resiliente de grabaciones
 * 
 * Características:
 * - Reconexión automática cuando el stream se cae
 * - Monitoreo de salud del stream
 * - Reintentos configurables
 * - Estadísticas de grabación
 * - Eventos para integración con otros servicios
 */
class RecordingManager extends EventEmitter {
  constructor() {
    super()
    
    // Procesos de grabación activos
    this.recordings = new Map()
    
    // Configuración por defecto
    this.config = {
      // Reconexión automática
      autoReconnect: true,
      reconnectDelay: 5000,     // 5 segundos entre reintentos
      maxReconnectAttempts: 10, // Máximo reintentos (0 = infinito)
      
      // Monitoreo de salud
      healthCheckInterval: 30000, // Verificar cada 30 segundos
      staleTimeout: 300000,        // 5 minutos sin actividad - más tolerante para streams estables
      
      // Segmentación optimizada para memoria
      // Segmentación optimizada para memoria
      segmentTime: 3600,          // 1 hora por archivo (antes 5 min)
                                  // Evita que el usuario perciba "cortes" cada 5 min
      
      // Límites de memoria FFmpeg
      inputBufferSize: '16M',     // Buffer de entrada RTSP (antes ilimitado)
      maxMuxingQueue: 512,        // Cola de muxing (antes 9999)
      analyzeDuration: '2M',      // Tiempo de análisis inicial
      probeSize: '2M',            // Tamaño de probe inicial
      
      // FFmpeg
      ffmpegPath: 'ffmpeg'
    }
    
    // Timer de monitoreo de salud
    this.healthCheckTimer = null
    
    // Crear directorio si no existe
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
    }
  }

  /**
   * Inicia el monitoreo de salud
   */
  startHealthMonitor() {
    if (this.healthCheckTimer) return
    
    console.log('💓 Iniciando monitoreo de salud de grabaciones')
    
    this.healthCheckTimer = setInterval(() => {
      this.checkRecordingsHealth()
    }, this.config.healthCheckInterval)
  }

  /**
   * Detiene el monitoreo de salud
   */
  stopHealthMonitor() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  /**
   * Verifica la salud de todas las grabaciones
   */
  checkRecordingsHealth() {
    const now = Date.now()
    
    this.recordings.forEach((recording, key) => {
      // Verificar si el proceso sigue vivo
      if (!recording.process || recording.process.killed) {
        console.log(`⚠️ Grabación ${key} - proceso muerto`)
        this.handleRecordingFailure(key, recording, 'Proceso terminado inesperadamente')
        return
      }
      
      // Verificar actividad secundaria: tamaño del archivo
      // Si el archivo sigue creciendo, la grabación está activa
      try {
        if (recording.outputDir && fs.existsSync(recording.outputDir)) {
          const files = fs.readdirSync(recording.outputDir).filter(f => f.endsWith('.mp4'))
          if (files.length > 0) {
            const latestFile = path.join(recording.outputDir, files[files.length - 1])
            if (fs.existsSync(latestFile)) {
              const currentSize = fs.statSync(latestFile).size
              if (recording.lastFileSize !== undefined && currentSize > recording.lastFileSize) {
                // El archivo sigue creciendo, actualizar actividad
                recording.lastActivity = now
              }
              recording.lastFileSize = currentSize
            }
          }
        }
      } catch (fsError) {
        // Ignorar errores de filesystem, usar solo lastActivity de stderr
      }
      
      // Verificar última actividad
      const timeSinceActivity = now - recording.lastActivity
      if (timeSinceActivity > this.config.staleTimeout) {
        console.log(`⚠️ Grabación ${key} - sin actividad por ${Math.round(timeSinceActivity / 1000)}s`)
        this.handleRecordingFailure(key, recording, 'Sin actividad (stream congelado)')
        return
      }
      
      // Todo OK
      recording.healthChecks++
    })
  }

  /**
   * Maneja fallo de grabación e intenta reconectar
   */
  async handleRecordingFailure(key, recording, reason) {
    console.log(`❌ Fallo en grabación ${key}: ${reason}`)
    
    // Emitir evento
    this.emit('recordingFailed', {
      cameraId: recording.cameraId,
      cameraName: recording.cameraName,
      reason,
      reconnectAttempt: recording.reconnectAttempts
    })
    
    // Matar proceso si aún existe
    if (recording.process && !recording.process.killed) {
      try {
        recording.process.kill('SIGKILL')
      } catch (e) {
        // Ignorar
      }
    }
    
    // Verificar si debemos reconectar
    if (!this.config.autoReconnect) {
      console.log(`🚫 Reconexión automática deshabilitada`)
      this.recordings.delete(key)
      return
    }
    
    // Verificar límite de reintentos
    if (this.config.maxReconnectAttempts > 0 && 
        recording.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log(`🚫 Máximo de reintentos alcanzado (${this.config.maxReconnectAttempts})`)
      this.recordings.delete(key)
      
      this.emit('recordingAbandoned', {
        cameraId: recording.cameraId,
        cameraName: recording.cameraName,
        totalAttempts: recording.reconnectAttempts
      })
      return
    }
    
    // Esperar antes de reconectar
    recording.reconnectAttempts++
    const delay = this.config.reconnectDelay * Math.min(recording.reconnectAttempts, 5) // Backoff
    
    console.log(`🔄 Reconectando en ${delay / 1000}s (intento ${recording.reconnectAttempts})...`)
    
    await new Promise(resolve => setTimeout(resolve, delay))
    
    // Verificar si todavía debemos reconectar (podría haberse detenido manualmente)
    if (!this.recordings.has(key)) {
      console.log(`⏹️ Grabación ${key} fue detenida, cancelando reconexión`)
      return
    }
    
    // Reconectar
    this.restartRecording(key, recording)
  }

  /**
   * Reinicia una grabación
   */
  restartRecording(key, oldRecording) {
    console.log(`🔄 Reiniciando grabación: ${oldRecording.cameraName}`)
    
    const camera = {
      id: oldRecording.cameraId,
      name: oldRecording.cameraName,
      rtspUrl: oldRecording.rtspUrl
    }
    
    // Usar la misma configuración
    this.startRecording(camera, {
      scenarioId: oldRecording.scenarioId,
      scenarioName: oldRecording.scenarioName,
      reconnectAttempts: oldRecording.reconnectAttempts
    })
  }

  /**
   * Inicia grabación de una cámara
   */
  startRecording(camera, options = {}) {
    const key = `camera_${camera.id}`
    
    // Verificar si ya está grabando
    if (this.recordings.has(key)) {
      const existing = this.recordings.get(key)
      if (existing.process && !existing.process.killed) {
        console.log(`⚠️ Grabación ya activa para ${camera.name}`)
        return { success: false, message: 'Ya está grabando' }
      }
    }
    
    const { scenarioId, scenarioName, reconnectAttempts = 0 } = options
    
    // Construir ruta de salida
    const today = new Date().toISOString().split('T')[0]
    const scenarioFolder = scenarioName ? scenarioName.replace(/[^a-zA-Z0-9]/g, '_') : 'sin_escenario'
    const cameraDir = path.join(RECORDINGS_DIR, scenarioFolder, today, `camera_${camera.id}`)
    
    if (!fs.existsSync(cameraDir)) {
      fs.mkdirSync(cameraDir, { recursive: true })
    }
    
    const scenarioPrefix = scenarioName ? `${scenarioName.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''
    const cameraNameClean = camera.name.replace(/[^a-zA-Z0-9]/g, '_')
    const outputPattern = path.join(cameraDir, `${scenarioPrefix}${cameraNameClean}_%Y-%m-%d_%H-%M-%S_%%03d.mp4`)
    
    const scenarioInfo = scenarioName ? ` (Escenario: ${scenarioName})` : ''
    console.log(`💾 Iniciando grabación resiliente: ${camera.name}${scenarioInfo}`)
    
    // Argumentos FFmpeg optimizados para bajo consumo de memoria
    // 
    // OPTIMIZACIONES DE MEMORIA:
    // 1. Segmentos de 5 min (antes 1h) - reduce buffer en memoria
    // 2. rtbufsize limita buffer RTSP a 16MB
    // 3. max_muxing_queue_size reducido de 9999 a 512
    // 4. analyzeduration/probesize limitan análisis inicial
    // 5. fflags +genpts+discardcorrupt evita acumulación de frames corruptos
    //
    // NOTA: Las opciones -reconnect* son solo para HTTP/HTTPS, NO para RTSP
    // Para RTSP usamos -timeout para timeout de conexión
    //
    const ffmpegArgs = [
      // ===== OPCIONES GLOBALES =====
      '-hide_banner',
      
      // ===== OPCIONES DE ENTRADA RTSP =====
      '-rtbufsize', this.config.inputBufferSize,  // Buffer circular RTSP (16MB)
      '-analyzeduration', this.config.analyzeDuration,  // Límite análisis stream
      '-probesize', this.config.probeSize,              // Límite probe inicial
      '-rtsp_transport', 'tcp',
      '-timeout', '5000000',     // Timeout de conexión 5s (microsegundos, FFmpeg 6.x)
      '-fflags', '+genpts+discardcorrupt',  // Generar timestamps, descartar frames corruptos
      
      // ===== INPUT =====
      '-i', camera.rtspUrl,
      
      // ===== CODEC (copy = sin transcodificación = menos CPU/RAM) =====
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      
      // ===== SEGMENTACIÓN OPTIMIZADA =====
      '-f', 'segment',
      '-segment_time', this.config.segmentTime.toString(),  // 5 minutos
      '-segment_format', 'mp4',
      '-reset_timestamps', '1',
      '-strftime', '1',
      
      // ===== OPCIONES DE SALIDA =====
      '-avoid_negative_ts', 'make_zero',
      '-max_muxing_queue_size', this.config.maxMuxingQueue.toString(),  // 512 (antes 9999)
      '-flush_packets', '1',  // Escribir paquetes inmediatamente
      
      outputPattern
    ]
    
    // DEBUG: Mostrar comando completo
    console.log(`🔧 FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`)
    
    const ffmpegProcess = spawn(this.config.ffmpegPath, ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    // Crear registro de grabación
    const recording = {
      cameraId: camera.id,
      cameraName: camera.name,
      rtspUrl: camera.rtspUrl,
      scenarioId,
      scenarioName,
      process: ffmpegProcess,
      startTime: new Date(),
      lastActivity: Date.now(),
      outputDir: cameraDir,
      reconnectAttempts,
      healthChecks: 0,
      framesProcessed: 0,
      bytesWritten: 0,
      errors: []
    }
    
    // Monitorear stderr para actividad y errores
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString()
      recording.lastActivity = Date.now()
      
      // Contar frames
      const frameMatch = output.match(/frame=\s*(\d+)/)
      if (frameMatch) {
        recording.framesProcessed = parseInt(frameMatch[1])
      }
      
      // Detectar nuevo archivo
      // Output típico: [segment @ ...] Opening 'path/to/file.mp4' for writing
      if (output.includes('Opening') && output.includes('.mp4')) {
        const match = output.match(/Opening '(.+?)'/)
        const fullPath = match ? match[1] : null
        const filename = fullPath ? path.basename(fullPath) : null
        
        if (filename) {
          console.log(`💾 Nuevo archivo detectado: ${filename}`)
          this.emit('newFile', {
            cameraId: camera.id,
            cameraName: camera.name,
            outputDir: cameraDir,
            filename: filename,
            fullPath: fullPath,
            timestamp: new Date()
          })
        }
      }
      
      // Detectar errores
      if (output.includes('Error') || output.includes('error')) {
        const errorLine = output.split('\n').find(l => l.includes('error') || l.includes('Error'))
        if (errorLine) {
          recording.errors.push({
            timestamp: new Date(),
            message: errorLine.trim()
          })
          console.error(`⚠️ FFmpeg ${camera.name}: ${errorLine.trim()}`)
        }
      }
      
      // Resetear contador de reconexión si hay actividad exitosa
      if (recording.framesProcessed > 100 && recording.reconnectAttempts > 0) {
        console.log(`✅ Grabación ${camera.name} estabilizada, reseteando contador de reconexión`)
        recording.reconnectAttempts = 0
      }
    })
    
    // Manejar errores del proceso
    ffmpegProcess.on('error', (error) => {
      console.error(`❌ Error de proceso FFmpeg ${camera.name}:`, error.message)
      this.handleRecordingFailure(key, recording, `Error de proceso: ${error.message}`)
    })
    
    // Manejar cierre del proceso
    ffmpegProcess.on('close', (code, signal) => {
      console.log(`🔴 FFmpeg ${camera.name} cerrado. Código: ${code}, Señal: ${signal}`)
      
      // Si fue un cierre inesperado (no fue detenido manualmente), intentar reconectar
      if (code !== 0 && this.recordings.has(key)) {
        const reason = signal ? `Señal ${signal}` : `Código de salida ${code}`
        this.handleRecordingFailure(key, recording, reason)
      }
    })
    
    // Guardar registro
    this.recordings.set(key, recording)
    
    // Emitir evento
    this.emit('recordingStarted', {
      cameraId: camera.id,
      cameraName: camera.name,
      scenarioId,
      scenarioName,
      outputDir: cameraDir
    })
    
    // Iniciar monitor de salud si no está corriendo
    this.startHealthMonitor()
    
    return {
      success: true,
      key,
      outputDir: cameraDir
    }
  }

  /**
   * Detiene grabación de una cámara
   */
  stopRecording(cameraId) {
    const key = `camera_${cameraId}`
    const recording = this.recordings.get(key)
    
    if (!recording) {
      console.log(`⚠️ No hay grabación activa para camera_${cameraId}`)
      return { success: false, message: 'No hay grabación activa' }
    }
    
    const scenarioInfo = recording.scenarioName ? ` (Escenario: ${recording.scenarioName})` : ''
    console.log(`🛑 Deteniendo grabación: ${recording.cameraName}${scenarioInfo}`)
    
    // Remover del mapa primero (para evitar reconexión)
    this.recordings.delete(key)
    
    return new Promise((resolve) => {
      // Enviar 'q' para cierre limpio
      try {
        recording.process.stdin.write('q')
        recording.process.stdin.end()
      } catch (error) {
        console.log(`⚠️ No se pudo enviar 'q', usando SIGTERM`)
      }
      
      // Timeout de seguridad
      const timeout = setTimeout(() => {
        if (recording.process && !recording.process.killed) {
          console.log(`⚠️ Forzando cierre de grabación: camera_${cameraId}`)
          recording.process.kill('SIGKILL')
        }
        resolve({
          success: true,
          duration: Date.now() - recording.startTime.getTime(),
          framesProcessed: recording.framesProcessed
        })
      }, 3000)
      
      recording.process.on('close', () => {
        clearTimeout(timeout)
        console.log(`✅ Grabación guardada: ${recording.cameraName}${scenarioInfo}`)
        
        this.emit('recordingStopped', {
          cameraId: recording.cameraId,
          cameraName: recording.cameraName,
          duration: Date.now() - recording.startTime.getTime(),
          framesProcessed: recording.framesProcessed,
          outputDir: recording.outputDir,
          scenarioName: recording.scenarioName
        })
        
        resolve({
          success: true,
          duration: Date.now() - recording.startTime.getTime(),
          framesProcessed: recording.framesProcessed
        })
      })
    })
  }

  /**
   * Verifica si una cámara está grabando
   */
  isRecording(cameraId) {
    const key = `camera_${cameraId}`
    const recording = this.recordings.get(key)
    return recording && recording.process && !recording.process.killed
  }

  /**
   * Obtiene estadísticas de una grabación
   */
  getRecordingStats(cameraId) {
    const key = `camera_${cameraId}`
    const recording = this.recordings.get(key)
    
    if (!recording) return null
    
    return {
      cameraId: recording.cameraId,
      cameraName: recording.cameraName,
      scenarioName: recording.scenarioName,
      startTime: recording.startTime,
      duration: Date.now() - recording.startTime.getTime(),
      framesProcessed: recording.framesProcessed,
      reconnectAttempts: recording.reconnectAttempts,
      healthChecks: recording.healthChecks,
      errors: recording.errors.slice(-5), // Últimos 5 errores
      outputDir: recording.outputDir,
      isHealthy: recording.process && !recording.process.killed,
      lastActivity: recording.lastActivity
    }
  }

  /**
   * Obtiene estado de todas las grabaciones
   */
  getAllRecordingsStatus() {
    const status = []
    
    this.recordings.forEach((recording, key) => {
      status.push(this.getRecordingStats(recording.cameraId))
    })
    
    return status
  }

  /**
   * Actualiza configuración
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig)
    console.log('⚙️ Configuración de RecordingManager actualizada:', this.config)
  }

  /**
   * Detiene todas las grabaciones
   */
  async stopAll() {
    console.log('🛑 Deteniendo todas las grabaciones...')
    
    const promises = []
    this.recordings.forEach((recording, key) => {
      promises.push(this.stopRecording(recording.cameraId))
    })
    
    await Promise.all(promises)
    this.stopHealthMonitor()
    
    console.log('✅ Todas las grabaciones detenidas')
  }

  /**
   * Cierre graceful
   */
  async gracefulStop() {
    console.log('🛑 Iniciando cierre graceful de RecordingManager...')
    await this.stopAll()
  }

  /**
   * Consolida todos los segmentos MP4 en un solo archivo
   * Usa ffmpeg concat demuxer para unión sin re-codificación (instantánea)
   * @param {string} outputDir - Directorio con los segmentos
   * @param {Object} options - Opciones de consolidación
   * @param {string} options.scenarioName - Nombre del escenario
   * @param {string} options.cameraName - Nombre de la cámara
   * @param {boolean} options.deleteSegments - Si eliminar segmentos después (default: false)
   * @returns {Promise<{success: boolean, outputFile?: string, error?: string}>}
   */
  async consolidateSegments(outputDir, options = {}) {
    const { scenarioName = '', cameraName = '', deleteSegments = false } = options
    
    console.log(`📦 Iniciando consolidación de segmentos en: ${outputDir}`)
    
    try {
      // Verificar que el directorio existe
      if (!fs.existsSync(outputDir)) {
        return { success: false, error: 'Directorio no encontrado' }
      }
      
      // Obtener lista de segmentos MP4 ordenados
      const segments = fs.readdirSync(outputDir)
        .filter(f => f.endsWith('.mp4'))
        .sort()
      
      if (segments.length === 0) {
        return { success: false, error: 'No hay segmentos para consolidar' }
      }
      
      if (segments.length === 1) {
        console.log(`📦 Solo hay 1 segmento, renombrando como completo...`)
        const singleFile = path.join(outputDir, segments[0])
        const consolidatedName = this._generateConsolidatedName(outputDir, scenarioName, cameraName)
        const consolidatedPath = path.join(outputDir, consolidatedName)
        
        // Renombrar el único segmento
        fs.renameSync(singleFile, consolidatedPath)
        
        return { 
          success: true, 
          outputFile: consolidatedPath,
          segmentsCount: 1,
          message: 'Único segmento renombrado'
        }
      }
      
      console.log(`📦 Consolidando ${segments.length} segmentos...`)
      
      // Crear archivo de lista para ffmpeg concat demuxer
      const listFile = path.join(outputDir, 'concat_list.txt')
      const listContent = segments.map(s => `file '${s}'`).join('\n')
      fs.writeFileSync(listFile, listContent)
      
      // Generar nombre del archivo consolidado
      const consolidatedName = this._generateConsolidatedName(outputDir, scenarioName, cameraName)
      const consolidatedPath = path.join(outputDir, consolidatedName)
      
      // Ejecutar ffmpeg concat (sin re-codificación)
      const result = await this._runFFmpegConcat(listFile, consolidatedPath)
      
      // Limpiar archivo de lista
      fs.unlinkSync(listFile)
      
      if (result.success) {
        console.log(`✅ Consolidación completada: ${consolidatedName}`)
        
        // Opcionalmente eliminar segmentos originales
        if (deleteSegments) {
          console.log(`🗑️ Eliminando ${segments.length} segmentos originales...`)
          for (const segment of segments) {
            const segmentPath = path.join(outputDir, segment)
            if (fs.existsSync(segmentPath)) {
              fs.unlinkSync(segmentPath)
            }
          }
          console.log(`✅ Segmentos eliminados`)
        }
        
        return {
          success: true,
          outputFile: consolidatedPath,
          segmentsCount: segments.length,
          deleteSegments
        }
      } else {
        return { success: false, error: result.error }
      }
      
    } catch (error) {
      console.error(`❌ Error consolidando segmentos:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Genera nombre para archivo consolidado
   * @private
   */
  _generateConsolidatedName(outputDir, scenarioName, cameraName) {
    const date = new Date().toISOString().split('T')[0]
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-')
    const scenario = scenarioName ? `${scenarioName.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''
    const camera = cameraName ? `${cameraName.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''
    
    return `${scenario}${camera}${date}_${time}_COMPLETO.mp4`
  }

  /**
   * Ejecuta ffmpeg concat demuxer
   * @private
   */
  _runFFmpegConcat(listFile, outputPath) {
    return new Promise((resolve) => {
      const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c', 'copy',  // No re-codificación, solo copia
        '-movflags', '+faststart',  // Optimizar para streaming
        outputPath
      ]
      
      console.log(`🎬 Ejecutando: ffmpeg ${args.join(' ')}`)
      
      const ffmpeg = spawn('ffmpeg', args, {
        cwd: path.dirname(listFile),
        stdio: ['ignore', 'pipe', 'pipe']
      })
      
      let stderr = ''
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          console.error(`❌ FFmpeg concat falló:`, stderr.slice(-500))
          resolve({ success: false, error: `FFmpeg exit code: ${code}` })
        }
      })
      
      ffmpeg.on('error', (error) => {
        resolve({ success: false, error: error.message })
      })
    })
  }
}

// Singleton
const recordingManager = new RecordingManager()

export default recordingManager
