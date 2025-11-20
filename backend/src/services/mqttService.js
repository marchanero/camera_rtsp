import mqtt from 'mqtt'
import { EventEmitter } from 'events'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Servicio MQTT para integración con sensores
 * Gestiona conexión, suscripciones y procesamiento de eventos
 */
class MQTTService extends EventEmitter {
  constructor() {
    super()
    this.client = null
    this.isConnected = false
    this.config = {
      broker: process.env.MQTT_BROKER || 'mqtt://100.82.84.24:1883',
      username: process.env.MQTT_USERNAME || 'admin',
      password: process.env.MQTT_PASSWORD || 'galgo2526',
      clientId: `camera_rtsp_${Date.now()}`
    }
    this.subscriptions = new Map()
    this.messageHandlers = new Map()
    this.statistics = {
      messagesReceived: 0,
      messagesProcessed: 0,
      errors: 0,
      lastMessageTime: null
    }
  }

  /**
   * Conectar al broker MQTT
   */
  async connect() {
    if (this.isConnected) {
      console.log('✅ Ya conectado a MQTT')
      return { success: true, broker: this.config.broker }
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`🔌 Conectando a MQTT: ${this.config.broker}`)

        this.client = mqtt.connect(this.config.broker, {
          clientId: this.config.clientId,
          username: this.config.username,
          password: this.config.password,
          clean: true,
          reconnectPeriod: 5000,
          connectTimeout: 30000,
          keepalive: 60
        })

        this.client.on('connect', () => {
          console.log('✅ Conectado a MQTT broker')
          this.isConnected = true
          this.emit('connected')
          
          // Auto-suscribirse a tópicos base
          this.autoSubscribe()
          
          resolve({ success: true, broker: this.config.broker })
        })

        this.client.on('message', (topic, message) => {
          this.handleMessage(topic, message)
        })

        this.client.on('error', (error) => {
          console.error('❌ Error MQTT:', error.message)
          this.statistics.errors++
          this.emit('error', error)
          reject(error)
        })

        this.client.on('close', () => {
          console.log('🔌 Conexión MQTT cerrada')
          this.isConnected = false
          this.emit('disconnected')
        })

        this.client.on('reconnect', () => {
          console.log('🔄 Reconectando a MQTT...')
          this.emit('reconnecting')
        })

      } catch (error) {
        console.error('❌ Error conectando a MQTT:', error)
        reject(error)
      }
    })
  }

  /**
   * Auto-suscribirse a tópicos principales
   */
  async autoSubscribe() {
    const topics = [
      'camera_rtsp/sensors/#',      // Todos los sensores
      'camera_rtsp/cameras/+/command', // Comandos a cámaras
      'camera_rtsp/rules/#'         // Eventos de reglas
    ]

    for (const topic of topics) {
      await this.subscribe(topic)
    }
  }

  /**
   * Suscribirse a un tópico
   */
  subscribe(topic, handler = null) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new Error('Cliente MQTT no conectado'))
        return
      }

      this.client.subscribe(topic, { qos: 1 }, (error, granted) => {
        if (error) {
          console.error(`❌ Error suscribiendo a ${topic}:`, error)
          reject(error)
        } else {
          console.log(`✅ Suscrito a: ${topic}`)
          this.subscriptions.set(topic, granted)
          
          if (handler) {
            this.messageHandlers.set(topic, handler)
          }
          
          resolve(granted)
        }
      })
    })
  }

  /**
   * Desuscribirse de un tópico
   */
  unsubscribe(topic) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Cliente MQTT no conectado'))
        return
      }

      this.client.unsubscribe(topic, (error) => {
        if (error) {
          console.error(`❌ Error desuscribiendo de ${topic}:`, error)
          reject(error)
        } else {
          console.log(`✅ Desuscrito de: ${topic}`)
          this.subscriptions.delete(topic)
          this.messageHandlers.delete(topic)
          resolve()
        }
      })
    })
  }

  /**
   * Publicar mensaje a un tópico
   */
  publish(topic, message, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new Error('Cliente MQTT no conectado'))
        return
      }

      const payload = typeof message === 'string' ? message : JSON.stringify(message)

      this.client.publish(topic, payload, { qos: 1, retain: false, ...options }, (error) => {
        if (error) {
          console.error(`❌ Error publicando en ${topic}:`, error)
          reject(error)
        } else {
          console.log(`📤 Publicado en ${topic}:`, payload.substring(0, 100))
          resolve()
        }
      })
    })
  }

  /**
   * Manejar mensajes recibidos
   */
  async handleMessage(topic, message) {
    try {
      this.statistics.messagesReceived++
      this.statistics.lastMessageTime = new Date()

      const payload = message.toString()
      console.log(`📨 Mensaje recibido en ${topic}`)

      let data
      try {
        data = JSON.parse(payload)
      } catch (e) {
        data = { raw: payload }
      }

      // Procesar según el tipo de tópico
      if (topic.startsWith('camera_rtsp/sensors/')) {
        await this.processSensorData(topic, data)
      } else if (topic.includes('/command')) {
        await this.processCommand(topic, data)
      }

      // Llamar handlers personalizados
      const handler = this.messageHandlers.get(topic)
      if (handler) {
        await handler(topic, data)
      }

      // Emitir evento general
      this.emit('message', { topic, data, timestamp: new Date() })

      this.statistics.messagesProcessed++

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error)
      this.statistics.errors++
      this.emit('error', error)
    }
  }

  /**
   * Procesar datos de sensores
   */
  async processSensorData(topic, data) {
    try {
      // Extraer tipo de sensor y ID del tópico
      // Formato: camera_rtsp/sensors/{type}/{sensor_id}
      // O: camera_rtsp/sensors/{category}/{type}/{sensor_id} (ej: gases/no2/NO2001)
      const parts = topic.split('/')
      
      // El último elemento es siempre el sensor_id
      const sensorId = parts[parts.length - 1]
      // Todo lo que está entre 'sensors/' y el sensor_id es el tipo
      const sensorType = parts.slice(2, -1).join('/')

      if (!sensorType || !sensorId) {
        console.warn('⚠️ Tópico de sensor inválido:', topic)
        return
      }

      console.log(`🌡️ Procesando ${sensorType} de sensor ${sensorId}`)

      // Buscar o crear sensor en BD
      let sensor = await prisma.sensor.findUnique({
        where: { sensorId }
      })

      if (!sensor) {
        console.log(`➕ Creando nuevo sensor: ${sensorId}`)
        sensor = await prisma.sensor.create({
          data: {
            sensorId,
            name: `${sensorType}_${sensorId}`,
            type: sensorType,
            unit: this.getUnitForType(sensorType),
            isActive: true
          }
        })
      }

      // Guardar evento del sensor
      await prisma.sensorEvent.create({
        data: {
          sensorId: sensor.id,
          value: JSON.stringify(data),
          timestamp: new Date(data.timestamp || Date.now())
        }
      })

      // Evaluar reglas de grabación
      await this.evaluateRules(sensor, data)

      console.log(`✅ Datos de sensor guardados: ${sensorId}`)

    } catch (error) {
      console.error('❌ Error procesando datos de sensor:', error)
      throw error
    }
  }

  /**
   * Evaluar reglas de grabación
   */
  async evaluateRules(sensor, data) {
    try {
      // Obtener reglas activas para este sensor
      const rules = await prisma.recordingRule.findMany({
        where: {
          sensorId: sensor.id,
          isActive: true
        },
        orderBy: {
          priority: 'desc'
        }
      })

      if (rules.length === 0) {
        return
      }

      console.log(`📋 Evaluando ${rules.length} regla(s) para sensor ${sensor.sensorId}`)

      for (const rule of rules) {
        try {
          const condition = JSON.parse(rule.condition)
          const action = JSON.parse(rule.action)

          // Evaluar condición
          if (this.checkCondition(data, condition)) {
            console.log(`✅ Regla cumplida: ${rule.name}`)
            
            // Ejecutar acción
            await this.executeAction(rule, action, data)
            
            // Registrar ejecución
            await prisma.ruleExecution.create({
              data: {
                ruleId: rule.id,
                sensorValue: JSON.stringify(data),
                cameras: JSON.stringify(action.cameras || []),
                success: true
              }
            })
          }
        } catch (error) {
          console.error(`❌ Error evaluando regla ${rule.id}:`, error)
          
          await prisma.ruleExecution.create({
            data: {
              ruleId: rule.id,
              sensorValue: JSON.stringify(data),
              cameras: JSON.stringify([]),
              success: false,
              error: error.message
            }
          })
        }
      }

    } catch (error) {
      console.error('❌ Error evaluando reglas:', error)
    }
  }

  /**
   * Verificar si se cumple una condición
   */
  checkCondition(data, condition) {
    const { field, operator, value } = condition
    const dataValue = field ? data[field] : (data.value !== undefined ? data.value : null)

    if (dataValue === null || dataValue === undefined) {
      return false
    }

    switch (operator) {
      case '>':
        return parseFloat(dataValue) > parseFloat(value)
      case '<':
        return parseFloat(dataValue) < parseFloat(value)
      case '>=':
        return parseFloat(dataValue) >= parseFloat(value)
      case '<=':
        return parseFloat(dataValue) <= parseFloat(value)
      case '==':
        return dataValue == value
      case '!=':
        return dataValue != value
      default:
        return false
    }
  }

  /**
   * Ejecutar acción de regla
   */
  async executeAction(rule, action, sensorData) {
    try {
      console.log(`🎬 Ejecutando acción: ${action.type}`)

      if (action.type === 'start_recording' && action.cameras) {
        for (const cameraId of action.cameras) {
          // Publicar comando de inicio de grabación
          await this.publish(`camera_rtsp/cameras/${cameraId}/recording/command`, {
            command: 'start',
            rule: rule.name,
            ruleId: rule.id,
            sensorData,
            duration: action.duration || null,
            timestamp: new Date().toISOString()
          })

          console.log(`📹 Comando de grabación enviado a cámara ${cameraId}`)
        }
      } else if (action.type === 'stop_recording' && action.cameras) {
        for (const cameraId of action.cameras) {
          await this.publish(`camera_rtsp/cameras/${cameraId}/recording/command`, {
            command: 'stop',
            rule: rule.name,
            ruleId: rule.id,
            timestamp: new Date().toISOString()
          })
        }
      }

    } catch (error) {
      console.error('❌ Error ejecutando acción:', error)
      throw error
    }
  }

  /**
   * Procesar comandos
   */
  async processCommand(topic, data) {
    console.log(`⚡ Comando recibido en ${topic}:`, data)
    this.emit('command', { topic, data })
  }

  /**
   * Obtener unidad según tipo de sensor
   */
  getUnitForType(type) {
    const units = {
      temperature: '°C',
      humidity: '%',
      co2: 'ppm',
      emotibit: 'mixed',
      presion: 'hPa',
      ruido: 'dB',
      luz: 'lux',
      voc: 'ppb',
      'gases/no2': 'ppm',
      'gases/so2': 'ppm',
      'gases/o3': 'ppm',
      'gases/co': 'ppm'
    }
    return units[type] || ''
  }

  /**
   * Obtener estadísticas
   */
  getStatistics() {
    return {
      ...this.statistics,
      isConnected: this.isConnected,
      subscriptions: Array.from(this.subscriptions.keys())
    }
  }

  /**
   * Desconectar del broker
   */
  async disconnect() {
    if (this.client) {
      console.log('🔌 Desconectando de MQTT...')
      return new Promise((resolve) => {
        this.client.end(false, () => {
          this.isConnected = false
          this.client = null
          console.log('✅ Desconectado de MQTT')
          resolve()
        })
      })
    }
  }
}

// Singleton
const mqttService = new MQTTService()

export default mqttService
