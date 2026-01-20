import React, { useEffect, useState, useCallback } from 'react'
import { MQTTConnectionProvider, useMQTTConnection } from './mqtt/MQTTConnectionContext'
import { MQTTMessagesProvider, useMQTTMessages } from './mqtt/MQTTMessagesContext'
import { MQTTSensorDataProvider, useMQTTSensorData } from './mqtt/MQTTSensorDataContext'

/**
 * MQTTProvider - Compositor that combines all MQTT contexts
 * 
 * Provides a unified interface while internally using specialized contexts.
 * This maintains backward compatibility with existing code using useMQTT().
 * 
 * Architecture:
 * MQTTProvider
 *   └─ MQTTConnectionProvider (connection, config, reconnect)
 *       └─ MQTTMessagesProvider (messages, rate, handlers)
 *           └─ MQTTSensorDataProvider (sensor data, camera status)
 *               └─ children
 */
export function MQTTProvider({ children }) {
  return (
    <MQTTConnectionProvider>
      <MQTTCompositor>
        {children}
      </MQTTCompositor>
    </MQTTConnectionProvider>
  )
}

/**
 * Internal compositor component
 * Now loads topics dynamically from the sensor-topics API
 */
function MQTTCompositor({ children }) {
  const connection = useMQTTConnection()
  const client = connection.getClient()
  const [dynamicTopics, setDynamicTopics] = useState([])
  const [topicsLoaded, setTopicsLoaded] = useState(false)

  // System topics (always subscribe to these)
  const systemTopics = [
    'camera_rtsp/sensors/#',
    'camera_rtsp/cameras/+/recording/status',
    'camera_rtsp/rules/#'
  ]

  // Load sensor topics from backend
  const loadSensorTopics = useCallback(async () => {
    try {
      const response = await fetch('/api/mqtt/sensor-topics')
      const data = await response.json()
      if (data.success && Array.isArray(data.data)) {
        const topics = data.data.map(t => t.topic)
        setDynamicTopics(topics)
        console.log(`📡 Topics dinámicos cargados: ${topics.length}`)
        if (topics.length > 0) {
          console.log('   Topics:', topics.slice(0, 5).join(', '), topics.length > 5 ? `... y ${topics.length - 5} más` : '')
        }
      }
    } catch (error) {
      console.warn('⚠️ Error cargando topics de sensores:', error.message)
    } finally {
      setTopicsLoaded(true)
    }
  }, [])

  // Load topics on mount
  useEffect(() => {
    loadSensorTopics()
  }, [loadSensorTopics])

  // Auto-connect on mount
  useEffect(() => {
    if (!connection.isConnected && !connection.isLoadingConfig) {
      connection.connect()
    }
  }, [connection.isConnected, connection.isLoadingConfig])

  // Auto-subscribe to topics when connected
  useEffect(() => {
    if (!client || !connection.isConnected || !topicsLoaded) return

    // Combine system topics with dynamic sensor topics
    const allTopics = [...new Set([...systemTopics, ...dynamicTopics])]

    console.log(`📡 Suscribiendo a ${allTopics.length} topics (${systemTopics.length} sistema + ${dynamicTopics.length} sensores)`)

    allTopics.forEach(topic => {
      client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          console.error(`❌ Error suscribiendo a ${topic}:`, error)
        } else {
          console.log(`✅ Suscrito a: ${topic}`)
        }
      })
    })

    // Cleanup: unsubscribe on unmount or when topics change
    return () => {
      allTopics.forEach(topic => {
        client.unsubscribe(topic)
      })
    }
  }, [client, connection.isConnected, topicsLoaded, dynamicTopics])

  return (
    <MQTTMessagesProvider mqttClient={client}>
      <MQTTSensorDataCompositor reloadTopics={loadSensorTopics}>
        {children}
      </MQTTSensorDataCompositor>
    </MQTTMessagesProvider>
  )
}

/**
 * Sensor data compositor
 */
function MQTTSensorDataCompositor({ children, reloadTopics }) {
  const messages = useMQTTMessages()

  return (
    <MQTTSensorDataProvider mqttMessages={messages} reloadTopics={reloadTopics}>
      {children}
    </MQTTSensorDataProvider>
  )
}

/**
 * Unified hook for backward compatibility
 * 
 * This hook combines all three specialized contexts into a single interface.
 * Existing components can continue using useMQTT() without changes.
 */
export function useMQTT() {
  const connection = useMQTTConnection()
  const messages = useMQTTMessages()
  const sensorData = useMQTTSensorData()

  return {
    // Connection
    isConnected: connection.isConnected,
    error: connection.error,
    config: connection.config,
    isLoadingConfig: connection.isLoadingConfig,
    reconnectState: connection.reconnectState,
    connect: connection.connect,
    disconnect: connection.disconnect,

    // Messages  
    messages: messages.messages,
    lastMessage: messages.lastMessage,
    messageRate: messages.messageRate,
    totalMessages: messages.totalMessages,
    subscribe: messages.subscribe,
    unsubscribe: messages.unsubscribe,
    publish: messages.publish,
    registerHandler: messages.registerHandler,
    unregisterHandler: messages.unregisterHandler,
    clearMessages: messages.clearMessages,

    // Sensor Data
    sensorData: sensorData.sensorData,
    cameraStatus: sensorData.cameraStatus,
    getSensor: sensorData.getSensor,
    getActiveSensors: sensorData.getActiveSensors,
    clearSensorData: sensorData.clearSensorData,
    matchTopic: sensorData.matchTopic
  }
}

// Re-export individual hooks for optimized usage
export { useMQTTConnection } from './mqtt/MQTTConnectionContext'
export { useMQTTMessages } from './mqtt/MQTTMessagesContext'
export { useMQTTSensorData } from './mqtt/MQTTSensorDataContext'
