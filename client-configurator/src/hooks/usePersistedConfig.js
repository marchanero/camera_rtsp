import { useState, useEffect, useCallback } from 'react'

/**
 * Hook personalizado para persistencia de configuraciones
 * Sincroniza estado con localStorage y opcionalmente con servidor
 * 
 * @param {string} key - Clave de localStorage
 * @param {any} initialState - Estado inicial
 * @param {string} apiUrl - URL del servidor (opcional)
 * @param {function} toast - Función de notificación (opcional)
 * @returns {[state, setState, isSaving, lastSaved, saveToServer]}
 */
export const usePersistedConfig = (key, initialState, apiUrl = null, toast = null) => {
  const [state, setState] = useState(() => {
    // Cargar desde localStorage al inicializar
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : initialState
    } catch (error) {
      console.error(`Error parsing localStorage key "${key}":`, error)
      return initialState
    }
  })

  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Guardar en localStorage cada vez que cambia el estado
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
      setHasUnsavedChanges(true)
    } catch (error) {
      console.error(`Error saving to localStorage key "${key}":`, error)
      if (toast) {
        toast.error('Error guardando configuración localmente', { duration: 3000 })
      }
    }
  }, [state, key, toast])

  // Guardar en el servidor
  const saveToServer = useCallback(async () => {
    if (!apiUrl) {
      console.warn('usePersistedConfig: No API URL provided')
      return false
    }

    setIsSaving(true)
    try {
      const response = await fetch(`${apiUrl}/api/config/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, data: state })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setLastSaved(new Date())
      setHasUnsavedChanges(false)

      if (toast) {
        toast.success('✅ Configuración guardada en servidor', {
          duration: 2000,
          icon: '💾'
        })
      }

      return true
    } catch (error) {
      console.error('Error saving to server:', error)
      if (toast) {
        toast.error('❌ Error al guardar configuración en servidor', {
          duration: 3000,
          icon: '⚠️'
        })
      }
      return false
    } finally {
      setIsSaving(false)
    }
  }, [key, state, apiUrl, toast])

  // Limpiar localStorage
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key)
      setState(initialState)
      setLastSaved(null)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error(`Error clearing localStorage key "${key}":`, error)
    }
  }, [key, initialState])

  // Restaurar valores iniciales
  const reset = useCallback(() => {
    setState(initialState)
    setHasUnsavedChanges(true)
  }, [initialState])

  return {
    state,
    setState,
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    saveToServer,
    clear,
    reset
  }
}

/**
 * Hook para colecciones (arrays) con persistencia
 * Facilita CRUD operations con persistencia automática
 */
export const usePersistedList = (key, initialList = [], apiUrl = null, toast = null) => {
  const { state, setState, ...rest } = usePersistedConfig(key, initialList, apiUrl, toast)

  const add = useCallback(
    (item) => {
      setState((prev) => [...prev, { ...item, id: Date.now().toString() }])
    },
    [setState]
  )

  const update = useCallback(
    (id, updatedItem) => {
      setState((prev) => prev.map((item) => (item.id === id ? { ...item, ...updatedItem } : item)))
    },
    [setState]
  )

  const remove = useCallback(
    (id) => {
      setState((prev) => prev.filter((item) => item.id !== id))
    },
    [setState]
  )

  const clear = useCallback(() => {
    setState([])
  }, [setState])

  const find = useCallback(
    (predicate) => {
      return state.find(predicate)
    },
    [state]
  )

  const filter = useCallback(
    (predicate) => {
      return state.filter(predicate)
    },
    [state]
  )

  return {
    items: state,
    setItems: setState,
    add,
    update,
    remove,
    clear,
    find,
    filter,
    ...rest
  }
}
