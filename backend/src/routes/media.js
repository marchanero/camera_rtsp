import express from 'express'
import mediaServerManager from '../services/mediaServer.js'
import fs from 'fs'
import path from 'path'

const router = express.Router()

// POST /api/media/start/:cameraId - Iniciar grabación continua
router.post('/start/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })

    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    const result = mediaServerManager.startCamera(camera)
    
    res.json({
      success: true,
      message: `Grabación continua iniciada: ${camera.name}`,
      ...result
    })
  } catch (error) {
    console.error('Error iniciando cámara:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/media/start-hls/:cameraId - Iniciar streaming HLS (fallback)
router.post('/start-hls/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })

    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    const result = mediaServerManager.startHLSStream(camera)
    
    res.json({
      success: true,
      message: `Stream HLS iniciado: ${camera.name}`,
      ...result
    })
  } catch (error) {
    console.error('Error iniciando HLS:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/media/stop/:cameraId - Detener grabación
router.post('/stop/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    mediaServerManager.stopCamera(parseInt(cameraId))
    
    res.json({
      success: true,
      message: 'Grabación detenida'
    })
  } catch (error) {
    console.error('Error deteniendo cámara:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/media/stop-hls/:cameraId - Detener streaming HLS
router.post('/stop-hls/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    mediaServerManager.stopHLSStream(parseInt(cameraId))
    
    res.json({
      success: true,
      message: 'Stream HLS detenido'
    })
  } catch (error) {
    console.error('Error deteniendo HLS:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/status - Estado del sistema
router.get('/status', (req, res) => {
  try {
    const status = mediaServerManager.getStatus()
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/recordings/:cameraId - Listar grabaciones
router.get('/recordings/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    const recordings = mediaServerManager.getRecordings(parseInt(cameraId))
    
    res.json({
      cameraId: parseInt(cameraId),
      recordings
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/download/:cameraId/:filename - Descargar grabación
router.get('/download/:cameraId/:filename', (req, res) => {
  try {
    const { cameraId, filename } = req.params
    const recordings = mediaServerManager.getRecordings(parseInt(cameraId))
    const recording = recordings.find(r => r.filename === filename)

    if (!recording) {
      return res.status(404).json({ error: 'Grabación no encontrada' })
    }

    res.download(recording.path, filename)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/recording/:cameraId/:filename - Eliminar grabación
router.delete('/recording/:cameraId/:filename', (req, res) => {
  try {
    const { cameraId, filename } = req.params
    const recordings = mediaServerManager.getRecordings(parseInt(cameraId))
    const recording = recordings.find(r => r.filename === filename)

    if (!recording) {
      return res.status(404).json({ error: 'Grabación no encontrada' })
    }

    fs.unlinkSync(recording.path)
    
    res.json({
      success: true,
      message: 'Grabación eliminada'
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/live/:cameraId - Stream del archivo MP4 actual en vivo
// GET /api/media/current/:cameraId - Alias para /live (usado por el frontend)
const streamCurrentRecording = (req, res) => {
  try {
    const { cameraId } = req.params
    const recordings = mediaServerManager.getRecordings(parseInt(cameraId))
    
    if (recordings.length === 0) {
      return res.status(404).json({ error: 'No hay grabaciones activas' })
    }

    // Obtener el archivo más reciente (el que se está grabando)
    const currentRecording = recordings[0]
    const filePath = currentRecording.path
    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    const range = req.headers.range

    if (range) {
      // Soporte para streaming parcial (HTTP Range)
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunksize = (end - start) + 1
      const file = fs.createReadStream(filePath, { start, end })
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(206, head)
      file.pipe(res)
    } else {
      // Sin range, enviar todo el archivo
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(200, head)
      fs.createReadStream(filePath).pipe(res)
    }
  } catch (error) {
    console.error('Error streaming video:', error)
    res.status(500).json({ error: error.message })
  }
}

router.get('/live/:cameraId', streamCurrentRecording)
router.get('/current/:cameraId', streamCurrentRecording)

// GET /api/media/hls/:cameraId/index.m3u8 - Servir manifest HLS (alternativa al puerto 8889)
router.get('/hls/:cameraId/index.m3u8', (req, res) => {
  try {
    const { cameraId } = req.params
    const streamKey = `camera_${cameraId}`
    const hlsPath = path.join(process.cwd(), 'media', 'live', streamKey, 'index.m3u8')
    
    if (!fs.existsSync(hlsPath)) {
      return res.status(404).json({ error: 'HLS manifest no encontrado. Espera unos segundos.' })
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.sendFile(hlsPath)
  } catch (error) {
    console.error('Error sirviendo HLS manifest:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/hls/:cameraId/:segment - Servir segmentos HLS
router.get('/hls/:cameraId/:segment', (req, res) => {
  try {
    const { cameraId, segment } = req.params
    const streamKey = `camera_${cameraId}`
    const segmentPath = path.join(process.cwd(), 'media', 'live', streamKey, segment)
    
    if (!fs.existsSync(segmentPath)) {
      return res.status(404).json({ error: 'Segmento no encontrado' })
    }

    res.setHeader('Content-Type', 'video/MP2T')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.sendFile(segmentPath)
  } catch (error) {
    console.error('Error sirviendo segmento HLS:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
