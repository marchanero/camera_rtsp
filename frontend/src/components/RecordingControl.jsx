import React from 'react'
import { useRecording } from '../contexts/RecordingContext'

export default function RecordingControl({ camera }) {
  const { 
    isRecording, 
    getRecordingStatus, 
    startRecording, 
    stopRecording 
  } = useRecording()

  const recordingState = getRecordingStatus(camera.id)
  const recording = isRecording(camera.id)

  const handleToggleRecording = async () => {
    if (recording) {
      await stopRecording(camera.id)
    } else {
      await startRecording(camera.id, camera.name)
    }
  }

  const getStatusColor = () => {
    switch (recordingState.status) {
      case 'recording':
        return 'bg-red-500'
      case 'starting':
        return 'bg-yellow-500 animate-pulse'
      case 'stopping':
        return 'bg-gray-500 animate-pulse'
      case 'error':
        return 'bg-red-700'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusText = () => {
    switch (recordingState.status) {
      case 'recording':
        return '🔴 Grabando'
      case 'starting':
        return '⏳ Iniciando...'
      case 'stopping':
        return '⏹️ Deteniendo...'
      case 'error':
        return '❌ Error'
      default:
        return '⚫ Detenido'
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Indicador de estado */}
      <div className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${getStatusColor()}`}>
        {getStatusText()}
      </div>

      {/* Botón de control */}
      <button
        onClick={handleToggleRecording}
        disabled={recordingState.status === 'starting' || recordingState.status === 'stopping'}
        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
          recording
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={recording ? 'Detener grabación' : 'Iniciar grabación'}
      >
        {recording ? '⏹️ Detener' : '⏺️ Grabar'}
      </button>

      {/* Información adicional */}
      {recordingState.startedAt && (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          Desde: {new Date(recordingState.startedAt).toLocaleTimeString()}
        </span>
      )}

      {recordingState.error && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {recordingState.error}
        </span>
      )}
    </div>
  )
}
