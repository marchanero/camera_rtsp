import React, { useState } from 'react'
import { useScenario } from '../contexts/ScenarioContext'
import ScenarioForm from './ScenarioForm'
import DeviceAssignment from './DeviceAssignment'
import ThresholdConfig from './ThresholdConfig'

function ScenarioManager() {
  const {
    scenarios,
    activeScenario,
    loading,
    error,
    deleteScenario,
    activateScenario
  } = useScenario()

  const [showForm, setShowForm] = useState(false)
  const [editingScenario, setEditingScenario] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list', 'form', 'devices', 'thresholds'
  const [selectedScenario, setSelectedScenario] = useState(null)

  const handleCreateNew = () => {
    setEditingScenario(null)
    setViewMode('form')
  }

  const handleEdit = (scenario) => {
    setEditingScenario(scenario)
    setViewMode('form')
  }

  const handleDelete = async (scenario) => {
    if (!confirm(`¿Eliminar el escenario "${scenario.name}"?`)) return
    
    const result = await deleteScenario(scenario.id)
    if (result.success) {
      alert('Escenario eliminado exitosamente')
    } else {
      alert('Error al eliminar: ' + result.message)
    }
  }

  const handleActivate = (scenario) => {
    if (activeScenario?.id === scenario.id) {
      activateScenario(null) // Desactivar
    } else {
      activateScenario(scenario) // Activar
    }
  }

  const handleConfigureDevices = (scenario) => {
    setSelectedScenario(scenario)
    setViewMode('devices')
  }

  const handleConfigureThresholds = (scenario) => {
    setSelectedScenario(scenario)
    setViewMode('thresholds')
  }

  const handleFormClose = () => {
    setViewMode('list')
    setEditingScenario(null)
  }

  const handleDevicesClose = () => {
    setViewMode('list')
    setSelectedScenario(null)
  }

  const handleThresholdsClose = () => {
    setViewMode('list')
    setSelectedScenario(null)
  }

  // Vista de formulario
  if (viewMode === 'form') {
    return (
      <ScenarioForm
        scenario={editingScenario}
        onClose={handleFormClose}
      />
    )
  }

  // Vista de asignación de dispositivos
  if (viewMode === 'devices' && selectedScenario) {
    return (
      <DeviceAssignment
        scenario={selectedScenario}
        onClose={handleDevicesClose}
      />
    )
  }

  // Vista de configuración de umbrales
  if (viewMode === 'thresholds' && selectedScenario) {
    return (
      <ThresholdConfig
        scenario={selectedScenario}
        onClose={handleThresholdsClose}
      />
    )
  }

  // Vista de lista de escenarios
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>⚙️</span>
              <span>Configuración de Escenarios</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gestiona aulas y asigna dispositivos
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>➕</span>
            <span>Nuevo Escenario</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Escenario Activo */}
      {activeScenario && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <div className="font-semibold text-green-900 dark:text-green-100">
                  Escenario Activo: {activeScenario.name}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  {activeScenario.cameras?.length || 0} cámaras • {activeScenario.sensors?.length || 0} sensores
                </div>
              </div>
            </div>
            <button
              onClick={() => activateScenario(null)}
              className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 text-green-700 dark:text-green-300 rounded transition-colors"
            >
              Desactivar
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Cargando escenarios...
        </div>
      )}

      {/* Lista de Escenarios */}
      {!loading && scenarios.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No hay escenarios configurados
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Crea tu primer escenario para organizar cámaras y sensores
          </p>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            Crear Escenario
          </button>
        </div>
      )}

      {!loading && scenarios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map(scenario => (
            <div
              key={scenario.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 transition-all ${
                activeScenario?.id === scenario.id
                  ? 'border-green-500'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {activeScenario?.id === scenario.id && <span className="text-green-500">✓</span>}
                    {scenario.name}
                  </h3>
                  {scenario.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {scenario.description}
                    </p>
                  )}
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  scenario.active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {scenario.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {scenario.cameras?.length || 0}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Cámaras
                  </div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {scenario.sensors?.length || 0}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Sensores
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="space-y-2">
                <button
                  onClick={() => handleActivate(scenario)}
                  className={`w-full px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                    activeScenario?.id === scenario.id
                      ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {activeScenario?.id === scenario.id ? '⊗ Desactivar' : '✓ Activar Escenario'}
                </button>
                
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleEdit(scenario)}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleConfigureDevices(scenario)}
                    className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                    title="Dispositivos"
                  >
                    📱
                  </button>
                  <button
                    onClick={() => handleConfigureThresholds(scenario)}
                    className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                    title="Umbrales"
                  >
                    ⚡
                  </button>
                </div>
                
                <button
                  onClick={() => handleDelete(scenario)}
                  className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ScenarioManager
