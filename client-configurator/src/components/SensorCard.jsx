import React from 'react'

const SensorCard = ({ sensor, onSelect, isSelected = false }) => {
  const getSensorIcon = (type) => {
    switch (type) {
      case 'rtsp':
        return (
          <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
        )
      case 'environmental':
        return (
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        )
      case 'emotibit':
        return (
          <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
        )
      default:
        return (
          <svg className="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
          </svg>
        )
    }
  }

  const getSensorTypeLabel = (type) => {
    switch (type) {
      case 'rtsp':
        return 'Cámara RTSP'
      case 'environmental':
        return 'Sensor Ambiental'
      case 'emotibit':
        return 'EmotiBit'
      default:
        return type
    }
  }

  const renderSensorData = () => {
    switch (sensor.type) {
      case 'rtsp':
        return (
          <div className="mt-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">URL del Stream</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded truncate">
              {sensor.data.url}
            </div>
          </div>
        )
      case 'environmental':
        return (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Ubicación</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{sensor.data.location}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Parámetros</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{sensor.data.parameters}</div>
            </div>
          </div>
        )
      case 'emotibit':
        return (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">ID del Dispositivo</div>
              <div className="text-sm text-gray-700 dark:text-gray-300 font-mono">{sensor.data.deviceId}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Frecuencia de Muestreo</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{sensor.data.samplingRate}</div>
            </div>
          </div>
        )
      default:
        return (
          <div className="mt-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Datos del Sensor</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">
              {JSON.stringify(sensor.data)}
            </div>
          </div>
        )
    }
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-blue-500 dark:border-blue-400 shadow-blue-200 dark:shadow-blue-900/50'
          : 'border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      onClick={() => onSelect && onSelect(sensor)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getSensorIcon(sensor.type)}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{sensor.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{getSensorTypeLabel(sensor.type)}</p>
          </div>
        </div>
        <div className={`h-3 w-3 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-green-500'}`}></div>
      </div>

      {renderSensorData()}

      {isSelected && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center">
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Seleccionado</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SensorCard