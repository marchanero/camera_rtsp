import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play, Square, Maximize, Camera, Wifi, WifiOff,
  Loader2, AlertCircle, Gauge, RefreshCw, ChevronDown
} from 'lucide-react'

// Quality profiles — must match backend qualityProfiles keys
const QUALITY_PROFILES = [
  { value: 'mobile', label: 'Mobile', badge: '📱', desc: '960×290 · 20 fps', hint: 'Redes lentas / baja potencia' },
  { value: 'low', label: 'Baja', badge: '🔽', desc: '1280×387 · 25 fps', hint: 'Fluido en redes moderadas' },
  { value: 'medium', label: 'Media', badge: '⚖️', desc: '1920×580 · 30 fps', hint: 'Equilibrio calidad/rendimiento' },
  { value: 'high', label: 'Alta', badge: '🔼', desc: '2560×776 · 30 fps', hint: 'Alta calidad, más ancho de banda' },
  { value: 'ultra', label: 'Ultra', badge: '💎', desc: 'Original · 30 fps', hint: 'Máxima calidad, sin escalado' },
]

const QUALITY_KEY = (cameraId) => `webrtc-quality-${cameraId}`

function getStoredQuality(cameraId) {
  try { return localStorage.getItem(QUALITY_KEY(cameraId)) || 'medium' } catch { return 'medium' }
}

function saveQuality(cameraId, quality) {
  try { localStorage.setItem(QUALITY_KEY(cameraId), quality) } catch { }
}

