import express from 'express'
import * as sensorController from '../controllers/sensorController.js'

const router = express.Router()

// GET /api/sensors - Obtener todos los sensores
router.get('/', sensorController.getAllSensors)

// GET /api/sensors/type/:type - Obtener sensores por tipo
router.get('/type/:type', sensorController.getSensorsByType)

// GET /api/sensors/:id - Obtener un sensor por ID
router.get('/:id', sensorController.getSensorById)

// POST /api/sensors - Crear un nuevo sensor
router.post('/', sensorController.createSensor)

// PUT /api/sensors/:id - Actualizar un sensor
router.put('/:id', sensorController.updateSensor)

// DELETE /api/sensors/:id - Eliminar un sensor
router.delete('/:id', sensorController.deleteSensor)

// GET /api/sensors/:id/topics - Generar topics MQTT del sensor
router.get('/:id/topics', sensorController.generateTopics)

export default router
