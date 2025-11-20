import { useState, useEffect } from 'react'
import { useRecording } from '../contexts/RecordingContext'
import { useMQTT } from '../contexts/MQTTContext'
import { useScenario } from '../contexts/ScenarioContext'
import api from '../services/api'
import RecordingControlGlobal from './RecordingControlGlobal'
import SyncStatus from './SyncStatus'

const DashboardSummary = () => {
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [cameraRecordings, setCameraRecordings] = useState([])
  const [sensorRecordings, setSensorRecordings] = useState([])
  const [recordingTab, setRecordingTab] = useState('video') // 'video' o 'sensors'
  const [cameraStatus, setCameraStatus] = useState(new Map()) // Map<cameraId, {active, lastCheck}>
  const [stats, setStats] = useState({
    totalCameras: 0,
    activeCameras: 0,
    recordingCameras: 0,
    totalSensors: 0,
    activeSensors: 0,
    messagesPerSecond: 0,
    mqttStatus: 'disconnected'
  })
  
  const { 
    recordings, 
    isRecording,
    getRecordings,
    downloadRecording,
    deleteRecording,
    activeRecordingsCount,
    syncRecordingStatus
  } = useRecording()
  
  const { 
    sensorData, 
    messageRate, 
    totalMessages,
    isConnected: mqttConnected,
    error: mqttError 
  } = useMQTT()

  const { 
    scenarios, 
    activeScenario, 
    setActiveScenario,
    loading: scenariosLoading 
  } = useScenario()

  // Debug: Verificar valor de activeScenario
  useEffect(() => {
    console.log('🎭 DashboardSummary - activeScenario cambió:', {
      activeScenario,
      id: activeScenario?.id,
      name: activeScenario?.name,
      localStorage: localStorage.getItem('activeScenarioId')
    })
  }, [activeScenario])

  // Verificar estado de una cámara (simplificado)
  const checkCameraStatus = async (cameraId) => {
    try {
      // Intentar verificar conectividad, pero no bloquear si falla
      const response = await fetch(`/api/stream/status/${cameraId}`, {
        signal: AbortSignal.timeout(3000) // Timeout de 3 segundos
      })
      const data = await response.json()
      return data.active || false
    } catch (error) {
      // Si falla la verificación FFmpeg, asumir que está activa si está en la BD
      console.warn(`⚠️ No se pudo verificar FFmpeg para cámara ${cameraId}, usando estado de BD`)
      return true // Asumir activa por defecto
    }
  }

  // Cargar cámaras y verificar su estado
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const data = await api.getCameras()
        setCameras(data)
        
        // Inicializar estado basado en isActive de la BD
        const initialStatus = new Map(
          data.map(camera => [
            camera.id, 
            { active: camera.isActive, lastCheck: Date.now(), fromDB: true }
          ])
        )
        setCameraStatus(initialStatus)
        
        // Sincronizar estado de grabación desde el backend
        data.forEach(camera => {
          syncRecordingStatus(camera.id, camera.name)
        })
        
        // Verificar conectividad real en segundo plano (no bloqueante)
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
    const interval = setInterval(fetchCameras, 60000) // Verificar cada 60 segundos (reducido para evitar pérdida de estado)
    return () => clearInterval(interval)
  }, [syncRecordingStatus])

  // Actualizar estadísticas
  useEffect(() => {
    const activeSensorsCount = Array.from(sensorData.values()).filter(
      sensor => Date.now() - new Date(sensor.timestamp).getTime() < 10000
    ).length

    const activeCamerasCount = Array.from(cameraStatus.values()).filter(
      status => status.active
    ).length

    console.log('📊 Stats Update:', {
      sensorDataSize: sensorData.size,
      activeSensorsCount,
      sensorDataEntries: Array.from(sensorData.entries()).map(([id, data]) => ({ id, type: data.type }))
    })

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

  // Cargar grabaciones cuando se selecciona una cámara
  useEffect(() => {
    if (selectedCameraId) {
      loadRecordings(selectedCameraId)
    }
  }, [selectedCameraId])

  const loadRecordings = async (cameraId) => {
    // Cargar grabaciones de video
    const recordings = await getRecordings(cameraId)
    setCameraRecordings(recordings)
    
    // Cargar grabaciones de sensores
    try {
      const response = await fetch(`/api/media/sensors/recordings/${cameraId}`)
      const data = await response.json()
      setSensorRecordings(data.recordings || [])
    } catch (error) {
      console.error('Error cargando grabaciones de sensores:', error)
      setSensorRecordings([])
    }
  }

  const handleDeleteRecording = async (filename) => {
    if (!confirm(`¿Eliminar grabación ${filename}?`)) return
    
    const result = await deleteRecording(selectedCameraId, filename)
    if (result.success) {
      await loadRecordings(selectedCameraId)
    }
  }

  const handleDeleteSensorRecording = async (filename) => {
    if (!confirm(`¿Eliminar grabación de sensores ${filename}?`)) return
    
    try {
      const response = await fetch(`/api/media/sensors/recording/${selectedCameraId}/${filename}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        await loadRecordings(selectedCameraId)
      }
    } catch (error) {
      console.error('Error eliminando grabación de sensores:', error)
    }
  }

  const handleDownloadSensorRecording = (filename) => {
    window.open(`/api/media/sensors/download/${selectedCameraId}/${filename}`, '_blank')
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins}m ${secs}s`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            📊 Dashboard Resumen
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Vista general del sistema de cámaras y sensores
          </p>
        </div>
      </div>

      {/* Escenario Activo */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-3">
              <span className="text-3xl">🎭</span>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Escenario Activo
              </label>
              {activeScenario ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {activeScenario.name}
                    </h3>
                    {activeScenario.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {activeScenario.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveScenario(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium"
                  >
                    Desactivar
                  </button>
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400 italic">
                  Sin escenario activo (mostrando todo)
                </div>
              )}
            </div>
          </div>
          
          {/* Info del escenario activo */}
          {activeScenario && (
            <div className="ml-6 flex items-center gap-4 text-sm">
              <div className="text-center px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {activeScenario.cameras?.length || 0}
                </div>
                <div className="text-gray-600 dark:text-gray-400">Cámaras</div>
              </div>
              <div className="text-center px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {activeScenario.sensors?.length || 0}
                </div>
                <div className="text-gray-600 dark:text-gray-400">Sensores</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control de Grabación Global */}
      <RecordingControlGlobal />

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cámaras */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm font-medium">Cámaras</p>
              <p className="text-4xl font-bold mt-2">{stats.totalCameras}</p>
              <p className="text-sm text-blue-100 mt-2">
                {stats.activeCameras} activa{stats.activeCameras !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-blue-400/30 rounded-lg p-3">
              <span className="text-3xl">📹</span>
            </div>
          </div>
        </div>

        {/* Grabando */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-red-100 text-sm font-medium">Grabando</p>
              <p className="text-4xl font-bold mt-2">{stats.recordingCameras}</p>
            </div>
            <div className="bg-red-400/30 rounded-lg p-3">
              <span className="text-3xl">🔴</span>
            </div>
          </div>
          {stats.recordingCameras > 0 && (
            <div className="mt-3 flex items-center">
              <span className="animate-pulse mr-2">●</span>
              <span className="text-sm text-red-100">En vivo</span>
            </div>
          )}
        </div>

        {/* Sensores Activos */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100 text-sm font-medium">Sensores Activos</p>
              <p className="text-4xl font-bold mt-2">
                {stats.activeSensors}/{stats.totalSensors}
              </p>
            </div>
            <div className="bg-green-400/30 rounded-lg p-3">
              <span className="text-3xl">📡</span>
            </div>
          </div>
        </div>

        {/* MQTT Status */}
        <div className={`bg-gradient-to-br ${
          stats.mqttStatus === 'connected' 
            ? 'from-purple-500 to-purple-600' 
            : 'from-gray-500 to-gray-600'
        } rounded-xl shadow-lg p-6 text-white`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-purple-100 text-sm font-medium">MQTT</p>
              <p className="text-2xl font-bold mt-2">
                {stats.messagesPerSecond.toFixed(1)} msg/s
              </p>
              {stats.mqttError && (
                <p className="text-xs text-red-200 mt-1 truncate" title={stats.mqttError}>
                  Error: {stats.mqttError}
                </p>
              )}
              {stats.totalMessages > 0 && (
                <p className="text-xs text-purple-100 mt-1">
                  Total: {stats.totalMessages.toLocaleString()}
                </p>
              )}
            </div>
            <div className="bg-purple-400/30 rounded-lg p-3">
              <span className="text-3xl">
                {stats.mqttStatus === 'connected' ? '✅' : '❌'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sincronización de Datos */}
      <SyncStatus />

      {/* Panel de Grabaciones */}
      {selectedCameraId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              📼 Grabaciones - {cameras.find(c => c.id === selectedCameraId)?.name}
            </h3>
            <button
              onClick={() => {
                setSelectedCameraId(null)
                setCameraRecordings([])
                setSensorRecordings([])
              }}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 mb-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setRecordingTab('video')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                recordingTab === 'video'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🎥 Video ({cameraRecordings.length})
            </button>
            <button
              onClick={() => setRecordingTab('sensors')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                recordingTab === 'sensors'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📊 Sensores ({sensorRecordings.length})
            </button>
          </div>

          {/* Video Recordings */}
          {recordingTab === 'video' && (
            cameraRecordings.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No hay grabaciones de video disponibles
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cameraRecordings.map((recording, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {recording.filename}
                      </p>
                      <div className="flex space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>📏 {formatFileSize(recording.size)}</span>
                        {recording.duration && (
                          <span>⏱️ {formatDuration(recording.duration)}</span>
                        )}
                        <span>📅 {new Date(recording.created).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => downloadRecording(selectedCameraId, recording.filename)}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
                        title="Descargar"
                      >
                        ⬇️
                      </button>
                      <button
                        onClick={() => handleDeleteRecording(recording.filename)}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm transition-colors"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Sensor Recordings */}
          {recordingTab === 'sensors' && (
            sensorRecordings.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No hay grabaciones de sensores disponibles
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sensorRecordings.map((recording, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {recording.filename}
                      </p>
                      <div className="flex space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>📏 {formatFileSize(recording.size)}</span>
                        <span>📊 {recording.recordCount} registros</span>
                        <span>📅 {new Date(recording.created).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleDownloadSensorRecording(recording.filename)}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
                        title="Descargar JSON"
                      >
                        ⬇️
                      </button>
                      <button
                        onClick={() => handleDeleteSensorRecording(recording.filename)}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm transition-colors"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default DashboardSummary
