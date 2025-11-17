import React, { useState, useEffect } from 'react'
import { useMQTT } from '../contexts/MQTTContext'
import { useEmqxData } from '../hooks/useEmqxData'
import api from '../services/api'

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
  }, [sensors, sensorData, sensorClients])

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
      temperature: '🌡️',
      humidity: '💧',
      presion: '🔽',
      ruido: '🔊',
      luz: '💡',
      co2: '🌫️',
      voc: '💨',
      'gases/no2': '☁️',
      'gases/so2': '🏭',
      'gases/o3': '⚗️',
      'gases/co': '☢️',
      emotibit: '💓'
    }
    return icons[type] || '📊'
  }

  const formatValue = (sensor, sensorData) => {
    if (!sensorData) return 'Sin datos'
    
    // Obtener el valor del sensor
    const data = sensorData.value || sensorData.data || {}
    
    if (sensor.type === 'emotibit') {
      const value = data.data || data.value || data
      
      // Calcular magnitud del acelerómetro si existen los valores
      const accelMagnitude = (value.accel_x !== undefined && value.accel_y !== undefined && value.accel_z !== undefined)
        ? Math.sqrt(value.accel_x**2 + value.accel_y**2 + value.accel_z**2).toFixed(3)
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
        <div className="text-gray-500 dark:text-gray-400">
          <div className="spinner"></div>
          <p className="mt-4">Cargando sensores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            📊 Sensores en Tiempo Real
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitoreo de sensores conectados via MQTT
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
            isConnected 
              ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
              : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {isConnected ? 'Conectado MQTT' : 'Desconectado'}
            </span>
          </div>
          <button 
            onClick={() => {
              fetchSensors()
              refetchEmqx()
            }}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            disabled={emqxLoading}
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* EMQX Stats */}
      {clusterStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Clientes Conectados</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {clusterStats['connections.count'] || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Publishers Sensores</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {sensorClients.length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Sensores Activos</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {activeSensors.length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Mensajes Recibidos</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {messageMetrics?.received || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Mensajes Enviados</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {messageMetrics?.sent || 0}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">❌ {error}</p>
        </div>
      )}

      {/* Sensors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {activeSensors.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="text-gray-500 dark:text-gray-400 space-y-3">
              <div className="text-4xl">📡</div>
              <p className="text-lg font-medium">
                No hay sensores activos
              </p>
              <p className="text-sm">
                Inicia un publisher para ver sensores en tiempo real
              </p>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                <code>cd test_publisher && node start.js</code>
              </div>
            </div>
          </div>
        ) : (
          activeSensors.map((sensor) => {
            const data = getSensorValue(sensor)
            const statusColor = getStatusColor(sensor, data)
            
            // Verificar si hay un cliente publisher activo para este sensor
            const isPublisherActive = sensorClients.some(client => 
              client.clientid.includes(sensor.sensorId) || 
              client.clientid.includes('sensor-publisher')
            )
            
            return (
              <div
                key={sensor.id || sensor.sensorId}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-3xl">
                      {getSensorIcon(sensor.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {sensor.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sensor.sensorId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Publisher status */}
                    {isPublisherActive && (
                      <div 
                        className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" 
                        title="Publisher activo"
                      ></div>
                    )}
                    {/* Data status */}
                    <div className={`w-3 h-3 rounded-full ${statusColor}`}></div>
                  </div>
                </div>

                {/* Value */}
                <div className="mb-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatValue(sensor, data)}
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  {sensor.location && (
                    <div className="flex items-center space-x-2">
                      <span>📍</span>
                      <span>{sensor.location}</span>
                    </div>
                  )}
                  {sensor._count?.events !== undefined && (
                    <div className="flex items-center space-x-2">
                      <span>🔢</span>
                      <span>{sensor._count.events} eventos</span>
                    </div>
                  )}
                  {isPublisherActive && (
                    <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                      <span>📡</span>
                      <span className="font-medium">Publisher conectado</span>
                    </div>
                  )}
                  {data && data.timestamp && (
                    <div className="flex items-center space-x-2 text-xs">
                      <span>🕐</span>
                      <span>{new Date(data.timestamp).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    data 
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                  }`}>
                    {data ? '✓ Activo' : '⏸ Inactivo'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Last Message Info */}
      {lastMessage && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-400">
            <span>📨</span>
            <span className="font-medium">Último mensaje:</span>
            <span className="text-sm">{lastMessage.topic}</span>
            <span className="text-xs text-blue-500 dark:text-blue-300">
              {new Date(lastMessage.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* Active Publishers */}
      {sensorClients.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📡 Publishers Activos ({sensorClients.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sensorClients.map((client, idx) => (
              <div 
                key={idx}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {client.clientid}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>IP: {client.ip_address}</div>
                  <div>Conectado: {new Date(client.connected_at).toLocaleString()}</div>
                  <div className="flex items-center space-x-2">
                    <span>↓ {client.recv_msg || 0}</span>
                    <span>↑ {client.send_msg || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SensorsDashboard
