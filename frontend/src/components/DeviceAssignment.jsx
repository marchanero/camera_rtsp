import React, { useState, useEffect, useMemo } from 'react'
import {
  Smartphone, X, Save, Loader2, AlertCircle, Camera, Radio,
  CheckCircle, Square, Video, Activity, Link2, Filter, Wifi, WifiOff
} from 'lucide-react'
import { useScenario } from '../contexts/ScenarioContext'
import { useMQTTStore } from '../stores/useMQTTStore'
import api from '../services/api'

function DeviceAssignment({ scenario, onClose }) {
  const { updateScenario } = useScenario()
  const sensorData = useMQTTStore(s => s.sensorData)
  const reloadTopics = useMQTTStore(s => s.reloadTopics)

  const [cameras, setCameras] = useState([])
  const [sensors, setSensors] = useState([]) // Sensores de la BD
  const [selectedCameras, setSelectedCameras] = useState([])
  const [selectedSensors, setSelectedSensors] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sensorFilter, setSensorFilter] = useState('all') // 'all' | 'online' | 'assigned'

  useEffect(() => {
    if (scenario) {
      setSelectedCameras(scenario.cameras || [])
      setSelectedSensors(scenario.sensors || [])
    }
  }, [scenario])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [camerasData, sensorsRes] = await Promise.all([
          api.getCameras(),
          fetch('/api/mqtt/sensors').then(r => r.json())
        ])
        setCameras(camerasData)
        setSensors(sensorsRes.data || [])
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Error al cargar dispositivos')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Enriquecer sensores con estado online
  const enrichedSensors = useMemo(() => {
    return sensors.map(sensor => {
      // Verificar si hay datos MQTT para este sensor
      const isOnline = sensorData.has(sensor.sensorId) ||
        Array.from(sensorData.keys()).some(k => k.includes(sensor.sensorId))
      const isAssigned = selectedSensors.includes(sensor.sensorId)
      return { ...sensor, isOnline, isAssigned }
    })
  }, [sensors, sensorData, selectedSensors])

  // Filtrar sensores según el filtro seleccionado
  const filteredSensors = useMemo(() => {
    switch (sensorFilter) {
      case 'online':
        return enrichedSensors.filter(s => s.isOnline)
      case 'assigned':
        return enrichedSensors.filter(s => s.isAssigned)
      default:
        return enrichedSensors
    }
  }, [enrichedSensors, sensorFilter])

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
        // Recargar topics MQTT para suscribirse a los nuevos sensores
        if (reloadTopics) {
          console.log('🔄 Recargando topics MQTT después de asignar sensores...')
          await reloadTopics()
        }
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Asignar Dispositivos
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Escenario: <span className="font-medium text-gray-700 dark:text-gray-300">{scenario.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
              <span className="text-gray-500 dark:text-gray-400">Cargando dispositivos...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {!loading && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedCameras.length}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Cámaras seleccionadas
                  </div>
                </div>
                <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Radio className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {selectedSensors.length}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Sensores seleccionados
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cámaras */}
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    <Video className="w-5 h-5 text-blue-500" />
                    Cámaras
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {cameras.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                        <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        No hay cámaras disponibles
                      </div>
                    ) : (
                      cameras.map(camera => {
                        const isSelected = selectedCameras.includes(camera.id)
                        return (
                          <div
                            key={camera.id}
                            onClick={() => handleCameraToggle(camera.id)}
                            className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700'
                              : 'bg-gray-50 dark:bg-gray-700/30 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-600'
                              }`}>
                              {isSelected ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {camera.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {camera.rtspUrl}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Sensores */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                      <Activity className="w-5 h-5 text-purple-500" />
                      Sensores
                      <span className="text-sm font-normal text-gray-500">({filteredSensors.length})</span>
                    </h3>
                    {/* Filtros */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                      {[
                        { key: 'all', label: 'Todos' },
                        { key: 'online', label: 'Online' },
                        { key: 'assigned', label: 'Asignados' }
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setSensorFilter(f.key)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${sensorFilter === f.key
                            ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {filteredSensors.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                        <Radio className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        {sensors.length === 0
                          ? 'No hay sensores registrados'
                          : 'No hay sensores con este filtro'}
                      </div>
                    ) : (
                      filteredSensors.map(sensor => {
                        const isSelected = selectedSensors.includes(sensor.sensorId)
                        return (
                          <div
                            key={sensor.id}
                            onClick={() => handleSensorToggle(sensor.sensorId)}
                            className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${isSelected
                              ? 'bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700'
                              : 'bg-gray-50 dark:bg-gray-700/30 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isSelected
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-600'
                              }`}>
                              {isSelected ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                {sensor.name}
                                {/* Badge Online/Offline */}
                                {sensor.isOnline ? (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-full">
                                    <Wifi className="w-3 h-3" />
                                    Online
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                                    <WifiOff className="w-3 h-3" />
                                    Offline
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {sensor.type} • {sensor.sensorId}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-pink-500/25 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {saving ? 'Guardando...' : 'Guardar Asignación'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeviceAssignment
