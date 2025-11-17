import express from 'express'
import WebRTCService from '../services/webrtcService.js'

const router = express.Router()
const webrtcService = new WebRTCService()

/**
 * POST /api/webrtc/start/:cameraId
 * Inicia streaming WebRTC
 */
router.post('/start/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })

    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    res.json({
      success: true,
      message: `Stream WebRTC listo para ${camera.name}`,
      cameraId: camera.id,
      wsUrl: `ws://localhost:${process.env.PORT || 3000}/ws/webrtc/${camera.id}`
    })
  } catch (error) {
    console.error('Error iniciando stream WebRTC:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/webrtc/stop/:cameraId
 * Detiene streaming WebRTC
 */
router.post('/stop/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    const stopped = webrtcService.stopStream(parseInt(cameraId))
    
    res.json({
      success: stopped,
      message: stopped ? 'Stream detenido' : 'Stream no encontrado'
    })
  } catch (error) {
    console.error('Error deteniendo stream:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/webrtc/status
 * Obtiene estado de todos los streams WebRTC
 */
router.get('/status', (req, res) => {
  try {
    const status = webrtcService.getStatus()
    res.json({
      success: true,
      streams: status
    })
  } catch (error) {
    console.error('Error obteniendo estado:', error)
    res.status(500).json({ error: error.message })
  }
})

export { router as default, webrtcService }
