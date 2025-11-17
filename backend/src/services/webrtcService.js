import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * Servicio WebRTC para streaming de baja latencia
 * Usa FFmpeg para convertir RTSP a formato WebSocket-compatible
 */
class WebRTCService {
  constructor() {
    this.streams = new Map() // Map<cameraId, {process, clients}>
    this.RECORDINGS_DIR = path.join(process.cwd(), 'recordings')
    
    // Perfiles de calidad para diferentes necesidades
    this.qualityProfiles = {
      'ultra': { scale: null, fps: 30, quality: 2, threads: 4 },        // Original, máxima calidad
      'high': { scale: '2560:776', fps: 30, quality: 3, threads: 4 },   // 50% reducción
      'medium': { scale: '1920:580', fps: 30, quality: 3, threads: 4 }, // 37.5% tamaño (~equilibrado)
      'low': { scale: '1280:387', fps: 25, quality: 4, threads: 2 },    // 25% tamaño (más fluido)
      'mobile': { scale: '960:290', fps: 20, quality: 5, threads: 2 }   // Para redes lentas
    }
    
    if (!fs.existsSync(this.RECORDINGS_DIR)) {
      fs.mkdirSync(this.RECORDINGS_DIR, { recursive: true })
    }
  }

  /**
   * Inicia streaming WebRTC para una cámara
   * @param {Object} camera - Objeto cámara con id, name, rtspUrl
   * @param {WebSocket} ws - WebSocket del cliente
   * @param {String} quality - Perfil de calidad: 'ultra', 'high', 'medium', 'low', 'mobile'
   */
  startStream(camera, ws, quality = 'medium') {
    const streamId = `camera_${camera.id}`
    
    // Si ya existe el stream, solo agregamos el nuevo cliente
    if (this.streams.has(streamId)) {
      const stream = this.streams.get(streamId)
      stream.clients.add(ws)
      console.log(`✅ Cliente agregado al stream ${camera.name}. Total clientes: ${stream.clients.size}`)
      return streamId
    }

    // Obtener perfil de calidad
    const profile = this.qualityProfiles[quality] || this.qualityProfiles['medium']
    console.log(`🎥 Iniciando stream WebRTC: ${camera.name} [${quality.toUpperCase()}]`)
    console.log(`📊 Perfil: ${profile.scale || 'Original'}, ${profile.fps} FPS, Quality ${profile.quality}, ${profile.threads} threads`)
    
    // FFmpeg optimizado: RTSP → JPEG frames via stdout
    const ffmpegArgs = [
      '-rtsp_transport', 'tcp',
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-strict', 'experimental',
      '-i', camera.rtspUrl
    ]
    
    // Agregar escalado si el perfil lo especifica
    if (profile.scale) {
      ffmpegArgs.push('-vf', `scale=${profile.scale}`)
    }
    
    ffmpegArgs.push(
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-q:v', profile.quality.toString(),
      '-r', profile.fps.toString(),
      '-preset', 'ultrafast',
      '-threads', profile.threads.toString(),
      '-tune', 'zerolatency',
      'pipe:1'
    )

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)
    
    const clients = new Set([ws])
    let buffer = Buffer.alloc(0)
    const SOI = Buffer.from([0xFF, 0xD8]) // Start of Image JPEG
    const EOI = Buffer.from([0xFF, 0xD9]) // End of Image JPEG
    const MAX_BUFFER_SIZE = 10 * 1024 * 1024 // 10MB max buffer
    
    let frameCount = 0
    let lastLogTime = Date.now()

    // Procesar frames JPEG con mejor manejo de buffer
    ffmpegProcess.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      
      // Prevenir buffer overflow
      if (buffer.length > MAX_BUFFER_SIZE) {
        console.warn(`⚠️ Buffer overflow ${camera.name}, reseteando...`)
        buffer = Buffer.alloc(0)
        return
      }
      
      // Buscar y extraer frames JPEG completos
      let start = buffer.indexOf(SOI)
      let end = buffer.indexOf(EOI, start + 2)
      
