import React, { useState, useEffect, useRef } from 'react'
import './CameraViewer.css'

function WebRTCViewer({ camera }) {
  const [status, setStatus] = useState('detenido')
  const [error, setError] = useState(null)
  const [fps, setFps] = useState(0)
  const [resolution, setResolution] = useState({ width: 0, height: 0 })
  const [quality, setQuality] = useState('medium') // Perfil de calidad seleccionado
  
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const frameCountRef = useRef(0)
  const lastFpsUpdateRef = useRef(Date.now())
  const renderQueueRef = useRef([])
  const isRenderingRef = useRef(false)

  // Iniciar streaming WebRTC
  const startStreaming = async () => {
    try {
      console.log('🎬 Iniciando stream para cámara:', camera)
      setStatus('conectando')
      setError(null)

      // Llamar API para iniciar stream
      console.log('📡 Llamando a /api/webrtc/start/' + camera.id)
      const response = await fetch(`/api/webrtc/start/${camera.id}`, {
        method: 'POST'
      })

      console.log('📥 Respuesta recibida:', response.status)
      const data = await response.json()
      console.log('📦 Datos:', data)

      if (!data.success) {
        throw new Error(data.error || 'Error iniciando stream')
      }

      console.log('✅ Stream WebRTC iniciado:', data)

      // Conectar WebSocket con parámetro de calidad
      const wsUrl = data.wsUrl.replace('localhost', window.location.hostname) + `?quality=${quality}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        console.log('🔌 WebSocket conectado')
        setStatus('streaming')
      }

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          // Mensaje de control
          const msg = JSON.parse(event.data)
          console.log('📨 Mensaje:', msg)
          
          if (msg.type === 'stream_ended' || msg.type === 'stream_stopped') {
            setStatus('detenido')
            setError('Stream terminado')
          }
          return
        }

        // Frame JPEG como ArrayBuffer - procesamiento optimizado
        const blob = new Blob([event.data], { type: 'image/jpeg' })
        
        // Usar createImageBitmap para decodificación hardware-accelerated
        try {
          const imageBitmap = await createImageBitmap(blob)
          
          // Agregar a cola de renderizado
          renderQueueRef.current.push(imageBitmap)
          
          // Si no hay renderizado en progreso, iniciar
          if (!isRenderingRef.current) {
            isRenderingRef.current = true
            requestAnimationFrame(renderFrames)
          }
          
          // Calcular FPS
          frameCountRef.current++
          const now = Date.now()
          const elapsed = now - lastFpsUpdateRef.current
          
          if (elapsed >= 1000) {
            const currentFps = Math.round((frameCountRef.current / elapsed) * 1000)
            setFps(currentFps)
            frameCountRef.current = 0
            lastFpsUpdateRef.current = now
          }
        } catch (err) {
          console.error('Error creando ImageBitmap:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setError('Error de conexión WebSocket')
        setStatus('error')
      }

      ws.onclose = () => {
        console.log('👋 WebSocket cerrado')
        if (status === 'streaming') {
          setStatus('detenido')
        }
      }

    } catch (err) {
      console.error('❌ Error:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  // Función de renderizado optimizada con requestAnimationFrame
  const renderFrames = () => {
    const canvas = canvasRef.current
    if (!canvas || renderQueueRef.current.length === 0) {
      isRenderingRef.current = false
      return
    }

    // Tomar el frame más reciente (descartar frames viejos si hay lag)
    const imageBitmap = renderQueueRef.current.pop()
    renderQueueRef.current = [] // Limpiar cola

    try {
      const ctx = canvas.getContext('2d', { 
        alpha: false, // Sin canal alpha para mejor rendimiento
        desynchronized: true // Permitir renderizado asíncrono
      })
      
      // Ajustar tamaño del canvas solo si cambió
      if (canvas.width !== imageBitmap.width || canvas.height !== imageBitmap.height) {
        canvas.width = imageBitmap.width
        canvas.height = imageBitmap.height
        setResolution({ width: imageBitmap.width, height: imageBitmap.height })
      }
      
      // Dibujar usando ImageBitmap (GPU-accelerated)
      ctx.drawImage(imageBitmap, 0, 0)
      
      // Liberar memoria del bitmap
      imageBitmap.close()
    } catch (err) {
      console.error('Error renderizando:', err)
    }

    // Continuar renderizando si hay más frames
    if (renderQueueRef.current.length > 0) {
      requestAnimationFrame(renderFrames)
    } else {
      isRenderingRef.current = false
    }
  }

  // Detener streaming
  const stopStreaming = async () => {
    try {
      setStatus('deteniendo')

      // Cerrar WebSocket
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      // Llamar API para detener
      await fetch(`/api/webrtc/stop/${camera.id}`, {
        method: 'POST'
      })

      setStatus('detenido')
      setFps(0)

    } catch (err) {
      console.error('❌ Error deteniendo:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  // Fullscreen
  const handleFullscreen = () => {
    const canvas = canvasRef.current
    if (canvas?.requestFullscreen) {
      canvas.requestFullscreen()
    }
  }

  // Snapshot
  const handleSnapshot = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `snapshot-${camera.name}-${Date.now()}.png`
    link.click()
  }

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      // Limpiar WebSocket
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      
      // Limpiar cola de renderizado
      renderQueueRef.current.forEach(bitmap => {
        try {
          bitmap.close()
        } catch (e) {}
      })
      renderQueueRef.current = []
      isRenderingRef.current = false
    }
  }, [])

  const getStatusColor = () => {
    switch (status) {
      case 'streaming':
        return '#51cf66'
      case 'conectando':
        return '#ffd43b'
      case 'error':
        return '#ff8787'
      default:
        return '#868e96'
    }
  }

  if (!camera) {
    console.warn('⚠️ WebRTCViewer: No hay cámara seleccionada')
    return (
      <div className="camera-viewer">
        <div className="loading">
          <p>Selecciona una cámara</p>
        </div>
      </div>
    )
  }

  console.log('📹 WebRTCViewer renderizado con cámara:', camera.name, camera.id)

  return (
    <div className="camera-viewer">
      <div className="viewer-header">
        <h2>{camera.name}</h2>
        <div className="controls">
          {/* Selector de Calidad */}
          {status === 'detenido' && (
            <select 
              value={quality} 
              onChange={(e) => setQuality(e.target.value)}
              className="control-btn px-3 py-2 bg-gray-700 text-white rounded"
            >
              <option value="mobile">📱 Mobile (960x290, 20fps)</option>
              <option value="low">🔽 Baja (1280x387, 25fps)</option>
              <option value="medium">⚖️ Media (1920x580, 30fps)</option>
              <option value="high">🔼 Alta (2560x776, 30fps)</option>
              <option value="ultra">💎 Ultra (5120x1552, 30fps)</option>
            </select>
          )}
          
          {/* Controles de Visualización */}
          {status === 'detenido' && (
            <button className="control-btn" onClick={startStreaming}>
              ▶️ Iniciar Stream
            </button>
          )}
          {status === 'streaming' && (
            <button className="control-btn" onClick={stopStreaming}>
              ⏹️ Detener
            </button>
          )}
          <button 
            className="control-btn" 
            onClick={handleFullscreen}
            disabled={status !== 'streaming'}
          >
            🖥️ Fullscreen
          </button>
          <button 
            className="control-btn" 
            onClick={handleSnapshot}
            disabled={status !== 'streaming'}
          >
            📸 Captura
          </button>
          <div className="connection-status" style={{ backgroundColor: getStatusColor() }}>
            {status} {status === 'streaming' && `(${fps} FPS)`}
          </div>
        </div>
      </div>

      <div className="video-container">
        {(status === 'conectando') && (
          <div className="loading">
            <div className="spinner"></div>
            <p>⏳ Conectando con cámara...</p>
          </div>
        )}

        {status === 'detenido' && (
          <div className="loading">
            <p>▶️ Presiona "Iniciar Stream WebRTC"</p>
          </div>
        )}

        {error && (
          <div className="loading">
            <p className="text-red-400">❌ {error}</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain', // Mantener aspecto sin recortar
            display: status === 'streaming' ? 'block' : 'none',
            backgroundColor: '#000'
          }}
        />

        <div className="stream-overlay">
          <span className="live-badge">
            {status === 'streaming' ? '🔴 LIVE WebRTC' : '⚫ OFFLINE'}
          </span>
          <span className="camera-info">
            {camera.name} {status === 'streaming' && `- ${fps} FPS`}
          </span>
        </div>
      </div>

      <div className="viewer-footer">
        <div className="info">
          <p><strong>Estado:</strong> {status}</p>
          <p><strong>Calidad:</strong> {quality.toUpperCase()}</p>
          <p><strong>URL RTSP:</strong> <code>{camera.rtspUrl}</code></p>
          <p><strong>FPS:</strong> {fps} {status === 'streaming' && fps < 25 && '⚠️ Bajo'}</p>
          <p><strong>Resolución:</strong> {resolution.width}x{resolution.height}</p>
          <p><strong>Latencia:</strong> ~200-500ms (WebRTC optimizado)</p>
          <p><strong>Codec:</strong> MJPEG (Hardware accelerated)</p>
          
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              ℹ️ <strong>Recomendación:</strong> Para 5120x1552 usa MEDIA (30 FPS fluido) o BAJA (máxima fluidez)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WebRTCViewer
