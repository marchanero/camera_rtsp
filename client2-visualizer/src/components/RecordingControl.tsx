import React from 'react'

type RecordingState = 'idle' | 'recording' | 'paused' | 'finished'

interface RecordingControlProps {
  recordingState: RecordingState
  elapsedTime: number
  pausedTime: number
  totalRecordingTime: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onFinish: () => void
}

const RecordingControl: React.FC<RecordingControlProps> = ({
  recordingState,
  elapsedTime,
  pausedTime,
  totalRecordingTime,
  onStart,
  onPause,
  onResume,
  onStop,
  onFinish
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStateInfo = () => {
    switch (recordingState) {
      case 'idle':
        return {
          title: 'Listo para grabar',
          subtitle: 'Presiona el botón para iniciar',
          color: 'text-gray-500 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-700'
        }
      case 'recording':
        return {
          title: 'Grabando...',
          subtitle: 'Grabación en curso',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20'
        }
      case 'paused':
        return {
          title: 'Pausado',
          subtitle: 'Grabación en pausa',
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
        }
      case 'finished':
        return {
          title: 'Grabación completada',
          subtitle: 'Sesión finalizada',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20'
        }
      default:
        return {
          title: 'Estado desconocido',
          subtitle: '',
          color: 'text-gray-500 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-700'
        }
    }
  }

  const stateInfo = getStateInfo()

  return (
    <div className={`p-8 rounded-2xl shadow-xl border transition-all duration-300 ${stateInfo.bgColor} border-gray-200 dark:border-gray-700`}>
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          Control de Grabación
        </h3>

        {/* Layout para móvil: contador y botón juntos */}
        <div className="lg:hidden">
          <div className="flex flex-col items-center space-y-6">
            {/* Contador principal */}
            <div>
              <div className={`text-4xl font-mono font-bold mb-2 ${stateInfo.color}`}>
                {formatTime(elapsedTime)}
              </div>
              <div className={`text-lg font-medium ${stateInfo.color}`}>
                {stateInfo.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {stateInfo.subtitle}
              </div>
            </div>

            {/* Botón principal grande estilo pill - centrado debajo del contador */}
            {recordingState === 'idle' && (
              <button
                onClick={onStart}
                className="group relative flex items-center justify-center w-64 h-16 rounded-full font-bold text-lg shadow-2xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/50"
              >
                {/* Efecto de pulso */}
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-blue-500"></div>

                <div className="relative flex items-center space-x-2">
                  <svg className="w-6 h-6 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  <span className="text-base">INICIAR</span>
                </div>
              </button>
            )}

            {recordingState === 'recording' && (
              <button
                onClick={onPause}
                className="group relative flex items-center justify-center w-64 h-16 rounded-full font-bold text-lg shadow-2xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-yellow-500/50"
              >
                {/* Efecto de pulso */}
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-yellow-500"></div>

                <div className="relative flex items-center space-x-2">
                  <svg className="w-6 h-6 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                  </svg>
                  <span className="text-base">PAUSAR</span>
                </div>
              </button>
            )}

            {recordingState === 'paused' && (
              <button
                onClick={onResume}
                className="group relative flex items-center justify-center w-64 h-16 rounded-full font-bold text-lg shadow-2xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-500/50"
              >
                {/* Efecto de pulso */}
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-green-500"></div>

                <div className="relative flex items-center space-x-2">
                  <svg className="w-6 h-6 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="8,5 19,12 8,19" />
                  </svg>
                  <span className="text-base">REANUDAR</span>
                </div>
              </button>
            )}

            {recordingState === 'finished' && (
              <div className="w-64 h-16 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-lg shadow-2xl flex items-center justify-center space-x-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-base">COMPLETADO</span>
              </div>
            )}
          </div>

          {/* Detalles de la grabación para móvil */}
          {(recordingState === 'recording' || recordingState === 'paused' || recordingState === 'finished') && (
            <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Tiempo total:</span>
                  <div className="font-mono font-bold text-gray-900 dark:text-white">
                    {formatTime(totalRecordingTime)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Tiempo pausado:</span>
                  <div className="font-mono font-bold text-gray-900 dark:text-white">
                    {formatTime(pausedTime)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción adicionales para móvil */}
          {(recordingState === 'recording' || recordingState === 'paused') && (
            <div className="mt-4 flex justify-center space-x-4">
              <button
                onClick={onStop}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
                </svg>
                <span>Detener</span>
              </button>

              {recordingState === 'paused' && (
                <button
                  onClick={onFinish}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Finalizar</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Layout para desktop: contador y botón en la misma línea */}
        <div className="hidden lg:block">
          <div className="flex items-center justify-between mb-6">
            {/* Contador principal */}
            <div className="flex-1">
              <div className={`text-5xl font-mono font-bold mb-3 ${stateInfo.color}`}>
                {formatTime(elapsedTime)}
              </div>
              <div className={`text-xl font-medium ${stateInfo.color}`}>
                {stateInfo.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {stateInfo.subtitle}
              </div>
            </div>

            {/* Botón principal grande estilo pill */}
            <div className="flex-shrink-0 ml-8">
              {recordingState === 'idle' && (
                <button
                  onClick={onStart}
                  className="group relative flex items-center justify-center w-64 h-20 rounded-full font-bold text-xl shadow-2xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/50"
                >
                  {/* Efecto de pulso */}
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-blue-500"></div>

                  <div className="relative flex items-center space-x-3">
                    <svg className="w-8 h-8 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span className="text-lg">INICIAR GRABACIÓN</span>
                  </div>
                </button>
              )}

              {recordingState === 'recording' && (
                <button
                  onClick={onPause}
                  className="group relative flex items-center justify-center w-64 h-20 rounded-full font-bold text-xl shadow-2xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-yellow-500/50"
                >
                  {/* Efecto de pulso */}
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-yellow-500"></div>

                  <div className="relative flex items-center space-x-3">
                    <svg className="w-8 h-8 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16"/>
                      <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                    <span className="text-lg">PAUSAR</span>
                  </div>
                </button>
              )}

              {recordingState === 'paused' && (
                <button
                  onClick={onResume}
                  className="group relative flex items-center justify-center w-64 h-20 rounded-full font-bold text-xl shadow-2xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-500/50"
                >
                  {/* Efecto de pulso */}
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-green-500"></div>

                  <div className="relative flex items-center space-x-3">
                    <svg className="w-8 h-8 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                      <polygon points="8,5 19,12 8,19" />
                    </svg>
                    <span className="text-lg">REANUDAR</span>
                  </div>
                </button>
              )}

              {recordingState === 'finished' && (
                <div className="w-64 h-20 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-xl shadow-2xl flex items-center justify-center space-x-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg">COMPLETADO</span>
                </div>
              )}
            </div>
          </div>

          {/* Detalles de la grabación */}
          {(recordingState === 'recording' || recordingState === 'paused' || recordingState === 'finished') && (
            <div className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Tiempo total:</span>
                  <div className="font-mono font-bold text-gray-900 dark:text-white">
                    {formatTime(totalRecordingTime)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Tiempo pausado:</span>
                  <div className="font-mono font-bold text-gray-900 dark:text-white">
                    {formatTime(pausedTime)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción adicionales */}
          {(recordingState === 'recording' || recordingState === 'paused') && (
            <div className="flex justify-center space-x-4">
              <button
                onClick={onStop}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
                </svg>
                <span>Detener</span>
              </button>

              {recordingState === 'paused' && (
                <button
                  onClick={onFinish}
                  className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Finalizar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RecordingControl