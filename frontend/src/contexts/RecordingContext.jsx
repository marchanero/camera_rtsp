import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const RecordingContext = createContext()

export function RecordingProvider({ children }) {
  // Cargar estado de grabación desde localStorage
  const [recordings, setRecordings] = useState(() => {
    try {
      const saved = localStorage.getItem('recordingState')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Convertir el array guardado de vuelta a Map
        return new Map(parsed.map(([key, value]) => [
          key,
          { ...value, startedAt: value.startedAt ? new Date(value.startedAt) : null }
        ]))
      }
    } catch (error) {
      console.error('Error cargando estado de grabación:', error)
    }
    return new Map()
  })
  
  const [globalRecordingStatus, setGlobalRecordingStatus] = useState('idle') // 'idle', 'starting', 'recording', 'stopping'

  // Persistir estado de grabación en localStorage
  useEffect(() => {
    try {
      // Convertir Map a array para poder serializar con JSON
      const recordingsArray = Array.from(recordings.entries())
      localStorage.setItem('recordingState', JSON.stringify(recordingsArray))
    } catch (error) {
      console.error('Error guardando estado de grabación:', error)
    }
  }, [recordings])

  /**
   * Sincroniza el estado de grabación desde el backend
   * IMPORTANTE: Esta función NO limpia el estado si backend dice false
   * Solo actualiza si backend confirma que SÍ está grabando
   * Para limpiar, usar stopRecording explícitamente
   */
  const syncRecordingStatus = useCallback(async (cameraId, cameraName) => {
    try {
      const response = await fetch(`/api/media/status/${cameraId}`)
      const data = await response.json()
      
      console.log(`🔄 Sync status camera ${cameraId}:`, data)
      
      if (data.isRecording) {
        // Solo actualizar si backend confirma grabación activa
        setRecordings(prev => {
          const existing = prev.get(cameraId)
          if (!existing) {
            console.log(`✅ Camera ${cameraId} confirmada grabando (agregando a estado)`)
            return new Map(prev).set(cameraId, {
              status: 'recording',
              cameraName,
              startedAt: new Date()
            })
          }
          // Ya existe, no cambiar
          return prev
        })
      }
      // NO limpiar si isRecording es false - mantener estado local
      // El usuario debe detener explícitamente con stopRecording
      
      return data.isRecording
    } catch (error) {
      console.error('Error sincronizando estado:', error)
      return false
    }
  }, [])

  /**
   * Inicia grabación para una cámara específica
   * @param {number} cameraId - ID de la cámara
   * @param {string} cameraName - Nombre de la cámara
   * @param {Object} options - Opciones adicionales
   * @param {number} options.scenarioId - ID del escenario activo
   * @param {string} options.scenarioName - Nombre del escenario activo
   */
  const startRecording = useCallback(async (cameraId, cameraName, options = {}) => {
    try {
      console.log('📹 RecordingContext.startRecording llamado:', {
        cameraId,
        cameraName,
        options,
        hasScenarioId: !!options.scenarioId,
        hasScenarioName: !!options.scenarioName
      })

      setRecordings(prev => new Map(prev).set(cameraId, {
        status: 'starting',
        cameraName,
        startedAt: null
      }))

      const requestBody = {
        recordSensors: true,
        scenarioId: options.scenarioId,
        scenarioName: options.scenarioName
      }

      console.log('📤 Enviando request a backend:', {
        url: `/api/media/start/${cameraId}`,
        body: requestBody
      })

      const response = await fetch(`/api/media/start/${cameraId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      console.log('📥 Respuesta del backend:', data)

      if (!data.success) {
        throw new Error(data.error || 'Error iniciando grabación')
      }

      setRecordings(prev => new Map(prev).set(cameraId, {
        status: 'recording',
        cameraName,
        scenarioId: options.scenarioId,
        scenarioName: options.scenarioName,
        startedAt: new Date()
      }))

      console.log(`✅ Grabación iniciada: ${cameraName}${options.scenarioName ? ` (${options.scenarioName})` : ''}`)
      return { success: true, data }

    } catch (error) {
      console.error('❌ Error iniciando grabación:', error)
      setRecordings(prev => new Map(prev).set(cameraId, {
        status: 'error',
        cameraName,
        error: error.message
      }))
      return { success: false, error: error.message }
    }
  }, [])

  /**
   * Detiene grabación para una cámara específica
   */
  const stopRecording = useCallback(async (cameraId) => {
    try {
      const current = recordings.get(cameraId)
      setRecordings(prev => new Map(prev).set(cameraId, {
        ...current,
        status: 'stopping'
      }))

      const response = await fetch(`/api/media/stop/${cameraId}`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error deteniendo grabación')
      }

      // SOLO AHORA limpiar el estado después de confirmar que backend detuvo
      setRecordings(prev => {
        const next = new Map(prev)
        next.delete(cameraId)
        return next
      })

      console.log(`🛑 Grabación detenida y estado limpiado: ${current?.cameraName}`)
      return { success: true, data }

    } catch (error) {
      console.error('❌ Error deteniendo grabación:', error)
      
      // En caso de error, restaurar estado anterior
      setRecordings(prev => {
        const current = prev.get(cameraId)
        if (current) {
          return new Map(prev).set(cameraId, {
            ...current,
            status: 'recording' // Volver a recording si falló
          })
        }
        return prev
      })
      
      return { success: false, error: error.message }
    }
  }, [recordings])

  /**
   * Inicia grabación para todas las cámaras
   * @param {Array} cameras - Lista de cámaras
   * @param {Object} options - Opciones de grabación (scenarioId, scenarioName)
   */
  const startAllRecordings = useCallback(async (cameras, options = {}) => {
    setGlobalRecordingStatus('starting')
    
    const results = await Promise.allSettled(
      cameras.map(camera => startRecording(camera.id, camera.name, options))
    )

    setGlobalRecordingStatus('recording')
    return results
  }, [startRecording])

  /**
   * Detiene grabación para todas las cámaras
   */
  const stopAllRecordings = useCallback(async () => {
    setGlobalRecordingStatus('stopping')
    
    const cameraIds = Array.from(recordings.keys())
    const results = await Promise.allSettled(
      cameraIds.map(id => stopRecording(id))
    )

    setGlobalRecordingStatus('idle')
    return results
  }, [recordings, stopRecording])

  /**
   * Obtiene estado de grabación de una cámara
   */
  const getRecordingStatus = useCallback((cameraId) => {
    return recordings.get(cameraId) || { status: 'idle' }
  }, [recordings])

  /**
   * Verifica si una cámara está grabando
   */
  const isRecording = useCallback((cameraId) => {
    const status = recordings.get(cameraId)?.status
    return status === 'recording' || status === 'starting'
  }, [recordings])

  /**
   * Obtiene lista de grabaciones de una cámara
   */
  const getRecordings = useCallback(async (cameraId) => {
    try {
      const response = await fetch(`/api/media/recordings/${cameraId}`)
      const data = await response.json()
      return data.recordings || []
    } catch (error) {
      console.error('Error obteniendo grabaciones:', error)
      return []
    }
  }, [])

  /**
   * Descarga una grabación
   */
  const downloadRecording = useCallback((cameraId, filename) => {
    window.open(`/api/media/download/${cameraId}/${filename}`, '_blank')
  }, [])

  /**
   * Elimina una grabación
   */
  const deleteRecording = useCallback(async (cameraId, filename) => {
    try {
      const response = await fetch(`/api/media/recording/${cameraId}/${filename}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      return { success: data.success, message: data.message }
    } catch (error) {
      console.error('Error eliminando grabación:', error)
      return { success: false, error: error.message }
    }
  }, [])

  const value = {
    // Estado
    recordings,
    globalRecordingStatus,
    
    // Acciones individuales
    startRecording,
    stopRecording,
    syncRecordingStatus,
    
    // Acciones globales
    startAllRecordings,
    stopAllRecordings,
    
    // Consultas
    getRecordingStatus,
    isRecording,
    getRecordings,
    
    // Gestión de archivos
    downloadRecording,
    deleteRecording,
    
    // Estadísticas
    activeRecordingsCount: recordings.size,
    isAnyRecording: recordings.size > 0
  }

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  )
}

// Hook debe estar después del Provider para compatibilidad con HMR
export function useRecording() {
  const context = useContext(RecordingContext)
  if (!context) {
    throw new Error('useRecording must be used within a RecordingProvider')
  }
  return context
}
