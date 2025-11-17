import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Obtener todos los sensores
export const getAllSensors = async (req, res) => {
  try {
    const sensors = await prisma.sensor.findMany({
      orderBy: { createdAt: 'desc' }
    })
    
    // Parsear JSON fields
    const sensorsWithParsedData = sensors.map(sensor => ({
      ...sensor,
      variables: JSON.parse(sensor.variables),
      config: JSON.parse(sensor.config)
    }))
    
    res.json({
      success: true,
      data: sensorsWithParsedData
    })
  } catch (error) {
    console.error('Error getting sensors:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener sensores',
      error: error.message
    })
  }
}

// Obtener un sensor por ID
export const getSensorById = async (req, res) => {
  try {
    const { id } = req.params
    
    const sensor = await prisma.sensor.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Sensor no encontrado'
      })
    }
    
    res.json({
      success: true,
      data: {
        ...sensor,
        variables: JSON.parse(sensor.variables),
        config: JSON.parse(sensor.config)
      }
    })
  } catch (error) {
    console.error('Error getting sensor:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener sensor',
      error: error.message
    })
  }
}

// Crear un nuevo sensor
export const createSensor = async (req, res) => {
  try {
    const { 
      sensorId, 
      name, 
      type, 
      unit,
      location,
      deviceId,
      topicBase,
      variables,
      isActive,
      config 
    } = req.body
    
    // Validaciones
    if (!sensorId || !name || !type) {
      return res.status(400).json({
        success: false,
        message: 'sensorId, name y type son obligatorios'
      })
    }
    
    // Verificar si ya existe
    const existing = await prisma.sensor.findUnique({
      where: { sensorId }
    })
    
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Ya existe un sensor con ID: ${sensorId}`
      })
    }
    
    // Crear sensor
    const sensor = await prisma.sensor.create({
      data: {
        sensorId,
        name,
        type,
        unit: unit || null,
        location: location || null,
        deviceId: deviceId || null,
        topicBase: topicBase || null,
        variables: JSON.stringify(variables || []),
        isActive: isActive !== undefined ? isActive : true,
        config: JSON.stringify(config || {})
      }
    })
    
    console.log(`✅ Sensor creado: ${sensor.name} (${sensor.sensorId})`)
    
    res.json({
      success: true,
      data: {
        ...sensor,
        variables: JSON.parse(sensor.variables),
        config: JSON.parse(sensor.config)
      }
    })
  } catch (error) {
    console.error('Error creating sensor:', error)
    res.status(500).json({
      success: false,
      message: 'Error al crear sensor',
      error: error.message
    })
  }
}

// Actualizar un sensor
export const updateSensor = async (req, res) => {
  try {
    const { id } = req.params
    const updateData = { ...req.body }
    
    // Verificar si existe
    const existing = await prisma.sensor.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Sensor no encontrado'
      })
    }
    
    // Convertir arrays/objects a JSON strings
    if (updateData.variables) {
      updateData.variables = JSON.stringify(updateData.variables)
    }
    if (updateData.config) {
      updateData.config = JSON.stringify(updateData.config)
    }
    
    // Actualizar
    const sensor = await prisma.sensor.update({
      where: { id: parseInt(id) },
      data: updateData
    })
    
    console.log(`✅ Sensor actualizado: ${sensor.name}`)
    
    res.json({
      success: true,
      data: {
        ...sensor,
        variables: JSON.parse(sensor.variables),
        config: JSON.parse(sensor.config)
      }
    })
  } catch (error) {
    console.error('Error updating sensor:', error)
    res.status(500).json({
      success: false,
      message: 'Error al actualizar sensor',
      error: error.message
    })
  }
}

// Eliminar un sensor
export const deleteSensor = async (req, res) => {
  try {
    const { id } = req.params
    
    const existing = await prisma.sensor.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Sensor no encontrado'
      })
    }
    
    await prisma.sensor.delete({
      where: { id: parseInt(id) }
    })
    
    console.log(`🗑️ Sensor eliminado: ${existing.name}`)
    
    res.json({
      success: true,
      message: 'Sensor eliminado exitosamente'
    })
  } catch (error) {
    console.error('Error deleting sensor:', error)
    res.status(500).json({
      success: false,
      message: 'Error al eliminar sensor',
      error: error.message
    })
  }
}

// Obtener sensores por tipo
export const getSensorsByType = async (req, res) => {
  try {
    const { type } = req.params
    
    const sensors = await prisma.sensor.findMany({
      where: { type },
      orderBy: { name: 'asc' }
    })
    
    const sensorsWithParsedData = sensors.map(sensor => ({
      ...sensor,
      variables: JSON.parse(sensor.variables),
      config: JSON.parse(sensor.config)
    }))
    
    res.json({
      success: true,
      data: sensorsWithParsedData
    })
  } catch (error) {
    console.error('Error getting sensors by type:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener sensores',
      error: error.message
    })
  }
}

// Generar topics MQTT para un sensor
export const generateTopics = async (req, res) => {
  try {
    const { id } = req.params
    
    const sensor = await prisma.sensor.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: 'Sensor no encontrado'
      })
    }
    
    const variables = JSON.parse(sensor.variables)
    const topics = variables.map(variable => `${sensor.topicBase}/${variable}`)
    
    res.json({
      success: true,
      data: {
        sensorId: sensor.id,
        topicBase: sensor.topicBase,
        variables,
        topics
      }
    })
  } catch (error) {
    console.error('Error generating topics:', error)
    res.status(500).json({
      success: false,
      message: 'Error al generar topics',
      error: error.message
    })
  }
}
