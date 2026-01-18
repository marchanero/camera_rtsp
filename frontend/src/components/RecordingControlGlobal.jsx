import { useState, useEffect, useRef, useCallback } from 'react'
import { useRecording } from '../contexts/RecordingContext'
import { useScenario } from '../contexts/ScenarioContext'
import api from '../services/api'

const RecordingControlGlobal = () => {
  const {
    recordings,
    startAllRecordings,
    stopAllRecordings,
    activeRecordingsCount,
    initialSyncDone
  } = useRecording()

  const { activeScenario } = useScenario()

  const [cameras, setCameras] = useState([])
  const [recordingState, setRecordingState] = useState(() => {
    try {
      const saved = localStorage.getItem('recordingControlState')
      return saved ? JSON.parse(saved).recordingState || 'idle' : 'idle'
    } catch {
      return 'idle'
    }
  })
  const [elapsedTime, setElapsedTime] = useState(() => {
    try {
      const saved = localStorage.getItem('recordingControlState')
      return saved ? JSON.parse(saved).elapsedTime || 0 : 0
    } catch {
      return 0
    }
  })
  const [pausedTime, setPausedTime] = useState(() => {
    try {
      const saved = localStorage.getItem('recordingControlState')
      return saved ? JSON.parse(saved).pausedTime || 0 : 0
    } catch {
      return 0
    }
  })
  const [totalRecordingTime, setTotalRecordingTime] = useState(() => {
    try {
      const saved = localStorage.getItem('recordingControlState')
      return saved ? JSON.parse(saved).totalRecordingTime || 0 : 0
    } catch {
      return 0
    }
  })
  const [pausedAt, setPausedAt] = useState(() => {
    try {
      const saved = localStorage.getItem('recordingControlState')
      const parsed = saved ? JSON.parse(saved) : {}
      return parsed.pausedAt ? new Date(parsed.pausedAt) : null
    } catch {
      return null
    }
  })

  // Referencias para cálculo preciso del tiempo
  const recordingStartTime = useRef(null)
  const pauseStartTime = useRef(null)
  const totalPausedDuration = useRef(0)

  // Referencia para recordings (evita re-renders infinitos)
  const recordingsRef = useRef(recordings)
  recordingsRef.current = recordings

  // Estado para controlar cuando el estado está completamente cargado
  const [stateLoaded, setStateLoaded] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0) // Para forzar re-renders cuando cambian las referencias
  const [backendVerified, setBackendVerified] = useState(false) // Verificación con backend después de cargar localStorage

  // Función para forzar actualización del tiempo mostrado
  const updateDisplayedTime = useCallback(() => {
    if (recordingState === 'recording') {
      const elapsed = calculateElapsedTime()
      setElapsedTime(elapsed)
      setTotalRecordingTime(elapsed)
    } else if (recordingState === 'paused') {
      setPausedTime(calculatePausedTime())
    }
  }, [recordingState])

  // Cargar estado de referencias desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recordingControlState')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.recordingStartTime) {
          recordingStartTime.current = new Date(parsed.recordingStartTime).getTime()
        }
        if (parsed.pauseStartTime) {
          pauseStartTime.current = new Date(parsed.pauseStartTime).getTime()
        }
        totalPausedDuration.current = parsed.totalPausedDuration || 0

        // Si se recuperó estado de recording, actualizar inmediatamente
        if (parsed.recordingState === 'recording' && recordingStartTime.current) {
          updateDisplayedTime()
        }
      }
    } catch (error) {
      console.error('Error cargando estado de referencias:', error)
    } finally {
      setStateLoaded(true)
    }
  }, []) // Solo al montar // Solo al montar

  // Función para guardar estado en localStorage
  const saveStateToLocalStorage = useCallback(() => {
    try {
      const state = {
        recordingState,
        elapsedTime,
        pausedTime,
        totalRecordingTime,
        pausedAt: pausedAt ? pausedAt.toISOString() : null,
        recordingStartTime: recordingStartTime.current ? new Date(recordingStartTime.current).toISOString() : null,
        pauseStartTime: pauseStartTime.current ? new Date(pauseStartTime.current).toISOString() : null,
        totalPausedDuration: totalPausedDuration.current
      }
      localStorage.setItem('recordingControlState', JSON.stringify(state))
    } catch (error) {
      console.error('Error guardando estado del contador:', error)
    }
  }, [recordingState, elapsedTime, pausedTime, totalRecordingTime, pausedAt])

  // Guardar estado cada vez que cambie
  useEffect(() => {
    saveStateToLocalStorage()
  }, [saveStateToLocalStorage])

  // Cargar cámaras al montar el componente
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const data = await api.getCameras()
        setCameras(data)
      } catch (error) {
        console.error('Error cargando cámaras:', error)
      }
    }

    fetchCameras()
  }, [])

  /**
   * Calcula el tiempo transcurrido basándose en timestamps reales
   * Esto es inmune al throttling del navegador cuando la pestaña está en segundo plano
   */
  const calculateElapsedTime = () => {
    if (!recordingStartTime.current) return 0

    const now = Date.now()
    let elapsed = Math.floor((now - recordingStartTime.current) / 1000)

    // Restar el tiempo que estuvo pausado
    elapsed -= Math.floor(totalPausedDuration.current / 1000)

    // Si está actualmente pausado, restar también el tiempo de pausa actual
    if (pauseStartTime.current) {
      elapsed -= Math.floor((now - pauseStartTime.current) / 1000)
    }

    return Math.max(0, elapsed)
  }

  /**
   * Calcula el tiempo de pausa actual
   */
  const calculatePausedTime = () => {
    if (!pauseStartTime.current) return Math.floor(totalPausedDuration.current / 1000)

    const now = Date.now()
    const currentPauseDuration = now - pauseStartTime.current
    return Math.floor((totalPausedDuration.current + currentPauseDuration) / 1000)
  }

  /**
   * Sincroniza el tiempo con el backend
   * Obtiene el startTime real de las grabaciones activas
   */
  const syncTimeWithBackend = useCallback(async () => {
    if (recordingsRef.current.size === 0) return

    try {
      // Obtener el startedAt más antiguo de las grabaciones activas
      let earliestStart = null
      for (const [, recordingInfo] of recordingsRef.current.entries()) {
        if (recordingInfo.startedAt) {
          const startDate = new Date(recordingInfo.startedAt)
          if (!earliestStart || startDate < earliestStart) {
            earliestStart = startDate
          }
        }
      }

      if (earliestStart) {
        recordingStartTime.current = earliestStart.getTime()
        // Forzar actualización inmediata del tiempo mostrado
        updateDisplayedTime()
        console.log('⏱️ Tiempo sincronizado con backend, inicio:', earliestStart.toISOString())
      }
    } catch (error) {
      console.error('Error sincronizando tiempo:', error)
    }
  }, []) // Removido recordings y calculateElapsedTime de las dependencias

  // Timer effect - ahora calcula el tiempo real en lugar de incrementar
  useEffect(() => {
    if (!stateLoaded) {
      console.log('⏱️ Temporizador esperando stateLoaded...');
      return // Esperar a que se cargue el estado
    }

    console.log('⏱️ Inicializando temporizador - Estado:', recordingState, 'stateLoaded:', stateLoaded);
    let interval
    if (recordingState === 'recording' || recordingState === 'paused') {
      console.log('⏱️ Creando interval para estado:', recordingState)
      // Actualizar cada segundo basándose en el tiempo real
      interval = setInterval(() => {
        const elapsed = calculateElapsedTime()
        const paused = calculatePausedTime()

        if (recordingState === 'recording') {
          console.log('⏱️ Actualizando tiempo - Elapsed:', elapsed, 'Total:', elapsed)
          setElapsedTime(elapsed)
          setTotalRecordingTime(elapsed)
        } else if (recordingState === 'paused') {
          console.log('⏱️ Actualizando tiempo pausado:', paused)
          setPausedTime(paused)
        }
      }, 1000)

      // Actualizar inmediatamente
      if (recordingState === 'recording') {
        const elapsed = calculateElapsedTime()
        console.log('⏱️ Actualización inmediata - Elapsed:', elapsed)
        setElapsedTime(elapsed)
        setTotalRecordingTime(elapsed)
      }
    } else {
      console.log('⏱️ No se crea interval - Estado:', recordingState)
    }
    return () => {
      if (interval) {
        console.log('⏱️ Limpiando temporizador')
        clearInterval(interval)
      }
    }
  }, [recordingState, stateLoaded])

  /**
   * Maneja cuando la página vuelve a ser visible
   * Re-sincroniza el tiempo y actualiza inmediatamente
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && recordingState === 'recording') {
        console.log('👁️ Página visible, actualizando contador de grabación...')
        // Sincronizar con el backend para obtener el tiempo más preciso
        syncTimeWithBackend()
        // Actualizar inmediatamente con el cálculo local
        const elapsed = calculateElapsedTime()
        setElapsedTime(elapsed)
        setTotalRecordingTime(elapsed)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [recordingState, syncTimeWithBackend])

  // Sync with recording context
  useEffect(() => {
    // Solo sincronizar si el estado está completamente cargado
    if (!stateLoaded) {
      console.log('🔄 Sincronización esperando stateLoaded...');
      return
    }

    // IMPORTANTE: Esperar a que el backend confirme el estado antes de confiar en localStorage
    if (!initialSyncDone) {
      console.log('🔄 Sincronización esperando initialSyncDone del backend...');
      return
    }

    // Verificación inicial: si localStorage dice "recording" pero backend no tiene sesiones
    if (!backendVerified && recordingState !== 'idle') {
      if (activeRecordingsCount === 0) {
        console.log('⚠️ localStorage decía recording pero backend no tiene sesiones, reseteando estado local')
        setRecordingState('idle')
        recordingStartTime.current = null
        pauseStartTime.current = null
        totalPausedDuration.current = 0
        setElapsedTime(0)
        setPausedTime(0)
        setTotalRecordingTime(0)
        localStorage.removeItem('recordingControlState')
      }
      setBackendVerified(true)
      return
    }

    console.log('🔄 Sincronizando - activeRecordingsCount:', activeRecordingsCount, 'recordingState:', recordingState);

    if (activeRecordingsCount > 0 && recordingState === 'idle') {
      console.log('🔄 Detectadas grabaciones activas, cambiando a recording');
      // Obtener el tiempo de inicio de las grabaciones activas
      let earliestStart = null
      let totalElapsedFromBackend = 0

      for (const [, recordingInfo] of recordingsRef.current.entries()) {
        if (recordingInfo.startedAt) {
          const startDate = new Date(recordingInfo.startedAt)
          if (!earliestStart || startDate < earliestStart) {
            earliestStart = startDate
          }
        }
        if (recordingInfo.elapsedSeconds) {
          totalElapsedFromBackend = Math.max(totalElapsedFromBackend, recordingInfo.elapsedSeconds)
        }
      }

      if (earliestStart) {
        recordingStartTime.current = earliestStart.getTime()
        console.log('🔄 Establecido recordingStartTime:', new Date(recordingStartTime.current).toLocaleString());
        // Si hay tiempo del backend, usarlo para corregir
        if (totalElapsedFromBackend > 0) {
          const currentCalculated = calculateElapsedTime()
          // Si la diferencia es significativa (>5 segundos), usar el del backend
          if (Math.abs(currentCalculated - totalElapsedFromBackend) > 5) {
            console.log('⏱️ Corrigiendo tiempo con backend:', totalElapsedFromBackend, 'vs calculado:', currentCalculated)
            // Ajustar el startTime para que coincida con el backend
            recordingStartTime.current = Date.now() - (totalElapsedFromBackend * 1000) - (totalPausedDuration.current)
          }
        }
      } else {
        recordingStartTime.current = Date.now()
      }

      totalPausedDuration.current = 0
      pauseStartTime.current = null
      setRecordingState('recording')
      setBackendVerified(true)

      // Calcular tiempo inicial y forzar actualización
      updateDisplayedTime()

    } else if (activeRecordingsCount === 0 && recordingState === 'recording') {
      console.log('⏹️ No hay grabaciones activas en backend, reseteando estado local')
      setRecordingState('idle')
      recordingStartTime.current = null
      pauseStartTime.current = null
      totalPausedDuration.current = 0
      setElapsedTime(0)
      setPausedTime(0)
      setTotalRecordingTime(0)
      // Limpiar estado persistente si no hay grabaciones activas
      localStorage.removeItem('recordingControlState')
    } else {
      console.log('🔄 No hay cambios necesarios - activeRecordingsCount:', activeRecordingsCount, 'recordingState:', recordingState);
    }
  }, [activeRecordingsCount, recordingState, stateLoaded, initialSyncDone, backendVerified]) // Añadido initialSyncDone y backendVerified

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStateInfo = () => {
    switch (recordingState) {
      case 'idle':
        return {
          title: 'Listo para grabar',
          subtitle: 'Graba todas las cámaras y sensores simultáneamente',
          color: 'text-gray-500 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-700'
        }
      case 'recording':
        return {
          title: 'Grabando...',
          subtitle: `${activeRecordingsCount} cámara${activeRecordingsCount !== 1 ? 's' : ''} grabando video + sensores`,
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
          subtitle: 'Sesión finalizada exitosamente',
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

  const handleStart = async () => {
    if (cameras.length === 0) {
      console.warn('No hay cámaras disponibles para grabar')
      return
    }

    console.log('🎬 Iniciando grabación global con escenario:', {
      scenarioId: activeScenario?.id,
      scenarioName: activeScenario?.name
    })

    // Inicializar timestamps
    recordingStartTime.current = Date.now()
    pauseStartTime.current = null
    totalPausedDuration.current = 0

    await startAllRecordings(cameras, {
      scenarioId: activeScenario?.id,
      scenarioName: activeScenario?.name
    })
    setRecordingState('recording')
    setElapsedTime(0)
    setPausedTime(0)
    setTotalRecordingTime(0)
  }

  const handlePause = () => {
    pauseStartTime.current = Date.now()
    setRecordingState('paused')
    setPausedAt(Date.now())
    updateDisplayedTime()
  }

  const handleResume = () => {
    // Acumular el tiempo pausado
    if (pauseStartTime.current) {
      totalPausedDuration.current += Date.now() - pauseStartTime.current
      pauseStartTime.current = null
    }
    setRecordingState('recording')
    setPausedAt(null)
    updateDisplayedTime()
  }

  const handleStop = async () => {
    await stopAllRecordings()
    setRecordingState('idle')
    recordingStartTime.current = null
    pauseStartTime.current = null
    totalPausedDuration.current = 0
    setElapsedTime(0)
    setPausedTime(0)
    setTotalRecordingTime(0)
    setPausedAt(null)
    // Limpiar estado persistente
    localStorage.removeItem('recordingControlState')
  }

  const handleFinish = async () => {
    await stopAllRecordings()
    setRecordingState('finished')
    setPausedAt(null)

    // Volver a idle después de 3 segundos
    setTimeout(() => {
      setRecordingState('idle')
      recordingStartTime.current = null
      pauseStartTime.current = null
      totalPausedDuration.current = 0
      setElapsedTime(0)
      setPausedTime(0)
      setTotalRecordingTime(0)
      // Limpiar estado persistente
      localStorage.removeItem('recordingControlState')
    }, 3000)
  }

  const stateInfo = getStateInfo()

  return (
    <div className={`p-8 rounded-2xl shadow-xl border transition-all duration-300 ${stateInfo.bgColor} border-gray-200 dark:border-gray-700`}>
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          🎬 Control de Grabación Global
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
                onClick={handleStart}
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
                onClick={handlePause}
                className="group relative flex items-center justify-center w-64 h-16 rounded-full font-bold text-lg shadow-2xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-yellow-500/50"
              >
                {/* Efecto de pulso */}
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-yellow-500"></div>

                <div className="relative flex items-center space-x-2">
                  <svg className="w-6 h-6 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  <span className="text-base">PAUSAR</span>
                </div>
              </button>
            )}

            {recordingState === 'paused' && (
              <button
                onClick={handleResume}
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
                onClick={handleStop}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
                </svg>
                <span>Detener</span>
              </button>

              {recordingState === 'paused' && (
                <button
                  onClick={handleFinish}
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
                  onClick={handleStart}
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
                  onClick={handlePause}
                  className="group relative flex items-center justify-center w-64 h-20 rounded-full font-bold text-xl shadow-2xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-yellow-500/50"
                >
                  {/* Efecto de pulso */}
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-yellow-500"></div>

                  <div className="relative flex items-center space-x-3">
                    <svg className="w-8 h-8 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                    <span className="text-lg">PAUSAR</span>
                  </div>
                </button>
              )}

              {recordingState === 'paused' && (
                <button
                  onClick={handleResume}
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
                onClick={handleStop}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
                </svg>
                <span>Detener</span>
              </button>

              {recordingState === 'paused' && (
                <button
                  onClick={handleFinish}
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

export default RecordingControlGlobal
