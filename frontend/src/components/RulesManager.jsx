import React, { useState, useEffect } from 'react'
import { useMQTTStore } from '../stores/useMQTTStore'
import {
  Settings,
  Plus,
  Edit3,
  Trash2,
  Play,
  Pause,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Video,
  Radio,
  Zap,
  Target,
  ArrowRight,
  Clock,
  Hash
} from 'lucide-react'

function RulesManager() {
  const isConnected = useMQTTStore(s => s.isConnected)
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
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Cargando reglas...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Reglas de Grabación
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatización basada en sensores
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nueva Regla
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay reglas configuradas
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Crea una regla para automatizar grabaciones
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Crear Regla
            </button>
          </div>
        ) : (
          rules.map((rule) => {
            const condition = JSON.parse(rule.condition)
            const action = JSON.parse(rule.action)

            return (
              <div
                key={rule.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                {/* Status Bar */}
                <div className={`h-1 ${rule.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />

                <div className="p-6">
                  <div className="flex flex-col lg:flex-row justify-between gap-4">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rule.isActive
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                          }`}>
                          <Zap className={`w-5 h-5 ${rule.isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {rule.name}
                          </h3>
                          {rule.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {rule.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${rule.isActive
                            ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                            }`}>
                            {rule.isActive ? <CheckCircle className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                            {rule.isActive ? 'Activa' : 'Inactiva'}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            P{rule.priority}
                          </span>
                        </div>
                      </div>

                      {/* Rule Flow — pills stack on mobile, inline on sm+ */}
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 text-sm">
                        {/* Sensor */}
                        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                          <Radio className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          <span className="text-purple-700 dark:text-purple-400 font-medium truncate">
                            {rule.sensor?.name || 'N/A'}
                          </span>
                        </div>

                        <ArrowRight className="hidden sm:block w-4 h-4 text-gray-400 flex-shrink-0" />

                        {/* Condition */}
                        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                          <Target className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span className="text-amber-700 dark:text-amber-400 font-mono text-xs sm:text-sm truncate">
                            {condition.field} {condition.operator} {condition.value}
                          </span>
                        </div>

                        <ArrowRight className="hidden sm:block w-4 h-4 text-gray-400 flex-shrink-0" />

                        {/* Action */}
                        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl border border-cyan-200 dark:border-cyan-800">
                          <Video className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                          <span className="text-cyan-700 dark:text-cyan-400">
                            {action.type === 'start_recording' ? 'Iniciar' : 'Detener'} ({action.cameras?.length || 0} cáms)
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Duración: {action.duration}s
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" />
                          {rule._count?.executions || 0} ejecuciones
                        </span>
                      </div>
                    </div>

                    {/* Actions — always row, wrap on small screens */}
                    <div className="flex flex-row flex-wrap gap-2 mt-2 lg:mt-0 lg:flex-col lg:flex-nowrap">
                      <button
                        onClick={() => toggleActive(rule)}
                        className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${rule.isActive
                          ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200'
                          : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200'
                          }`}
                        title={rule.isActive ? 'Desactivar' : 'Activar'}
                      >
                        {rule.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(rule)}
                        className="px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-200 transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-200 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  {editingRule ? <Edit3 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingRule ? 'Editar Regla' : 'Nueva Regla'}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre de la regla *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Alerta temperatura alta"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción opcional de la regla..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                    rows="2"
                  />
                </div>
              </div>

              {/* Sensor & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-purple-500" />
                    Sensor *
                  </label>
                  <select
                    required
                    value={formData.sensorId}
                    onChange={(e) => setFormData({ ...formData, sensorId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  >
                    <option value="">Seleccionar sensor...</option>
                    {sensors.map(sensor => (
                      <option key={sensor.id} value={sensor.id}>
                        {sensor.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-blue-500" />
                    Prioridad
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Condition Section */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-200 dark:border-amber-800">
                <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Condición de activación
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                      Campo
                    </label>
                    <input
                      type="text"
                      value={formData.field}
                      onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                      placeholder="value"
                      className="w-full px-3 py-2.5 border border-amber-300 dark:border-amber-700 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                      Operador
                    </label>
                    <select
                      value={formData.operator}
                      onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                      className="w-full px-3 py-2.5 border border-amber-300 dark:border-amber-700 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
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
                    <label className="block text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                      Valor *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2.5 border border-amber-300 dark:border-amber-700 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Action Section */}
              <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl p-5 border border-cyan-200 dark:border-cyan-800">
                <h4 className="font-semibold text-cyan-800 dark:text-cyan-300 mb-4 flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Acción a ejecutar
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-cyan-700 dark:text-cyan-400 mb-2">
                      Tipo de acción
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, actionType: 'start_recording' })}
                        className={`px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${formData.actionType === 'start_recording'
                          ? 'border-cyan-500 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-cyan-300'
                          }`}
                      >
                        <Play className="w-4 h-4" />
                        Iniciar Grabación
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, actionType: 'stop_recording' })}
                        className={`px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${formData.actionType === 'stop_recording'
                          ? 'border-cyan-500 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-cyan-300'
                          }`}
                      >
                        <Pause className="w-4 h-4" />
                        Detener Grabación
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-cyan-700 dark:text-cyan-400 mb-2">
                      Cámaras afectadas *
                    </label>
                    <select
                      multiple
                      required
                      value={formData.cameras}
                      onChange={(e) => setFormData({
                        ...formData,
                        cameras: Array.from(e.target.selectedOptions, option => option.value)
                      })}
                      className="w-full px-3 py-2.5 border border-cyan-300 dark:border-cyan-700 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                      size="3"
                    >
                      {cameras.map(camera => (
                        <option key={camera.id} value={camera.id}>
                          {camera.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Mantén Ctrl/Cmd para seleccionar múltiples
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-cyan-700 dark:text-cyan-400 mb-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Duración (segundos)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="60"
                      className="w-full px-3 py-2.5 border border-cyan-300 dark:border-cyan-700 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {editingRule ? 'Actualizar' : 'Crear'} Regla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default RulesManager
