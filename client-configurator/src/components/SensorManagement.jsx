import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useFormValidation, validationRules } from '../hooks/useFormValidation'

// API URL - use environment variable for Docker deployment
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001'

function SensorManagement({ sensors, mqttTopics, onSensorUpdate, onTopicUpdate }) {
  const [editingSensor, setEditingSensor] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedSensor, setSelectedSensor] = useState(null)

  // Form validation for sensor creation/editing
  const sensorForm = useFormValidation(
    {
      type: '',
      name: '',
      topic: '',
      description: '',
      unit: '',
      min_value: null,
      max_value: null,
      active: true,
      data: {}
    },
    {
      type: [validationRules.required('El tipo de sensor es requerido')],
      name: [
        validationRules.required('El nombre del sensor es requerido'),
        validationRules.minLength(2, 'El nombre debe tener al menos 2 caracteres'),
        validationRules.maxLength(50, 'El nombre no puede tener más de 50 caracteres')
      ],
      topic: [
        validationRules.required('El topic MQTT es requerido'),
        validationRules.mqttTopic('Formato de topic MQTT inválido')
      ],
      description: [
        validationRules.maxLength(200, 'La descripción no puede tener más de 200 caracteres')
      ],
      unit: [
        validationRules.maxLength(20, 'La unidad no puede tener más de 20 caracteres')
      ],
      data: (value, formValues) => {
        const errors = {}
        if (formValues.type === 'rtsp') {
          if (!value.host || !value.host.trim()) {
            errors.host = 'La dirección IP o host es requerida'
          } else if (!/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value.host) && !/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(value.host)) {
            errors.host = 'Formato de IP o dominio inválido'
          }
          if (!value.port || !value.port.toString().trim()) {
            errors.port = 'El puerto RTSP es requerido'
          } else if (value.port < 1 || value.port > 65535) {
            errors.port = 'El puerto debe estar entre 1 y 65535'
          }
          if (!value.path || !value.path.trim()) {
            errors.path = 'El path del stream es requerido'
          }
        } else if (formValues.type === 'emotibit') {
          if (!value.deviceId || !value.deviceId.trim()) {
            errors.deviceId = 'El ID del dispositivo es requerido'
          }
          if (!value.samplingRate || !value.samplingRate.trim()) {
            errors.samplingRate = 'La frecuencia de muestreo es requerida'
          }
        } else if (formValues.type === 'environmental') {
          if (!value.location || !value.location.trim()) {
            errors.location = 'La ubicación es requerida'
          }
          if (!value.parameters || !value.parameters.trim()) {
            errors.parameters = 'Los parámetros son requeridos'
          }
        }
        return Object.keys(errors).length > 0 ? errors : undefined
      }
    }
  )

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!showCreateModal && !editingSensor) {
      sensorForm.resetForm()
    }
  }, [showCreateModal, editingSensor])

  // Load sensor data for editing
  useEffect(() => {
    if (editingSensor) {
      sensorForm.setValues({
        type: editingSensor.type,
        name: editingSensor.name,
        topic: editingSensor.topic,
        description: editingSensor.description || '',
        unit: editingSensor.unit || '',
        min_value: editingSensor.min_value,
        max_value: editingSensor.max_value,
        active: editingSensor.active,
        data: editingSensor.data || {}
      })
    }
  }, [editingSensor])

  const handleCreateSensor = async () => {
    if (!sensorForm.validateForm()) {
      toast.error('Por favor corrige los errores del formulario', { duration: 4000 })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/sensors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sensorForm.values)
      })

      if (response.ok) {
        const result = await response.json()
        onSensorUpdate()
        setShowCreateModal(false)
        sensorForm.resetForm()
        toast.success('Sensor creado exitosamente')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create sensor')
      }
    } catch (error) {
      console.error('Error creating sensor:', error)
      toast.error(`Error al crear sensor: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSensor = async () => {
    if (!sensorForm.validateForm()) {
      toast.error('Por favor corrige los errores del formulario', { duration: 4000 })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/sensors/${editingSensor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sensorForm.values)
      })

      if (response.ok) {
        onSensorUpdate()
        setEditingSensor(null)
        sensorForm.resetForm()
        toast.success('Sensor actualizado exitosamente')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update sensor')
      }
    } catch (error) {
      console.error('Error updating sensor:', error)
      toast.error(`Error al actualizar sensor: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSensor = async (sensorId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este sensor? Esta acción no se puede deshacer.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/sensors/${sensorId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onSensorUpdate()
        toast.success('Sensor eliminado exitosamente')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete sensor')
      }
    } catch (error) {
      console.error('Error deleting sensor:', error)
      toast.error(`Error al eliminar sensor: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const renderDataFields = (sensorType, form) => {
    switch (sensorType) {
      case 'rtsp':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Dirección IP o Host</label>
              <input
                type="text"
                placeholder="192.168.1.100"
                value={form.values.data.host || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, host: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.host ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.host && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.host}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Puerto RTSP</label>
              <input
                type="number"
                placeholder="554"
                value={form.values.data.port || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, port: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.port ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.port && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.port}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Path del Stream</label>
              <input
                type="text"
                placeholder="/stream"
                value={form.values.data.path || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, path: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.path ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.path && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.path}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Usuario (opcional)</label>
                <input
                  type="text"
                  placeholder="admin"
                  value={form.values.data.username || ''}
                  onChange={(e) => form.handleChange('data', {...form.values.data, username: e.target.value})}
                  onBlur={() => form.handleBlur('data')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    form.errors.data?.username ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {form.errors.data?.username && form.touched.data && (
                  <p className="text-red-500 text-sm mt-1">{form.errors.data.username}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Contraseña (opcional)</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.values.data.password || ''}
                  onChange={(e) => form.handleChange('data', {...form.values.data, password: e.target.value})}
                  onBlur={() => form.handleBlur('data')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    form.errors.data?.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {form.errors.data?.password && form.touched.data && (
                  <p className="text-red-500 text-sm mt-1">{form.errors.data.password}</p>
                )}
              </div>
            </div>
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <strong>URL RTSP generada:</strong>
                <div className="mt-1 font-mono text-xs bg-white dark:bg-gray-800 p-2 rounded border">
                  rtsp://{form.values.data.username && form.values.data.password ? `${form.values.data.username}:${form.values.data.password}@` : ''}{form.values.data.host || 'host'}:{form.values.data.port || '554'}{form.values.data.path || '/stream'}
                </div>
              </div>
            </div>
          </div>
        )
      case 'emotibit':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Device ID</label>
              <input
                type="text"
                placeholder="Device ID"
                value={form.values.data.deviceId || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, deviceId: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.deviceId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.deviceId && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.deviceId}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Sampling Rate</label>
              <input
                type="text"
                placeholder="Sampling Rate"
                value={form.values.data.samplingRate || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, samplingRate: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.samplingRate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.samplingRate && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.samplingRate}</p>
              )}
            </div>
          </div>
        )
      case 'environmental':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <input
                type="text"
                placeholder="Location"
                value={form.values.data.location || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, location: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.location ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.location && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.location}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Parameters</label>
              <input
                type="text"
                placeholder="Parameters (e.g., temperature, humidity)"
                value={form.values.data.parameters || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, parameters: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.parameters ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.parameters && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.parameters}</p>
              )}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Sensores</h2>
          <p className="text-gray-600 dark:text-gray-300">Administra sensores conectados y sus topics MQTT</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Crear Sensor</span>
        </button>
      </div>

      {/* Sensors List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sensores Registrados ({sensors.length})
          </h3>
        </div>

        {sensors.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay sensores registrados</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Comienza creando tu primer sensor</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sensors.map(sensor => (
              <div key={sensor.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        sensor.type === 'rtsp' ? 'bg-green-500' :
                        sensor.type === 'environmental' ? 'bg-blue-500' :
                        sensor.type === 'emotibit' ? 'bg-purple-500' : 'bg-gray-500'
                      }`}></div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{sensor.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{sensor.type}</p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Topic:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-white">{sensor.topic}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          sensor.active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {sensor.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {sensor.unit && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Unidad:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{sensor.unit}</span>
                        </div>
                      )}
                      {sensor.description && (
                        <div className="col-span-2">
                          <span className="text-gray-500 dark:text-gray-400">Descripción:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{sensor.description}</span>
                        </div>
                      )}
                    </div>

                    {/* Sensor-specific data */}
                    <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                      {sensor.type === 'rtsp' && sensor.data?.url && (
                        <span>RTSP: {sensor.data.url}</span>
                      )}
                      {sensor.type === 'environmental' && sensor.data?.location && (
                        <span>Ubicación: {sensor.data.location}</span>
                      )}
                      {sensor.type === 'emotibit' && sensor.data?.deviceId && (
                        <span>Device ID: {sensor.data.deviceId}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setSelectedSensor(selectedSensor?.id === sensor.id ? null : sensor)}
                      className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
                      title="Ver detalles"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditingSensor(sensor)}
                      className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteSensor(sensor.id)}
                      className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {selectedSensor?.id === sensor.id && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">Detalles del Sensor</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">ID:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-white">{sensor.id}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Creado:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {new Date(sensor.created_at).toLocaleString()}
                        </span>
                      </div>
                      {sensor.min_value !== null && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Valor Mínimo:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{sensor.min_value}</span>
                        </div>
                      )}
                      {sensor.max_value !== null && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Valor Máximo:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{sensor.max_value}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSensor) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingSensor ? 'Editar Sensor' : 'Crear Nuevo Sensor'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingSensor(null)
                    sensorForm.resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tipo de Sensor</label>
                  <select
                    value={sensorForm.values.type}
                    onChange={(e) => sensorForm.handleChange('type', e.target.value)}
                    onBlur={() => sensorForm.handleBlur('type')}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                      sensorForm.errors.type ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    disabled={editingSensor} // Don't allow type change when editing
                  >
                    <option value="">Seleccionar Tipo de Sensor</option>
                    <option value="environmental">Ambiental</option>
                    <option value="emotibit">EmotiBit</option>
                    <option value="rtsp">Cámara RTSP</option>
                  </select>
                  {sensorForm.errors.type && sensorForm.touched.type && (
                    <p className="text-red-500 text-sm mt-1">{sensorForm.errors.type}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre del Sensor</label>
                  <input
                    type="text"
                    placeholder="Ej: Sensor Temperatura Principal"
                    value={sensorForm.values.name}
                    onChange={(e) => sensorForm.handleChange('name', e.target.value)}
                    onBlur={() => sensorForm.handleBlur('name')}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                      sensorForm.errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {sensorForm.errors.name && sensorForm.touched.name && (
                    <p className="text-red-500 text-sm mt-1">{sensorForm.errors.name}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Topic MQTT</label>
                <select
                  value={sensorForm.values.topic}
                  onChange={(e) => sensorForm.handleChange('topic', e.target.value)}
                  onBlur={() => sensorForm.handleBlur('topic')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    sensorForm.errors.topic ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="">Seleccionar Topic MQTT</option>
                  {mqttTopics.map(topic => (
                    <option key={topic.id} value={topic.topic}>{topic.topic}</option>
                  ))}
                </select>
                {sensorForm.errors.topic && sensorForm.touched.topic && (
                  <p className="text-red-500 text-sm mt-1">{sensorForm.errors.topic}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción (opcional)</label>
                  <input
                    type="text"
                    placeholder="Descripción del sensor"
                    value={sensorForm.values.description}
                    onChange={(e) => sensorForm.handleChange('description', e.target.value)}
                    onBlur={() => sensorForm.handleBlur('description')}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                      sensorForm.errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {sensorForm.errors.description && sensorForm.touched.description && (
                    <p className="text-red-500 text-sm mt-1">{sensorForm.errors.description}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Unidad (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: °C, %, V"
                    value={sensorForm.values.unit}
                    onChange={(e) => sensorForm.handleChange('unit', e.target.value)}
                    onBlur={() => sensorForm.handleBlur('unit')}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                      sensorForm.errors.unit ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {sensorForm.errors.unit && sensorForm.touched.unit && (
                    <p className="text-red-500 text-sm mt-1">{sensorForm.errors.unit}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Valor Mínimo (opcional)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={sensorForm.values.min_value || ''}
                    onChange={(e) => sensorForm.handleChange('min_value', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Valor Máximo (opcional)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="100"
                    value={sensorForm.values.max_value || ''}
                    onChange={(e) => sensorForm.handleChange('max_value', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={sensorForm.values.active}
                      onChange={(e) => sensorForm.handleChange('active', e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Activo</span>
                  </label>
                </div>
              </div>

              {/* Type-specific fields */}
              {sensorForm.values.type && (
                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Configuración específica de {sensorForm.values.type}
                  </h4>
                  {renderDataFields(sensorForm.values.type, sensorForm)}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingSensor(null)
                    sensorForm.resetForm()
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingSensor ? handleUpdateSensor : handleCreateSensor}
                  disabled={loading || !sensorForm.isValid}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{editingSensor ? 'Actualizar' : 'Crear'} Sensor</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SensorManagement