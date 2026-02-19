import React, { useEffect } from 'react'
import { useMQTTStore } from '../stores/useMQTTStore'

/**
 * MQTTProvider - Inicializa el store Zustand y proporciona cleanup
 * 
 * Reemplaza la jerarquía anidada de 3 providers.
 * El estado vive en el store Zustand, no en contextos React.
 */
export function MQTTProvider({ children }) {
  const initialize = useMQTTStore(s => s.initialize)
  const destroy = useMQTTStore(s => s.destroy)

  useEffect(() => {
    console.log('🔧 MQTTProvider montado, inicializando store Zustand...')
    initialize()

    return () => {
      console.log('🔧 MQTTProvider desmontado, limpiando store...')
      destroy()
    }
  }, [initialize, destroy])

  return <>{children}</>
}

/**
 * useMQTT() - Hook unificado para backward compatibility
 * 
 * ⚠️ Suscribe a TODO el store → re-renderiza en cada cambio.
 * Para rendimiento óptimo, usa selectores directos con useMQTTStore.
 */
export function useMQTT() {
  const store = useMQTTStore()
  return {
    // Connection
    isConnected: store.isConnected,
    error: store.error,
    config: store.config,
    isLoadingConfig: store.isLoadingConfig,
    reconnectState: store.reconnectState,
    connect: store.connect,
    disconnect: store.disconnect,

    // Messages
    messages: store.messages,
    lastMessage: store.lastMessage,
    messageRate: store.messageRate,
    totalMessages: store.totalMessages,
    subscribe: store.subscribe,
    unsubscribe: store.unsubscribe,
    publish: store.publish,
    registerHandler: store.registerHandler,
    unregisterHandler: store.unregisterHandler,
    clearMessages: store.clearMessages,

    // Sensor Data
    sensorData: store.sensorData,
    cameraStatus: store.cameraStatus,
    getSensor: store.getSensor,
    getActiveSensors: store.getActiveSensors,
    clearSensorData: store.clearSensorData,
    matchTopic: store.matchTopic
  }
}

/**
 * Hooks optimizados con selectores — solo re-renderizan en su slice
 */
export function useMQTTConnection() {
  return useMQTTStore(s => ({
    isConnected: s.isConnected,
    error: s.error,
    config: s.config,
    isLoadingConfig: s.isLoadingConfig,
    reconnectState: s.reconnectState,
    connect: s.connect,
    disconnect: s.disconnect,
    fetchConfig: s.fetchConfig
  }))
}

export function useMQTTMessages() {
  return useMQTTStore(s => ({
    messages: s.messages,
    lastMessage: s.lastMessage,
    messageRate: s.messageRate,
    totalMessages: s.totalMessages,
    subscribe: s.subscribe,
    unsubscribe: s.unsubscribe,
    publish: s.publish,
    registerHandler: s.registerHandler,
    unregisterHandler: s.unregisterHandler,
    clearMessages: s.clearMessages
  }))
}

export function useMQTTSensorData() {
  return useMQTTStore(s => ({
    sensorData: s.sensorData,
    cameraStatus: s.cameraStatus,
    getSensor: s.getSensor,
    getActiveSensors: s.getActiveSensors,
    clearSensorData: s.clearSensorData,
    matchTopic: s.matchTopic,
    reloadTopics: s.reloadTopics
  }))
}
