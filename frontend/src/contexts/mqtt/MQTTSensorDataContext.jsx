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

                    // Extract variable name from topic (last segment)
                    // e.g., ETSIIAB/emotibit/0CDC7ECC5F10/ppg_green -> ppg_green
                    const topicParts = topic.split('/')
                    const variableName = topicParts[topicParts.length - 1]

                    // Try multiple ways to get sensorId
                    // For EmotiBit: ETSIIAB/emotibit/0CDC7ECC5F10/ppg_green -> 0CDC7ECC5F10
                    const sensorId = data.sensorId || data.sensor_id || data.device_id ||
                        topicParts.slice(-2, -1)[0] || topic

                    setSensorData(prev => {
                        const newMap = new Map(prev)
                        const existingData = prev.get(sensorId) || { values: {} }

                        // Merge new data with existing - preserve all variables
                        const mergedData = {
                            ...existingData,
                            timestamp: data.timestamp || new Date().toISOString(),
                            topic,
                            sensorId
                        }

                        // Store the entire payload under the variable name
                        // This handles EmotiBit format where each topic has variable-sized objects
                        if (variableName && variableName !== sensorId) {
                            // For EmotiBit /data topic: deep merge sensor values to preserve
                            // slow-updating sensors like temperature (7.5Hz) between fast messages
                            const existingPayload = existingData.values?.[variableName] || {}
                            const mergedPayload = {
                                ...existingPayload,  // Keep previous sensor values
                                ...data              // Overlay new data
                            }

                            // Deep merge individual sensor objects (ppg, eda, temp, acc, etc.)
                            // This preserves temp/hr values when a message doesn't include them
                            const sensorKeys = ['ppg', 'eda', 'temp', 'acc', 'gyr', 'mag', 'hr']
                            for (const key of sensorKeys) {
                                if (existingPayload[key] && !data[key]) {
                                    // Preserve previous value if new data doesn't have this sensor
                                    mergedPayload[key] = existingPayload[key]
                                }
                            }

                            mergedData.values = {
                                ...(existingData.values || {}),
                                [variableName]: mergedPayload
                            }
                            // Also store at root level for easy access
                            mergedData[variableName] = mergedPayload
                        } else {
                            // For non-variable topics, merge data directly
                            Object.assign(mergedData, data)
                        }

                        newMap.set(sensorId, mergedData)
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
