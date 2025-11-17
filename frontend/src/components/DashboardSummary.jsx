import { useState, useEffect } from 'react'
import { useRecording } from '../contexts/RecordingContext'
import { useMQTT } from '../contexts/MQTTContext'
import api from '../services/api'

const DashboardSummary = () => {
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [cameraRecordings, setCameraRecordings] = useState([])
  const [stats, setStats] = useState({
    totalCameras: 0,
    recordingCameras: 0,
    totalSensors: 0,
    activeSensors: 0,
    messagesPerSecond: 0,
    mqttStatus: 'disconnected'
  })
  
  const { 
    recordings, 
    startRecording, 
    stopRecording, 
    isRecording,
    getRecordings,
    downloadRecording,
    deleteRecording,
    activeRecordingsCount 
  } = useRecording()
  
  const { sensorData, messageRate, isConnected } = useMQTT()

  // Cargar cámaras
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const data = await api.getCameras()
        setCameras(data)
      } catch (error) {
        console.error('Error cargando cámaras:', error)
      }
    }
    
    fetchCameras()
    const interval = setInterval(fetchCameras, 10000)
    return () => clearInterval(interval)
  }, [])

  // Actualizar estadísticas
  useEffect(() => {
    const activeSensorsCount = Array.from(sensorData.values()).filter(
      sensor => Date.now() - new Date(sensor.timestamp).getTime() < 10000
    ).length

    setStats({
      totalCameras: cameras.length,
      recordingCameras: activeRecordingsCount,
      totalSensors: sensorData.size,
      activeSensors: activeSensorsCount,
      messagesPerSecond: messageRate,
      mqttStatus: isConnected ? 'connected' : 'disconnected'
    })
  }, [cameras, activeRecordingsCount, sensorData, messageRate, isConnected])

  // Cargar grabaciones cuando se selecciona una cámara
  useEffect(() => {
    if (selectedCameraId) {
      loadRecordings(selectedCameraId)
    }
  }, [selectedCameraId])

  const loadRecordings = async (cameraId) => {
    const recordings = await getRecordings(cameraId)
    setCameraRecordings(recordings)
  }

  const handleStartRecording = async (camera) => {
    await startRecording(camera.id, camera.name)
  }

  const handleStopRecording = async (cameraId) => {
    await stopRecording(cameraId)
    if (selectedCameraId === cameraId) {
      await loadRecordings(cameraId)
    }
  }

  const handleDeleteRecording = async (filename) => {
    if (!confirm(`¿Eliminar grabación ${filename}?`)) return
    
    const result = await deleteRecording(selectedCameraId, filename)
    if (result.success) {
      await loadRecordings(selectedCameraId)
    }
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

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cámaras */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Cámaras</p>
              <p className="text-4xl font-bold mt-2">{stats.totalCameras}</p>
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
            </div>
            <div className="bg-purple-400/30 rounded-lg p-3">
              <span className="text-3xl">
                {stats.mqttStatus === 'connected' ? '✅' : '❌'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controles de Grabación */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            🎬 Control de Grabaciones
          </h3>
        </div>

        {cameras.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No hay cámaras configuradas
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cameras.map(camera => {
              const recording = isRecording(camera.id)
              const recordingInfo = recordings.get(camera.id)
              
              return (
                <div 
                  key={camera.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {camera.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {camera.rtspUrl}
                      </p>
                    </div>
                    {recording && (
                      <span className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full flex items-center">
                        <span className="animate-pulse mr-1">●</span>
                        REC
                      </span>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    {!recording ? (
                      <button
                        onClick={() => handleStartRecording(camera)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        ▶ Iniciar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStopRecording(camera.id)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        ⏹ Detener
                      </button>
                    )}
                    
                    <button
                      onClick={() => setSelectedCameraId(
                        selectedCameraId === camera.id ? null : camera.id
                      )}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      📁
                    </button>
                  </div>

                  {recordingInfo?.status === 'recording' && recordingInfo.startedAt && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Inicio: {new Date(recordingInfo.startedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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
              }}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          {cameraRecordings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No hay grabaciones disponibles
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
          )}
        </div>
      )}

      {/* Actividad Reciente de Sensores */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          📈 Actividad de Sensores (últimos 10s)
        </h3>
        
        {stats.activeSensors === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No hay sensores activos
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(sensorData.entries())
              .filter(([, sensor]) => 
                Date.now() - new Date(sensor.timestamp).getTime() < 10000
              )
              .slice(0, 9)
              .map(([sensorId, sensor]) => (
                <div
                  key={sensorId}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {sensor.type}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sensorId}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                      ● Activo
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {sensor.type === 'DHT22' && (
                      <>
                        <div>🌡️ {sensor.value?.temperature?.toFixed(1)}°C</div>
                        <div>💧 {sensor.value?.humidity?.toFixed(1)}%</div>
                      </>
                    )}
                    {sensor.type === 'MQ135' && (
                      <div>💨 CO₂: {sensor.value?.co2?.toFixed(0)} ppm</div>
                    )}
                    {sensor.type === 'EmotiBit' && sensor.value && (
                      <>
                        <div>❤️ {sensor.value.heart_rate?.toFixed(0)} bpm</div>
                        <div>🌡️ {sensor.value.temperature?.toFixed(1)}°C</div>
                      </>
                    )}
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-400">
                    {new Date(sensor.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardSummary
