import { PrismaClient } from '@prisma/client'
import mediaServerManager from '../services/mediaServer.js'
import sensorRecorder from '../services/sensorRecorder.js'

const prisma = new PrismaClient()

// Obtener todos los escenarios
const getAllScenarios = async (req, res) => {
  try {
    const scenarios = await prisma.scenario.findMany({
      orderBy: { createdAt: 'desc' }
    })
    
    // Parsear JSON strings a objetos
    const scenariosWithParsedData = scenarios.map(scenario => ({
      ...scenario,
      cameras: JSON.parse(scenario.cameras),
      sensors: JSON.parse(scenario.sensors),
      thresholds: JSON.parse(scenario.thresholds)
    }))
    
    res.json({
      success: true,
      data: scenariosWithParsedData
    })
  } catch (error) {
    console.error('Error getting scenarios:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener escenarios',
      error: error.message
    })
  }
}

// Obtener un escenario por ID
const getScenarioById = async (req, res) => {
  try {
    const { id } = req.params
    const scenario = await prisma.scenario.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!scenario) {
      return res.status(404).json({
        success: false,
        message: 'Escenario no encontrado'
      })
    }
    
    // Parsear JSON strings a objetos
    const scenarioWithParsedData = {
      ...scenario,
      cameras: JSON.parse(scenario.cameras),
      sensors: JSON.parse(scenario.sensors),
      thresholds: JSON.parse(scenario.thresholds)
    }
    
    res.json({
      success: true,
      data: scenarioWithParsedData
    })
  } catch (error) {
    console.error('Error getting scenario:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener escenario',
      error: error.message
    })
  }
}

// Crear un nuevo escenario
const createScenario = async (req, res) => {
  try {
    const { name, description, active, cameras, sensors, thresholds } = req.body
    
    // Validaciones
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nombre del escenario es requerido'
      })
    }
    
    // Verificar si ya existe un escenario con ese nombre
    const existing = await prisma.scenario.findUnique({
      where: { name }
    })
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un escenario con ese nombre'
      })
    }
    
    // Crear escenario
    const scenario = await prisma.scenario.create({
      data: {
        name,
        description: description || null,
        active: active !== undefined ? active : true,
        cameras: JSON.stringify(cameras || []),
        sensors: JSON.stringify(sensors || []),
        thresholds: JSON.stringify(thresholds || {})
      }
    })
    
    // Parsear JSON strings a objetos
    const scenarioWithParsedData = {
      ...scenario,
      cameras: JSON.parse(scenario.cameras),
      sensors: JSON.parse(scenario.sensors),
      thresholds: JSON.parse(scenario.thresholds)
    }
    
    res.status(201).json({
      success: true,
      message: 'Escenario creado exitosamente',
      data: scenarioWithParsedData
    })
  } catch (error) {
    console.error('Error creating scenario:', error)
    res.status(500).json({
      success: false,
      message: 'Error al crear escenario',
      error: error.message
    })
  }
}

// Actualizar un escenario
const updateScenario = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, active, cameras, sensors, thresholds } = req.body
    
    // Verificar si el escenario existe
    const existing = await prisma.scenario.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Escenario no encontrado'
      })
    }
    
    // Si se cambia el nombre, verificar que no exista otro con ese nombre
    if (name && name !== existing.name) {
      const duplicate = await prisma.scenario.findUnique({
        where: { name }
      })
      
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un escenario con ese nombre'
        })
      }
    }
    
    // Preparar datos para actualización
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (active !== undefined) updateData.active = active
    if (cameras !== undefined) updateData.cameras = JSON.stringify(cameras)
    if (sensors !== undefined) updateData.sensors = JSON.stringify(sensors)
    if (thresholds !== undefined) updateData.thresholds = JSON.stringify(thresholds)
    
    // Actualizar escenario
    const scenario = await prisma.scenario.update({
      where: { id: parseInt(id) },
      data: updateData
    })
    
    // Parsear JSON strings a objetos
    const scenarioWithParsedData = {
      ...scenario,
      cameras: JSON.parse(scenario.cameras),
      sensors: JSON.parse(scenario.sensors),
      thresholds: JSON.parse(scenario.thresholds)
    }
    
    res.json({
      success: true,
      message: 'Escenario actualizado exitosamente',
      data: scenarioWithParsedData
    })
  } catch (error) {
    console.error('Error updating scenario:', error)
    res.status(500).json({
      success: false,
      message: 'Error al actualizar escenario',
      error: error.message
    })
  }
}

