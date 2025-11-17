import express from 'express'
import * as scenarioController from '../controllers/scenarioController.js'

const router = express.Router()

// GET /api/scenarios - Obtener todos los escenarios
router.get('/', scenarioController.getAllScenarios)

// GET /api/scenarios/:id - Obtener un escenario por ID
router.get('/:id', scenarioController.getScenarioById)

// POST /api/scenarios - Crear un nuevo escenario
router.post('/', scenarioController.createScenario)

// PUT /api/scenarios/:id - Actualizar un escenario
router.put('/:id', scenarioController.updateScenario)

// DELETE /api/scenarios/:id - Eliminar un escenario
router.delete('/:id', scenarioController.deleteScenario)

// POST /api/scenarios/:id/start-recording - Iniciar grabación del escenario
router.post('/:id/start-recording', scenarioController.startScenarioRecording)

// POST /api/scenarios/:id/stop-recording - Detener grabación del escenario
router.post('/:id/stop-recording', scenarioController.stopScenarioRecording)

// GET /api/scenarios/:id/recording-status - Obtener estado de grabación
router.get('/:id/recording-status', scenarioController.getScenarioRecordingStatus)

export default router
