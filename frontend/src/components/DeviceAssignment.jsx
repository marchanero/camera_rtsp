import React, { useState, useEffect } from 'react'
import { useScenario } from '../contexts/ScenarioContext'
import { useMQTT } from '../contexts/MQTTContext'
import api from '../services/api'

function DeviceAssignment({ scenario, onClose }) {
  const { updateScenario } = useScenario()
  const { sensorData } = useMQTT()
  
  const [cameras, setCameras] = useState([])
  const [selectedCameras, setSelectedCameras] = useState([])
  const [selectedSensors, setSelectedSensors] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (scenario) {
      setSelectedCameras(scenario.cameras || [])
      setSelectedSensors(scenario.sensors || [])
    }
  }, [scenario])

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const data = await api.getCameras()
        setCameras(data)
      } catch (err) {
        console.error('Error fetching cameras:', err)
        setError('Error al cargar cámaras')
      } finally {
        setLoading(false)
      }
    }
    fetchCameras()
  }, [])

  // Obtener lista única de sensores desde MQTT
  const uniqueSensors = Array.from(sensorData.entries()).map(([id, data]) => ({
    id,
    name: data.name || id,
    type: data.type || 'unknown'
  }))

  const handleCameraToggle = (cameraId) => {
    setSelectedCameras(prev => 
      prev.includes(cameraId)
        ? prev.filter(id => id !== cameraId)
        : [...prev, cameraId]
    )
  }

  const handleSensorToggle = (sensorId) => {
    setSelectedSensors(prev =>
      prev.includes(sensorId)
        ? prev.filter(id => id !== sensorId)
        : [...prev, sensorId]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const result = await updateScenario(scenario.id, {
        cameras: selectedCameras,
        sensors: selectedSensors
      })

      if (result.success) {
        onClose()
      } else {
        setError(result.message || 'Error al guardar')
      }
    } catch (err) {
      setError('Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              📱 Asignar Dispositivos
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Escenario: {scenario.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400">Cargando dispositivos...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {selectedCameras.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Cámaras seleccionadas
                </div>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {selectedSensors.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Sensores seleccionados
                </div>
              </div>
            </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cámaras */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              📹 Cámaras
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {cameras.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No hay cámaras disponibles
                </div>
              ) : (
                cameras.map(camera => (
                  <label
                    key={camera.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCameras.includes(camera.id)}
                      onChange={() => handleCameraToggle(camera.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {camera.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {camera.rtspUrl}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Sensores */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              📡 Sensores
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {uniqueSensors.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No hay sensores conectados
                </div>
              ) : (
                uniqueSensors.map(sensor => (
                  <label
                    key={sensor.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSensors.includes(sensor.id)}
                      onChange={() => handleSensorToggle(sensor.id)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {sensor.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Tipo: {sensor.type}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar Asignación'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}

export default DeviceAssignment