// Eliminar un escenario
const deleteScenario = async (req, res) => {
  try {
    const { id } = req.params
    
    // Verificar si el escenario existe
    const existing = await prisma.scenario.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Escenario no encontrado'
      })
    }
    
    // Eliminar escenario
    await prisma.scenario.delete({
      where: { id: parseInt(id) }
    })
    
    res.json({
      success: true,
      message: 'Escenario eliminado exitosamente'
    })
  } catch (error) {
    console.error('Error deleting scenario:', error)
    res.status(500).json({
      success: false,
      message: 'Error al eliminar escenario',
      error: error.message
    })
  }
}

// Iniciar grabación de todas las cámaras y sensores de un escenario
const startScenarioRecording = async (req, res) => {
  try {
    const { id } = req.params
    
    // Obtener escenario
    const scenario = await prisma.scenario.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!scenario) {
      return res.status(404).json({
        success: false,
        message: 'Escenario no encontrado'
      })
    }

    const cameras = JSON.parse(scenario.cameras)
    const sensors = JSON.parse(scenario.sensors)
    
    console.log(`🎬 Iniciando grabación de escenario: ${scenario.name}`)
    console.log(`   - Cámaras: ${cameras.length}`)
    console.log(`   - Sensores: ${sensors.length}`)

    const results = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      cameras: [],
      sensors: [],
      errors: []
    }

    // Obtener información de las cámaras
    const cameraRecords = await prisma.camera.findMany({
      where: { id: { in: cameras } }
    })

    // Iniciar grabación de cada cámara
    for (const cameraRecord of cameraRecords) {
      try {
        // Iniciar grabación de video con información del escenario
        const videoResult = mediaServerManager.startCamera(cameraRecord, {
          scenarioId: scenario.id,
          scenarioName: scenario.name
        })
        
        // Iniciar grabación de sensores para esta cámara
        const sensorResult = sensorRecorder.startRecording(
          cameraRecord.id, 
          cameraRecord.name, 
          scenario.id,
          scenario.name
        )
        
        // Crear registro en la BD
        const recording = await prisma.recording.create({
          data: {
            scenarioId: scenario.id,
            cameraId: cameraRecord.id,
            videoPath: null, // Se actualizará al detener
            sensorPath: sensorResult.filepath,
            startTime: new Date(),
            metadata: JSON.stringify({
              cameraName: cameraRecord.name,
              scenarioName: scenario.name,
              videoInfo: videoResult,
              sensorInfo: sensorResult
            })
          }
        })
        
        results.cameras.push({
          id: cameraRecord.id,
          name: cameraRecord.name,
          recordingId: recording.id,
          videoRecording: videoResult,
          sensorRecording: sensorResult
        })
        
        console.log(`✅ Grabación iniciada: ${cameraRecord.name} (Recording ID: ${recording.id})`)
      } catch (error) {
        console.error(`❌ Error iniciando grabación de cámara ${cameraRecord.name}:`, error)
        results.errors.push({
          cameraId: cameraRecord.id,
          cameraName: cameraRecord.name,
          error: error.message
        })
      }
    }

    // Marcar sensores asignados (ya se están grabando via sensorRecorder)
    results.sensors = sensors

    res.json({
      success: true,
      message: `Grabación de escenario "${scenario.name}" iniciada`,
      data: results
    })
  } catch (error) {
    console.error('Error starting scenario recording:', error)
    res.status(500).json({
      success: false,
      message: 'Error al iniciar grabación de escenario',
      error: error.message
    })
  }
}

