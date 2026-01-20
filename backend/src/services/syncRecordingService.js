import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import recordingManager from './recordingManager.js'
import sensorRecorder from './sensorRecorder.js'
import mqttRecordingService from './mqttRecordingService.js'

const prisma = new PrismaClient()

/**
 * SyncRecordingService - Coordina grabación sincronizada de video y sensores
 * 
 * Garantiza:
 * - Timestamp maestro único para toda la sesión
 * - ID de sesión compartido entre video y sensores
 * - Generación de manifest.json al finalizar
 * - Registro de offsets de sincronización
 * - Persistencia en base de datos (Prisma)
 */
class SyncRecordingService extends EventEmitter {
  constructor() {
    super()
    this.activeSessions = new Map() // cameraId -> session data
    this.recordingsDir = path.join(process.cwd(), 'recordings')
    // Escuchar nuevos archivos de video para asociarlos a la sesión activa
    recordingManager.on('newFile', (data) => {
      const session = this.activeSessions.get(data.cameraId)
      if (session) {
        console.log(`📎 Asociando archivo ${data.filename} a sesión ${session.sessionId}`)
        session.videoFiles.push({
          filename: data.filename,
          created: data.timestamp,
          path: data.fullPath
        })
      }
    })
  }

  /**
   * Inicializa el servicio y recupera estado previo
   */
  async init(prismaClient) {
    console.log('🔄 Inicializando SyncRecordingService...')
    
    try {
      // 1. Buscar grabaciones que quedaron abiertas (zombies)
      // Nota: Recording no tiene relación directa con Camera, solo cameraId
      const zombieRecordings = await prismaClient.recording.findMany({
        where: {
          endTime: null
        },
        include: {
          scenario: true
        }
      })
      
      console.log(`🔎 Encontradas ${zombieRecordings.length} grabaciones interrumpidas`)
      
      const now = new Date()
      
      // 2. Procesar cada grabación interrumpida
      for (const recording of zombieRecordings) {
        // Obtener cámara por separado ya que no hay relación definida en el schema
        const camera = await prismaClient.camera.findUnique({
          where: { id: recording.cameraId }
        })
        
        if (!camera) {
          console.log(`⚠️ Cámara ${recording.cameraId} no encontrada, omitiendo grabación ${recording.id}`)
          continue
        }
        
        console.log(`🩹 Recuperando grabación interrumpida para cámara ${camera.name} (ID: ${recording.cameraId})`)
        
        // A. Cerrar la grabación anterior en BD
        await prismaClient.recording.update({
          where: { id: recording.id },
          data: {
            endTime: now,
            duration: Math.floor((now - recording.startTime) / 1000), // Duración aproximada hasta el reinicio
            metadata: JSON.stringify({
              ...JSON.parse(recording.metadata || '{}'),
              closureReason: 'server_restart' // Marcar razón de cierre
            })
          }
        })
        
        // B. Reiniciar la grabación automáticamente
        if (camera && camera.isActive) {
          console.log(`▶️ Reiniciando grabación automáticamente para: ${camera.name}`)
          
          // Esperar un momento para asegurar que otros servicios (RTSP, etc) estén listos
          setTimeout(() => {
            this.startSyncRecording(camera, {
              scenarioId: recording.scenarioId,
              scenarioName: recording.scenario ? recording.scenario.name : null,
              // Mantener topics si estuvieran en metadata (opcional)
            }).catch(err => console.error(`❌ Error reiniciando grabación ${camera.name}:`, err))
          }, 5000)
        }
      }
      
    } catch (error) {
      console.error('❌ Error inicializando SyncRecordingService:', error)
    }
  }

  /**
   * Inicia grabación sincronizada para una cámara
   * @param {Object} camera - { id, name, rtspUrl }
   * @param {Object} options - { scenarioId, scenarioName, sensorTopics }
   */
  async startSyncRecording(camera, options = {}) {
    const { scenarioId, scenarioName, sensorTopics = [] } = options

    // Verificar si ya hay una sesión activa
    if (this.activeSessions.has(camera.id)) {
      console.log(`⚠️ Ya hay una sesión de grabación activa para cámara ${camera.id}`)
      return {
        success: false,
        error: 'Ya hay una grabación activa'
      }
    }

    // RESOLVER RTSP URL SI ES 'auto'
    // El frontend envía 'auto' para que el backend maneje la fuente real
    if (!camera.rtspUrl || camera.rtspUrl === 'auto') {
      try {
        console.log(`🔍 Resolviendo URL RTSP para cámara ${camera.id}...`)
        const dbCamera = await prisma.camera.findUnique({
          where: { id: parseInt(camera.id) }
        })
        
        if (dbCamera && dbCamera.rtspUrl) {
          camera.rtspUrl = dbCamera.rtspUrl
          console.log(`✅ URL RTSP resuelta: ${camera.rtspUrl}`)
        } else {
          throw new Error('No se pudo resolver la URL RTSP de la base de datos')
        }
      } catch (error) {
        console.error('❌ Error resolviendo RTSP URL:', error)
        return {
          success: false,
          error: `Error resolviendo URL de cámara: ${error.message}`
        }
      }
    }

    // === GENERAR CONTEXTO DE SESIÓN ===
    const sessionId = uuidv4()
    const masterTimestamp = new Date()
    const masterTimestampISO = masterTimestamp.toISOString()

    console.log(`\n🎬 ════════════════════════════════════════`)
    console.log(`   INICIANDO GRABACIÓN SINCRONIZADA`)
    console.log(`   Session ID: ${sessionId}`)
    console.log(`   Master Timestamp: ${masterTimestampISO}`)
    console.log(`   Cámara: ${camera.name}`)
    if (scenarioName) console.log(`   Escenario: ${scenarioName}`)
    console.log(`════════════════════════════════════════\n`)

    // Crear estructura de sesión en memoria
    const session = {
      sessionId,
      cameraId: camera.id,
      cameraName: camera.name,
      scenarioId,
      scenarioName,
      masterTimestamp,
      masterTimestampISO,
      videoStartTime: null,
      videoOffsetMs: null,
      sensorStartTime: null,
      sensorOffsetMs: null,
      status: 'starting',
      videoFiles: [],
      sensorFile: null,
      dbId: null // ID de registro en BD
    }

    this.activeSessions.set(camera.id, session)

    try {
      // === PERSISTENCIA INICIAL (BD) ===
      if (scenarioId) {
        try {
          const recordingRecord = await prisma.recording.create({
            data: {
              scenarioId: parseInt(scenarioId),
              cameraId: parseInt(camera.id),
              sessionId: sessionId,
              masterTime: masterTimestamp,
              startTime: masterTimestamp,
              metadata: JSON.stringify({
                cameraName: camera.name,
                scenarioName: scenarioName,
                sensorTopics: sensorTopics
              })
            }
          })
          session.dbId = recordingRecord.id
          console.log(`💾 Registro en BD creado: ID ${session.dbId}`)
        } catch (dbError) {
          console.error('⚠️ Error creando registro en BD (continuando sin persistencia):', dbError)
        }
      }

      // === INICIAR VIDEO (FFmpeg) ===
      const videoResult = recordingManager.startRecording(camera, {
        scenarioId,
        scenarioName
      })
      session.videoStartTime = new Date()
      session.videoOffsetMs = Date.now() - masterTimestamp.getTime()

      if (!videoResult.success) {
        throw new Error(`Error iniciando video: ${videoResult.message}`)
      }

      console.log(`📹 Video iniciado (offset: ${session.videoOffsetMs}ms)`)

      // === INICIAR SENSORES (JSONL) ===
      const sensorResult = sensorRecorder.startRecording(
        camera.id,
        camera.name,
        scenarioId,
        scenarioName
      )
      session.sensorStartTime = new Date()
      session.sensorOffsetMs = Date.now() - masterTimestamp.getTime()
      session.sensorFile = sensorResult.filename

      console.log(`📊 Sensores iniciados (offset: ${session.sensorOffsetMs}ms)`)

      // === HABILITAR GRABACIÓN MQTT ===
      mqttRecordingService.startRecordingForCamera(camera.id, {
        recordAllSensors: true,
        sensorIds: sensorTopics
      })

      console.log(`📡 Escucha MQTT habilitada`)

      // Calcular offset total
      const totalOffset = Math.abs(session.videoOffsetMs - session.sensorOffsetMs)
      console.log(`\n✅ Grabación sincronizada iniciada`)
      console.log(`   Offset Video-Sensores: ${totalOffset}ms`)

      session.status = 'recording'

      // Actualizar offset en BD si existe el registro
      if (session.dbId) {
        await prisma.recording.update({
          where: { id: session.dbId },
          data: {
            videoOffset: session.videoOffsetMs,
            sensorOffset: session.sensorOffsetMs
          }
        }).catch(e => console.error('Error actualizando offsets en DB:', e))
      }

      // Emitir evento
      this.emit('syncRecordingStarted', {
        sessionId,
        cameraId: camera.id,
        cameraName: camera.name,
        scenarioName,
        masterTimestamp: masterTimestampISO,
        offsets: {
          video: session.videoOffsetMs,
          sensor: session.sensorOffsetMs,
          total: totalOffset
        }
      })

      return {
        success: true,
        sessionId,
        masterTimestamp: masterTimestampISO,
        offsets: {
          video: session.videoOffsetMs,
          sensor: session.sensorOffsetMs,
          total: totalOffset
        }
      }

    } catch (error) {
      console.error(`❌ Error en grabación sincronizada:`, error)
      
      // Limpiar BD si se creó registro
      if (session.dbId) {
        prisma.recording.delete({ where: { id: session.dbId } }).catch(() => {})
      }

      // Limpiar estado parcial
      this.activeSessions.delete(camera.id)
      
      // Intentar detener lo que se haya iniciado
      try {
        recordingManager.stopRecording(camera.id)
        await sensorRecorder.stopRecording(camera.id)
        mqttRecordingService.stopRecordingForCamera(camera.id)
      } catch (cleanupError) {
        console.error(`⚠️ Error en limpieza:`, cleanupError)
      }

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Detiene grabación sincronizada y genera manifest
   */
  async stopSyncRecording(cameraId) {
    const session = this.activeSessions.get(cameraId)

    if (!session) {
      console.log(`⚠️ No hay sesión activa para cámara ${cameraId}`)
      return {
        success: false,
        error: 'No hay grabación activa'
      }
    }

    console.log(`\n🛑 ════════════════════════════════════════`)
    console.log(`   DETENIENDO GRABACIÓN SINCRONIZADA`)
    console.log(`   Session ID: ${session.sessionId}`)
    console.log(`════════════════════════════════════════\n`)

    session.status = 'stopping'
    const endTimestamp = new Date()

    try {
      // === DETENER VIDEO ===
      const videoResult = await recordingManager.stopRecording(cameraId)
      console.log(`📹 Video detenido`)

      // === DETENER SENSORES ===
      const sensorResult = await sensorRecorder.stopRecording(cameraId)
      console.log(`📊 Sensores detenidos (${sensorResult.recordCount} registros)`)

      // === DESHABILITAR MQTT ===
      mqttRecordingService.stopRecordingForCamera(cameraId)
      console.log(`📡 Escucha MQTT deshabilitada`)

      // === GENERAR MANIFEST ===
      const manifest = await this.generateManifest(session, endTimestamp, videoResult, sensorResult)

      // === ACTUALIZAR BD ===
      if (session.dbId) {
        try {
          await prisma.recording.update({
            where: { id: session.dbId },
            data: {
              endTime: endTimestamp,
              duration: manifest.duration,
              manifestPath: manifest.manifestPath,
              videoPath: manifestDirToFile(manifest.manifestPath, videoResult?.outputDir), // Helper simplificado
              sensorPath: sensorResult?.filepath,
              sensorRecords: sensorResult?.recordCount || 0
            }
          })
          console.log(`💾 Registro en BD actualizado`)
        } catch (dbError) {
          console.error('⚠️ Error actualizando BD:', dbError)
        }
      }

      // Limpiar sesión
      this.activeSessions.delete(cameraId)

      console.log(`\n✅ Grabación sincronizada finalizada`)
      console.log(`   Manifest: ${manifest.manifestPath}`)

      // === CONSOLIDAR SEGMENTOS (async, no bloquea) ===
      const outputDir = videoResult?.outputDir || path.dirname(manifest.manifestPath)
      this._consolidateInBackground(outputDir, {
        scenarioName: session.scenarioName,
        cameraName: session.cameraName,
        deleteSegments: false // Mantener segmentos por seguridad
      })

      // Emitir evento
      this.emit('syncRecordingStopped', {
        sessionId: session.sessionId,
        cameraId,
        manifestPath: manifest.manifestPath,
        duration: manifest.duration
      })

      return {
        success: true,
        sessionId: session.sessionId,
        manifest,
        duration: manifest.duration,
        sensorRecordCount: sensorResult.recordCount
      }

    } catch (error) {
      console.error(`❌ Error deteniendo grabación:`, error)
      
      // Limpiar de todos modos
      this.activeSessions.delete(cameraId)

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Genera archivo manifest.json con metadatos de sincronización
   */
  async generateManifest(session, endTimestamp, videoResult, sensorResult) {
    const duration = Math.floor((endTimestamp - session.masterTimestamp) / 1000)
    
    // Construir ruta del manifest
    const today = session.masterTimestamp.toISOString().split('T')[0]
    const scenarioFolder = session.scenarioName 
      ? session.scenarioName.replace(/[^a-zA-Z0-9]/g, '_') 
      : 'sin_escenario'
    const manifestDir = path.join(
      this.recordingsDir, 
      scenarioFolder, 
      today, 
      `camera_${session.cameraId}`
    )
    const manifestPath = path.join(manifestDir, `session_${session.sessionId.slice(0, 8)}.json`)

    // Listar archivos de video
    // Prioridad 1: Archivos rastreados durante la sesión (más preciso)
    // Prioridad 2: Escaneo de directorio (fallback)
    let videoFiles = []
    
    if (session.videoFiles && session.videoFiles.length > 0) {
      // Usar archivos rastreados
      videoFiles = session.videoFiles.map(f => {
        let size = 0
        try {
          if (f.path && fs.existsSync(f.path)) {
            size = fs.statSync(f.path).size
          } else {
             // Intentar construir path si no existe
             const probablePath = path.join(manifestDir, f.filename)
             if (fs.existsSync(probablePath)) size = fs.statSync(probablePath).size
          }
        } catch (e) { console.error('Error obteniendo tamaño:', e) }

        return {
          filename: f.filename,
          size: size,
          created: f.created
        }
      })
    } else if (fs.existsSync(manifestDir)) {
      // Fallback: Escanear directorio (riesgo de incluir archivos de otras sesiones)
      console.log('⚠️ Usando fallback de escaneo de directorio para manifest')
      videoFiles = fs.readdirSync(manifestDir)
        .filter(f => f.endsWith('.mp4'))
        .map(f => {
          const filePath = path.join(manifestDir, f)
          const stats = fs.statSync(filePath)
          return {
            filename: f,
            size: stats.size,
            created: stats.birthtime
          }
        })
        // Simple filtro por hora de creación (dentro del rango de sesión +/- margen)
        .filter(f => {
          const createdTime = new Date(f.created).getTime()
          const startTime = session.masterTimestamp.getTime()
          const endTime = endTimestamp.getTime()
          // Margen de 10 segundos
          return createdTime >= (startTime - 10000) && createdTime <= (endTime + 10000)
        })
    }

    const manifest = {
      version: '1.0',
      sessionId: session.sessionId,
      camera: {
        id: session.cameraId,
        name: session.cameraName
      },
      scenario: session.scenarioName ? {
        id: session.scenarioId,
        name: session.scenarioName
      } : null,
      timing: {
        masterTimestamp: session.masterTimestampISO,
        startTime: session.masterTimestamp.toISOString(),
        endTime: endTimestamp.toISOString(),
        durationSeconds: duration
      },
      synchronization: {
        videoOffsetMs: session.videoOffsetMs,
        sensorOffsetMs: session.sensorOffsetMs,
        totalOffsetMs: Math.abs(session.videoOffsetMs - session.sensorOffsetMs),
        note: 'Offset positivo indica que el componente inició después del masterTimestamp'
      },
      video: {
        files: videoFiles,
        framesProcessed: videoResult?.framesProcessed || 0
      },
      sensors: {
        filename: sensorResult?.filename || session.sensorFile,
        recordCount: sensorResult?.recordCount || 0,
        filepath: sensorResult?.filepath
      },
      generatedAt: new Date().toISOString()
    }

    // Escribir manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    
    console.log(`📄 Manifest generado: ${manifestPath}`)

    return {
      ...manifest,
      manifestPath
    }
  }

  /**
   * Obtiene estado de una sesión activa
   */
  getSessionStatus(cameraId) {
    const session = this.activeSessions.get(cameraId)
    if (!session) return null

    const now = new Date()
    const elapsedSeconds = Math.floor((now - session.masterTimestamp) / 1000)

    return {
      sessionId: session.sessionId,
      cameraId: session.cameraId,
      cameraName: session.cameraName,
      scenarioName: session.scenarioName,
      status: session.status,
      masterTimestamp: session.masterTimestampISO,
      startTime: session.masterTimestampISO, // Alias para compatibilidad
      duration: elapsedSeconds,
      elapsedSeconds: elapsedSeconds, // Campo explícito para el frontend
      offsets: {
        video: session.videoOffsetMs,
        sensor: session.sensorOffsetMs
      }
    }
  }

  /**
   * Obtiene estado de todas las sesiones activas
   */
  getAllSessionsStatus() {
    const sessions = []
    const now = new Date()
    for (const [cameraId] of this.activeSessions) {
      const sessionStatus = this.getSessionStatus(cameraId)
      if (sessionStatus) {
        // Agregar elapsedSeconds calculado en tiempo real
        sessionStatus.elapsedSeconds = Math.floor((now - this.activeSessions.get(cameraId).masterTimestamp) / 1000)
        sessions.push(sessionStatus)
      }
    }
    return sessions
  }

  /**
   * Verifica si hay una sesión activa para una cámara
   */
  isRecording(cameraId) {
    return this.activeSessions.has(cameraId)
  }

  /**
   * Detiene todas las sesiones activas
   */
  async stopAll() {
    console.log('🛑 Deteniendo todas las sesiones sincronizadas...')
    
    const promises = []
    for (const [cameraId] of this.activeSessions) {
      promises.push(this.stopSyncRecording(cameraId))
    }

    await Promise.all(promises)
    console.log('✅ Todas las sesiones detenidas')
  }

  /**
   * Consolida segmentos en background (async, no bloquea)
   * @private
   */
  _consolidateInBackground(outputDir, options) {
    // Ejecutar en background sin await
    recordingManager.consolidateSegments(outputDir, options)
      .then(result => {
        if (result.success) {
          console.log(`📦 Consolidación completada: ${result.outputFile}`)
          console.log(`   Segmentos procesados: ${result.segmentsCount}`)
        } else {
          console.error(`⚠️ Consolidación falló: ${result.error}`)
          console.log(`   Puedes consolidar manualmente con: POST /api/recordings/consolidate`)
        }
      })
      .catch(error => {
        console.error(`❌ Error en consolidación background:`, error)
      })
  }

  /**
   * Consolida manualmente los segmentos de una grabación
   * Útil para post-procesamiento si hubo error
   * @param {string} recordingPath - Ruta al directorio con segmentos
   * @param {Object} options - Opciones de consolidación
   * @returns {Promise<Object>} Resultado de la consolidación
   */
  async consolidateRecording(recordingPath, options = {}) {
    console.log(`📦 Consolidación manual solicitada para: ${recordingPath}`)
    return recordingManager.consolidateSegments(recordingPath, options)
  }
}

// Helper simple para obtener ruta de video válida para BD en caso de múltiples segmentos
function manifestDirToFile(manifestPath, outputDir) {
    if (!manifestPath) return null;
    return path.dirname(manifestPath); // Guardamos el directorio por ahora si hay multiples archivos
}


// Singleton
const syncRecordingService = new SyncRecordingService()

export default syncRecordingService
