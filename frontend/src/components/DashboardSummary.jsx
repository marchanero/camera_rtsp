import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRecording } from '../contexts/RecordingContext'
import { useMQTTStore } from '../stores/useMQTTStore'
import { useScenario } from '../contexts/ScenarioContext'
import api from '../services/api'
import { toast } from 'react-hot-toast'

// Import new modular components
import StatusBar from './dashboard/StatusBar'
import RecordingControl from './dashboard/RecordingControl'
import CameraGrid from './dashboard/CameraGrid'
import RecordingsList from './dashboard/RecordingsList'
import SystemStats from './dashboard/SystemStats'

/**
 * DashboardSummary - Main dashboard layout and data coordinator
 * 
 * Responsibilities:
 * - Data fetching (cameras, disk info, recordings)
 * - State management and distribution to child components
 * - Effect hooks for polling and updates
 * - Layout coordination
 */
const DashboardSummary = () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [cameraRecordings, setCameraRecordings] = useState([])
  const [sensorRecordings, setSensorRecordings] = useState([])
  const [cameraStatus, setCameraStatus] = useState(new Map())
  const [syncStatus, setSyncStatus] = useState({ isConnected: false, isSyncing: false })
  const [stats, setStats] = useState({
    totalCameras: 0,
    activeCameras: 0,
    recordingCameras: 0,
    totalSensors: 0,
    activeSensors: 0,
    messagesPerSecond: 0,
    mqttStatus: 'disconnected'
  })
  const [localDiskInfo, setLocalDiskInfo] = useState(null)
  const [remoteDiskInfo, setRemoteDiskInfo] = useState(null)
  const [diskNotifications, setDiskNotifications] = useState({
    localWarningShown: false,
    localCriticalShown: false,
    remoteWarningShown: false,
    remoteCriticalShown: false
  })

  // Recording state
  const [recordingState, setRecordingState] = useState('idle')
  const [elapsedTime, setElapsedTime] = useState(0)
  const recordingStartTime = useRef(null)

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXTS
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    recordings,
    getRecordings,
    downloadRecording,
    deleteRecording,
    activeRecordingsCount,
    startAllRecordings,
    stopAllRecordings,
    getMaxElapsedSeconds,
    getOldestStartTime,
    initialSyncDone,
    isSyncing
  } = useRecording()

  const sensorData = useMQTTStore(s => s.sensorData)
  const messageRate = useMQTTStore(s => s.messageRate)
  const totalMessages = useMQTTStore(s => s.totalMessages)
  const mqttConnected = useMQTTStore(s => s.isConnected)
  const mqttError = useMQTTStore(s => s.error)

  const {
    activeScenario,
    setActiveScenario,
    getActiveSensors
  } = useScenario()

  // ═══════════════════════════════════════════════════════════════════════════
  // REFS FOR STABLE CALLBACKS
  // ═══════════════════════════════════════════════════════════════════════════

  const getMaxElapsedSecondsRef = useRef(getMaxElapsedSeconds)
  const getOldestStartTimeRef = useRef(getOldestStartTime)
  getMaxElapsedSecondsRef.current = getMaxElapsedSeconds
  getOldestStartTimeRef.current = getOldestStartTime

  // ═══════════════════════════════════════════════════════════════════════════
  // RECORDING TIMER LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  const calculateElapsedTime = useCallback(() => {
    const syncedElapsed = getMaxElapsedSecondsRef.current?.() || 0
    if (syncedElapsed > 0) {
      return syncedElapsed
    }
    if (!recordingStartTime.current) return 0
    return Math.max(0, Math.floor((Date.now() - recordingStartTime.current) / 1000))
  }, [])

  // Timer for recording
  useEffect(() => {
    let interval
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        setElapsedTime(calculateElapsedTime())
      }, 1000)
      setElapsedTime(calculateElapsedTime())
    }
    return () => clearInterval(interval)
  }, [recordingState, calculateElapsedTime])

  // Sync on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && recordingState === 'recording') {
        setElapsedTime(calculateElapsedTime())
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [recordingState, calculateElapsedTime])

  // Sync with recording context
  useEffect(() => {
    // 1. Manejar transición de estado
    if (activeRecordingsCount > 0 && recordingState === 'idle') {
      setRecordingState('recording')
    } else if (activeRecordingsCount === 0 && recordingState === 'recording') {
      setRecordingState('idle')
      recordingStartTime.current = null
      setElapsedTime(0)
    }

    // 2. Manejar inicialización/actualización del timer
    // Esto se ejecuta si hay grabaciones, independientemente de si acabamos de cambiar a 'recording' o ya lo estábamos
    if (activeRecordingsCount > 0 && initialSyncDone) {
      const syncedElapsed = getMaxElapsedSecondsRef.current?.() || 0
      const oldestStart = getOldestStartTimeRef.current?.()

      // Si no tenemos timestamp de inicio local, o si el backend nos da uno mejor, actualizar
      if (!recordingStartTime.current || oldestStart) {
        if (oldestStart) {
          recordingStartTime.current = new Date(oldestStart).getTime()
        } else if (!recordingStartTime.current) {
          // Fallback solo si no tenemos nada
          recordingStartTime.current = Date.now()
        }
      }

      // Actualizar tiempo transcurrido visual
      if (syncedElapsed > 0) {
        setElapsedTime(syncedElapsed)
      } else {
        setElapsedTime(calculateElapsedTime())
      }
    }
  }, [activeRecordingsCount, recordingState, initialSyncDone, calculateElapsedTime])

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const checkCameraStatus = async (cameraId) => {
    try {
      const response = await fetch(`/api/stream/status/${cameraId}`, {
        signal: AbortSignal.timeout(3000)
      })
      const data = await response.json()
      return data.active || false
    } catch {
      return true
    }
  }

  const checkDiskLevels = (diskInfo, diskType) => {
    if (!diskInfo?.available || !diskInfo.usePercent) return

    const usePercent = diskInfo.usePercent
    const isLocal = diskType === 'local'

    if (usePercent < 70) {
      setDiskNotifications(prev => ({
        ...prev,
        [`${diskType}WarningShown`]: false,
        [`${diskType}CriticalShown`]: false
      }))
      return
    }

    if (usePercent >= 75 && usePercent < 90 && !diskNotifications[`${diskType}WarningShown`]) {
      toast.warning(
        `⚠️ Disco ${isLocal ? 'Local' : 'Remoto'} casi lleno`,
        {
          description: `${usePercent}% usado. Considere liberar espacio.`,
          duration: 6000,
        }
      )
      setDiskNotifications(prev => ({
        ...prev,
        [`${diskType}WarningShown`]: true
      }))
    }

    if (usePercent >= 90 && !diskNotifications[`${diskType}CriticalShown`]) {
      toast.error(
        `🚨 Disco ${isLocal ? 'Local' : 'Remoto'} CRÍTICAMENTE lleno`,
        {
          description: `${usePercent}% usado. ¡Libere espacio inmediatamente!`,
          duration: 8000,
        }
      )
      setDiskNotifications(prev => ({
        ...prev,
        [`${diskType}CriticalShown`]: true
      }))
    }
  }

  const loadRecordings = async (cameraId) => {
    const recordings = await getRecordings(cameraId)
    setCameraRecordings(recordings)

    try {
      const response = await fetch(`/api/media/sensors/recordings/${cameraId}`)
      const data = await response.json()
      setSensorRecordings(data.recordings || [])
    } catch {
      setSensorRecordings([])
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS FOR DATA POLLING
  // ═══════════════════════════════════════════════════════════════════════════

  // Load cameras
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const data = await api.getCameras()
        setCameras(data)

        const initialStatus = new Map(
          data.map(camera => [
            camera.id,
            { active: camera.isActive, lastCheck: Date.now(), fromDB: true }
          ])
        )
        setCameraStatus(initialStatus)

        if (data.length > 0 && !selectedCameraId) {
          const activeCamera = data.find(camera => camera.isActive)
          const cameraToSelect = activeCamera || data[0]
          setSelectedCameraId(cameraToSelect.id)
        }

        // No llamar syncRecordingStatus aquí - la sincronización inicial
        // ya se hace en RecordingContext usando /api/recordings/sync/status

        data.forEach(async (camera) => {
          try {
            const isActive = await checkCameraStatus(camera.id)
            setCameraStatus(prev => new Map(prev).set(camera.id, {
              active: isActive,
              lastCheck: Date.now(),
              fromDB: false
            }))
          } catch (error) {
            console.error(`Error verificando cámara ${camera.id}:`, error)
          }
        })
      } catch (error) {
        console.error('Error cargando cámaras:', error)
      }
    }

    fetchCameras()
    const interval = setInterval(fetchCameras, 60000)
    return () => clearInterval(interval)
  }, [selectedCameraId])

  // Load sync status
  // Load sync status — diferido 3s para no bloquear carga inicial
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const response = await fetch('/api/sync/status')
        if (!response.ok) return
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const data = await response.json()
          if (data.success) {
            setSyncStatus(data.data)
          }
        }
      } catch { }
    }

    const initialDelay = setTimeout(() => {
      fetchSyncStatus()
    }, 3000)
    const interval = setInterval(fetchSyncStatus, 10000)
    return () => { clearTimeout(initialDelay); clearInterval(interval) }
  }, [])

  // Load local disk info — diferido 3s
  useEffect(() => {
    const fetchDiskInfo = async () => {
      try {
        const data = await api.getReplicationDiskInfo()
        setLocalDiskInfo(data)
        if (data) checkDiskLevels(data, 'local')
      } catch (error) {
        console.error('Error cargando información del disco:', error)
        setLocalDiskInfo(null)
      }
    }

    const initialDelay = setTimeout(() => {
      fetchDiskInfo()
    }, 3000)
    const interval = setInterval(fetchDiskInfo, 30000)
    return () => { clearTimeout(initialDelay); clearInterval(interval) }
  }, [])

  // Load remote disk info — diferido 3s
  useEffect(() => {
    const fetchRemoteDiskInfo = async () => {
      try {
        const response = await fetch('/api/replication/remote-disk-info')
        if (response.ok) {
          const data = await response.json()
          setRemoteDiskInfo(data)
          if (data) checkDiskLevels(data, 'remote')
        } else {
          setRemoteDiskInfo(null)
        }
      } catch (error) {
        console.error('Error cargando información del disco remoto:', error)
        setRemoteDiskInfo(null)
      }
    }

    const initialDelay = setTimeout(() => {
      fetchRemoteDiskInfo()
    }, 3000)
    const interval = setInterval(fetchRemoteDiskInfo, 30000)
    return () => { clearTimeout(initialDelay); clearInterval(interval) }
  }, [])

  // Update stats
  useEffect(() => {
    const activeSensorsCount = Array.from(sensorData.values()).filter(
      sensor => Date.now() - new Date(sensor.timestamp).getTime() < 10000
    ).length

    const activeCamerasCount = Array.from(cameraStatus.values()).filter(
      status => status.active
    ).length

    setStats({
      totalCameras: cameras.length,
      activeCameras: activeCamerasCount,
      recordingCameras: activeRecordingsCount,
      totalSensors: sensorData.size,
      activeSensors: activeSensorsCount,
      messagesPerSecond: messageRate,
      mqttStatus: mqttConnected ? 'connected' : 'disconnected',
      mqttError: mqttError,
      totalMessages: totalMessages
    })
  }, [cameras, cameraStatus, activeRecordingsCount, sensorData, messageRate, mqttConnected, mqttError, totalMessages])

  // Load recordings when camera selected
  useEffect(() => {
    if (selectedCameraId) {
      loadRecordings(selectedCameraId)
    }
  }, [selectedCameraId])

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleStartRecording = async () => {
    await startAllRecordings(cameras, { scenarioName: activeScenario?.name || 'sin_escenario' })
    setRecordingState('recording')
  }

  const handleStopRecording = async () => {
    await stopAllRecordings()
    setRecordingState('idle')
    setElapsedTime(0)
  }

  const handleDeleteRecording = async (filename) => {
    try {
      const result = await deleteRecording(selectedCameraId, filename)
      if (result.success) {
        await loadRecordings(selectedCameraId)
      } else {
        console.error('Error eliminando grabación:', result.error)
        alert('Error al eliminar la grabación')
      }
    } catch (error) {
      console.error('Error eliminando grabación:', error)
      alert('Error al eliminar la grabación')
    }
  }

  const handleDownloadRecording = async (filename) => {
    try {
      const result = await downloadRecording(selectedCameraId, filename)
      if (!result.success) {
        console.error('Error descargando grabación:', result.error)
        alert('Error al descargar la grabación')
      }
    } catch (error) {
      console.error('Error descargando grabación:', error)
      alert('Error al descargar la grabación')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════

  const selectedCamera = useMemo(() => {
    return cameras.find(c => c.id === selectedCameraId)
  }, [cameras, selectedCameraId])

  const scenarioSensorIds = activeScenario ? getActiveSensors() : []

  const activeSensorsList = useMemo(() => {
    const uniqueSensors = new Map()

    Array.from(sensorData.entries()).forEach(([sensorId, data]) => {
      const isRecent = Date.now() - new Date(data.timestamp).getTime() < 10000
      // Show ONLY sensors assigned to the active scenario
      const isInScenario = scenarioSensorIds.includes(sensorId) ||
        scenarioSensorIds.includes(String(sensorId))

      if (isRecent && isInScenario) {
        uniqueSensors.set(sensorId, {
          id: sensorId,
          type: data.type || sensorId,
          value: data.value,
          timestamp: data.timestamp,
          lastSeen: Date.now() - new Date(data.timestamp).getTime()
        })
      }
    })

    return Array.from(uniqueSensors.values())
      .sort((a, b) => (a.type || '').localeCompare(b.type || ''))
      .slice(0, 5)
  }, [sensorData, scenarioSensorIds])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <StatusBar
        activeScenario={activeScenario}
        onScenarioChange={setActiveScenario}
        recordingState={recordingState}
        elapsedTime={elapsedTime}
        mqttConnected={mqttConnected}
        syncStatus={syncStatus}
        isRecordingSyncing={isSyncing && recordingState === 'recording'}
      />

      {/* Main Layout - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left Column - Cameras and Recordings (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recording Control */}
          <RecordingControl
            cameras={cameras}
            recordingState={recordingState}
            activeRecordingsCount={activeRecordingsCount}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
            elapsedTime={elapsedTime}
          />

          {/* Camera Grid */}
          <CameraGrid
            cameras={cameras}
            cameraStatus={cameraStatus}
            recordings={recordings}
            selectedCameraId={selectedCameraId}
            onCameraSelect={setSelectedCameraId}
            stats={stats}
          />

          {/* Recordings List */}
          {selectedCamera && (
            <RecordingsList
              selectedCamera={selectedCamera}
              videoRecordings={cameraRecordings}
              sensorRecordings={sensorRecordings}
              onClose={() => {
                setSelectedCameraId(null)
                setCameraRecordings([])
                setSensorRecordings([])
              }}
              onDownload={handleDownloadRecording}
              onDelete={handleDeleteRecording}
              onConsolidate={async (cameraId) => {
                try {
                  // Obtener la ruta del directorio de grabaciones
                  const firstRecording = cameraRecordings.find(r => !r.filename.includes('_COMPLETO'))
                  if (!firstRecording || !firstRecording.path) {
                    toast.error('No se encontraron segmentos para consolidar')
                    return
                  }

                  // Extraer el directorio del path
                  const recordingPath = firstRecording.path.substring(0, firstRecording.path.lastIndexOf('/'))

                  const response = await fetch('/api/recordings/consolidate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      recordingPath,
                      cameraName: selectedCamera.name,
                      scenarioName: activeScenario?.name
                    })
                  })

                  const result = await response.json()

                  if (result.success) {
                    toast.success(`Consolidación completada: ${result.segmentsCount} segmentos unidos`)
                    await loadRecordings(cameraId)
                  } else {
                    toast.error(`Error: ${result.error}`)
                  }
                } catch (error) {
                  console.error('Error consolidando:', error)
                  toast.error('Error al consolidar los segmentos')
                }
              }}
            />
          )}
        </div>

        {/* Right Column - System Stats (1/3) */}
        <div>
          <SystemStats
            localDiskInfo={localDiskInfo}
            remoteDiskInfo={remoteDiskInfo}
            activeSensors={activeSensorsList}
            stats={stats}
          />
        </div>
      </div>
    </div>
  )
}

export default DashboardSummary
