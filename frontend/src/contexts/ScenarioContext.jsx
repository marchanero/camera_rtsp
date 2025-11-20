import React, { createContext, useContext, useState, useEffect } from 'react'

const ScenarioContext = createContext()

export function ScenarioProvider({ children }) {
  const [scenarios, setScenarios] = useState([])
  const [activeScenario, setActiveScenario] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Cargar escenarios al iniciar
  useEffect(() => {
    fetchScenarios()
  }, [])

  // Cargar escenario activo del localStorage
  useEffect(() => {
    const savedActiveId = localStorage.getItem('activeScenarioId')
    if (savedActiveId && scenarios.length > 0) {
      const active = scenarios.find(s => s.id === parseInt(savedActiveId))
      if (active) {
        console.log('✅ Escenario cargado desde localStorage:', active.name)
        setActiveScenario(active)
      } else {
        console.log('⚠️ Escenario guardado no encontrado, limpiando localStorage')
        localStorage.removeItem('activeScenarioId')
      }
    }
  }, [scenarios])

  // Obtener todos los escenarios
  const fetchScenarios = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/scenarios')
      const data = await response.json()
      
      if (data.success) {
        setScenarios(data.data)
      } else {
        setError(data.message || 'Error al cargar escenarios')
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error)
      setError('Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  // Crear un nuevo escenario
  const createScenario = async (scenarioData) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setScenarios(prev => [data.data, ...prev])
        return { success: true, data: data.data }
      } else {
        setError(data.message || 'Error al crear escenario')
        return { success: false, message: data.message }
      }
    } catch (error) {
      console.error('Error creating scenario:', error)
      setError('Error de conexión con el servidor')
      return { success: false, message: 'Error de conexión' }
    } finally {
      setLoading(false)
    }
  }

  // Actualizar un escenario
  const updateScenario = async (id, scenarioData) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/scenarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setScenarios(prev => prev.map(s => s.id === id ? data.data : s))
        
        // Actualizar escenario activo si es el que se editó
        if (activeScenario?.id === id) {
          setActiveScenario(data.data)
        }
        
        return { success: true, data: data.data }
      } else {
        setError(data.message || 'Error al actualizar escenario')
        return { success: false, message: data.message }
      }
    } catch (error) {
      console.error('Error updating scenario:', error)
      setError('Error de conexión con el servidor')
      return { success: false, message: 'Error de conexión' }
    } finally {
      setLoading(false)
    }
  }

  // Eliminar un escenario
  const deleteScenario = async (id) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/scenarios/${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setScenarios(prev => prev.filter(s => s.id !== id))
        
        // Limpiar escenario activo si es el que se eliminó
        if (activeScenario?.id === id) {
          setActiveScenario(null)
          localStorage.removeItem('activeScenarioId')
        }
        
        return { success: true }
      } else {
        setError(data.message || 'Error al eliminar escenario')
        return { success: false, message: data.message }
      }
    } catch (error) {
      console.error('Error deleting scenario:', error)
      setError('Error de conexión con el servidor')
      return { success: false, message: 'Error de conexión' }
    } finally {
      setLoading(false)
    }
  }

  // Activar/Desactivar un escenario (con persistencia)
  const activateScenario = (scenario) => {
    setActiveScenario(scenario)
    if (scenario) {
      localStorage.setItem('activeScenarioId', scenario.id.toString())
      console.log('💾 Escenario guardado en localStorage:', scenario.name, '(ID:', scenario.id, ')')
    } else {
      localStorage.removeItem('activeScenarioId')
      console.log('🗑️ Escenario activo eliminado de localStorage')
    }
  }

  // Wrapper para setActiveScenario que también persiste (usado en componentes)
  const setActiveScenarioWithPersistence = (scenario) => {
    activateScenario(scenario)
  }

  // Obtener cámaras del escenario activo
  const getActiveCameras = () => {
    if (!activeScenario) return []
    return activeScenario.cameras || []
  }

  // Obtener sensores del escenario activo
  const getActiveSensors = () => {
    if (!activeScenario) return []
    return activeScenario.sensors || []
  }

  // Verificar si una cámara pertenece al escenario activo
  const isCameraInActiveScenario = (cameraId) => {
    if (!activeScenario) return true // Si no hay escenario activo, mostrar todas
    return activeScenario.cameras.includes(cameraId)
  }

  // Verificar si un sensor pertenece al escenario activo
  const isSensorInActiveScenario = (sensorId) => {
    if (!activeScenario) return true // Si no hay escenario activo, mostrar todos
    return activeScenario.sensors.includes(sensorId)
  }

  // Obtener umbral configurado para un tipo de sensor
  const getThresholdForSensor = (sensorType) => {
    if (!activeScenario || !activeScenario.thresholds) return null
    return activeScenario.thresholds[sensorType] || null
  }

  const value = {
    // Estado
    scenarios,
    activeScenario,
    loading,
    error,
    
    // Acciones CRUD
    fetchScenarios,
    createScenario,
    updateScenario,
    deleteScenario,
    
    // Activación con persistencia
    activateScenario,
    setActiveScenario: setActiveScenarioWithPersistence, // Alias para compatibilidad
    
    // Helpers
    getActiveCameras,
    getActiveSensors,
    isCameraInActiveScenario,
    isSensorInActiveScenario,
    getThresholdForSensor
  }

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  )
}

export const useScenario = () => {
  const context = useContext(ScenarioContext)
  if (!context) {
    throw new Error('useScenario debe usarse dentro de ScenarioProvider')
  }
  return context
}

export default ScenarioContext
