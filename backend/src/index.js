import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import cameraRoutes from './routes/cameras.js'
import streamRoutes from './routes/stream.js'
import mediaRoutes from './routes/media.js'
import StreamingService from './utils/streamingService.js'
import mediaServerManager from './services/mediaServer.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000

// Inicializar servicio de streaming WebSocket
const streamingService = new StreamingService(httpServer)

// Inicializar Node Media Server
mediaServerManager.start().then(() => {
  console.log('✅ Sistema de grabación y streaming iniciado')
}).catch((error) => {
  console.error('❌ Error iniciando Media Server:', error)
})

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
  console.log(`� WebSocket disponible en ws://localhost:${PORT}/ws`)
  console.log(`�📊 API disponible en http://localhost:${PORT}/cameras`)
})

// Manejo de errores
process.on('SIGINT', async () => {
  console.log('\n🛑 Deteniendo servidor...')
  streamingService.closeAll()
  mediaServerManager.stop()
  await prisma.$disconnect()
  process.exit(0)
})
