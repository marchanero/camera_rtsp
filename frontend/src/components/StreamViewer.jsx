import React, { useState, useEffect, useRef } from 'react'
import './CameraViewer.css'

function StreamViewer({ camera }) {
  const [status, setStatus] = useState('conectando')
  const [frameCount, setFrameCount] = useState(0)
  const imgRef = useRef(null)
  const containerRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!camera) return

    console.log(`🚀 StreamViewer iniciando para: ${camera.name}`)
    setStatus('conectando')
    
    // Abortar conexión anterior
    if (abortRef.current) {
      abortRef.current.abort()
    }

    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    // Conectar al stream
    const streamUrl = `/api/stream/${camera.id}/live`
    console.log(`📍 Conectando a: ${streamUrl}`)

    fetch(streamUrl, { signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        console.log('✅ Conexión establecida, procesando stream...')
        setStatus('streaming')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let localFrameCount = 0

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // Buscar frames entre boundaries
            const parts = buffer.split('--BOUNDARY')
            
            // Procesar todas las partes menos la última (que podría estar incompleta)
            for (let i = 1; i < parts.length - 1; i++) {
              const part = parts[i]
              
              // Buscar el fin de headers
              const headerEnd = part.indexOf('\r\n\r\n')
              if (headerEnd === -1) continue

              // Extraer el JPEG
              const jpegStart = headerEnd + 4
              const jpegEnd = part.lastIndexOf('\r\n')
              
              if (jpegEnd <= jpegStart) continue

              const jpegBase64 = part.substring(jpegStart, jpegEnd)
              if (!jpegBase64) continue

              try {
                // Intentar crear blob directamente del base64
                const binaryString = atob(jpegBase64)
                const bytes = new Uint8Array(binaryString.length)
                for (let j = 0; j < binaryString.length; j++) {
                  bytes[j] = binaryString.charCodeAt(j)
                }

                // Validar JPEG
                if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
                  const blob = new Blob([bytes], { type: 'image/jpeg' })
                  const url = URL.createObjectURL(blob)
                  
                  if (imgRef.current) {
                    imgRef.current.src = url
                    localFrameCount++
                    setFrameCount(localFrameCount)
                    if (localFrameCount % 5 === 0) {
                      console.log(`📸 Frame ${localFrameCount}`)
                    }
                  }
                }
              } catch (e) {
                // Ignorar errores de parse
              }
            }

            // Mantener la última parte en el buffer
            buffer = parts[parts.length - 1]
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('❌ Error en stream:', err)
            setStatus('error')
          }
        }

        setStatus('error')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('❌ Error conexión:', err)
          setStatus('error')
        }
      })

    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [camera])

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

  return (
    <div className="camera-viewer">
      <div className="viewer-header">
        <h2>{camera?.name || 'Sin cámara'}</h2>
        <div className="controls">
          <div
            className="connection-status"
            style={{ backgroundColor: getStatusColor() }}
          >
            {status} ({frameCount} frames)
          </div>
        </div>
      </div>

      <div className="video-container">
        {status === 'conectando' && (
          <div className="loading">
            <div className="spinner"></div>
            <p>⏳ Conectando...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="loading">
            <div className="spinner"></div>
            <p>❌ Error</p>
          </div>
        )}

        {status === 'streaming' && (
          <img
            ref={imgRef}
            alt="Stream"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        )}

        <div className="stream-overlay">
          <span className="live-badge">🔴 LIVE</span>
          <span className="camera-info">{camera?.name}</span>
        </div>
      </div>

      <div className="viewer-footer">
        <div className="info">
          <p><strong>Estado:</strong> {status}</p>
          <p><strong>Frames recibidos:</strong> {frameCount}</p>
        </div>
      </div>
    </div>
  )
}

export default StreamViewer
