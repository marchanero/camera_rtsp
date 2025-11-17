import React from 'react'

const RecordingControl = ({ isRecording, elapsedTime, sensorCount, onStart, onStop }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 relative overflow-hidden">
      {/* Patrón de fondo sutil */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600"></div>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Control de Grabación
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Inicia una grabación sincronizada de todos los sensores conectados
            </p>
          </div>

          {/* Estado de sensores */}
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Sensores listos</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{sensorCount}</div>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-6 md:mb-0 md:mr-8">
            <div className="flex items-center space-x-4 mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Sensores ambientales: {sensorCount}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Cámaras RTSP: 0</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">EmotiBit: 0</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Todos los datos se guardarán en la ubicación configurada en Ajustes
            </p>
          </div>

          <div className="flex-shrink-0">
            <button
              onClick={isRecording ? onStop : onStart}
              className={`group relative flex items-center justify-center w-32 h-32 rounded-full font-bold text-lg shadow-2xl transition-all duration-500 transform hover:scale-105 ${
                isRecording
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-red-500/50'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/50'
              }`}
            >
              {/* Efecto de pulso */}
              <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
                isRecording ? 'bg-red-500' : 'bg-blue-500'
              }`}></div>

              <div className="relative flex flex-col items-center">
                {isRecording ? (
                  <>
                    <svg className="w-8 h-8 mb-1 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
                    </svg>
                    <span className="text-sm">Detener</span>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 mb-1 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" fill="currentColor" />
                    </svg>
                    <span className="text-sm">Iniciar</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>

        {isRecording && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-700 dark:text-red-300 font-medium">
                  Grabación activa: {formatTime(elapsedTime)}
                </span>
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">
                {sensorCount} sensores grabando
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecordingControl