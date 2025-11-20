import React, { useState, useEffect } from 'react'
import { useScenario } from '../contexts/ScenarioContext'

function ThresholdConfig({ scenario, onClose }) {
  const { updateScenario } = useScenario()
  
  // Tipos de sensores comunes con sus unidades
  const sensorTypes = [
    { type: 'temperatura', label: 'Temperatura', unit: '°C', icon: '🌡️', defaultMin: 18, defaultMax: 26 },
    { type: 'humedad', label: 'Humedad', unit: '%', icon: '💧', defaultMin: 30, defaultMax: 70 },
    { type: 'co2', label: 'CO₂', unit: 'ppm', icon: '💨', defaultMin: 400, defaultMax: 1000 },
    { type: 'presion', label: 'Presión', unit: 'hPa', icon: '🎈', defaultMin: 980, defaultMax: 1030 },
    { type: 'ruido', label: 'Ruido', unit: 'dB', icon: '🔊', defaultMin: 30, defaultMax: 70 },
    { type: 'luz', label: 'Luz', unit: 'lux', icon: '💡', defaultMin: 200, defaultMax: 1000 },
    { type: 'voc', label: 'VOC', unit: 'ppb', icon: '🌫️', defaultMin: 0, defaultMax: 500 },
    { type: 'gases/no2', label: 'NO₂', unit: 'ppm', icon: '⚗️', defaultMin: 0, defaultMax: 0.2 },
    { type: 'gases/so2', label: 'SO₂', unit: 'ppm', icon: '⚗️', defaultMin: 0, defaultMax: 0.1 },
    { type: 'gases/co', label: 'CO', unit: 'ppm', icon: '⚗️', defaultMin: 0, defaultMax: 9 },
  ]

  const [thresholds, setThresholds] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (scenario && scenario.thresholds) {
      setThresholds(scenario.thresholds)
    } else {
      // Inicializar con valores por defecto
      const defaultThresholds = {}
      sensorTypes.forEach(sensor => {
        defaultThresholds[sensor.type] = {
          enabled: false,
          min: sensor.defaultMin,
          max: sensor.defaultMax
        }
      })
      setThresholds(defaultThresholds)
    }
  }, [scenario])

  const handleToggle = (type) => {
    setThresholds(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        enabled: !prev[type]?.enabled
      }
    }))
  }

  const handleMinChange = (type, value) => {
    setThresholds(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        min: parseFloat(value) || 0
      }
    }))
  }

  const handleMaxChange = (type, value) => {
    setThresholds(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        max: parseFloat(value) || 0
      }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const result = await updateScenario(scenario.id, {
        thresholds: thresholds
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              ⚡ Configurar Umbrales
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

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Info */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          <strong>💡 Sugerencia:</strong> Define rangos aceptables para cada tipo de sensor. 
          Los valores fuera de estos umbrales podrán activar alertas o grabaciones automáticas.
        </div>

        {/* Lista de Umbrales */}
        <div className="space-y-3 max-h-96 overflow-y-auto mb-6">
          {sensorTypes.map(sensor => (
            <div
              key={sensor.type}
              className={`border rounded-lg p-4 transition-colors ${
                thresholds[sensor.type]?.enabled
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Sensor Header */}
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={thresholds[sensor.type]?.enabled || false}
                    onChange={() => handleToggle(sensor.type)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-lg">{sensor.icon}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {sensor.label}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({sensor.unit})
                  </span>
                </label>
              </div>

              {/* Rangos (solo si está habilitado) */}
              {thresholds[sensor.type]?.enabled && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mínimo
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholds[sensor.type]?.min || sensor.defaultMin}
                      onChange={(e) => handleMinChange(sensor.type, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Máximo
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholds[sensor.type]?.max || sensor.defaultMax}
                      onChange={(e) => handleMaxChange(sensor.type, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Resumen */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-6">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Sensores configurados:</strong> {' '}
            {Object.entries(thresholds).filter(([_, config]) => config?.enabled).length} / {sensorTypes.length}
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar Umbrales'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default ThresholdConfig
