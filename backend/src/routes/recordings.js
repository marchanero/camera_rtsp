import express from 'express'
import recordingManager from '../services/recordingManager.js'
import videoProcessor from '../services/videoProcessor.js'
import syncRecordingService from '../services/syncRecordingService.js'

const router = express.Router()

/**
 * GET /api/recordings/status
 * Obtiene estado de todas las grabaciones activas
 */
router.get('/status', (req, res) => {
  try {
    const status = recordingManager.getAllRecordingsStatus()
    res.json({
      success: true,
      activeCount: status.length,
      recordings: status,
      config: recordingManager.config
    })
  } catch (error) {
    console.error('Error obteniendo estado de grabaciones:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/recordings/:cameraId/stats
 * Obtiene estadísticas de una grabación específica
 */
router.get('/:cameraId/stats', (req, res) => {
  try {
    const { cameraId } = req.params
    const stats = recordingManager.getRecordingStats(parseInt(cameraId))
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'No hay grabación activa para esta cámara'
      })
    }
    
    res.json({ success: true, stats })
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/start
 * Inicia grabación de una cámara
 */
router.post('/start', async (req, res) => {
  try {
    const { camera, scenarioId, scenarioName } = req.body
    
    if (!camera || !camera.id || !camera.rtspUrl) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere camera con id, name y rtspUrl'
      })
    }
    
    const result = recordingManager.startRecording(camera, {
      scenarioId,
      scenarioName
    })
    
    res.json(result)
  } catch (error) {
    console.error('Error iniciando grabación:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/:cameraId/stop
 * Detiene grabación de una cámara
 */
router.post('/:cameraId/stop', async (req, res) => {
  try {
    const { cameraId } = req.params
    const result = await recordingManager.stopRecording(parseInt(cameraId))
    res.json(result)
  } catch (error) {
    console.error('Error deteniendo grabación:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/stop-all
 * Detiene todas las grabaciones
 */
router.post('/stop-all', async (req, res) => {
  try {
    await recordingManager.stopAll()
    res.json({ success: true, message: 'Todas las grabaciones detenidas' })
  } catch (error) {
    console.error('Error deteniendo todas las grabaciones:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/recordings/config
 * Actualiza configuración del RecordingManager
 */
router.put('/config', (req, res) => {
  try {
    const config = req.body
    recordingManager.updateConfig(config)
    res.json({
      success: true,
      config: recordingManager.config
    })
  } catch (error) {
    console.error('Error actualizando configuración:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/recordings/:cameraId/is-recording
 * Verifica si una cámara está grabando
 */
router.get('/:cameraId/is-recording', (req, res) => {
  try {
    const { cameraId } = req.params
    const isRecording = recordingManager.isRecording(parseInt(cameraId))
    res.json({ success: true, cameraId: parseInt(cameraId), isRecording })
  } catch (error) {
    console.error('Error verificando grabación:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/combine-segments
 * Combina segmentos de grabación en un archivo único
 * 
 * Body:
 * - recordingDir: Directorio con los segmentos
 * - outputName: Nombre del archivo de salida (opcional)
 * - deleteSegments: Si eliminar los segmentos originales (opcional, default: false)
 * - applyFaststart: Si aplicar faststart para streaming (opcional, default: true)
 */
router.post('/combine-segments', async (req, res) => {
  try {
    const { 
      recordingDir, 
      outputName = 'recording_combined.mp4',
      deleteSegments = false,
      applyFaststart = true 
    } = req.body

    if (!recordingDir) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere recordingDir'
      })
    }

    const result = await videoProcessor.combineRecordingSession(recordingDir, {
      outputName,
      deleteSegments,
      applyFaststart
    })

    res.json(result)
  } catch (error) {
    console.error('Error combinando segmentos:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/apply-faststart
 * Aplica faststart a un video (mueve moov atom al inicio para streaming)
 * 
 * Body:
 * - videoPath: Ruta al video
 */
router.post('/apply-faststart', async (req, res) => {
  try {
    const { videoPath } = req.body

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere videoPath'
      })
    }

    const result = await videoProcessor.applyFaststart(videoPath)
    res.json(result)
  } catch (error) {
    console.error('Error aplicando faststart:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/recordings/memory-config
 * Obtiene la configuración de memoria del sistema de grabación
 */
router.get('/memory-config', (req, res) => {
  try {
    const config = recordingManager.config
    res.json({
      success: true,
      memoryOptimizations: {
        segmentTime: `${config.segmentTime} segundos (${config.segmentTime / 60} minutos)`,
        inputBufferSize: config.inputBufferSize,
        maxMuxingQueue: config.maxMuxingQueue,
        analyzeDuration: config.analyzeDuration,
        probeSize: config.probeSize
      },
      tips: [
        'Los segmentos de 5 minutos reducen el uso de memoria vs 1 hora',
        'El buffer de entrada está limitado a 16MB',
        'Use POST /combine-segments para unir segmentos después de grabar',
        'Use POST /apply-faststart para optimizar videos para streaming'
      ]
    })
  } catch (error) {
    console.error('Error obteniendo config de memoria:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================
// GRABACIÓN SINCRONIZADA (Video + Sensores)
// ============================================

/**
 * POST /api/recordings/sync/start
 * Inicia grabación sincronizada de video y sensores
 * 
 * Body:
 * - camera: { id, name, rtspUrl }
 * - scenarioId: (opcional)
 * - scenarioName: (opcional)
 * - sensorTopics: (opcional) Array de topics específicos a grabar
 */
router.post('/sync/start', async (req, res) => {
  try {
    const { camera, scenarioId, scenarioName, sensorTopics } = req.body

    if (!camera || !camera.id || !camera.rtspUrl) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere camera con id, name y rtspUrl'
      })
    }

    const result = await syncRecordingService.startSyncRecording(camera, {
      scenarioId,
      scenarioName,
      sensorTopics
    })

    res.json(result)
  } catch (error) {
    console.error('Error iniciando grabación sincronizada:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/sync/:cameraId/stop
 * Detiene grabación sincronizada y genera manifest
 */
router.post('/sync/:cameraId/stop', async (req, res) => {
  try {
    const { cameraId } = req.params
    const result = await syncRecordingService.stopSyncRecording(parseInt(cameraId))
    res.json(result)
  } catch (error) {
    console.error('Error deteniendo grabación sincronizada:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/recordings/sync/status
 * Obtiene estado de todas las sesiones sincronizadas activas
 */
router.get('/sync/status', (req, res) => {
  try {
    const sessions = syncRecordingService.getAllSessionsStatus()
    res.json({
      success: true,
      activeSessions: sessions.length,
      sessions
    })
  } catch (error) {
    console.error('Error obteniendo estado de sesiones:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/recordings/sync/:cameraId/status
 * Obtiene estado de una sesión específica
 */
router.get('/sync/:cameraId/status', (req, res) => {
  try {
    const { cameraId } = req.params
    const session = syncRecordingService.getSessionStatus(parseInt(cameraId))

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No hay sesión activa para esta cámara'
      })
    }

    res.json({ success: true, session })
  } catch (error) {
    console.error('Error obteniendo estado de sesión:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/sync/stop-all
 * Detiene todas las sesiones sincronizadas
 */
router.post('/sync/stop-all', async (req, res) => {
  try {
    await syncRecordingService.stopAll()
    res.json({ success: true, message: 'Todas las sesiones sincronizadas detenidas' })
  } catch (error) {
    console.error('Error deteniendo todas las sesiones:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})
/**
 * POST /api/recordings/consolidate
 * Consolida manualmente los segmentos de video de una grabación
 * Útil para post-procesamiento si la consolidación automática falló
 * 
 * Body:
 * - recordingPath: string (ruta al directorio con segmentos)
 * - deleteSegments: boolean (opcional, eliminar segmentos después)
 */
router.post('/consolidate', async (req, res) => {
  try {
    const { recordingPath, deleteSegments = false, scenarioName, cameraName } = req.body
    
    if (!recordingPath) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere recordingPath'
      })
    }

    console.log(`📦 Solicitud de consolidación manual: ${recordingPath}`)
    
    const result = await syncRecordingService.consolidateRecording(recordingPath, {
      deleteSegments,
      scenarioName,
      cameraName
    })
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Consolidación completada',
        outputFile: result.outputFile,
        segmentsCount: result.segmentsCount
      })
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      })
    }
  } catch (error) {
    console.error('Error en consolidación manual:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router

