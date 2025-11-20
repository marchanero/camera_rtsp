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
import mqttRoutes from './routes/mqtt.js'
import scenarioRoutes from './routes/scenarios.js'
import sensorRoutes from './routes/sensors.js'
import StreamingService from './utils/streamingService.js'
import mediaServerManager from './services/mediaServer.js'
import mqttService from './services/mqttService.js'

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

// Inicializar MQTT Service
const initMQTT = async () => {
  try {
    console.log('🔌 Iniciando servicio MQTT...')
    await mqttService.connect()
    
    // Escuchar comandos de grabación desde MQTT
    mqttService.on('command', async ({ topic, data }) => {
      if (topic.includes('/recording/command')) {
        const cameraId = parseInt(topic.split('/')[2])
        
        try {
          const camera = await prisma.camera.findUnique({
            where: { id: cameraId }
          })
          
          if (!camera) {
            console.error(`❌ Cámara ${cameraId} no encontrada`)
            return
          }
          
          if (data.command === 'start') {
            console.log(`📹 Iniciando grabación de cámara ${cameraId} por regla MQTT`)
            mediaServerManager.startCamera(camera)
            
            // Publicar estado
            await mqttService.publish(`camera_rtsp/cameras/${cameraId}/recording/status`, {
              status: 'recording',
              camera: camera.name,
              startedAt: new Date().toISOString(),
              rule: data.rule
            })
            
          } else if (data.command === 'stop') {
            console.log(`⏹️ Deteniendo grabación de cámara ${cameraId} por comando MQTT`)
            mediaServerManager.stopCamera(cameraId)
            
            // Publicar estado
            await mqttService.publish(`camera_rtsp/cameras/${cameraId}/recording/status`, {
              status: 'stopped',
              camera: camera.name,
              stoppedAt: new Date().toISOString()
            })
          }
        } catch (error) {
          console.error(`❌ Error ejecutando comando de grabación:`, error)
        }
      }
    })
    
    console.log('✅ Servicio MQTT iniciado')
  } catch (error) {
    console.error('❌ Error iniciando MQTT:', error)
  }
}

// Iniciar MQTT
setTimeout(initMQTT, 1000)

// Auto-iniciar grabación para cámaras existentes
// ⚠️ DESHABILITADO: El auto-inicio siempre graba sin escenario
// Las grabaciones deben iniciarse manualmente desde el frontend para incluir el escenario activo
const autoStartRecordings = async () => {
  try {
    const cameras = await prisma.camera.findMany({
      where: { isActive: true }
    })
    
    if (cameras.length > 0) {
      console.log(`📹 Encontradas ${cameras.length} cámara(s) activa(s)`)
      console.log('ℹ️ Auto-inicio DESHABILITADO - Inicia grabación desde el frontend para aplicar escenario')
      
      // NO iniciar automáticamente - esperar comando del frontend
      // for (const camera of cameras) {
      //   try {
      //     if (mediaServerManager.isRecording(camera.id)) {
      //       console.log(`⏭️ Grabación ya activa: ${camera.name} (omitiendo)`)
      //       continue
      //     }
      //     
      //     mediaServerManager.startCamera(camera)
      //     console.log(`✅ Grabación iniciada: ${camera.name}`)
      //     
      //     await mqttService.publish(`camera_rtsp/cameras/${camera.id}/recording/status`, {
      //       status: 'recording',
      //       camera: camera.name,
      //       startedAt: new Date().toISOString(),
      //       autoStart: true
      //     }).catch(err => console.error('Error publicando a MQTT:', err))
      //     
      //   } catch (error) {
      //     console.error(`❌ Error iniciando ${camera.name}:`, error.message)
      //   }
      // }
    } else {
      console.log('ℹ️ No hay cámaras activas configuradas')
    }
  } catch (error) {
    console.error('❌ Error verificando cámaras:', error)
  }
}

// Verificar cámaras disponibles (sin auto-iniciar)
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
app.use('/api/mqtt', mqttRoutes)
app.use('/api/scenarios', scenarioRoutes)
app.use('/api/sensors', sensorRoutes)

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

// Manejo de cierre graceful
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Señal ${signal} recibida. Cerrando servidor...`)
  
  try {
    // 1. Detener nuevas conexiones
    console.log('📡 Cerrando servicios de streaming...')
    streamingService.closeAll()
    webrtcService.stopAll()
    
    // 2. Cerrar grabaciones limpiamente (CRÍTICO para evitar pérdida de datos)
    console.log('💾 Guardando grabaciones en curso...')
    await mediaServerManager.gracefulStop()
    
    // 3. Cerrar servidor Node Media
    console.log('🎬 Deteniendo servidor de medios...')
    mediaServerManager.stop()
    
    // 4. Desconectar base de datos
    console.log('🗄️ Cerrando conexión a base de datos...')
    await prisma.$disconnect()
    
    console.log('✅ Servidor cerrado correctamente')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error durante cierre:', error)
    process.exit(1)
  }
}

// Capturar múltiples señales de cierre
process.on('SIGINT', () => gracefulShutdown('SIGINT'))   // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')) // Kill
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'))   // Terminal cerrada

// Capturar errores no manejados (SOLO LOGUEAR, NO CERRAR)
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error)
  console.error('Stack:', error.stack)
  // NO cerrar el servidor, solo loguear
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason)
  console.error('Promesa:', promise)
  // NO cerrar el servidor, solo loguear
})