      while (start !== -1 && end !== -1 && end > start) {
        const frame = buffer.slice(start, end + 2)
        
        // Enviar frame a todos los clientes (sin bloquear)
        setImmediate(() => {
          clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
              try {
                client.send(frame, { binary: true })
              } catch (error) {
                console.error('Error enviando frame:', error.message)
                clients.delete(client)
              }
            }
          })
        })
        
        // Contador de frames
        frameCount++
        const now = Date.now()
        if (now - lastLogTime >= 5000) { // Log cada 5 segundos
          const fps = (frameCount / (now - lastLogTime) * 1000).toFixed(1)
          console.log(`📹 ${camera.name}: ${fps} FPS, ${clients.size} clientes, buffer: ${(buffer.length / 1024).toFixed(1)}KB`)
          frameCount = 0
          lastLogTime = now
        }
        
        // Remover frame procesado del buffer
        buffer = buffer.slice(end + 2)
        start = buffer.indexOf(SOI)
        end = buffer.indexOf(EOI, start + 2)
      }
      
      // Limpiar buffer viejo (mantener solo últimos 512KB)
      if (buffer.length > 512 * 1024 && start === -1) {
        buffer = buffer.slice(-512 * 1024)
      }
    })

    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString()
      if (output.includes('frame=')) {
        const match = output.match(/frame=\s*(\d+)/)
        if (match && parseInt(match[1]) % 100 === 0) {
          console.log(`📹 ${camera.name}: Frame ${match[1]}, Clientes: ${clients.size}`)
        }
      }
    })

    ffmpegProcess.on('error', (error) => {
      console.error(`❌ Error FFmpeg ${camera.name}:`, error.message)
      this.stopStream(camera.id)
    })

    ffmpegProcess.on('close', (code) => {
      console.log(`🔴 Stream FFmpeg ${camera.name} cerrado. Código: ${code}`)
      this.streams.delete(streamId)
      
      // Notificar a todos los clientes que el stream terminó
      clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'stream_ended' }))
        }
      })
    })

    // Guardar stream
    this.streams.set(streamId, {
      process: ffmpegProcess,
      clients,
      camera
    })

    console.log(`✅ Stream WebRTC iniciado: ${camera.name}`)
    return streamId
  }

  /**
   * Detiene streaming de una cámara
   */
  stopStream(cameraId) {
    const streamId = `camera_${cameraId}`
    const stream = this.streams.get(streamId)
    
    if (!stream) {
      console.log(`⚠️ Stream no encontrado: camera_${cameraId}`)
      return false
    }

    console.log(`🛑 Deteniendo stream: camera_${cameraId}`)
    
    // Matar proceso FFmpeg
    if (stream.process) {
      stream.process.kill('SIGTERM')
    }

    // Cerrar todas las conexiones WebSocket
    stream.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'stream_stopped' }))
        client.close()
      }
    })

    this.streams.delete(streamId)
    console.log(`✅ Stream detenido: camera_${cameraId}`)
    return true
  }

  /**
   * Remueve un cliente de un stream
   */
  removeClient(cameraId, ws) {
    const streamId = `camera_${cameraId}`
    const stream = this.streams.get(streamId)
    
    if (!stream) return

    stream.clients.delete(ws)
    console.log(`👋 Cliente desconectado de ${streamId}. Clientes restantes: ${stream.clients.size}`)

    // Si no quedan clientes, detener el stream
    if (stream.clients.size === 0) {
      console.log(`🗑️ No quedan clientes, deteniendo stream: ${streamId}`)
      this.stopStream(cameraId)
    }
  }

  /**
   * Inicia grabación continua (independiente del streaming)
   */
  startRecording(camera) {
    const cameraDir = path.join(this.RECORDINGS_DIR, `camera_${camera.id}`)
    
    if (!fs.existsSync(cameraDir)) {
      fs.mkdirSync(cameraDir, { recursive: true })
    }

    const outputPattern = path.join(cameraDir, '%Y-%m-%d_%H-%M-%S_%%03d.mp4')

    console.log(`💾 Iniciando grabación: ${camera.name}`)

    const recordArgs = [
      '-rtsp_transport', 'tcp',
      '-i', camera.rtspUrl,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-f', 'segment',
      '-segment_time', '3600', // 1 hora por archivo
      '-segment_format', 'mp4',
      '-reset_timestamps', '1',
      '-strftime', '1',
      outputPattern
    ]

    const recordProcess = spawn('ffmpeg', recordArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    recordProcess.stderr.on('data', (data) => {
      const output = data.toString()
      if (output.includes('Opening') && output.includes('.mp4')) {
        console.log(`💾 Nuevo archivo: ${camera.name}`)
      }
    })

    recordProcess.on('error', (error) => {
      console.error(`❌ Error grabación ${camera.name}:`, error.message)
    })

    recordProcess.on('close', (code) => {
      console.log(`🔴 Grabación ${camera.name} cerrada: ${code}`)
    })

    return recordProcess
  }

  /**
   * Obtiene estado de todos los streams
   */
  getStatus() {
    const status = []
    
    this.streams.forEach((stream, streamId) => {
      status.push({
        streamId,
        camera: stream.camera.name,
        clients: stream.clients.size,
        active: stream.process && !stream.process.killed
      })
    })

    return status
  }

  /**
   * Detiene todos los streams
   */
  stopAll() {
    console.log('🛑 Deteniendo todos los streams WebRTC...')
    this.streams.forEach((stream, streamId) => {
      this.stopStream(stream.camera.id)
    })
  }
}

export default WebRTCService
