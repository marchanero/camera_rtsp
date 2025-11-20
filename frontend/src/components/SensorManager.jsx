import { useState, useEffect } from 'react'

const SensorManager = () => {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSensor, setEditingSensor] = useState(null)
  const [formData, setFormData] = useState({
    sensorId: '',
    name: '',
    type: 'emotibit',
    unit: '',
    location: '',
    deviceId: '',
    topicBase: '',
    variables: [],
    isActive: true
  })

  // Tipos de sensores disponibles
  const SENSOR_TYPES = {
    emotibit: {
      label: 'EmotiBit',
      icon: '💓',
      defaultUnit: 'bpm',
      defaultVariables: ['hr', 'eda', 'ppg', 'temperatura', 'accel', 'imu', 'status']
    },
    temperature: { label: 'Temperatura', icon: '🌡️', defaultUnit: '°C', defaultVariables: ['value'] },
    humidity: { label: 'Humedad', icon: '💧', defaultUnit: '%', defaultVariables: ['value'] },
    co2: { label: 'CO2', icon: '🌫️', defaultUnit: 'ppm', defaultVariables: ['value'] },
    pressure: { label: 'Presión', icon: '🔽', defaultUnit: 'hPa', defaultVariables: ['value'] },
    noise: { label: 'Ruido', icon: '🔊', defaultUnit: 'dB', defaultVariables: ['value'] },
    light: { label: 'Luz', icon: '💡', defaultUnit: 'lux', defaultVariables: ['value'] },
    voc: { label: 'VOC', icon: '🌬️', defaultUnit: 'ppb', defaultVariables: ['value'] }
  }

  useEffect(() => {
    fetchSensors()
  }, [])

  const fetchSensors = async () => {
    try {
      const response = await fetch('/api/sensors')
      const data = await response.json()
      if (data.success) {
        setSensors(data.data)
      }
    } catch (error) {
      console.error('Error fetching sensors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTypeChange = (type) => {
    const typeInfo = SENSOR_TYPES[type]
    setFormData(prev => ({
      ...prev,
      type,
      unit: typeInfo.defaultUnit,
      variables: [...typeInfo.defaultVariables]
    }))
  }

  const handleGenerateTopicBase = () => {
    const { location, type, deviceId } = formData
    if (location && type && deviceId) {
      const topicBase = `${location}/${type}/${deviceId}`
      setFormData(prev => ({ ...prev, topicBase }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const url = editingSensor 
        ? `/api/sensors/${editingSensor.id}`
        : '/api/sensors'
      
      const method = editingSensor ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        await fetchSensors()
        handleCloseForm()
      } else {
        alert(data.message || 'Error al guardar sensor')
      }
    } catch (error) {
      console.error('Error saving sensor:', error)
      alert('Error al guardar sensor')
    }
  }

  const handleEdit = (sensor) => {
    setEditingSensor(sensor)
    setFormData({
      sensorId: sensor.sensorId,
      name: sensor.name,
      type: sensor.type,
      unit: sensor.unit || '',
      location: sensor.location || '',
      deviceId: sensor.deviceId || '',
      topicBase: sensor.topicBase || '',
      variables: sensor.variables || [],
      isActive: sensor.isActive
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este sensor?')) return
    
    try {
      const response = await fetch(`/api/sensors/${id}`, { method: 'DELETE' })
      const data = await response.json()
      
      if (data.success) {
        await fetchSensors()
      }
    } catch (error) {
      console.error('Error deleting sensor:', error)
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingSensor(null)
    setFormData({
      sensorId: '',
      name: '',
      type: 'emotibit',
      unit: '',
      location: '',
      deviceId: '',
      topicBase: '',
      variables: [],
      isActive: true
    })
  }

  const handleAddVariable = () => {
    const varName = prompt('Nombre de la variable:')
    if (varName && !formData.variables.includes(varName)) {
      setFormData(prev => ({
        ...prev,
        variables: [...prev.variables, varName]
      }))
    }
  }

  const handleRemoveVariable = (index) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }))
  }

  if (loading) {
    return <div className="text-center py-8">Cargando sensores...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            📡 Gestión de Sensores
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Registra y configura sensores MQTT con patrón de topics
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
        >
          ➕ Nuevo Sensor
        </button>
      </div>

      {/* Lista de sensores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sensors.map(sensor => {
          const typeInfo = SENSOR_TYPES[sensor.type] || { icon: '📊', label: sensor.type }
          
          return (
            <div
              key={sensor.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border-l-4 border-blue-500"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{typeInfo.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {sensor.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {typeInfo.label}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  sensor.isActive 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {sensor.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">ID:</span>{' '}
                  <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">
                    {sensor.sensorId}
                  </code>
                </div>
                
                {sensor.topicBase && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Topic Base:</span>
                    <div className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mt-1 font-mono">
                      {sensor.topicBase}
                    </div>
                  </div>
                )}

                {sensor.variables && sensor.variables.length > 0 && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Variables:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sensor.variables.map((v, i) => (
                        <span
                          key={i}
                          className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleEdit(sensor)}
                  className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => handleDelete(sensor.id)}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        })}

        {sensors.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            No hay sensores registrados. Crea uno nuevo para comenzar.
          </div>
        )}
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingSensor ? '✏️ Editar Sensor' : '➕ Nuevo Sensor'}
                </h3>
                <button
                  onClick={handleCloseForm}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Sensor ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ID del Sensor *
                </label>
                <input
                  type="text"
                  value={formData.sensorId}
                  onChange={(e) => setFormData({...formData, sensorId: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="sensor_temp_001"
                  required
                  disabled={editingSensor !== null}
                />
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="Sensor Temperatura Aula 101"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Sensor *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  required
                >
                  {Object.entries(SENSOR_TYPES).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.icon} {info.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ubicación / Escenario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ubicación/Escenario (para topic)
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  onBlur={handleGenerateTopicBase}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="aula1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Primera parte del topic MQTT
                </p>
              </div>

              {/* Device ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Device ID
                </label>
                <input
                  type="text"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
                  onBlur={handleGenerateTopicBase}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="EM:01:23:45:67:89"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ID único del dispositivo físico
                </p>
              </div>

              {/* Topic Base */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Topic Base MQTT
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.topicBase}
                    onChange={(e) => setFormData({...formData, topicBase: e.target.value})}
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm"
                    placeholder="aula1/emotibit/EM:01:23:45:67:89"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateTopicBase}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
                  >
                    🔄 Generar
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Patrón: {'{escenario}/{tipo}/{deviceId}'}
                </p>
              </div>

              {/* Unidad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unidad de Medida
                </label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="°C, %, ppm, bpm..."
                />
              </div>

              {/* Variables */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Variables del Sensor
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.variables.map((variable, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded"
                    >
                      <span className="text-sm">{variable}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariable(index)}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ➕ Añadir variable
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Topics completos: {formData.topicBase}/{'{variable}'}
                </p>
              </div>

              {/* Activo */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                  Sensor activo
                </label>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  {editingSensor ? 'Actualizar' : 'Crear'} Sensor
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SensorManager
