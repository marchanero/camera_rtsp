import { useState, useEffect, useMemo, useRef } from 'react'
import { useMQTTStore } from '../stores/useMQTTStore'
import { useScenario } from '../contexts/ScenarioContext'

/**
 * useSensorList — Data hook for the sensors dashboard.
 *
 * Responsibilities:
 *  - Fetches sensors from the API on mount
 *  - Derives `activeSensors` from MQTT data + EMQX clients
 *  - Derives `scenarioSensors` (sensors linked to the active scenario)
 *  - Derives `generalSensors` (active but not linked to the current scenario)
 *  - Provides a `refetch` function
 */
export function useSensorList(sensorClients = []) {
  const sensorData = useMQTTStore(s => s.sensorData)
  const { activeScenario, getActiveSensors } = useScenario()

  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cache to prevent flickering when data is intermittent
  const prevActiveSensorsRef = useRef([])
  const prevSensorDataRef = useRef(new Map())

  const fetchSensors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mqtt/sensors')
      const data = await response.json()
      if (data.success) setSensors(data.data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSensors() }, [])

  // Helper: find MQTT data for a given sensor (by id, type, or topic prefix)
  const findMqttData = (sensor) => {
    if (sensorData.has(sensor.sensorId)) {
      const data = sensorData.get(sensor.sensorId)
      prevSensorDataRef.current.set(sensor.sensorId, data)
      return data
    }
    for (const [, data] of sensorData.entries()) {
      if (data.type === sensor.type) {
        prevSensorDataRef.current.set(sensor.sensorId, data)
        return data
      }
    }
    if (sensor.topicBase) {
      for (const [, data] of sensorData.entries()) {
        if (data.topic?.startsWith(sensor.topicBase)) {
          prevSensorDataRef.current.set(sensor.sensorId, data)
          return data
        }
      }
    }
    // Fallback to cached data to prevent flickering
    return prevSensorDataRef.current.get(sensor.sensorId) || null
  }

  // Sensors visible in the active scenario
  const scenarioSensors = useMemo(() => {
    if (!activeScenario) return []
    const scenarioSensorIds = getActiveSensors()
    return sensors
      .filter(s =>
        scenarioSensorIds.includes(s.sensorId) ||
        scenarioSensorIds.includes(s.id) ||
        scenarioSensorIds.includes(String(s.id))
      )
      .map(s => {
        const mqttData = findMqttData(s)
        return { ...s, isOnline: !!mqttData, liveData: mqttData || null }
      })
  }, [activeScenario, sensors, sensorData, getActiveSensors])

  // All sensors that are currently sending data (from MQTT + DB)
  const activeSensors = useMemo(() => {
    const sensorsFromMQTT = Array.from(sensorData.entries()).map(([sensorId, data]) => ({
      id: sensorId,
      name: typeof data.type === 'string' ? data.type : sensorId,
      sensorId,
      type: typeof data.type === 'string' ? data.type : 'unknown',
      isActive: true,
      data,
      isOnline: true,
      liveData: data
    }))

    let result = []

    if (sensors.length > 0) {
      const combined = sensors.map(sensor => {
        const mqttData = Array.from(sensorData.values()).find(
          data => data.type === sensor.type || sensorData.has(sensor.sensorId)
        )
        const hasPublisher = sensorClients.some(client =>
          client.clientid.includes(sensor.sensorId) ||
          client.clientid.includes('sensor-publisher') ||
          client.clientid.includes('stress-test')
        )
        return { ...sensor, hasData: !!mqttData, hasPublisher, isOnline: !!mqttData, liveData: mqttData || null }
      }).filter(s => s.hasData || s.hasPublisher)

      result = [
        ...combined,
        ...sensorsFromMQTT.filter(mqtt => !combined.some(s => s.sensorId === mqtt.sensorId))
      ]
    } else {
      result = sensorsFromMQTT
    }

    if (result.length > 0) {
      prevActiveSensorsRef.current = result
      return result
    }
    return prevActiveSensorsRef.current
  }, [sensors, sensorData, sensorClients])

  // Sensors NOT in the current scenario (shown in the general section)
  const generalSensors = useMemo(() => {
    if (!activeScenario) return activeSensors
    const scenarioIds = scenarioSensors.map(s => s.sensorId || s.id)
    return activeSensors.filter(s =>
      !scenarioIds.includes(s.sensorId) &&
      !scenarioIds.includes(s.id) &&
      !scenarioIds.includes(String(s.id))
    )
  }, [activeSensors, scenarioSensors, activeScenario])

  return { sensors, activeSensors, scenarioSensors, generalSensors, loading, error, refetch: fetchSensors }
}
