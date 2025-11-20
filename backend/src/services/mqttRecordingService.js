import mqtt from 'mqtt'
import sensorRecorder from './sensorRecorder.js'

class MQTTRecordingService {
  constructor() {
    this.client = null
    this.isConnected = false
    this.cameraSensorMapping = new Map() // cameraId -> topics to record
  }

  /**
   * Conecta al broker MQTT
   */
  connect() {
    const config = {
      broker: 'mqtt://100.82.84.24:1883',
      username: 'admin',
      password: 'galgo2526'
    }

    console.log('🔌 Conectando servicio MQTT de grabación...')

    this.client = mqtt.connect(config.broker, {
      username: config.username,
      password: config.password,
      clientId: `sensor_recorder_${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000
    })

    this.client.on('connect', () => {
      console.log('✅ Servicio MQTT de grabación conectado')
      this.isConnected = true
      
      // Suscribirse a todos los topics de sensores
      this.client.subscribe('camera_rtsp/sensors/#', (err) => {
        if (err) {
          console.error('❌ Error suscribiéndose a sensores:', err)
        } else {
          console.log('📡 Suscrito a topics de sensores')
        }
      })
    })

    this.client.on('message', (topic, message) => {
      this.handleSensorMessage(topic, message)
    })

    this.client.on('error', (error) => {
      console.error('❌ Error MQTT:', error)
    })

    this.client.on('close', () => {
      console.log('🔌 Conexión MQTT cerrada')
      this.isConnected = false
    })
  }

  /**
   * Maneja mensajes de sensores y los graba si hay grabación activa
   */
  handleSensorMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString())
      
      // Extraer tipo de sensor del topic
      // Ejemplo: camera_rtsp/sensors/DHT22_1 -> DHT22_1
      const parts = topic.split('/')
      const sensorId = parts[parts.length - 1]
      
      // Verificar qué cámaras están grabando y asociar sensores
      for (const [cameraId, config] of this.cameraSensorMapping.entries()) {
        if (config.recordAllSensors || config.sensorIds.includes(sensorId)) {
          const enrichedData = {
            sensorId,
            sensorType: data.type,
            topic,
            ...data
          }
          
          sensorRecorder.recordSensorData(cameraId, enrichedData)
        }
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje de sensor:', error)
    }
  }

  /**
   * Inicia grabación de sensores para una cámara
   */
  startRecordingForCamera(cameraId, options = {}) {
    const config = {
      recordAllSensors: options.recordAllSensors !== false, // Por defecto grabar todos
      sensorIds: options.sensorIds || []
    }
    
    this.cameraSensorMapping.set(cameraId, config)
    
    console.log(`📝 Grabación de sensores habilitada para cámara ${cameraId}`)
    console.log(`   Modo: ${config.recordAllSensors ? 'Todos los sensores' : `Sensores específicos: ${config.sensorIds.join(', ')}`}`)
  }

  /**
   * Detiene grabación de sensores para una cámara
   */
  stopRecordingForCamera(cameraId) {
    this.cameraSensorMapping.delete(cameraId)
    console.log(`🛑 Grabación de sensores deshabilitada para cámara ${cameraId}`)
  }

  /**
   * Desconecta del broker MQTT
   */
  disconnect() {
    if (this.client) {
      this.client.end()
      this.cameraSensorMapping.clear()
    }
  }
}

// Singleton
const mqttRecordingService = new MQTTRecordingService()

// Auto-conectar al iniciar
mqttRecordingService.connect()

export default mqttRecordingService
