import { spawn } from 'child_process'

class StreamingService {
  constructor(httpServer, wss) {
    this.httpServer = httpServer
    this.wss = wss
    this.streamProcesses = new Map()
    this.clientSubscriptions = new Map()
  }

  // Manejar nueva conexión WebSocket (llamado desde index.js)
  handleConnection(ws, req) {
    console.log('👤 Cliente WebSocket conectado (legacy)')

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message)
        this.handleMessage(ws, data)
      } catch (error) {
        console.error('Error al procesar mensaje:', error)
        ws.send(JSON.stringify({ error: 'Mensaje inválido' }))
      }
    })

    ws.on('close', () => {
      console.log('👤 Cliente WebSocket desconectado (legacy)')
      this.clientSubscriptions.delete(ws)
    })

    ws.on('error', (error) => {
      console.error('Error WebSocket:', error)
    })
  }

  handleMessage(ws, data) {
    const { action, cameraId, rtspUrl } = data

    switch (action) {
      case 'subscribe':
        this.subscribeToStream(ws, cameraId, rtspUrl)
        break
      case 'unsubscribe':
        this.unsubscribeFromStream(ws, cameraId)
        break
      case 'ping':
        ws.send(JSON.stringify({ action: 'pong' }))
        break
      default:
        ws.send(JSON.stringify({ error: 'Acción no reconocida' }))
    }
  }

  subscribeToStream(ws, cameraId, rtspUrl) {
    if (!this.clientSubscriptions.has(ws)) {
      this.clientSubscriptions.set(ws, new Set())
    }

    const subscriptions = this.clientSubscriptions.get(ws)
    subscriptions.add(cameraId)

    ws.send(JSON.stringify({
      action: 'subscribed',
      cameraId,
      message: `Suscrito al stream de cámara ${cameraId}`
    }))

    console.log(`📡 Cliente suscrito a cámara ${cameraId}`)

    // Iniciar proceso de captura de frames si no existe
    if (!this.streamProcesses.has(cameraId)) {
      this.startFrameCapture(cameraId, rtspUrl)
    }
  }

  unsubscribeFromStream(ws, cameraId) {
    const subscriptions = this.clientSubscriptions.get(ws)
    if (subscriptions) {
      subscriptions.delete(cameraId)
    }

    // Verificar si hay otros clientes suscritos
    const hasOtherSubscribers = Array.from(this.clientSubscriptions.values())
      .some(subs => subs.has(cameraId))

    if (!hasOtherSubscribers) {
      this.stopFrameCapture(cameraId)
    }
  }

  startFrameCapture(cameraId, rtspUrl) {
    console.log(`🎥 Iniciando captura de frames para cámara ${cameraId}`)

    const ffmpegArgs = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-vf', 'fps=5',
      '-c:v', 'mjpeg',
      '-q:v', '5',
      '-f', 'singlejpeg',
      'pipe:1'
    ]

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let buffer = Buffer.alloc(0)

    ffmpegProcess.stdout.on('data', (data) => {
      // Enviar frames a todos los clientes suscritos
      for (const [client, subscriptions] of this.clientSubscriptions) {
        if (subscriptions.has(cameraId) && client.readyState === 1) {
          client.send(JSON.stringify({
            action: 'frame',
            cameraId,
            frame: data.toString('base64')
          }), { binary: false })
        }
      }
    })

    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`[FFmpeg ${cameraId}]`, data.toString().slice(0, 100))
    })

    ffmpegProcess.on('error', (error) => {
      console.error(`❌ Error en captura ${cameraId}:`, error)
      this.streamProcesses.delete(cameraId)
    })

    this.streamProcesses.set(cameraId, ffmpegProcess)
  }

  stopFrameCapture(cameraId) {
    const process = this.streamProcesses.get(cameraId)
    if (process) {
      process.kill('SIGTERM')
      this.streamProcesses.delete(cameraId)
      console.log(`🛑 Captura de frames ${cameraId} detenida`)
    }
  }

  broadcast(message) {
    // Broadcast solo a clientes legacy (no WebRTC)
    for (const [client] of this.clientSubscriptions) {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message))
      }
    }
  }

  closeAll() {
    for (const process of this.streamProcesses.values()) {
      process.kill('SIGTERM')
    }
    this.streamProcesses.clear()
    this.clientSubscriptions.clear()
  }
}

export default StreamingService
