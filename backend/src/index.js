import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import cameraRoutes from './routes/cameras.js'
import streamRoutes from './routes/stream.js'
import mediaRoutes from './routes/media.js'
import webrtcRoutes, { webrtcService } from './routes/webrtc.js'
import StreamingService from './utils/streamingService.js'
import mediaServerManager from './services/mediaServer.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000

// Inicializar WebSocket Server para ambos servicios
const wss = new WebSocketServer({ noServer: true })

// Inicializar servicio de streaming WebSocket (sin crear su propio servidor)
const streamingService = new StreamingService(httpServer, wss)

// Manejar upgrade de HTTP a WebSocket
httpServer.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`)
  
  // WebRTC WebSocket: /ws/webrtc/:cameraId
  if (url.pathname.startsWith('/ws/webrtc/')) {
    const cameraId = parseInt(url.pathname.split('/')[3])
    
    wss.handleUpgrade(request, socket, head, async (ws) => {
      try {
        // Buscar cámara
        const camera = await prisma.camera.findUnique({
          where: { id: cameraId }
        })

        if (!camera) {
          ws.close(1008, 'Cámara no encontrada')
          return
        }

        console.log(`🔌 Cliente WebRTC conectado: ${camera.name}`)

        // Obtener parámetro de calidad de la query string (default: medium)
        const quality = url.searchParams.get('quality') || 'medium'
        console.log(`📊 Calidad solicitada: ${quality}`)

        // Iniciar stream WebRTC con perfil de calidad
        const streamId = webrtcService.startStream(camera, ws, quality)

        ws.on('close', () => {
          console.log(`👋 Cliente WebRTC desconectado: ${camera.name}`)
          webrtcService.removeClient(cameraId, ws)
        })

        ws.on('error', (error) => {
          console.error(`❌ Error WebSocket:`, error.message)
        })

      } catch (error) {
        console.error('Error en WebSocket upgrade:', error)
        ws.close(1011, 'Error del servidor')
      }
    })
  }
  // WebSocket legacy: /ws (para StreamingService)
  else if (url.pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      streamingService.handleConnection(ws, request)
    })
  }
  else {
    socket.destroy()
  }
})

// Inicializar Node Media Server (HLS como fallback)
mediaServerManager.start().then(() => {
  console.log('✅ Sistema de grabación y streaming iniciado')
}).catch((error) => {
  console.error('❌ Error iniciando Media Server:', error)
})

// Auto-iniciar grabación para cámaras existentes
const autoStartRecordings = async () => {
  try {
    const cameras = await prisma.camera.findMany({
      where: { isActive: true }
    })
    
    if (cameras.length > 0) {
      console.log(`📹 Auto-iniciando grabación para ${cameras.length} cámara(s)...`)
      
      for (const camera of cameras) {
        try {
          mediaServerManager.startCamera(camera)
          console.log(`✅ Grabación iniciada: ${camera.name}`)
        } catch (error) {
          console.error(`❌ Error iniciando ${camera.name}:`, error.message)
        }
      }
    } else {
      console.log('ℹ️ No hay cámaras activas para grabar')
    }
  } catch (error) {
    console.error('❌ Error auto-iniciando grabaciones:', error)
  }
}

// Iniciar grabaciones después de que el servidor esté listo
setTimeout(autoStartRecordings, 2000)

// Middleware
app.use(cors())
app.use(express.json())

// Servir archivos estáticos HLS desde /media
const mediaPath = path.join(process.cwd(), 'media')
app.use('/media', express.static(mediaPath, {
  setHeaders: (res, path) => {
    if (path.endsWith('.m3u8')) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl')
      res.set('Cache-Control', 'no-cache')
    } else if (path.endsWith('.ts')) {
      res.set('Content-Type', 'video/MP2T')
      res.set('Cache-Control', 'no-cache')
    }
  }
}))

// Pasar prisma y streaming service a las rutas
app.use((req, res, next) => {
  req.prisma = prisma
  req.streamingService = streamingService
  next()
})

// Rutas
app.use('/cameras', cameraRoutes)
app.use('/stream', streamRoutes)
app.use('/api/cameras', cameraRoutes)
app.use('/api/stream', streamRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/webrtc', webrtcRoutes)

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente' })
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente' })
})

// Ruta para obtener estado de streams
app.get('/api/streams/status', (req, res) => {
  const status = {
    totalClients: streamingService.wss.clients.size,
    activeStreams: streamingService.streamProcesses.size,
    message: 'Estado del servidor de streaming'
  }
  res.json(status)
})

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`)
  console.log(`🔌 WebSocket HLS en ws://localhost:${PORT}/ws`)
  console.log(`🎥 WebSocket WebRTC en ws://localhost:${PORT}/ws/webrtc/:cameraId`)
  console.log(`📊 API disponible en http://localhost:${PORT}/cameras`)
})

// Manejo de errores
process.on('SIGINT', async () => {
  console.log('\n🛑 Deteniendo servidor...')
  streamingService.closeAll()
  webrtcService.stopAll()
  mediaServerManager.stop()
  await prisma.$disconnect()
  process.exit(0)
})
