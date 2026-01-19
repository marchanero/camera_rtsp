import mqttService from '../services/mqttService.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Controlador para gestionar MQTT y sensores
 */
class MQTTController {
  /**
   * GET /api/mqtt/status
   * Obtener estado de conexión MQTT
   */
  async getStatus(req, res) {
    try {
      const stats = mqttService.getStatistics()
      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/mqtt/config
   * Obtener configuración MQTT para el frontend (sin exponer contraseña)
   */
  async getConfig(req, res) {
    try {
      const config = mqttService.getConfig()
      res.json({
        success: true,
        data: config
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * POST /api/mqtt/connect
   * Conectar al broker MQTT
   */
  async connect(req, res) {
    try {
      const result = await mqttService.connect()
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * POST /api/mqtt/disconnect
   * Desconectar del broker MQTT
   */
  async disconnect(req, res) {
    try {
      await mqttService.disconnect()
      res.json({
        success: true,
        message: 'Desconectado de MQTT'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * POST /api/mqtt/publish
   * Publicar mensaje a tópico MQTT
   */
  async publish(req, res) {
    try {
      const { topic, message, qos, retain } = req.body

      if (!topic || !message) {
        return res.status(400).json({
          success: false,
          error: 'Topic y message son requeridos'
        })
      }

      await mqttService.publish(topic, message, { qos, retain })

      res.json({
        success: true,
        message: 'Mensaje publicado correctamente'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/sensors
   * Obtener todos los sensores
   */
  async getSensors(req, res) {
    try {
      const sensors = await prisma.sensor.findMany({
        include: {
          _count: {
            select: { events: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      res.json({
        success: true,
        data: sensors
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/sensors/:id
   * Obtener sensor por ID
   */
  async getSensorById(req, res) {
    try {
      const { id } = req.params

      const sensor = await prisma.sensor.findUnique({
        where: { id: parseInt(id) },
        include: {
          events: {
            take: 100,
            orderBy: {
              timestamp: 'desc'
            }
          },
          rules: true
        }
      })

      if (!sensor) {
        return res.status(404).json({
          success: false,
          error: 'Sensor no encontrado'
        })
      }

      res.json({
        success: true,
        data: sensor
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * POST /api/sensors
   * Crear nuevo sensor (con auto-suscripción a topic)
   */
  async createSensor(req, res) {
    try {
      const { sensorId, name, type, unit, location, deviceId, topicBase, variables, config, isActive } = req.body

      if (!sensorId || !name || !type) {
        return res.status(400).json({
          success: false,
          error: 'sensorId, name y type son requeridos'
        })
      }

      const sensor = await prisma.sensor.create({
        data: {
          sensorId,
          name,
          type,
          unit,
          location,
          deviceId,
          topicBase,
          variables: Array.isArray(variables) ? JSON.stringify(variables) : (variables || '[]'),
          config: config ? JSON.stringify(config) : '{}',
          isActive: isActive !== false
        }
      })

      // Auto-suscribirse al topic del sensor si tiene topicBase
      if (topicBase && mqttService.isConnected) {
        const subscribeTopic = `${topicBase}/#`
        mqttService.subscribe(subscribeTopic)
        console.log(`✅ Auto-suscrito a topic: ${subscribeTopic}`)
      }

      res.status(201).json({
        success: true,
        message: 'Sensor creado correctamente',
        data: sensor
      })
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'El sensorId ya existe'
        })
      }

      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * PUT /api/sensors/:id
   * Actualizar sensor (con sincronización de suscripciones MQTT)
   */
  async updateSensor(req, res) {
    try {
      const { id } = req.params
      const { name, location, isActive, config, topicBase, deviceId, unit, variables } = req.body

      // Obtener el sensor actual para comparar topicBase
      const existingSensor = await prisma.sensor.findUnique({
        where: { id: parseInt(id) }
      })

      if (!existingSensor) {
        return res.status(404).json({
          success: false,
          error: 'Sensor no encontrado'
        })
      }

      const sensor = await prisma.sensor.update({
        where: { id: parseInt(id) },
        data: {
          ...(name && { name }),
          ...(location !== undefined && { location }),
          ...(isActive !== undefined && { isActive }),
          ...(config && { config: JSON.stringify(config) }),
          ...(topicBase !== undefined && { topicBase }),
          ...(deviceId !== undefined && { deviceId }),
          ...(unit !== undefined && { unit }),
          ...(variables && { variables: Array.isArray(variables) ? JSON.stringify(variables) : variables })
        }
      })

      // Si cambió el topicBase, actualizar suscripciones MQTT
      if (topicBase !== undefined && existingSensor.topicBase !== topicBase) {
        // Desuscribir del topic anterior
        if (existingSensor.topicBase && mqttService.isConnected) {
          const oldTopic = `${existingSensor.topicBase}/#`
          try {
            await mqttService.unsubscribe(oldTopic)
            console.log(`🔄 MQTT: Desuscrito de topic anterior: ${oldTopic}`)
          } catch (err) {
            console.warn(`⚠️ MQTT: Error desuscribiendo de ${oldTopic}:`, err.message)
          }
        }
        // Suscribir al nuevo topic
        if (topicBase && mqttService.isConnected) {
          const newTopic = `${topicBase}/#`
          try {
            await mqttService.subscribe(newTopic)
            console.log(`✅ MQTT: Suscrito a nuevo topic: ${newTopic}`)
          } catch (err) {
            console.warn(`⚠️ MQTT: Error suscribiendo a ${newTopic}:`, err.message)
          }
        }
      }

      res.json({
        success: true,
        message: 'Sensor actualizado correctamente',
        data: sensor
      })
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Sensor no encontrado'
        })
      }

      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * DELETE /api/sensors/:id
   * Eliminar sensor
   */
  async deleteSensor(req, res) {
    try {
      const { id } = req.params

      await prisma.sensor.delete({
        where: { id: parseInt(id) }
      })

      res.json({
        success: true,
        message: 'Sensor eliminado'
      })
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Sensor no encontrado'
        })
      }

      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/sensors/:id/events
   * Obtener eventos de un sensor
   */
  async getSensorEvents(req, res) {
    try {
      const { id } = req.params
      const { limit = 100, offset = 0 } = req.query

      const events = await prisma.sensorEvent.findMany({
        where: { sensorId: parseInt(id) },
        take: parseInt(limit),
        skip: parseInt(offset),
        orderBy: {
          timestamp: 'desc'
        },
        include: {
          sensor: {
            select: {
              sensorId: true,
              name: true,
              type: true,
              unit: true
            }
          }
        }
      })

      const total = await prisma.sensorEvent.count({
        where: { sensorId: parseInt(id) }
      })

      res.json({
        success: true,
        data: {
          events,
          total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/rules
   * Obtener todas las reglas de grabación
   */
  async getRules(req, res) {
    try {
      const rules = await prisma.recordingRule.findMany({
        include: {
          sensor: true,
          _count: {
            select: { executions: true }
          }
        },
        orderBy: {
          priority: 'desc'
        }
      })

      res.json({
        success: true,
        data: rules
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/rules/:id
   * Obtener regla por ID
   */
  async getRuleById(req, res) {
    try {
      const { id } = req.params

      const rule = await prisma.recordingRule.findUnique({
        where: { id: parseInt(id) },
        include: {
          sensor: true,
          executions: {
            take: 50,
            orderBy: {
              executedAt: 'desc'
            }
          }
        }
      })

      if (!rule) {
        return res.status(404).json({
          success: false,
          error: 'Regla no encontrada'
        })
      }

      res.json({
        success: true,
        data: rule
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * POST /api/rules
   * Crear nueva regla de grabación
   */
  async createRule(req, res) {
    try {
      const { name, description, sensorId, condition, action, priority } = req.body

      if (!name || !sensorId || !condition || !action) {
        return res.status(400).json({
          success: false,
          error: 'name, sensorId, condition y action son requeridos'
        })
      }

      const rule = await prisma.recordingRule.create({
        data: {
          name,
          description,
          sensorId: parseInt(sensorId),
          condition: JSON.stringify(condition),
          action: JSON.stringify(action),
          priority: priority || 0
        },
        include: {
          sensor: true
        }
      })

      res.status(201).json({
        success: true,
        data: rule
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * PUT /api/rules/:id
   * Actualizar regla
   */
  async updateRule(req, res) {
    try {
      const { id } = req.params
      const { name, description, isActive, condition, action, priority } = req.body

      const rule = await prisma.recordingRule.update({
        where: { id: parseInt(id) },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
          ...(condition && { condition: JSON.stringify(condition) }),
          ...(action && { action: JSON.stringify(action) }),
          ...(priority !== undefined && { priority })
        },
        include: {
          sensor: true
        }
      })

      res.json({
        success: true,
        data: rule
      })
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Regla no encontrada'
        })
      }

      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * DELETE /api/rules/:id
   * Eliminar regla
   */
  async deleteRule(req, res) {
    try {
      const { id } = req.params

      await prisma.recordingRule.delete({
        where: { id: parseInt(id) }
      })

      res.json({
        success: true,
        message: 'Regla eliminada'
      })
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Regla no encontrada'
        })
      }

      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/mqtt/subscriptions
   * Obtener suscripciones activas
   */
  async getSubscriptions(req, res) {
    try {
      const subscriptions = Array.from(mqttService.subscriptions.keys())
      res.json({
        success: true,
        data: subscriptions,
        count: subscriptions.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * GET /api/mqtt/sensor-topics
   * Obtener topics de sensores activos para suscripción dinámica
   */
  async getSensorTopics(req, res) {
    try {
      const sensors = await prisma.sensor.findMany({
        where: { isActive: true },
        select: { 
          sensorId: true, 
          topicBase: true, 
          type: true,
          name: true 
        }
      })

      const topics = sensors
        .filter(s => s.topicBase && s.topicBase.trim() !== '')
        .map(s => ({
          sensorId: s.sensorId,
          name: s.name,
          topic: `${s.topicBase}/#`,
          type: s.type
        }))

      res.json({
        success: true,
        data: topics,
        count: topics.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
}

export default new MQTTController()
