import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import mqtt from 'mqtt'

const MQTTContext = createContext()

export function MQTTProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [sensorData, setSensorData] = useState(new Map())
  const [cameraStatus, setCameraStatus] = useState({})
  const [lastMessage, setLastMessage] = useState(null)
  const [error, setError] = useState(null)
  const [messageRate, setMessageRate] = useState(0)
  const [totalMessages, setTotalMessages] = useState(0)
  
  const clientRef = useRef(null)
  const messageHandlersRef = useRef(new Map())
  const messageCountRef = useRef(0)
  const lastRateUpdateRef = useRef(Date.now())

  // Configuración MQTT
  const config = {
    broker: 'ws://100.82.84.24:8083/mqtt', // WebSocket port de EMQX
    username: 'admin',
    password: 'galgo2526'
  }

  /**
   * Conectar al broker MQTT
   */
  const connect = useCallback(async () => {
    if (clientRef.current?.connected) {
      console.log('✅ Ya conectado a MQTT')
      return
    }

    try {
      console.log('🔌 Conectando a MQTT:', config.broker)
      setError(null)

      const client = mqtt.connect(config.broker, {
        username: config.username,
        password: config.password,
        clientId: `camera_rtsp_frontend_${Date.now()}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000
      })

      client.on('connect', () => {
        console.log('✅ Conectado a MQTT broker [v2 - Fixed]')
        setIsConnected(true)
        setError(null)

        // Auto-suscribirse a tópicos (usando el cliente directamente, no la función subscribe)
        const topics = [
          'camera_rtsp/sensors/#',
          'camera_rtsp/cameras/+/recording/status',
          'camera_rtsp/rules/#'
        ]

        topics.forEach(topic => {
          client.subscribe(topic, { qos: 1 }, (error) => {
            if (error) {
              console.error(`❌ Error suscribiendo a ${topic}:`, error)
            } else {
              console.log(`✅ Suscrito a: ${topic}`)
            }
          })
        })
      })

      client.on('message', (topic, message) => {
        handleMessage(topic, message)
      })

      client.on('error', (err) => {
        console.error('❌ Error MQTT:', err.message)
        setError(err.message)
        setIsConnected(false)
      })

      client.on('close', () => {
        console.log('🔌 Conexión MQTT cerrada')
        setIsConnected(false)
      })

      client.on('reconnect', () => {
        console.log('🔄 Reconectando a MQTT...')
      })

      clientRef.current = client

    } catch (err) {
      console.error('❌ Error conectando a MQTT:', err)
      setError(err.message)
      setIsConnected(false)
    }
  }, [])

  /**
   * Suscribirse a un tópico
   */
  const subscribe = useCallback((topic, handler = null) => {
    if (!clientRef.current || !clientRef.current.connected) {
      console.warn('⚠️ Cliente MQTT no conectado')
      return Promise.reject(new Error('Cliente MQTT no conectado'))
    }

    return new Promise((resolve, reject) => {
      clientRef.current.subscribe(topic, { qos: 1 }, (error, granted) => {
        if (error) {
          console.error(`❌ Error suscribiendo a ${topic}:`, error)
          reject(error)
        } else {
          console.log(`✅ Suscrito a: ${topic}`)
          
          if (handler) {
            messageHandlersRef.current.set(topic, handler)
          }
          
          resolve(granted)
        }
      })
    })
  }, [])

  /**
   * Desuscribirse de un tópico
   */
  const unsubscribe = useCallback((topic) => {
    if (!clientRef.current) return

    clientRef.current.unsubscribe(topic, (error) => {
      if (error) {
        console.error(`❌ Error desuscribiendo de ${topic}:`, error)
      } else {
        console.log(`✅ Desuscrito de: ${topic}`)
        messageHandlersRef.current.delete(topic)
      }
    })
  }, [])

  /**
   * Publicar mensaje
   */
  const publish = useCallback((topic, message) => {
    if (!clientRef.current || !clientRef.current.connected) {
      console.warn('⚠️ Cliente MQTT no conectado')
      return Promise.reject(new Error('Cliente MQTT no conectado'))
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message)

    return new Promise((resolve, reject) => {
      clientRef.current.publish(topic, payload, { qos: 1 }, (error) => {
        if (error) {
          console.error(`❌ Error publicando en ${topic}:`, error)
          reject(error)
        } else {
          console.log(`📤 Publicado en ${topic}`)
          resolve()
        }
      })
    })
  }, [])

  /**
   * Manejar mensajes recibidos
   */
  const handleMessage = useCallback((topic, message) => {
    try {
      const payload = message.toString()
      let data

      try {
        data = JSON.parse(payload)
      } catch (e) {
        data = { raw: payload }
      }

      const messageObj = {
        topic,
        data,
        timestamp: new Date().toISOString(),
        _id: `${topic}_${Date.now()}_${Math.random()}`
      }

      console.log('📨 Mensaje MQTT recibido:', topic, data)

      // Incrementar contador de mensajes
      messageCountRef.current += 1
      setTotalMessages(prev => prev + 1)

      // Calcular tasa de mensajes cada segundo
      const now = Date.now()
      if (now - lastRateUpdateRef.current >= 1000) {
        setMessageRate(messageCountRef.current)
        messageCountRef.current = 0
        lastRateUpdateRef.current = now
      }

      // Actualizar último mensaje
      setLastMessage(messageObj)

      // Agregar a historial (máximo 100 mensajes)
      setMessages(prev => {
        const newMessages = [messageObj, ...prev]
        return newMessages.slice(0, 100)
      })

      // Procesar según tipo de tópico
      if (topic.startsWith('camera_rtsp/sensors/')) {
        console.log('🔍 Procesando mensaje de sensor:', topic)
        processSensorMessage(topic, data)
      } else if (topic.includes('/recording/status')) {
        processCameraStatus(topic, data)
      }

      // Llamar handlers personalizados
      const handler = messageHandlersRef.current.get(topic)
      if (handler) {
        handler(messageObj)
      }

      // Handlers por patrón wildcard
      messageHandlersRef.current.forEach((handler, pattern) => {
        if (matchTopic(topic, pattern)) {
          handler(messageObj)
        }
      })

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error)
    }
  }, [])

  /**
   * Procesar mensajes de sensores
   */
  const processSensorMessage = useCallback((topic, data) => {
    console.log('🔧 processSensorMessage called:', topic, data)
    const parts = topic.split('/')
    
    // El último elemento es siempre el sensor_id
    const sensorId = parts[parts.length - 1]
    // Todo lo que está entre 'sensors/' y el sensor_id es el tipo
    const sensorType = parts.slice(2, -1).join('/')

    console.log('🔍 Parsed sensor:', { sensorType, sensorId, parts })

    if (!sensorType || !sensorId) {
      console.warn('⚠️ Sensor inválido - faltan type o id:', { sensorType, sensorId })
      return
    }

    setSensorData(prev => {
      const newMap = new Map(prev)
      newMap.set(sensorId, {
        type: sensorType,
        value: data,
        timestamp: data.timestamp || new Date().toISOString(),
        topic
      })
      console.log('✅ Sensor agregado al Map:', sensorId, newMap.size, 'sensores totales')
      return newMap
    })
  }, [])

  /**
   * Procesar estado de cámaras
   */
  const processCameraStatus = useCallback((topic, data) => {
    const parts = topic.split('/')
    const cameraId = parts[2]

    if (!cameraId) return

    setCameraStatus(prev => ({
      ...prev,
      [cameraId]: {
        status: data.status,
        camera: data.camera,
        timestamp: data.startedAt || data.stoppedAt || new Date().toISOString(),
        rule: data.rule,
        autoStart: data.autoStart
      }
    }))
  }, [])

  /**
   * Verificar si tópico coincide con patrón
   */
  const matchTopic = (topic, pattern) => {
    const regexPattern = '^' + 
      pattern
        .replace(/\//g, '\\/') 
        .replace(/\#/g, '.*') 
        .replace(/\+/g, '[^/]+')
        + '$'
    
    const regex = new RegExp(regexPattern)
    return regex.test(topic)
  }

  /**
   * Limpiar mensajes
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    setLastMessage(null)
  }, [])

  /**
   * Desconectar
   */
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      console.log('🔌 Desconectando de MQTT...')
      clientRef.current.end()
      clientRef.current = null
      setIsConnected(false)
    }
  }, [])

  /**
   * Conectar automáticamente al montar
   */
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  const value = {
    isConnected,
    messages,
    sensorData,
    cameraStatus,
    lastMessage,
    error,
    messageRate,
    totalMessages,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish,
    clearMessages
  }

  return (
    <MQTTContext.Provider value={value}>
      {children}
    </MQTTContext.Provider>
  )
}

export const useMQTT = () => {
  const context = useContext(MQTTContext)
  if (!context) {
    throw new Error('useMQTT must be used within a MQTTProvider')
  }
  return context
}
