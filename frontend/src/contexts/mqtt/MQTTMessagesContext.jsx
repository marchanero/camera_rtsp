import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

const MQTTMessagesContext = createContext()

/**
 * MQTTMessagesProvider - Maneja mensajes MQTT y message rate
 * 
 * Responsabilidades:
 * - Almacenamiento de mensajes recibidos
 * - Tracking de message rate (msg/s)
 * - Total de mensajes
 * - Último mensaje recibido
 * - Message handlers personalizados
 */
export function MQTTMessagesProvider({ children, mqttClient }) {
    const [messages, setMessages] = useState([])
    const [lastMessage, setLastMessage] = useState(null)
    const [messageRate, setMessageRate] = useState(0)
    const [totalMessages, setTotalMessages] = useState(0)

    const messageHandlersRef = useRef(new Map())
    const messageCountRef = useRef(0)
    const lastRateUpdateRef = useRef(Date.now())

    // Buffer para batching: acumular mensajes y volcar al estado cada 250ms
    const pendingMessagesRef = useRef([])
    const pendingCountRef = useRef(0)

    /**
     * Subscribe to MQTT topics
     */
    const subscribe = (topic, qos = 1) => {
        if (!mqttClient) {
            console.warn('MQTT client not available')
            return
        }

        mqttClient.subscribe(topic, { qos }, (error) => {
            if (error) {
                console.error(`❌ Error suscribiendo a ${topic}:`, error)
            } else {
                console.log(`✅ Suscrito a: ${topic}`)
            }
        })
    }

    /**
     * Unsubscribe from MQTT topics
     */
    const unsubscribe = (topic) => {
        if (!mqttClient) return

        mqttClient.unsubscribe(topic, (error) => {
            if (error) {
                console.error(`❌ Error desuscribiendo de ${topic}:`, error)
            } else {
                console.log(`✅ Desuscrito de: ${topic}`)
            }
        })
    }

    /**
     * Publish message to MQTT topic
     */
    const publish = (topic, message, options = {}) => {
        if (!mqttClient) {
            console.warn('MQTT client not available')
            return Promise.reject(new Error('No MQTT client'))
        }

        return new Promise((resolve, reject) => {
            mqttClient.publish(topic, message, options, (error) => {
                if (error) {
                    console.error(`❌ Error publicando en ${topic}:`, error)
                    reject(error)
                } else {
                    console.log(`✅ Mensaje publicado en ${topic}`)
                    resolve()
                }
            })
        })
    }

    /**
     * Register custom message handler for specific topics
     */
    const registerHandler = (name, handler) => {
        messageHandlersRef.current.set(name, handler)
    }

    /**
     * Unregister message handler
     */
    const unregisterHandler = (name) => {
        messageHandlersRef.current.delete(name)
    }

    /**
     * Handle incoming MQTT messages
     */
    useEffect(() => {
        if (!mqttClient) return

        const handleMessage = (topic, message) => {
            try {
                const payload = message.toString()

                // Update message count for rate calculation (sin setState para no re-renderizar)
                messageCountRef.current++
                pendingCountRef.current++

                // Create message object
                const msg = {
                    topic,
                    payload,
                    timestamp: new Date(),
                    id: `${topic}-${Date.now()}`
                }

                // Acumular en buffer en lugar de llamar setState directamente
                pendingMessagesRef.current.push(msg)

                // Llamar handlers síncronamente (no bloquean UI)
                messageHandlersRef.current.forEach(handler => {
                    try {
                        handler(topic, payload, msg)
                    } catch (err) {
                        console.error('Error en message handler:', err)
                    }
                })

            } catch (error) {
                console.error('Error procesando mensaje MQTT:', error)
            }
        }

        mqttClient.on('message', handleMessage)

        return () => {
            mqttClient.off('message', handleMessage)
        }
    }, [mqttClient])

    /**
     * Flush buffer al estado React cada 250ms
     * Reduce re-renders de decenas/segundo a 4/segundo
     */
    useEffect(() => {
        const flushInterval = setInterval(() => {
            const pending = pendingMessagesRef.current
            const count = pendingCountRef.current

            if (pending.length === 0) return

            // Vaciar buffer
            pendingMessagesRef.current = []
            pendingCountRef.current = 0

            // Un único setState batch para los tres valores
            setMessages(prev => [...prev, ...pending].slice(-100))
            setLastMessage(pending[pending.length - 1])
            setTotalMessages(prev => prev + count)
        }, 250)

        return () => clearInterval(flushInterval)
    }, [])

    /**
     * Calculate message rate every second
     */
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now()
            const timeDiff = (now - lastRateUpdateRef.current) / 1000
            const msgCount = messageCountRef.current

            if (timeDiff > 0) {
                const rate = msgCount / timeDiff
                setMessageRate(rate)
            }

            // Reset counters
            messageCountRef.current = 0
            lastRateUpdateRef.current = now
        }, 1000)

        return () => clearInterval(interval)
    }, [])

    /**
     * Clear all messages
     */
    const clearMessages = () => {
        setMessages([])
        setLastMessage(null)
    }

    const value = {
        messages,
        lastMessage,
        messageRate,
        totalMessages,
        subscribe,
        unsubscribe,
        publish,
        registerHandler,
        unregisterHandler,
        clearMessages
    }

    return (
        <MQTTMessagesContext.Provider value={value}>
            {children}
        </MQTTMessagesContext.Provider>
    )
}

export function useMQTTMessages() {
    const context = useContext(MQTTMessagesContext)
    if (context === undefined) {
        throw new Error('useMQTTMessages must be used within MQTTMessagesProvider')
    }
    return context
}
