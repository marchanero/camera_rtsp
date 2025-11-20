import React, { useState, useEffect } from 'react'
import { useMQTT } from '../contexts/MQTTContext'

function RulesManager() {
  const { isConnected } = useMQTT()
  const [rules, setRules] = useState([])
  const [sensors, setSensors] = useState([])
  const [cameras, setCameras] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sensorId: '',
    operator: '>',
    value: '',
    field: 'value',
    actionType: 'start_recording',
    cameras: [],
    duration: 300,
    priority: 5
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [rulesRes, sensorsRes, camerasRes] = await Promise.all([
        fetch('/api/mqtt/rules'),
        fetch('/api/mqtt/sensors'),
        fetch('/api/cameras')
      ])

      const rulesData = await rulesRes.json()
      const sensorsData = await sensorsRes.json()
      const camerasData = await camerasRes.json()

      if (rulesData.success) setRules(rulesData.data)
      if (sensorsData.success) setSensors(sensorsData.data)
      setCameras(Array.isArray(camerasData) ? camerasData : camerasData.data || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        sensorId: parseInt(formData.sensorId),
        condition: {
          field: formData.field,
          operator: formData.operator,
          value: parseFloat(formData.value)
        },
        action: {
          type: formData.actionType,
          cameras: formData.cameras.map(id => parseInt(id)),
          duration: parseInt(formData.duration)
        },
        priority: parseInt(formData.priority)
      }

      const url = editingRule 
        ? `/api/mqtt/rules/${editingRule.id}`
        : '/api/mqtt/rules'
      
      const method = editingRule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        await fetchData()
        closeModal()
      } else {
        alert('Error: ' + data.error)
      }
    } catch (err) {
      console.error('Error saving rule:', err)
      alert('Error guardando regla')
    }
  }

  const handleEdit = (rule) => {
    const condition = JSON.parse(rule.condition)
    const action = JSON.parse(rule.action)

    setEditingRule(rule)
    setFormData({
      name: rule.name,
      description: rule.description || '',
      sensorId: rule.sensorId.toString(),
      operator: condition.operator,
      value: condition.value.toString(),
      field: condition.field || 'value',
      actionType: action.type,
      cameras: action.cameras || [],
      duration: action.duration || 300,
      priority: rule.priority
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta regla?')) return

    try {
      const response = await fetch(`/api/mqtt/rules/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
      }
    } catch (err) {
      console.error('Error deleting rule:', err)
    }
  }

  const toggleActive = async (rule) => {
    try {
      const response = await fetch(`/api/mqtt/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive })
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
      }
    } catch (err) {
      console.error('Error toggling rule:', err)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingRule(null)
    setFormData({
      name: '',
      description: '',
      sensorId: '',
      operator: '>',
      value: '',
      field: 'value',
      actionType: 'start_recording',
      cameras: [],
      duration: 300,
      priority: 5
    })
  }

  const getOperatorSymbol = (op) => {
    const symbols = {
      '>': 'Mayor que',
      '<': 'Menor que',
      '>=': 'Mayor o igual',
      '<=': 'Menor o igual',
      '==': 'Igual a',
      '!=': 'Diferente de'
    }
    return symbols[op] || op
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando reglas...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            ⚙️ Reglas de Grabación
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configurar activación automática basada en sensores
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
        >
          ➕ Nueva Regla
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              No hay reglas configuradas
            </p>
          </div>
        ) : (
          rules.map((rule) => {
            const condition = JSON.parse(rule.condition)
            const action = JSON.parse(rule.action)

            return (
              <div
                key={rule.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {rule.name}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rule.isActive
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                      }`}>
                        {rule.isActive ? '✓ Activa' : '⏸ Inactiva'}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                        Prioridad: {rule.priority}
                      </span>
                    </div>

                    {rule.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {rule.description}
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                        <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                          📊 Sensor
                        </div>
                        <div className="text-gray-900 dark:text-white">
                          {rule.sensor?.name || 'N/A'}
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                        <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                          🎯 Condición
                        </div>
                        <div className="text-gray-900 dark:text-white">
                          {condition.field} {condition.operator} {condition.value}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {getOperatorSymbol(condition.operator)}
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                        <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                          🎬 Acción
                        </div>
                        <div className="text-gray-900 dark:text-white">
                          {action.type === 'start_recording' ? '▶️ Iniciar' : '⏹️ Detener'} grabación
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {action.cameras?.length || 0} cámara(s)
                          {action.duration && ` por ${action.duration}s`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>🔄 Ejecutada {rule._count?.executions || 0} veces</span>
                    </div>
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`px-3 py-2 rounded transition-colors ${
                        rule.isActive
                          ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
                          : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200'
                      }`}
                      title={rule.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {rule.isActive ? '⏸' : '▶️'}
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="px-3 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 transition-colors"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded hover:bg-red-200 transition-colors"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {editingRule ? 'Editar Regla' : 'Nueva Regla'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows="2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sensor *
                    </label>
                    <select
                      required
                      value={formData.sensorId}
                      onChange={(e) => setFormData({...formData, sensorId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Seleccionar...</option>
                      {sensors.map(sensor => (
                        <option key={sensor.id} value={sensor.id}>
                          {sensor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Prioridad
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Condición</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Campo
                      </label>
                      <input
                        type="text"
                        value={formData.field}
                        onChange={(e) => setFormData({...formData, field: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Operador
                      </label>
                      <select
                        value={formData.operator}
                        onChange={(e) => setFormData({...formData, operator: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value=">">{'>'} Mayor</option>
                        <option value="<">{'<'} Menor</option>
                        <option value=">=">{'>='} Mayor o igual</option>
                        <option value="<=">{'<='} Menor o igual</option>
                        <option value="==">== Igual</option>
                        <option value="!=">!= Diferente</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Valor *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={formData.value}
                        onChange={(e) => setFormData({...formData, value: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Acción</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Tipo de Acción
                      </label>
                      <select
                        value={formData.actionType}
                        onChange={(e) => setFormData({...formData, actionType: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="start_recording">Iniciar Grabación</option>
                        <option value="stop_recording">Detener Grabación</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Cámaras *
                      </label>
                      <select
                        multiple
                        required
                        value={formData.cameras}
                        onChange={(e) => setFormData({
                          ...formData, 
                          cameras: Array.from(e.target.selectedOptions, option => option.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        size="3"
                      >
                        {cameras.map(camera => (
                          <option key={camera.id} value={camera.id}>
                            {camera.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Mantén Ctrl/Cmd para seleccionar múltiples
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Duración (segundos)
                      </label>
                      <input
                        type="number"
                        value={formData.duration}
                        onChange={(e) => setFormData({...formData, duration: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    {editingRule ? 'Actualizar' : 'Crear'} Regla
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RulesManager
