import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useMQTT } from '../contexts/MQTTContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useEmqxData } from '../hooks/useEmqxData'
import {
  Activity,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
  Users,
  MessageSquare,
  ArrowDown,
  ArrowUp,
  Clock,
  MapPin,
  Hash,
  Loader2,
  AlertCircle,
  CheckCircle,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  Volume2,
  Sun,
  Gauge,
  Zap,
  Settings
} from 'lucide-react'

function SensorsDashboard() {
  const { isConnected, sensorData, lastMessage } = useMQTT()
  const {
    clusterStats,
    sensorClients,
    messageMetrics,
    loading: emqxLoading,
    refetch: refetchEmqx
  } = useEmqxData(true, 5000) // Auto-refresh cada 5s

  const [sensors, setSensors] = useState([])
  const [activeSensors, setActiveSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Obtener escenario activo y sus sensores
  const { activeScenario, getActiveSensors } = useScenario()

  // Cache for previous sensor data to prevent flickering
  const prevSensorDataRef = React.useRef(new Map())

  // Sensores del escenario activo con sus datos en tiempo real
  const scenarioSensors = useMemo(() => {
    if (!activeScenario) return []
    const scenarioSensorIds = getActiveSensors()

    // Helper: buscar datos MQTT para un sensor
    const findMqttData = (sensor) => {
      // 1. Buscar por sensorId exacto en datos actuales
      if (sensorData.has(sensor.sensorId)) {
        const data = sensorData.get(sensor.sensorId)
        // Cache the data for future use
        prevSensorDataRef.current.set(sensor.sensorId, data)
        return data
      }

      // 2. Buscar por coincidencia de tipo de sensor
      for (const [key, data] of sensorData.entries()) {
        if (data.type === sensor.type) {
          prevSensorDataRef.current.set(sensor.sensorId, data)
          return data
        }
      }

      // 3. Buscar por coincidencia parcial del tópico
      if (sensor.topicBase) {
        for (const [key, data] of sensorData.entries()) {
          if (data.topic && data.topic.startsWith(sensor.topicBase)) {
            prevSensorDataRef.current.set(sensor.sensorId, data)
            return data
          }
        }
      }

      // 4. FALLBACK: Use cached previous data to prevent flickering
      if (prevSensorDataRef.current.has(sensor.sensorId)) {
        return prevSensorDataRef.current.get(sensor.sensorId)
      }

      return null
    }

    return sensors
      .filter(s => scenarioSensorIds.includes(s.sensorId) || scenarioSensorIds.includes(s.id) || scenarioSensorIds.includes(String(s.id)))
      .map(s => {
        const mqttData = findMqttData(s)
        return {
          ...s,
          isOnline: !!mqttData,
          liveData: mqttData || null
        }
      })
  }, [activeScenario, sensors, sensorData, getActiveSensors])

  useEffect(() => {
    fetchSensors()
  }, [])

  // Cache for active sensors to prevent flickering
  const prevActiveSensorsRef = React.useRef([])

  // Filtrar sensores activos basado en clientes EMQX y datos MQTT recibidos
  useEffect(() => {
    // Si hay datos MQTT, mostrar todos los sensores que tienen datos
    const sensorsFromMQTT = Array.from(sensorData.entries()).map(([sensorId, data]) => ({
      id: sensorId,
      name: typeof data.type === 'string' ? data.type : sensorId,
      sensorId: sensorId,
      type: typeof data.type === 'string' ? data.type : 'unknown',
      isActive: true,
      data: data
    }))

    let newActiveSensors = []

    // Combinar con sensores de la BD si existen
    if (sensors.length > 0) {
      const combinedSensors = sensors.map(sensor => {
        const mqttData = Array.from(sensorData.values()).find(
          data => data.type === sensor.type || sensorData.has(sensor.sensorId)
        )

        const hasPublisher = sensorClients.some(client =>
          client.clientid.includes(sensor.sensorId) ||
          client.clientid.includes('sensor-publisher') ||
          client.clientid.includes('stress-test')
        )

        return {
          ...sensor,
          hasData: !!mqttData,
          hasPublisher
        }
      }).filter(s => s.hasData || s.hasPublisher)

      newActiveSensors = [...combinedSensors, ...sensorsFromMQTT.filter(
        mqtt => !combinedSensors.some(s => s.sensorId === mqtt.sensorId)
      )]
    } else {
      // Si no hay sensores en BD, mostrar solo los de MQTT
      newActiveSensors = sensorsFromMQTT
    }

    // Only update if we have sensors, otherwise keep previous to prevent flickering
    if (newActiveSensors.length > 0) {
      prevActiveSensorsRef.current = newActiveSensors
      setActiveSensors(newActiveSensors)
    } else if (prevActiveSensorsRef.current.length > 0) {
      // Keep previous sensors if new calculation is empty (prevents flickering)
      setActiveSensors(prevActiveSensorsRef.current)
    }

    setLoading(false)
  }, [sensors, sensorData, sensorClients])

  // Filtrar sensores que NO están en el escenario activo para el listado general
  const generalSensors = useMemo(() => {
    if (!activeScenario) return activeSensors

    // IDs de los sensores que ya están en el escenario
    const scenarioSensorIds = scenarioSensors.map(s => s.sensorId || s.id)

    return activeSensors.filter(s =>
      !scenarioSensorIds.includes(s.sensorId) &&
      !scenarioSensorIds.includes(s.id) &&
      !scenarioSensorIds.includes(String(s.id))
    )
  }, [activeSensors, scenarioSensors, activeScenario])

  const fetchSensors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mqtt/sensors')
      const data = await response.json()
      if (data.success) {
        setSensors(data.data)
      }
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getSensorValue = (sensor) => {
    // Primero buscar por sensorId exacto
    if (sensorData.has(sensor.sensorId)) {
      return sensorData.get(sensor.sensorId)
    }

    // Si tiene data directa (del MQTT), usarla
    if (sensor.data) {
      return sensor.data
    }

    // Buscar por tipo de sensor
    const dataByType = Array.from(sensorData.values()).find(
      data => data.type === sensor.type
    )

    return dataByType || null
  }

  const getSensorIcon = (type) => {
    const icons = {
      temperature: Thermometer,
      humidity: Droplets,
      presion: Gauge,
      ruido: Volume2,
      luz: Sun,
      co2: Wind,
      voc: Activity,
      'gases/no2': Activity,
      'gases/so2': Activity,
      'gases/o3': Activity,
      'gases/co': Activity,
      emotibit: Heart,
      mota: Settings
    }
    return icons[type] || Radio
  }

  const formatValue = (sensor, sensorData) => {
    if (!sensorData) return 'Sin datos'

    // Obtener el valor del sensor
    const data = sensorData.value || sensorData.data || {}

    if (sensor.type === 'emotibit') {
      const value = data.data || data.value || data

      // Calcular magnitud del acelerómetro si existen los valores
      const accelMagnitude = (value.accel_x !== undefined && value.accel_y !== undefined && value.accel_z !== undefined)
        ? Math.sqrt(value.accel_x ** 2 + value.accel_y ** 2 + value.accel_z ** 2).toFixed(3)
        : null

      return (
        <div className="space-y-2">
          {/* Heart Rate - Principal */}
          <div className="flex items-center space-x-2">
            <span className="text-3xl font-bold text-red-500 dark:text-red-400">
              {value.heart_rate || '--'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">bpm</span>
          </div>

          {/* Temperaturas */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {value.temperature && (
              <div className="flex items-center space-x-1">
                <span>🫀</span>
                <span className="font-medium">{value.temperature}°C</span>
              </div>
            )}
            {value.sensor_temperature && (
              <div className="flex items-center space-x-1">
                <span>🌡️</span>
                <span>{value.sensor_temperature}°C</span>
              </div>
            )}
          </div>

          {/* EDA y HRV */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {value.eda && (
              <div className="flex items-center space-x-1">
                <span>⚡</span>
                <span>{value.eda.toFixed(2)}μS</span>
              </div>
            )}
            {value.hrv && (
              <div className="flex items-center space-x-1">
                <span>💚</span>
                <span>HRV: {value.hrv}ms</span>
              </div>
            )}
          </div>

          {/* Acelerómetro */}
          {accelMagnitude && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Acelerómetro</span>
                <span className="font-medium">{accelMagnitude}g</span>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-1 text-xs text-gray-600 dark:text-gray-400">
                <div>X: {value.accel_x?.toFixed(3) || '--'}</div>
                <div>Y: {value.accel_y?.toFixed(3) || '--'}</div>
                <div>Z: {value.accel_z?.toFixed(3) || '--'}</div>
              </div>
            </div>
          )}

          {/* PPG (opcional, para debugging) */}
          {value.ppg !== undefined && (
            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
              <span>📈</span>
              <span>PPG: {value.ppg.toFixed(3)}</span>
            </div>
          )}
        </div>
      )
    }

    // Para otros tipos de sensores
    const value = data.value || data

    // Handle object values (like accelerometer {x, y, z})
    if (typeof value === 'object' && value !== null) {
      if ('x' in value && 'y' in value && 'z' in value) {
        return (
          <div className="flex flex-col text-xs font-mono">
            <span><span className="text-gray-500">X:</span> {typeof value.x === 'number' ? value.x.toFixed(2) : value.x}</span>
            <span><span className="text-gray-500">Y:</span> {typeof value.y === 'number' ? value.y.toFixed(2) : value.y}</span>
            <span><span className="text-gray-500">Z:</span> {typeof value.z === 'number' ? value.z.toFixed(2) : value.z}</span>
            {sensor.unit && <span className="text-gray-400">{sensor.unit}</span>}
          </div>
        )
      }
      // For other objects, show formatted key-value pairs
      return (
        <div className="flex flex-col text-xs font-mono">
          {Object.entries(value).slice(0, 5).map(([key, val]) => (
            <span key={key}>
              <span className="text-gray-500">{key}:</span> {typeof val === 'number' ? val.toFixed(2) : String(val)}
            </span>
          ))}
          {Object.keys(value).length > 5 && <span className="text-gray-400">+{Object.keys(value).length - 5} más</span>}
        </div>
      )
    }

    return `${value || 'N/A'} ${sensor.unit || ''}`
  }

  const getStatusColor = (sensor, sensorData) => {
    if (!sensorData) return 'bg-gray-500'

    const timestamp = sensorData.timestamp
    if (!timestamp) return 'bg-gray-500'

    const age = Date.now() - new Date(timestamp).getTime()
    if (age > 60000) return 'bg-yellow-500' // Más de 1 minuto

    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Cargando sensores...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - Similar to section headers */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-500" />
          Sensores en Tiempo Real
        </h2>
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${isConnected
            ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                Desconectado
              </>
            )}
          </div>
          <button
            onClick={() => {
              fetchSensors()
              refetchEmqx()
            }}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors flex items-center gap-2"
            disabled={emqxLoading}
          >
            <RefreshCw className={`w-4 h-4 ${emqxLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Sensores del Escenario Activo */}
      {activeScenario && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {activeScenario.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {scenarioSensors.filter(s => s.isOnline).length} activos de {scenarioSensors.length} sensores
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-xs font-medium">
              Escenario Activo
            </span>
          </div>

          {/* Sensors Grid */}
          <div className="p-4">
            {scenarioSensors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {scenarioSensors.map((sensor) => (
                  <SensorErrorBoundary key={sensor.id}>
                    <div
                      className={`relative rounded-xl p-4 min-h-fit flex flex-col transition-none shadow-sm hover:shadow-md ${sensor.isOnline
                        ? 'bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700/50 ring-1 ring-emerald-100 dark:ring-emerald-900/20'
                        : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 opacity-70'
                        }`}
                    >
                      {/* Header: Icon + Name + Status */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${sensor.isOnline
                            ? 'bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-800/20'
                            : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                            {React.createElement(getSensorIcon(sensor.type), {
                              className: sensor.isOnline
                                ? 'w-5 h-5 text-indigo-600 dark:text-indigo-400'
                                : 'w-5 h-5 text-gray-400 dark:text-gray-500'
                            })}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate" title={sensor.name}>
                              {sensor.name}
                            </h4>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {sensor.type}
                            </p>
                          </div>
                        </div>
                        {/* Status indicator */}
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${sensor.isOnline
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sensor.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                          {sensor.isOnline ? 'Online' : 'Offline'}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-gray-100 dark:bg-gray-700 mb-3" />

                      {/* Value display - takes remaining space */}
                      <div className="flex-1 overflow-hidden">
                        {sensor.isOnline && sensor.liveData
                          ? <SensorValueDisplay data={sensor.liveData} sensor={sensor} />
                          : (
                            <div className="h-full flex items-center justify-center">
                              <span className="text-sm text-gray-400 dark:text-gray-500">Sin datos</span>
                            </div>
                          )
                        }
                      </div>
                    </div>
                  </SensorErrorBoundary>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Radio className="w-12 h-12 mx-auto mb-3 text-indigo-300 dark:text-indigo-700" />
                <p className="text-gray-500 dark:text-gray-400">No hay sensores asignados a este escenario</p>
              </div>
            )}
          </div>
        </div>
      )}


      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Last Message Info */}
      {lastMessage && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm">Último mensaje:</span>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">{lastMessage.topic}</code>
          </div>
          <span className="text-xs text-gray-500">
            {new Date(lastMessage.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Fallback: Show live MQTT sensors when no scenario is active */}
      {!activeScenario && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500" />
              Sensores Detectados
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {activeSensors.length} en tiempo real
            </span>
          </div>

          <div className="p-4">
            {activeSensors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {activeSensors.map((sensor) => {
                  const data = getSensorValue(sensor)
                  const SensorIcon = getSensorIcon(sensor.type)
                  const isOnline = !!data

                  return (
                    <div
                      key={sensor.id || sensor.sensorId}
                      className={`relative rounded-xl p-4 min-h-fit flex flex-col transition-none shadow-sm hover:shadow-md ${isOnline
                        ? 'bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700/50 ring-1 ring-emerald-100 dark:ring-emerald-900/20'
                        : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 opacity-70'
                        }`}
                    >
                      {/* Header: Icon + Name + Status */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isOnline
                            ? 'bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-900/40 dark:to-cyan-800/20'
                            : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                            <SensorIcon className={isOnline
                              ? 'w-5 h-5 text-cyan-600 dark:text-cyan-400'
                              : 'w-5 h-5 text-gray-400 dark:text-gray-500'
                            } />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate" title={sensor.name || sensor.type}>
                              {sensor.name || sensor.type}
                            </h4>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {sensor.sensorId || sensor.type}
                            </p>
                          </div>
                        </div>
                        {/* Status indicator */}
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${isOnline
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                          {isOnline ? 'Online' : 'Offline'}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-gray-100 dark:bg-gray-700 mb-3" />

                      {/* Value display - takes remaining space */}
                      <div className="flex-1 overflow-hidden">
                        {isOnline
                          ? <SensorValueDisplay data={data} sensor={sensor} />
                          : (
                            <div className="h-full flex items-center justify-center">
                              <span className="text-sm text-gray-400 dark:text-gray-500">Sin datos</span>
                            </div>
                          )
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                  <Radio className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  No hay sensores enviando datos
                </p>
                <p className="text-xs text-gray-400">
                  Activa un escenario o inicia un publisher MQTT
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Safe Sensor wrapper
class SensorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Sensor Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-center min-h-[110px]">
          <span className="text-xs text-red-500 text-center">Error renderizado</span>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SensorsDashboard

// Memoized sensor value display - only re-renders when data actually changes
// Uses useRef to cache previous values and avoid glitches when data is intermittent
const SensorValueDisplay = memo(function SensorValueDisplay({ data, sensor }) {
  const unit = sensor?.unit || ''
  const sensorType = sensor?.type?.toLowerCase() || ''

  // Cache for EmotiBit data to preserve values when data is intermittent
  const cachedDataRef = React.useRef({
    status: null,
    sensorData: null,
    allVariables: {},
    lastTimestamp: null
  })

  // Update cache with new data if available
  React.useEffect(() => {
    if (data && sensorType === 'emotibit') {
      // Deep merge new data with cached data
      if (data.values?.status) {
        cachedDataRef.current.status = { ...cachedDataRef.current.status, ...data.values.status }
      } else if (data.status) {
        cachedDataRef.current.status = { ...cachedDataRef.current.status, ...data.status }
      }

      if (data.values?.data) {
        cachedDataRef.current.sensorData = { ...cachedDataRef.current.sensorData, ...data.values.data }
      } else if (data.data) {
        cachedDataRef.current.sensorData = { ...cachedDataRef.current.sensorData, ...data.data }
      }

      // Cache all variables from values
      if (data.values && typeof data.values === 'object') {
        Object.entries(data.values).forEach(([key, value]) => {
          if (key !== 'status' && key !== 'data' && typeof value === 'object') {
            cachedDataRef.current.allVariables[key] = value
          }
        })
      }

      cachedDataRef.current.lastTimestamp = data.timestamp || Date.now()
    }
  }, [data, sensorType])

  // MOTA variable keys for detection
  const motaKeys = ['temperatura', 'humedad', 'luz', 'ruido_dbfs', 'aqi', 'tvoc', 'eco2', 'bmp_temperatura', 'bmp_presion', 'bmp_altitud']

  // Helper: Extract MOTA data from various nested formats
  const extractMotaData = (rawData) => {
    if (!rawData) return null

    // Check direct level first
    if (motaKeys.some(k => rawData[k] !== undefined)) {
      return rawData
    }

    // Check in values.data (from MQTTSensorDataContext merge)
    if (rawData.values?.data && typeof rawData.values.data === 'object') {
      if (motaKeys.some(k => rawData.values.data[k] !== undefined)) {
        return rawData.values.data
      }
    }

    // Check in data directly
    if (rawData.data && typeof rawData.data === 'object') {
      if (motaKeys.some(k => rawData.data[k] !== undefined)) {
        return rawData.data
      }
    }

    return null
  }

  // Check if this is a MOTA sensor (by data structure, not just type)
  const motaData = extractMotaData(data)
  const isMota = motaData !== null || sensorType === 'mota' || sensorType === 'sensor'

  // Extract actual value from different data formats (for non-MOTA sensors)
  const extractValue = (rawData) => {
    if (!rawData) return null

    // Format 1: { value: X } - wrapped value
    if (rawData.value !== undefined) return rawData.value

    // Format 2: { data: { value: X } } - doubly wrapped
    if (rawData.data?.value !== undefined) return rawData.data.value

    // Format 3: Direct sensor values (temperatura, humedad, etc)
    // Return the whole object for multi-value display
    const dataKeys = Object.keys(rawData).filter(k =>
      !['sensorId', 'sensor_id', 'timestamp', 'topic', 'type', 'location', 'name', 'recording', 'values'].includes(k)
    )

    if (dataKeys.length === 1) {
      // Single value - return it directly
      return rawData[dataKeys[0]]
    } else if (dataKeys.length > 1) {
      // Multiple values - return object with just sensor data
      return dataKeys.reduce((obj, key) => ({ ...obj, [key]: rawData[key] }), {})
    }

    return null
  }

  const value = extractValue(data)

  // ============ MOTA SENSOR DISPLAY ============
  // MOTA publishes all variables in a single payload:
  // temperatura, humedad, luz, ruido_dbfs, aqi, tvoc, eco2, bmp_temperatura, bmp_presion, bmp_altitud
  // Detect by data structure, not just sensor type
  if (isMota && motaData) {
    // MOTA variable definitions with emoji and units
    const motaVars = [
      { key: 'temperatura', emoji: '🌡️', unit: '°C', label: 'Temperatura' },
      { key: 'humedad', emoji: '💧', unit: '%', label: 'Humedad' },
      { key: 'luz', emoji: '☀️', unit: 'lux', label: 'Luz' },
      { key: 'ruido_dbfs', emoji: '🔊', unit: 'dB', label: 'Ruido' },
      { key: 'aqi', emoji: '🌬️', unit: '', label: 'AQI' },
      { key: 'tvoc', emoji: '🧪', unit: 'ppb', label: 'TVOC' },
      { key: 'eco2', emoji: '☁️', unit: 'ppm', label: 'eCO2' },
      { key: 'bmp_temperatura', emoji: '🔥', unit: '°C', label: 'Temp BMP' },
      { key: 'bmp_presion', emoji: '🎚️', unit: 'hPa', label: 'Presión' },
      { key: 'bmp_altitud', emoji: '⛰️', unit: 'm', label: 'Altitud' },
    ]

    // Filter to only show variables that exist in the data
    const availableVars = motaVars.filter(v => motaData[v.key] !== undefined)

    const formatMotaValue = (val) => {
      if (val === null || val === undefined) return '--'
      if (typeof val === 'number') return val.toFixed(1)
      return String(val)
    }

    return (
      <div className="flex flex-col gap-1 w-full h-full overflow-y-auto">
        {availableVars.map(({ key, emoji, unit, label }) => (
          <div
            key={key}
            className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0 text-base">{emoji}</span>
              <span className="text-gray-700 dark:text-gray-200 font-semibold text-sm truncate">{label}</span>
            </div>
            <div className="font-semibold tabular-nums text-right ml-2 flex items-baseline gap-1">
              <span className="text-gray-900 dark:text-white text-sm">{formatMotaValue(motaData[key])}</span>
              {unit && <span className="text-xs text-gray-400 dark:text-gray-500">{unit}</span>}
            </div>
          </div>
        ))}

        {availableVars.length === 0 && (
          <div className="text-center text-gray-400 py-4 text-sm">
            Esperando datos MOTA...
          </div>
        )}
      </div>
    )
  }

  // ============ EMOTIBIT SPECIAL DISPLAY ============
  // EmotiBit sends data in format: { status: {...}, data: { ppg, eda, temp, acc, gyr, mag } }
  // Or merged from individual topics into values: { status: {...}, data: {...} }
  // Also includes: timestamp, topic, sensorId, and values with nested variable data
  if (sensorType === 'emotibit') {
    // Extract EmotiBit data from various nested formats
    const extractEmotibitData = (rawData) => {
      if (!rawData) return { status: null, sensorData: null, metadata: null, allVariables: {} }

      let status = null
      let sensorData = null
      let metadata = {
        timestamp: rawData.timestamp,
        topic: rawData.topic,
        sensorId: rawData.sensorId
      }
      let allVariables = {}

      // Check for status in values.status or direct status
      if (rawData.values?.status) {
        status = rawData.values.status
        // Status might have its own data structure
        if (typeof status === 'object' && status.data) {
          status = { ...status, ...status.data }
        }
      } else if (rawData.status && typeof rawData.status === 'object') {
        status = rawData.status
      }

      // Check for sensor data in values.data or direct data
      if (rawData.values?.data) {
        sensorData = rawData.values.data
      } else if (rawData.data && typeof rawData.data === 'object') {
        sensorData = rawData.data
      }

      // Extract all variables from values object (ppg_green, ppg_red, acc, gyr, etc.)
      if (rawData.values && typeof rawData.values === 'object') {
        Object.entries(rawData.values).forEach(([key, value]) => {
          if (key !== 'status' && key !== 'data' && typeof value === 'object') {
            allVariables[key] = value
          }
        })
      }

      return { status, sensorData, metadata, allVariables }
    }

    // Extract data and merge with cached values
    const extracted = extractEmotibitData(data)

    // Use cached data as fallback for missing values
    const status = extracted.status || cachedDataRef.current.status
    const sensorData = extracted.sensorData || cachedDataRef.current.sensorData
    const allVariables = { ...cachedDataRef.current.allVariables, ...extracted.allVariables }
    const metadata = extracted.metadata

    // EmotiBit variable definitions (based on real data structure from broker)
    // Real format: ppg: {g:[], r:[], ir:[]}, eda: {v:[]}, temp: {skin:[]}, acc/gyr/mag: {x:[], y:[], z:[]}
    // With units for each subkey
    const emotibitVars = [
      { key: 'ppg', emoji: '💓', label: 'PPG', unit: 'counts', subkeys: ['g', 'r', 'ir'], subkeyUnits: { g: '', r: '', ir: '' } },
      { key: 'eda', emoji: '⚡', label: 'EDA', unit: 'µS', subkeys: ['v', 'r'], subkeyUnits: { v: 'µS', r: 'Ω' } },
      { key: 'temp', emoji: '🌡️', label: 'Temp', unit: '°C', subkeys: ['skin'], subkeyUnits: { skin: '°C' } },
      { key: 'acc', emoji: '📐', label: 'Accel', unit: 'g', subkeys: ['x', 'y', 'z'], subkeyUnits: { x: 'g', y: 'g', z: 'g' } },
      { key: 'gyr', emoji: '🔄', label: 'Gyro', unit: '°/s', subkeys: ['x', 'y', 'z'], subkeyUnits: { x: '°/s', y: '°/s', z: '°/s' } },
      { key: 'mag', emoji: '🧲', label: 'Mag', unit: 'µT', subkeys: ['x', 'y', 'z'], subkeyUnits: { x: 'µT', y: 'µT', z: 'µT' } },
    ]

    // Format a sensor value (could be number, array, or object)
    // EmotiBit sends arrays of data at 25Hz, so we need to display them properly
    const formatSensorValue = (val, subkeys) => {
      if (val === null || val === undefined) return '--'
      if (typeof val === 'number') return val.toFixed(2)

      // Handle arrays - show last value with count indicator
      if (Array.isArray(val)) {
        if (val.length === 0) return '--'
        const lastVal = val[val.length - 1]
        const formatted = typeof lastVal === 'number' ? lastVal.toFixed(1) : String(lastVal)
        // Show count if more than 1 value to indicate array length
        return val.length > 1 ? `${formatted} [${val.length}]` : formatted
      }

      if (typeof val === 'object') {
        // Format object with expected subkeys (e.g., {g, r, ir} or {x, y, z})
        const parts = subkeys
          .filter(k => val[k] !== undefined)
          .map(k => {
            const v = val[k]
            if (Array.isArray(v) && v.length > 0) {
              const lastVal = v[v.length - 1]
              const formatted = typeof lastVal === 'number' ? lastVal.toFixed(0) : String(lastVal)
              // Show array length indicator
              return `${k}:${formatted}${v.length > 1 ? `[${v.length}]` : ''}`
            }
            if (typeof v === 'number') return `${k}:${v.toFixed(1)}`
            return `${k}:${v}`
          })

        // If too long, wrap to multiple lines
        return parts.join(' ')
      }
      return String(val)
    }

    // Format status values
    const formatStatusValue = (val) => {
      if (val === null || val === undefined) return '--'
      if (typeof val === 'number') return val.toFixed(1)
      if (typeof val === 'boolean') return val ? 'Sí' : 'No'
      return String(val)
    }

    // Format timestamp from ts (epoch ms)
    const formatTimestamp = (ts) => {
      if (!ts) return '--'
      try {
        const date = new Date(typeof ts === 'number' ? ts : parseInt(ts))
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      } catch {
        return '--'
      }
    }

    // Always show all EmotiBit variables (use emotibitVars directly, not filtered)
    // This prevents UI from jumping when data is intermittent
    const availableSensorVars = emotibitVars

    // Status fields to display (based on real EmotiBit data structure)
    // Only essential fields - removed heap and seq as they are not needed
    const statusFields = [
      { key: 'status', emoji: '📶', label: 'Estado' },
      { key: 'rssi', emoji: '📡', label: 'RSSI', unit: 'dB' },
      { key: 'uptime', emoji: '⏱️', label: 'Uptime', unit: 's' },
    ]

    // Data metadata fields (from /data topic) - only timestamp and interval
    const dataMetaFields = [
      { key: 'ts', emoji: '🕐', label: 'Timestamp', format: formatTimestamp },
      { key: 'int', emoji: '⏱️', label: 'Intervalo', unit: 'ms' },
    ]

    return (
      <div className="flex flex-col gap-1 text-[10px] w-full h-full overflow-y-auto">
        {/* Status section */}
        {status && (
          <>
            {statusFields.map(({ key, emoji, label, unit }) => {
              if (status[key] === undefined) return null
              return (
                <div
                  key={key}
                  className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 min-h-[24px]"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="flex-shrink-0">{emoji}</span>
                    <span className="text-gray-600 dark:text-gray-300 font-medium truncate">{label}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-right ml-2 flex items-baseline gap-1">
                    <span className="text-gray-900 dark:text-white">{formatStatusValue(status[key])}</span>
                    {unit && <span className="text-[9px] text-gray-400">{unit}</span>}
                  </span>
                </div>
              )
            })}
            <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
          </>
        )}

        {/* Data metadata section (ts, seq, int from /data topic) */}
        {sensorData && (sensorData.ts || sensorData.seq || sensorData.int) && (
          <>
            {dataMetaFields.map(({ key, emoji, label, unit, format }) => {
              if (sensorData[key] === undefined) return null
              const value = format ? format(sensorData[key]) : sensorData[key]
              return (
                <div
                  key={`meta-${key}`}
                  className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 rounded px-2 py-1 min-h-[24px]"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="flex-shrink-0">{emoji}</span>
                    <span className="text-gray-600 dark:text-gray-300 font-medium truncate">{label}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-right ml-2 flex items-baseline gap-1">
                    <span className="text-gray-900 dark:text-white">{value}</span>
                    {unit && <span className="text-[9px] text-gray-400">{unit}</span>}
                  </span>
                </div>
              )
            })}
            <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
          </>
        )}

        {/* Sensor data section - PPG, EDA, Temp, Acc, Gyr, Mag */}
        {availableSensorVars.map(({ key, emoji, label, unit, subkeys, subkeyUnits }) => {
          // Get sensor value, fallback to empty object to always show structure
          const sensorVal = sensorData?.[key] || {}

          // Helper to format a single array value - never show undefined
          const formatArrayValue = (arr) => {
            if (!Array.isArray(arr) || arr.length === 0) return '--'
            const lastVal = arr[arr.length - 1]
            if (lastVal === null || lastVal === undefined) return '--'
            const formatted = typeof lastVal === 'number' ? lastVal.toFixed(2) : String(lastVal)
            return `${formatted} [${arr.length}]`
          }

          // Helper to format any value - never show undefined
          const formatSubkeyValue = (val) => {
            if (val === null || val === undefined) return '--'
            if (Array.isArray(val)) return formatArrayValue(val)
            if (typeof val === 'number') return val.toFixed(2)
            return String(val)
          }

          // Always show complex structure with all subkeys
          return (
            <div key={key} className="bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
              {/* Header row with variable name and unit */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex-shrink-0 text-base">{emoji}</span>
                <span className="text-gray-700 dark:text-gray-200 font-semibold text-sm">{label}</span>
                {unit && <span className="text-xs text-gray-400 dark:text-gray-500">({unit})</span>}
              </div>
              {/* Subkey rows - always show all subkeys */}
              <div className="pl-6 space-y-1">
                {subkeys.map(subkey => {
                  const subVal = sensorVal[subkey]
                  const subUnit = subkeyUnits?.[subkey] || ''
                  return (
                    <div key={subkey} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400 font-mono w-10">{subkey}:</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-100 w-20 text-right">
                          {formatSubkeyValue(subVal)}
                        </span>
                        {subUnit && <span className="text-[10px] text-gray-400 dark:text-gray-500 w-8">{subUnit}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Show all nested variables from allVariables if available */}
        {Object.keys(allVariables).length > 0 && (
          <>
            <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
            <div className="text-[9px] text-gray-500 dark:text-gray-400 px-1">Variables adicionales:</div>
            {Object.entries(allVariables).map(([varName, varData]) => {
              // Skip if varData is not an object
              if (!varData || typeof varData !== 'object') return null

              // Format the nested data
              let displayValue = '--'
              if (varData.data !== undefined) {
                // Has a data property
                if (Array.isArray(varData.data)) {
                  displayValue = `[${varData.data.length}] ${varData.data[varData.data.length - 1]?.toFixed?.(2) || varData.data[varData.data.length - 1]}`
                } else if (typeof varData.data === 'object') {
                  displayValue = Object.entries(varData.data)
                    .map(([k, v]) => {
                      if (Array.isArray(v)) return `${k}:${v[v.length - 1]?.toFixed?.(1) || v[v.length - 1]}[${v.length}]`
                      return `${k}:${typeof v === 'number' ? v.toFixed(1) : v}`
                    })
                    .join(' ')
                } else {
                  displayValue = String(varData.data)
                }
              } else if (varData.value !== undefined) {
                displayValue = String(varData.value)
              }

              return (
                <div
                  key={varName}
                  className="flex flex-col gap-0.5 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 min-h-[24px]"
                >
                  <span className="text-gray-600 dark:text-gray-300 font-medium">{varName}</span>
                  <span className="text-[9px] text-gray-700 dark:text-gray-200 pl-2 break-all">{displayValue}</span>
                  {varData.ts && (
                    <span className="text-[8px] text-gray-400 pl-2">ts: {formatTimestamp(varData.ts)}</span>
                  )}
                </div>
              )
            })}
          </>
        )}

        {!status && availableSensorVars.length === 0 && Object.keys(allVariables).length === 0 && (
          <div className="text-center text-gray-400 py-4">
            Esperando datos EmotiBit...
          </div>
        )}
      </div>
    )
  }

  // ============ GENERIC SENSOR DISPLAY ============

  // Label mapping for Spanish-friendly display
  const labelMap = {
    temperatura: '🌡️',
    humedad: '💧',
    aqi: '🌬️',
    tvoc: '🧪',
    eco2: '☁️',
    bmp_temperatura: '🔥',
    bmp_presion: '🎚️',
    bmp_altitud: '⛰️',
    luz: '☀️',
    ruido_dbfs: '🔊',
    heart_rate: '❤️',
    eda: '⚡',
    ppg: '📈',
    hrv: '💚',
    temperature: '🌡️',
    accel: '📐',
    gyro: '🔄',
    mag: '🧲'
  }

  // Unit mapping for each sensor type
  const unitMap = {
    temperatura: '°C',
    humedad: '%',
    aqi: '',
    tvoc: 'ppb',
    eco2: 'ppm',
    bmp_temperatura: '°C',
    bmp_presion: 'hPa',
    bmp_altitud: 'm',
    luz: 'lux',
    ruido_dbfs: 'dB',
    heart_rate: 'bpm',
    eda: 'μS',
    ppg: '',
    hrv: 'ms',
    temperature: '°C',
    accel: 'g',
    gyro: '°/s',
    mag: 'μT'
  }

  if (value === null || value === undefined) return <span className="text-gray-400">--</span>

  // If it's an object with multiple sensor values (fallback for unknown sensor types)
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)

    // Limit display and show most important values first
    const priorityKeys = ['temperatura', 'humedad', 'aqi', 'luz', 'ruido_dbfs', 'heart_rate', 'eda']
    const sortedEntries = entries.sort((a, b) => {
      const aIdx = priorityKeys.indexOf(a[0])
      const bIdx = priorityKeys.indexOf(b[0])
      if (aIdx === -1 && bIdx === -1) return 0
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })

    // Helper to format any value safely
    const formatValue = (val) => {
      if (val === null || val === undefined) return '--'
      if (typeof val === 'number') return val.toFixed(1)
      if (typeof val === 'object') {
        // For objects like {g, r, ir} or {x, y, z}, show a summary
        const keys = Object.keys(val)
        if (keys.length <= 3) {
          return keys.map(k => `${k}:${typeof val[k] === 'number' ? val[k].toFixed(0) : val[k]}`).join(' ')
        }
        return `{${keys.length} props}`
      }
      return String(val)
    }

    return (
      <div className="flex flex-col gap-1 w-full h-full overflow-y-auto">
        {sortedEntries.map(([key, val]) => (
          <div
            key={key}
            className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0 text-base">{labelMap[key] || '📊'}</span>
              <span className="text-gray-700 dark:text-gray-200 font-semibold text-sm truncate">
                {key.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="font-semibold tabular-nums text-right ml-2 flex items-baseline gap-1">
              <span className="text-gray-900 dark:text-white text-sm">{formatValue(val)}</span>
              {unitMap[key] && <span className="text-xs text-gray-400 dark:text-gray-500">{unitMap[key]}</span>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // If it's a scalar number
  if (typeof value === 'number') {
    return (
      <span className="tabular-nums whitespace-nowrap text-2xl">
        {value.toFixed(1)}
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{unit}</span>
      </span>
    )
  }

  // Fallback for strings or other types
  return <span className="text-gray-700 dark:text-gray-300">{String(value)}</span>
})
