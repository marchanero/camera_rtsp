import React, { useState, useEffect, useRef } from 'react'
import './CameraViewer.css'

function CameraViewer({ camera }) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('conectando')
  const imgRef = useRef(null)
  const containerRef = useRef(null)
  const abortControllerRef = useRef(null)
  const connectionAttemptRef = useRef(0)

  useEffect(() => {
    if (!camera || !isPlaying) {
      console.log('🛑 Stream pausado o sin cámara')
      setConnectionStatus('pausado')
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      return
    }

    // Evitar múltiples conexiones simultáneas
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      console.log('⏳ Ya hay una conexión activa')
      return
    }

    console.log(`🎬 Conectando a stream MJPEG: ${camera.name}`)
    setConnectionStatus('conectando')
    connectionAttemptRef.current += 1
    const attemptNum = connectionAttemptRef.current

    // Crear nuevo controlador de aborto
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    // Fetch stream MJPEG
    const streamUrl = `/api/stream/${camera.id}/live`

    fetch(streamUrl, { signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        
        console.log('📡 Respuesta recibida, leyendo stream...')
        const reader = response.body.getReader()
        let buffer = new Uint8Array(0)
        let frameCount = 0
        let chunkCount = 0
        
        setConnectionStatus('streaming')

        const processChunk = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              chunkCount++
              
              if (done) {
                console.log(`📹 Stream cerrado. Chunks: ${chunkCount}, Frames: ${frameCount}`)
                setConnectionStatus('error')
                break
              }

              // Concatenar nuevos datos binarios
              const newBuffer = new Uint8Array(buffer.length + value.length)
              newBuffer.set(buffer)
              newBuffer.set(value, buffer.length)
              buffer = newBuffer

              // Log del buffer cada 5 chunks
              if (chunkCount === 1 || chunkCount % 10 === 0) {
                const preview = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 200))
                console.log(`📊 Chunk ${chunkCount}: buffer=${buffer.length} bytes, preview: ${preview.substring(0, 80)}...`)
              }

              // Buscar boundary "--BOUNDARY" (está en formato de string ASCII puro)
              const boundaryStr = '--BOUNDARY'
              const bufferStr = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
              const boundaryIndex = bufferStr.indexOf(boundaryStr)

              if (boundaryIndex >= 0) {
                // Encontramos el boundary
                console.log(`🎯 Boundary encontrado en índice ${boundaryIndex}`)
                
                // Tomar todo hasta el boundary como un frame
                const frameBytes = buffer.slice(0, boundaryIndex)
                buffer = buffer.slice(boundaryIndex)

                // Buscar \r\n\r\n (fin de headers)
                let headerEnd = -1
                for (let i = 0; i < frameBytes.length - 3; i++) {
                  if (frameBytes[i] === 0x0d && frameBytes[i+1] === 0x0a &&
                      frameBytes[i+2] === 0x0d && frameBytes[i+3] === 0x0a) {
                    headerEnd = i + 4
                    break
                  }
                }

                if (headerEnd > 0) {
                  // Extraer JPEG (todo después de los headers)
                  let jpegData = frameBytes.slice(headerEnd)
                  
                  // Remover \r\n final si existe
                  while (jpegData.length >= 2 && 
                         jpegData[jpegData.length-2] === 0x0d && 
                         jpegData[jpegData.length-1] === 0x0a) {
                    jpegData = jpegData.slice(0, jpegData.length - 2)
                  }

                  // Validar que sea JPEG válido (comienza con FF D8 FF)
                  if (jpegData.length > 100 && jpegData[0] === 0xFF && jpegData[1] === 0xD8) {
                    frameCount++
                    const blob = new Blob([jpegData], { type: 'image/jpeg' })
                    const url = URL.createObjectURL(blob)
                    
                    if (imgRef.current) {
                      imgRef.current.src = url
                      console.log(`✅ Frame ${frameCount}: ${jpegData.length} bytes (JPEG válido)`)
                    }
                  } else {
                    console.warn(`⚠️ Datos rechazados: ${jpegData.length} bytes, inicio: ${jpegData[0]?.toString(16)} ${jpegData[1]?.toString(16)}`)
                  }
                } else {
                  console.warn(`⚠️ No encontrado \\r\\n\\r\\n en frameBytes (${frameBytes.length} bytes)`)
                }
              }
            }
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.error('❌ Error procesando stream:', error.message)
              setConnectionStatus('error')
            }
          }
        }

        processChunk()
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Error conectando:', error)
          setConnectionStatus('error')
        }
      })

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }

  }, [camera, isPlaying])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen()
    }
  }

  const handleSnapshot = () => {
    if (imgRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = imgRef.current.naturalWidth || imgRef.current.width
      canvas.height = imgRef.current.naturalHeight || imgRef.current.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(imgRef.current, 0, 0)
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `snapshot-${camera.name}-${new Date().getTime()}.png`
      link.click()
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'streaming':
        return '#51cf66'
      case 'conectando':
        return '#ffd43b'
      case 'pausado':
        return '#ff8787'
      case 'error':
        return '#ff8787'
      default:
        return '#868e96'
    }
  }

  return (
    <div className="camera-viewer">
      <div className="viewer-header">
        <h2>{camera.name}</h2>
        <div className="controls">
          <button 
            className="control-btn"
            onClick={handlePlayPause}
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? '⏸️ Pausar' : '▶️ Reproducir'}
          </button>
          <button className="control-btn" onClick={handleFullscreen} title="Fullscreen">
            🖥️ Fullscreen
          </button>
          <button 
            className="control-btn" 
            onClick={handleSnapshot}
            disabled={!imgRef.current}
            title="Captura"
          >
            📸 Captura
          </button>
          <div className="connection-status" style={{ backgroundColor: getStatusColor() }}>
            {connectionStatus}
          </div>
        </div>
      </div>
      
      <div className="video-container" ref={containerRef}>
        {connectionStatus === 'conectando' && (
          <div className="loading">
            <div className="spinner"></div>
            <p>⏳ Conectando al stream...</p>
          </div>
        )}
        
        {connectionStatus === 'error' && (
          <div className="loading">
            <div className="spinner"></div>
            <p>❌ Error conectando... reintentando</p>
          </div>
        )}

        {connectionStatus === 'pausado' && (
          <div className="paused-placeholder">
            <p>🔇 Stream Pausado</p>
            <button onClick={handlePlayPause} className="play-btn">
              ▶️ Iniciar Stream
            </button>
          </div>
        )}

        {connectionStatus === 'streaming' && (
          <img 
            ref={imgRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
            alt="Stream MJPEG"
          />
        )}

        <div className="stream-overlay">
          <span className="live-badge">🔴 LIVE {connectionStatus === 'streaming' ? '1fps' : ''}</span>
          <span className="camera-info">{camera.name}</span>
        </div>
      </div>

      <div className="viewer-footer">
        <div className="info">
          <p><strong>Modo:</strong> ⚡ MJPEG (1 fps, fetch streaming)</p>
          <p><strong>URL RTSP:</strong> <code>{camera.rtspUrl}</code></p>
          <p><strong>Estado:</strong> {camera.isActive ? '✅ En línea' : '❌ Offline'}</p>
          <p><strong>Descripción:</strong> {camera.description || 'Sin descripción'}</p>
          <p><strong>Última actualización:</strong> {new Date(camera.updatedAt).toLocaleString('es-ES')}</p>
        </div>
      </div>
    </div>
  )
}

export default CameraViewer
