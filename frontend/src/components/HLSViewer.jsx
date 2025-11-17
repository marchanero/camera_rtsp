import React, { useState, useEffect, useRef } from 'react'
import Hls from 'hls.js'
import ConfirmModal from './ConfirmModal'
import RecordingControl from './RecordingControl'
import './CameraViewer.css'

function HLSViewer({ camera }) {
  const [status, setStatus] = useState('detenido')
  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState([])
  const [error, setError] = useState(null)
  const [streamUrl, setStreamUrl] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, filename: '', cameraId: null })
  
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const containerRef = useRef(null)

    // Iniciar streaming + grabación
  const startStreaming = async () => {
    try {
      setStatus('conectando')
      setError(null)

      // Iniciar stream HLS (la grabación ya debería estar activa automáticamente)
      const response = await fetch(`/api/media/start-hls/${camera.id}`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error iniciando stream')
      }

      console.log('✅ Stream HLS iniciado:', data)

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

      // Solo detener stream HLS (la grabación sigue activa en background)
      const response = await fetch(`/api/media/stop-hls/${camera.id}`, {
        method: 'POST'
      })

      const data = await response.json()
      console.log('🛑 Stream HLS detenido:', data)

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
    setConfirmDelete({
      isOpen: true,
      filename,
      cameraId: camera.id
    })
  }

  const confirmDeleteRecording = async () => {
    try {
      await fetch(`/api/media/recording/${confirmDelete.cameraId}/${confirmDelete.filename}`, {
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
          {/* Control de Grabación Separado */}
          <RecordingControl camera={camera} />
          
          {/* Controles de Visualización HLS */}
          {status === 'detenido' && (
            <button className="control-btn" onClick={startStreaming}>
              ▶️ Iniciar Stream HLS
            </button>
          )}
          {status === 'streaming' && (
            <button className="control-btn" onClick={stopStreaming}>
              ⏹️ Detener Stream
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
            <p>▶️ Presiona "Iniciar Stream HLS"</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              💾 La grabación continua ya está activa en segundo plano
            </p>
          </div>
        )}

        {error && (
          <div className="loading">
            <p className="text-red-400">❌ {error}</p>
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
          <p><strong>Grabación:</strong> ✅ Continua (sin pérdida de calidad)</p>
          
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded">
            <p className="text-sm text-green-700 dark:text-green-300">
              ℹ️ <strong>Modo HLS:</strong> Grabación continua en MP4 sin pérdida + Visualización HLS
            </p>
          </div>
          
          <hr className="my-4 border-gray-300 dark:border-gray-600" />
          
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">📼 Grabaciones ({recordings.length})</h3>
          {recordings.length === 0 && <p className="text-gray-500 dark:text-gray-400">No hay grabaciones</p>}
          
          <div className="max-h-[200px] overflow-y-auto mt-2">
            {recordings.map((rec, idx) => (
              <div 
                key={idx}
                className="p-2 mb-2 bg-gray-100 dark:bg-gray-700 rounded flex justify-between items-center"
              >
                <div className="flex-1">
                  <div className="font-bold text-gray-900 dark:text-white">{rec.filename}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {formatFileSize(rec.size)} - {formatDate(rec.created)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    className="control-btn py-1 px-2 text-xs" 
                    onClick={() => downloadRecording(rec.filename)}
                  >
                    ⬇️
                  </button>
                  <button 
                    className="control-btn py-1 px-2 text-xs" 
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

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, filename: '', cameraId: null })}
        onConfirm={confirmDeleteRecording}
        title="Eliminar Grabación"
        message={`¿Estás seguro que deseas eliminar "${confirmDelete.filename}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDanger={true}
      />
    </div>
  )
}

export default HLSViewer
