import express from 'express'
import * as cameraController from '../controllers/cameraController.js'

const router = express.Router()

// GET todas las cámaras
router.get('/', cameraController.getAllCameras)

// GET prueba de conexión a cámara (ANTES que /:id)
router.get('/:id/test', cameraController.testCamera)

// GET una cámara por ID
router.get('/:id', cameraController.getCameraById)

// POST crear una nueva cámara
router.post('/', cameraController.createCamera)

// PUT actualizar una cámara
router.put('/:id', cameraController.updateCamera)

// DELETE eliminar una cámara
router.delete('/:id', cameraController.deleteCamera)

export default router
