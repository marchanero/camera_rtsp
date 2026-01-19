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
  Zap
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

      setActiveSensors([...combinedSensors, ...sensorsFromMQTT.filter(
        mqtt => !combinedSensors.some(s => s.sensorId === mqtt.sensorId)
      )])
    } else {
      // Si no hay sensores en BD, mostrar solo los de MQTT
      setActiveSensors(sensorsFromMQTT)
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
      emotibit: Heart
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {scenarioSensors.map((sensor) => (
                  <SensorErrorBoundary key={sensor.id}>
                    <div
                      className={`relative rounded-lg p-3 min-h-[220px] h-fit flex flex-col justify-between transition-all duration-150 ${sensor.isOnline
                        ? 'bg-gray-50 dark:bg-gray-700/50 border border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 opacity-60'
                        }`}
                    >
                      {/* ... content ... */}
                      {/* Status indicator */}
                      <div className="absolute top-2 right-2">
                        <span className={`w-2 h-2 rounded-full block ${sensor.isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      </div>

                      <div>
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${sensor.isOnline
                          ? 'bg-indigo-100 dark:bg-indigo-900/30'
                          : 'bg-gray-200 dark:bg-gray-700'
                          }`}>
                          {React.createElement(getSensorIcon(sensor.type), {
                            className: sensor.isOnline ? 'w-4 h-4 text-indigo-600 dark:text-indigo-400' : 'w-4 h-4 text-gray-400'
                          })}
                        </div>

                        {/* Sensor name */}
                        <h4 className="font-medium text-gray-900 dark:text-white text-xs truncate mb-2" title={sensor.name}>
                          {sensor.name}
                        </h4>
                      </div>

                      {/* Value display with fixed height container to prevent jitter */}
                      <div className={`text-lg font-bold min-h-[3rem] flex items-end ${sensor.isOnline
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400'
                        }`}>
                        {sensor.isOnline && sensor.liveData
                          ? <SensorValueDisplay data={sensor.liveData} sensor={sensor} />
                          : <span className="text-xs font-normal">--</span>
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {activeSensors.map((sensor) => {
                  const data = getSensorValue(sensor)
                  const SensorIcon = getSensorIcon(sensor.type)

                  return (
                    <div
                      key={sensor.id || sensor.sensorId}
                      className="relative rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
                    >
                      {/* Status indicator */}
                      <div className="absolute top-2 right-2">
                        <span className={`w-2 h-2 rounded-full block ${data ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      </div>

                      {/* Icon */}
                      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center mb-2">
                        <SensorIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>

                      {/* Sensor name */}
                      <h4 className="font-medium text-gray-900 dark:text-white text-xs truncate">
                        {sensor.name || sensor.type}
                      </h4>

                      {/* Value */}
                      <div className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                        <SensorValueDisplay data={data} sensor={sensor} />
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
const SensorValueDisplay = memo(function SensorValueDisplay({ data, sensor }) {
  const unit = sensor?.unit || ''

  // Extract actual value from different data formats
  const extractValue = (rawData) => {
    if (!rawData) return null

    // Format 1: { value: X } - wrapped value
    if (rawData.value !== undefined) return rawData.value

    // Format 2: { data: { value: X } } - doubly wrapped
    if (rawData.data?.value !== undefined) return rawData.data.value

    // Format 3: Direct sensor values (temperatura, humedad, etc)
    // Return the whole object for multi-value display
    const dataKeys = Object.keys(rawData).filter(k =>
      !['sensorId', 'sensor_id', 'timestamp', 'topic', 'type', 'location', 'name', 'recording'].includes(k)
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

  // Helper to format individual values
  const formatVal = (val) => {
    if (val === null || val === undefined) return '--'
    if (typeof val === 'number') return val.toFixed(2)
    return String(val)
  }

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

  if (value === null || value === undefined) return <span>--</span>

  // If it's an object with multiple sensor values
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

    return (
      <div className="flex flex-col gap-0.5 text-xs font-normal max-h-48 overflow-y-auto w-full">
        {sortedEntries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-1 whitespace-nowrap">
            <span className="w-4 flex-shrink-0">{labelMap[key] || '📊'}</span>
            <span className="text-gray-600 dark:text-gray-400 capitalize truncate max-w-[80px]">{key.replace(/_/g, ' ')}:</span>
            <span className="font-medium text-gray-900 dark:text-white tabular-nums">{formatVal(val)}</span>
            <span className="text-gray-400 text-[10px]">{unitMap[key] || ''}</span>
          </div>
        ))}
      </div>
    )
  }

  // If it's a scalar number
  if (typeof value === 'number') {
    return (
      <span className="tabular-nums whitespace-nowrap">
        {value.toFixed(1)} <span className="text-xs font-normal text-gray-500">{unit}</span>
      </span>
    )
  }

  // Fallback for strings or other types
  return <span>{String(value)}</span>
})
