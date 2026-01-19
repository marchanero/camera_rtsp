import { useState, useEffect } from 'react'
import {
  Radio,
  Plus,
  Edit3,
  Trash2,
  X,
  RefreshCw,
  Thermometer,
  Droplets,
  Wind,
  Volume2,
  Sun,
  Activity,
  Heart,
  Gauge,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Hash,
  MapPin,
  Link2,
  Tag
} from 'lucide-react'

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
      icon: Heart,
      color: 'rose',
      defaultUnit: 'bpm',
      defaultVariables: ['hr', 'eda', 'ppg', 'temperatura', 'accel', 'imu', 'status']
    },
    temperature: { label: 'Temperatura', icon: Thermometer, color: 'orange', defaultUnit: '°C', defaultVariables: ['value'] },
    humidity: { label: 'Humedad', icon: Droplets, color: 'blue', defaultUnit: '%', defaultVariables: ['value'] },
    co2: { label: 'CO2', icon: Wind, color: 'gray', defaultUnit: 'ppm', defaultVariables: ['value'] },
    pressure: { label: 'Presión', icon: Gauge, color: 'indigo', defaultUnit: 'hPa', defaultVariables: ['value'] },
    noise: { label: 'Ruido', icon: Volume2, color: 'purple', defaultUnit: 'dB', defaultVariables: ['value'] },
    light: { label: 'Luz', icon: Sun, color: 'amber', defaultUnit: 'lux', defaultVariables: ['value'] },
    voc: { label: 'VOC', icon: Activity, color: 'teal', defaultUnit: 'ppb', defaultVariables: ['voc'] },
    mota: {
      label: 'MOTA (Multisensor)',
      icon: Settings,
      color: 'indigo',
      defaultUnit: '',
      defaultVariables: ['temperatura', 'humedad', 'luz', 'ruido_dbfs', 'aqi', 'tvoc', 'eco2', 'bmp_temperatura', 'bmp_presion', 'bmp_altitud']
    }
  }

  const getColorClasses = (color) => {
    const colors = {
      rose: 'bg-rose-500 text-rose-500 bg-rose-50 dark:bg-rose-900/20',
      orange: 'bg-orange-500 text-orange-500 bg-orange-50 dark:bg-orange-900/20',
      blue: 'bg-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-900/20',
      gray: 'bg-gray-500 text-gray-500 bg-gray-50 dark:bg-gray-900/20',
      indigo: 'bg-indigo-500 text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',
      purple: 'bg-purple-500 text-purple-500 bg-purple-50 dark:bg-purple-900/20',
      amber: 'bg-amber-500 text-amber-500 bg-amber-50 dark:bg-amber-900/20',
      teal: 'bg-teal-500 text-teal-500 bg-teal-50 dark:bg-teal-900/20'
    }
    return colors[color] || colors.blue
  }

  useEffect(() => {
    fetchSensors()
  }, [])

  const fetchSensors = async () => {
    try {
      const response = await fetch('/api/mqtt/sensors')
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

    setFormData(prev => {
      // Si el sensor ya tiene variables, las combinamos evitando duplicados
      const newVariables = [...new Set([...prev.variables, ...typeInfo.defaultVariables])]

      return {
        ...prev,
        type: prev.type === 'emotibit' || prev.type === 'mota' ? prev.type : type, // Mantener tipo principal si es especial
        unit: prev.unit || typeInfo.defaultUnit,
        variables: newVariables
      }
    })
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
        ? `/api/mqtt/sensors/${editingSensor.id}`
        : '/api/mqtt/sensors'

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
    // Parsear variables si es string JSON
    const parsedVariables = typeof sensor.variables === 'string'
      ? JSON.parse(sensor.variables || '[]')
      : (sensor.variables || [])

    setEditingSensor(sensor)
    setFormData({
      sensorId: sensor.sensorId,
      name: sensor.name,
      type: sensor.type,
      unit: sensor.unit || '',
      location: sensor.location || '',
      deviceId: sensor.deviceId || '',
      topicBase: sensor.topicBase || '',
      variables: parsedVariables,
      isActive: sensor.isActive
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este sensor?')) return

    try {
      const response = await fetch(`/api/mqtt/sensors/${id}`, { method: 'DELETE' })
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Gestión de Sensores
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Registra y configura sensores MQTT
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nuevo Sensor
        </button>
      </div>

      {/* Lista de sensores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sensors.map(sensor => {
          const typeInfo = SENSOR_TYPES[sensor.type] || { icon: Radio, label: sensor.type, color: 'blue' }
          const IconComponent = typeInfo.icon || Radio
          // Parsear variables si es string JSON
          const variables = typeof sensor.variables === 'string'
            ? JSON.parse(sensor.variables || '[]')
            : (sensor.variables || [])

          return (
            <div
              key={sensor.id}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
            >
              {/* Card Header with Color Bar */}
              <div className={`h-1.5 ${typeInfo.color === 'rose' ? 'bg-rose-500' :
                typeInfo.color === 'orange' ? 'bg-orange-500' :
                  typeInfo.color === 'blue' ? 'bg-blue-500' :
                    typeInfo.color === 'gray' ? 'bg-gray-500' :
                      typeInfo.color === 'indigo' ? 'bg-indigo-500' :
                        typeInfo.color === 'purple' ? 'bg-purple-500' :
                          typeInfo.color === 'amber' ? 'bg-amber-500' :
                            typeInfo.color === 'teal' ? 'bg-teal-500' : 'bg-blue-500'
                }`} />

              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeInfo.color === 'rose' ? 'bg-rose-100 dark:bg-rose-900/30' :
                      typeInfo.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        typeInfo.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                          typeInfo.color === 'gray' ? 'bg-gray-100 dark:bg-gray-900/30' :
                            typeInfo.color === 'indigo' ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                              typeInfo.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                                typeInfo.color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/30' :
                                  typeInfo.color === 'teal' ? 'bg-teal-100 dark:bg-teal-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                      <IconComponent className={`w-6 h-6 ${typeInfo.color === 'rose' ? 'text-rose-500' :
                        typeInfo.color === 'orange' ? 'text-orange-500' :
                          typeInfo.color === 'blue' ? 'text-blue-500' :
                            typeInfo.color === 'gray' ? 'text-gray-500' :
                              typeInfo.color === 'indigo' ? 'text-indigo-500' :
                                typeInfo.color === 'purple' ? 'text-purple-500' :
                                  typeInfo.color === 'amber' ? 'text-amber-500' :
                                    typeInfo.color === 'teal' ? 'text-teal-500' : 'text-blue-500'
                        }`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {sensor.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {typeInfo.label}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium flex items-center gap-1 ${sensor.isActive
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                    {sensor.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {sensor.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Hash className="w-4 h-4" />
                    <span className="font-medium">ID:</span>
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">
                      {sensor.sensorId}
                    </code>
                  </div>

                  {sensor.topicBase && (
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                      <Link2 className="w-4 h-4 mt-0.5" />
                      <div>
                        <span className="font-medium">Topic:</span>
                        <div className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mt-1 font-mono break-all">
                          {sensor.topicBase}
                        </div>
                      </div>
                    </div>
                  )}

                  {variables && variables.length > 0 && (
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                      <Tag className="w-4 h-4 mt-0.5" />
                      <div>
                        <span className="font-medium">Variables:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {variables.slice(0, 4).map((v, i) => (
                            <span
                              key={i}
                              className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full"
                            >
                              {v}
                            </span>
                          ))}
                          {variables.length > 4 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              +{variables.length - 4} más
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleEdit(sensor)}
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(sensor.id)}
                    className="px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {sensors.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center mb-4">
              <Radio className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay sensores registrados
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Crea uno nuevo para comenzar a monitorear
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Crear Sensor
            </button>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    {editingSensor ? <Edit3 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingSensor ? 'Editar Sensor' : 'Nuevo Sensor'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseForm}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Sensor ID */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Hash className="w-4 h-4" />
                  ID del Sensor *
                </label>
                <input
                  type="text"
                  value={formData.sensorId}
                  onChange={(e) => setFormData({ ...formData, sensorId: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="sensor_temp_001"
                  required
                  disabled={editingSensor !== null}
                />
              </div>

              {/* Nombre */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Settings className="w-4 h-4" />
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Sensor Temperatura Aula 101"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Radio className="w-4 h-4" />
                  Tipo de Sensor *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {Object.entries(SENSOR_TYPES).map(([key, info]) => {
                    const IconComp = info.icon
                    const isSelected = formData.type === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleTypeChange(key)}
                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                          <IconComp className={`w-5 h-5 ${isSelected ? 'text-emerald-600' : 'text-gray-500'}`} />
                        </div>
                        <span className={`text-[10px] font-bold text-center leading-none ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          {info.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Ubicación / Escenario */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MapPin className="w-4 h-4" />
                  Ubicación/Escenario
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  onBlur={handleGenerateTopicBase}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="aula1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Primera parte del topic MQTT
                </p>
              </div>

              {/* Device ID */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Settings className="w-4 h-4" />
                  Device ID
                </label>
                <input
                  type="text"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                  onBlur={handleGenerateTopicBase}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="EM:01:23:45:67:89"
                />
              </div>

              {/* Topic Base */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Link2 className="w-4 h-4" />
                  Topic Base MQTT
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.topicBase}
                    onChange={(e) => setFormData({ ...formData, topicBase: e.target.value })}
                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="aula1/emotibit/EM:01:23:45:67:89"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateTopicBase}
                    className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Unidad */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Gauge className="w-4 h-4" />
                  Unidad de Medida
                </label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="°C, %, ppm, bpm..."
                />
              </div>

              {/* Variables */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Tag className="w-4 h-4" />
                  Variables del Sensor
                </label>
                <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl min-h-[52px]">
                  {Array.isArray(formData.variables) && formData.variables.map((variable, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded-lg"
                    >
                      <span className="text-sm font-medium">{variable}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariable(index)}
                        className="text-purple-500 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Añadir variable
                </button>
              </div>

              {/* Activo */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sensor activo
                </label>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/25"
                >
                  {editingSensor ? 'Actualizar Sensor' : 'Crear Sensor'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
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