// Detener grabación de todas las cámaras y sensores de un escenario
const stopScenarioRecording = async (req, res) => {
  try {
    const { id } = req.params
    
    // Obtener escenario
    const scenario = await prisma.scenario.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!scenario) {
      return res.status(404).json({
        success: false,
        message: 'Escenario no encontrado'
      })
    }

    const cameras = JSON.parse(scenario.cameras)
    
    console.log(`🛑 Deteniendo grabación de escenario: ${scenario.name}`)

    const results = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      cameras: [],
      errors: []
    }

    // Obtener información de las cámaras
    const cameraRecords = await prisma.camera.findMany({
      where: { id: { in: cameras } }
    })

    // Detener grabación de cada cámara
    for (const cameraRecord of cameraRecords) {
      try {
        const videoResult = mediaServerManager.stopCamera(cameraRecord.id)
        
        // Detener grabación de sensores
        const sensorResult = await sensorRecorder.stopRecording(cameraRecord.id)
        
        // Buscar y actualizar registro en la BD
        const recordings = await prisma.recording.findMany({
          where: {
            scenarioId: scenario.id,
            cameraId: cameraRecord.id,
            endTime: null // Solo grabaciones activas
          },
          orderBy: {
            startTime: 'desc'
          },
          take: 1
        })
        
        if (recordings.length > 0) {
          const recording = recordings[0]
          const endTime = new Date()
          const duration = Math.floor((endTime - recording.startTime) / 1000)
          
          // Actualizar con información final
          await prisma.recording.update({
            where: { id: recording.id },
            data: {
              endTime,
              duration,
              sensorPath: sensorResult.filepath,
              sensorRecords: sensorResult.recordCount,
              metadata: JSON.stringify({
                ...JSON.parse(recording.metadata),
                videoResult,
                sensorResult
              })
            }
          })
          
          console.log(`✅ Recording ${recording.id} actualizado`)
        }
        
        results.cameras.push({
          id: cameraRecord.id,
          name: cameraRecord.name,
          videoRecording: videoResult,
          sensorRecording: sensorResult
        })
        
        console.log(`✅ Grabación detenida: ${cameraRecord.name}`)
      } catch (error) {
        console.error(`❌ Error deteniendo grabación de cámara ${cameraRecord.name}:`, error)
        results.errors.push({
          cameraId: cameraRecord.id,
          cameraName: cameraRecord.name,
          error: error.message
        })
      }
    }

    res.json({
      success: true,
      message: `Grabación de escenario "${scenario.name}" detenida`,
      data: results
    })
  } catch (error) {
    console.error('Error stopping scenario recording:', error)
    res.status(500).json({
      success: false,
      message: 'Error al detener grabación de escenario',
      error: error.message
    })
  }
}

// Obtener estado de grabación de un escenario
const getScenarioRecordingStatus = async (req, res) => {
  try {
    const { id } = req.params
    
    const scenario = await prisma.scenario.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!scenario) {
      return res.status(404).json({
        success: false,
        message: 'Escenario no encontrado'
      })
    }

    const cameras = JSON.parse(scenario.cameras)
    const cameraStatuses = []

    for (const cameraId of cameras) {
      const isRecording = mediaServerManager.isRecording(cameraId)
      const isSensorRecording = sensorRecorder.isRecording(cameraId)
      
      cameraStatuses.push({
        cameraId,
        isRecording,
        isSensorRecording
      })
    }

    const allRecording = cameraStatuses.every(s => s.isRecording && s.isSensorRecording)
    const anyRecording = cameraStatuses.some(s => s.isRecording || s.isSensorRecording)

    res.json({
      success: true,
      data: {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        isRecording: allRecording,
        partialRecording: anyRecording && !allRecording,
        cameras: cameraStatuses
      }
    })
  } catch (error) {
    console.error('Error getting scenario recording status:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de grabación',
      error: error.message
    })
  }
}

export {
  getAllScenarios,
  getScenarioById,
  createScenario,
  updateScenario,
  deleteScenario,
  startScenarioRecording,
  stopScenarioRecording,
  getScenarioRecordingStatus
}