export default function WebRTCViewer({ camera }) {
  const [status, setStatus] = useState('idle') // idle | connecting | streaming | stopping | error
  const [error, setError] = useState(null)
  const [fps, setFps] = useState(0)
  const [resolution, setResolution] = useState({ w: 0, h: 0 })
  const [quality, setQuality] = useState(() => getStoredQuality(camera?.id))
  const [pendingQuality, setPendingQuality] = useState(null) // quality change while streaming
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false)

  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const frameCountRef = useRef(0)
  const lastFpsRef = useRef(Date.now())
  const renderQueueRef = useRef([])
  const isRenderingRef = useRef(false)
  const qualityMenuRef = useRef(null)

  // Close quality menu on outside click
  useEffect(() => {
    if (!qualityMenuOpen) return
    const handler = (e) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target)) setQualityMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [qualityMenuOpen])

  // Reset quality state when camera changes
  useEffect(() => {
    if (camera?.id) setQuality(getStoredQuality(camera.id))
  }, [camera?.id])

  const renderFrames = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || renderQueueRef.current.length === 0) {
      isRenderingRef.current = false
      return
    }
    // Take latest frame, discard stale ones
    const bitmap = renderQueueRef.current.pop()
    renderQueueRef.current = []
    try {
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        setResolution({ w: bitmap.width, h: bitmap.height })
      }
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
    } catch { }
    if (renderQueueRef.current.length > 0) requestAnimationFrame(renderFrames)
    else isRenderingRef.current = false
  }, [])

  const startStreaming = useCallback(async (overrideQuality) => {
    const selectedQuality = overrideQuality || quality
    try {
      setStatus('connecting')
      setError(null)

      const response = await fetch(`/api/webrtc/start/${camera.id}`, { method: 'POST' })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Error iniciando stream')

      const wsUrl = data.wsUrl.replace('localhost', window.location.hostname) + `?quality=${selectedQuality}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      ws.binaryType = 'arraybuffer'

      ws.onopen = () => setStatus('streaming')

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data)
          if (msg.type === 'stream_ended' || msg.type === 'stream_stopped') {
            setStatus('idle')
            setError('Stream terminado')
          }
          return
        }
        try {
          const bitmap = await createImageBitmap(new Blob([event.data], { type: 'image/jpeg' }))
          renderQueueRef.current.push(bitmap)
          if (!isRenderingRef.current) {
            isRenderingRef.current = true
            requestAnimationFrame(renderFrames)
          }
          frameCountRef.current++
          const now = Date.now()
          const elapsed = now - lastFpsRef.current
          if (elapsed >= 1000) {
            setFps(Math.round((frameCountRef.current / elapsed) * 1000))
            frameCountRef.current = 0
            lastFpsRef.current = now
          }
        } catch { }
      }

      ws.onerror = () => { setError('Error de conexión WebSocket'); setStatus('error') }
      ws.onclose = () => { if (wsRef.current === ws) setStatus('idle') }
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [camera?.id, quality, renderFrames])

  const stopStreaming = useCallback(async () => {
    setStatus('stopping')
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    try { await fetch(`/api/webrtc/stop/${camera.id}`, { method: 'POST' }) } catch { }
    setStatus('idle')
    setFps(0)
    setPendingQuality(null)
  }, [camera?.id])

  const changeQuality = useCallback((newQuality) => {
    setQuality(newQuality)
    saveQuality(camera?.id, newQuality)
    setQualityMenuOpen(false)
    if (status === 'streaming') {
      setPendingQuality(newQuality)
    }
  }, [status, camera?.id])

  const applyPendingQuality = useCallback(async () => {
    const q = pendingQuality
    setPendingQuality(null)
    await stopStreaming()
    await startStreaming(q)
  }, [pendingQuality, stopStreaming, startStreaming])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
      renderQueueRef.current.forEach(b => { try { b.close() } catch { } })
      renderQueueRef.current = []
      isRenderingRef.current = false
    }
  }, [])

  // Helpers
  const isStreaming = status === 'streaming'
  const isConnecting = status === 'connecting' || status === 'stopping'
  const currentProfile = QUALITY_PROFILES.find(p => p.value === quality) || QUALITY_PROFILES[2]

  const statusConfig = {
    streaming: { color: 'bg-emerald-500', text: 'text-emerald-400', label: `LIVE · ${fps} FPS` },
    connecting: { color: 'bg-yellow-500', text: 'text-yellow-400', label: 'Conectando...' },
    stopping: { color: 'bg-yellow-500', text: 'text-yellow-400', label: 'Deteniendo...' },
    error: { color: 'bg-red-500', text: 'text-red-400', label: 'Error' },
    idle: { color: 'bg-gray-500', text: 'text-gray-400', label: 'Detenido' },
  }
  const sc = statusConfig[status] || statusConfig.idle

  if (!camera) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>Selecciona una cámara para ver el stream</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header controls ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${sc.color} ${isStreaming ? 'animate-pulse' : ''}`} />
          <span className={`text-sm font-medium ${sc.text}`}>{sc.label}</span>
          {resolution.w > 0 && isStreaming && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{resolution.w}×{resolution.h}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quality selector */}
          <div className="relative" ref={qualityMenuRef}>
            <button
              onClick={() => setQualityMenuOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Cambiar calidad de stream"
            >
              <Gauge className="w-4 h-4 text-blue-500" />
              <span>{currentProfile.badge} {currentProfile.label}</span>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${qualityMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {qualityMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Calidad del stream</p>
                </div>
                {QUALITY_PROFILES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => changeQuality(p.value)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${quality === p.value ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                  >
                    <span className="text-base">{p.badge}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${quality === p.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                        {p.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{p.desc}</div>
                    </div>
                    {quality === p.value && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pending quality change banner */}
          {pendingQuality && (
            <button
              onClick={applyPendingQuality}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Aplicar calidad
            </button>
          )}

          {/* Main stream control */}
          {!isStreaming && !isConnecting && (
            <button
              onClick={() => startStreaming()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Iniciar stream
            </button>
          )}
          {isConnecting && (
            <button disabled className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-xl text-sm font-medium cursor-not-allowed">
              <Loader2 className="w-4 h-4 animate-spin" />
              {status === 'connecting' ? 'Conectando...' : 'Deteniendo...'}
            </button>
          )}
          {isStreaming && (
            <button
              onClick={stopStreaming}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Square className="w-4 h-4" />
              Detener
            </button>
          )}

          {/* Fullscreen */}
          <button
            onClick={() => canvasRef.current?.requestFullscreen?.()}
            disabled={!isStreaming}
            className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Pantalla completa"
          >
            <Maximize className="w-4 h-4" />
          </button>

          {/* Snapshot */}
          <button
            onClick={() => {
              const canvas = canvasRef.current
              if (!canvas) return
              const a = document.createElement('a')
              a.href = canvas.toDataURL('image/png')
              a.download = `snapshot-${camera.name}-${Date.now()}.png`
              a.click()
            }}
            disabled={!isStreaming}
            className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Captura de pantalla"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Video canvas ─────────────────────────────────────────────── */}
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video w-full">
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ display: isStreaming ? 'block' : 'none' }}
        />

        {/* Placeholder states */}
        {!isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            {status === 'connecting' || status === 'stopping' ? (
              <>
                <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
                <p className="text-gray-400 text-sm">{status === 'connecting' ? 'Conectando con cámara...' : 'Deteniendo stream...'}</p>
              </>
            ) : error ? (
              <>
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={() => { setError(null); startStreaming() }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors"
                >
                  Reintentar
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                  <WifiOff className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-gray-500 text-sm">Stream detenido</p>
                <p className="text-gray-600 text-xs">{currentProfile.badge} {currentProfile.label} · {currentProfile.desc}</p>
              </>
            )}
          </div>
        )}

        {/* Live badge overlay */}
        {isStreaming && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-xs font-semibold text-white">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              LIVE · {fps} FPS
            </span>
            {resolution.w > 0 && (
              <span className="px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-xs text-gray-300">
                {resolution.w}×{resolution.h}
              </span>
            )}
          </div>
        )}

        {/* Quality badge while streaming */}
        {isStreaming && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-xs text-gray-300 flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              {currentProfile.label}
              {pendingQuality && <span className="text-amber-400 ml-1">→ {QUALITY_PROFILES.find(p => p.value === pendingQuality)?.label}</span>}
            </span>
          </div>
        )}
      </div>

      {/* ── Info footer ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Estado', value: sc.label },
          { label: 'Calidad', value: `${currentProfile.badge} ${currentProfile.label} (${currentProfile.desc})` },
          { label: 'Resolución', value: resolution.w > 0 ? `${resolution.w}×${resolution.h}` : '—' },
          { label: 'RTSP URL', value: camera.rtspUrl || '—', mono: true },
        ].map(({ label, value, mono }) => (
          <div key={label} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide mb-0.5">{label}</p>
            <p className={`text-xs text-gray-700 dark:text-gray-300 truncate ${mono ? 'font-mono' : ''}`} title={value}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
