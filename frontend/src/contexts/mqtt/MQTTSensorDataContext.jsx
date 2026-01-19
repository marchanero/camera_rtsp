import React, { createContext, useContext, useState, useEffect } from 'react'

const MQTTSensorDataContext = createContext()

/**
 * MQTTSensorDataProvider - Maneja sensor data y camera status
 * 
 * Responsabilidades:
 * - Map de sensor data por sensorId
 * - Camera status tracking
 * - Topic pattern matching
 * - Data cleanup (stale data removal)
 */
export function MQTTSensorDataProvider({ children, mqttMessages, reloadTopics }) {
    const [sensorData, setSensorData] = useState(new Map())
    const [cameraStatus, setCameraStatus] = useState({})

    /**
     * Match topic against pattern (supports MQTT wildcards)
     */
    const matchTopic = (topic, pattern) => {
        const topicParts = topic.split('/')
        const patternParts = pattern.split('/')

        if (patternParts.length > topicParts.length) return false

        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] === '#') return true
            if (patternParts[i] === '+') continue
            if (patternParts[i] !== topicParts[i]) return false
        }

        return patternParts.length === topicParts.length
    }

    /**
     * Process incoming messages for sensor data
     */
    useEffect(() => {
        if (!mqttMessages?.registerHandler) return

        const handleSensorMessage = (topic, payload) => {
            try {
                // Parse sensor data - accept any topic that looks like sensor data
                // Patterns: camera_rtsp/sensors/*, */emotibit/*, */sensor/*, */co2/*, */humidity/*, */temperature/*
                const isSensorTopic =
                    matchTopic(topic, 'camera_rtsp/sensors/#') ||
                    topic.includes('/emotibit/') ||
                    topic.includes('/sensor/') ||  // Generic sensor pattern
                    topic.includes('/co2/') ||
                    topic.includes('/humidity/') ||
                    topic.includes('/temperature/') ||
                    topic.includes('/pressure/') ||
                    topic.includes('/light/') ||
                    topic.includes('/noise/')

                if (isSensorTopic) {
                    const data = JSON.parse(payload)
                    // Try multiple ways to get sensorId
                    const sensorId = data.sensorId || data.sensor_id || data.device_id ||
                        topic.split('/').slice(-2, -1)[0] || topic

                    setSensorData(prev => {
                        const newMap = new Map(prev)
                        newMap.set(sensorId, {
                            ...data,
                            timestamp: data.timestamp || new Date().toISOString(),
                            topic
                        })
                        return newMap
                    })
                }

                // Parse camera recording status
                if (matchTopic(topic, 'camera_rtsp/cameras/+/recording/status')) {
                    const data = JSON.parse(payload)
                    const cameraId = topic.split('/')[2]

                    setCameraStatus(prev => ({
                        ...prev,
                        [cameraId]: {
                            isRecording: data.isRecording,
                            startTime: data.startTime,
                            timestamp: new Date().toISOString()
                        }
                    }))
                }

            } catch (error) {
                // Silently ignore parse errors for non-JSON messages
            }
        }

        mqttMessages.registerHandler('sensorData', handleSensorMessage)

        return () => {
            mqttMessages.unregisterHandler('sensorData')
        }
    }, [mqttMessages])

    /**
     * Cleanup stale sensor data (older than 30 seconds)
     */
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now()
            const maxAge = 30000 // 30 seconds

            setSensorData(prev => {
                const newMap = new Map()
                prev.forEach((data, id) => {
                    const age = now - new Date(data.timestamp).getTime()
                    if (age < maxAge) {
                        newMap.set(id, data)
                    }
                })
                return newMap
            })
        }, 5000) // Check every 5 seconds

        return () => clearInterval(interval)
    }, [])

    /**
     * Get sensor data by ID
     */
    const getSensor = (sensorId) => {
        return sensorData.get(sensorId)
    }

    /**
     * Get all active sensors (data received in last 10 seconds)
     */
    const getActiveSensors = () => {
        const now = Date.now()
        const maxAge = 10000 // 10 seconds
        const active = []

        sensorData.forEach((data, id) => {
            const age = now - new Date(data.timestamp).getTime()
            if (age < maxAge) {
                active.push({ id, ...data })
            }
        })

        return active
    }

    /**
     * Clear all sensor data
     */
    const clearSensorData = () => {
        setSensorData(new Map())
    }

    const value = {
        sensorData,
        cameraStatus,
        getSensor,
        getActiveSensors,
        clearSensorData,
        matchTopic,
        reloadTopics // Expose reload function for components
    }

    return (
        <MQTTSensorDataContext.Provider value={value}>
            {children}
        </MQTTSensorDataContext.Provider>
    )
}

export function useMQTTSensorData() {
    const context = useContext(MQTTSensorDataContext)
    if (context === undefined) {
        throw new Error('useMQTTSensorData must be used within MQTTSensorDataProvider')
    }
    return context
}
