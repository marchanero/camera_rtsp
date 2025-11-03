import React, { useState, useEffect, useRef } from 'react'
import Hls from 'hls.js'
import './CameraViewer.css'

function HLSViewer({ camera }) {
  const [status, setStatus] = useState('detenido')
  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState([])
  const [error, setError] = useState(null)
  const [streamUrl, setStreamUrl] = useState(null)
  
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const containerRef = useRef(null)

    // Iniciar streaming + grabación
  const startStreaming = async () => {
    try {
      setStatus('conectando')
      setError(null)

      const response = await fetch(`/api/media/start/${camera.id}`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error iniciando stream')
      }

      console.log('✅ Stream iniciado:', data)

      // Esperar 8 segundos para que FFmpeg genere segmentos HLS
      setStatus('generando_hls')
      await new Promise(resolve => setTimeout(resolve, 8000))

      // Intentar cargar HLS desde el puerto 3000 (a través del proxy de Vite)
      const hlsUrlViaProxy = `/api/media/hls/${camera.id}/index.m3u8`
      console.log('🎬 Intentando HLS vía proxy:', hlsUrlViaProxy)
      
      // Cargar HLS
      loadHLS(hlsUrlViaProxy)
      setIsRecording(true)
      setStatus('streaming')

    } catch (err) {
      console.error('❌ Error:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  // Detener streaming + grabación
  const stopStreaming = async () => {
    try {
      setStatus('deteniendo')

      // Cleanup HLS
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
      }

      const response = await fetch(`/api/media/stop/${camera.id}`, {
        method: 'POST'
      })

      const data = await response.json()
      console.log('🛑 Stream detenido:', data)

      setIsRecording(false)
      setStreamUrl(null)
      setStatus('detenido')
      
      // Recargar lista de grabaciones
      loadRecordings()

    } catch (err) {
      console.error('❌ Error deteniendo:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  // Cargar HLS con hls.js
  const loadHLS = (url) => {
    const video = videoRef.current
    if (!video) return

    console.log('🎬 Cargando HLS desde:', url)

    // Cleanup HLS anterior si existe
    if (hlsRef.current) {
      hlsRef.current.destroy()
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        maxFragLookUpTolerance: 0.25,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 6,
        levelLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000
      })

      hls.loadSource(url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest cargado correctamente')
        video.play().catch(err => {
          console.log('⚠️ Autoplay bloqueado por el navegador:', err)
          setError('Click en el video para reproducir')
        })
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS Error:', data)
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('🔄 Error de red, reintentando...')
              setTimeout(() => hls.startLoad(), 1000)
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('🔄 Error de media, recuperando...')
              hls.recoverMediaError()
              break
            default:
              console.error('💥 Error fatal irrecuperable')
              setError(`Error fatal: ${data.details}`)
              setStatus('error')
              hls.destroy()
              break
          }
        }
      })

      hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        console.log(`� Fragmento HLS cargado: ${data.frag.sn}`)
      })

      hlsRef.current = hls
      setStreamUrl(url)

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Soporte nativo (Safari)
      console.log('🍎 Usando reproductor HLS nativo de Safari')
      video.src = url
      video.addEventListener('loadedmetadata', () => {
        video.play()
      })
      setStreamUrl(url)
    } else {
      setError('Tu navegador no soporta HLS')
      setStatus('error')
    }
  }  // Cargar grabaciones
  const loadRecordings = async () => {
    try {
      const response = await fetch(`/api/media/recordings/${camera.id}`)
      const data = await response.json()
      setRecordings(data.recordings || [])
    } catch (err) {
      console.error('Error cargando grabaciones:', err)
    }
  }

  // Descargar grabación
  const downloadRecording = (filename) => {
    window.open(`/api/media/download/${camera.id}/${filename}`, '_blank')
  }

  // Eliminar grabación
  const deleteRecording = async (filename) => {
    if (!confirm(`¿Eliminar ${filename}?`)) return

    try {
      await fetch(`/api/media/recording/${camera.id}/${filename}`, {
        method: 'DELETE'
      })
      loadRecordings()
    } catch (err) {
      console.error('Error eliminando:', err)
    }
  }

  // Fullscreen
  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen()
    }
  }

  // Snapshot
  const handleSnapshot = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `snapshot-${camera.name}-${Date.now()}.png`
    link.click()
  }

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
      }
    }
  }, [])

  // Cargar grabaciones al montar
  useEffect(() => {
    if (camera) {
      loadRecordings()
    }
  }, [camera])

  const getStatusColor = () => {
    switch (status) {
      case 'streaming':
        return '#51cf66'
      case 'conectando':
      case 'generando_hls':
        return '#ffd43b'
      case 'error':
        return '#ff8787'
      default:
        return '#868e96'
    }
  }

  const formatFileSize = (bytes) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleString('es-ES')
  }

  if (!camera) {
    return (
      <div className="camera-viewer">
        <div className="placeholder">
          <p>Selecciona una cámara</p>
        </div>
      </div>
    )
  }

  return (
    <div className="camera-viewer">
      <div className="viewer-header">
        <h2>{camera.name}</h2>
        <div className="controls">
          {status === 'detenido' && (
            <button className="control-btn" onClick={startStreaming}>
              ▶️ Iniciar Stream + Grabación
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
          <button className="control-btn" onClick={loadRecordings}>
            🔄 Actualizar grabaciones
          </button>
          <div className="connection-status" style={{ backgroundColor: getStatusColor() }}>
            {status} {isRecording && '🔴 REC'}
          </div>
        </div>
      </div>

      <div className="video-container" ref={containerRef}>
        {(status === 'conectando' || status === 'generando_hls') && (
          <div className="loading">
            <div className="spinner"></div>
            <p>
              {status === 'conectando' && '⏳ Conectando con cámara...'}
              {status === 'generando_hls' && '⏳ Generando stream HLS (8 seg)...'}
            </p>
          </div>
        )}

        {status === 'detenido' && (
          <div className="loading">
            <p>▶️ Presiona "Iniciar Stream + Grabación"</p>
          </div>
        )}

        {error && (
          <div className="loading">
            <p style={{ color: '#ff8787' }}>❌ {error}</p>
          </div>
        )}

        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: status === 'streaming' ? 'block' : 'none'
          }}
          controls
          muted
        />

        <div className="stream-overlay">
          <span className="live-badge">
            {status === 'streaming' ? '🔴 LIVE' : '⚫ OFFLINE'}
            {isRecording && ' - GRABANDO'}
          </span>
          <span className="camera-info">{camera.name}</span>
        </div>
      </div>

      <div className="viewer-footer">
        <div className="info">
          <p><strong>Estado:</strong> {status}</p>
          <p><strong>URL RTSP:</strong> <code>{camera.rtspUrl}</code></p>
          <p><strong>Grabación:</strong> {isRecording ? '✅ Activa' : '❌ Inactiva'}</p>
          
          <hr style={{ margin: '1rem 0', borderColor: '#404040' }} />
          
          <h3>📼 Grabaciones ({recordings.length})</h3>
          {recordings.length === 0 && <p style={{ color: '#999' }}>No hay grabaciones</p>}
          
          <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '0.5rem' }}>
            {recordings.map((rec, idx) => (
              <div 
                key={idx}
                style={{
                  padding: '0.5rem',
                  marginBottom: '0.5rem',
                  background: '#1a1a1a',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{rec.filename}</div>
                  <div style={{ fontSize: '0.8rem', color: '#999' }}>
                    {formatFileSize(rec.size)} - {formatDate(rec.created)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="control-btn" 
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                    onClick={() => downloadRecording(rec.filename)}
                  >
                    ⬇️
                  </button>
                  <button 
                    className="control-btn" 
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                    onClick={() => deleteRecording(rec.filename)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HLSViewer
