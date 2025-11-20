import express from 'express'
import mqttController from '../controllers/mqttController.js'

const router = express.Router()

// MQTT Connection
router.get('/status', mqttController.getStatus)
router.post('/connect', mqttController.connect)
router.post('/disconnect', mqttController.disconnect)
router.post('/publish', mqttController.publish)

// Sensors
router.get('/sensors', mqttController.getSensors)
router.get('/sensors/:id', mqttController.getSensorById)
router.post('/sensors', mqttController.createSensor)
router.put('/sensors/:id', mqttController.updateSensor)
router.delete('/sensors/:id', mqttController.deleteSensor)
router.get('/sensors/:id/events', mqttController.getSensorEvents)

// Recording Rules
router.get('/rules', mqttController.getRules)
router.get('/rules/:id', mqttController.getRuleById)
router.post('/rules', mqttController.createRule)
router.put('/rules/:id', mqttController.updateRule)
router.delete('/rules/:id', mqttController.deleteRule)

export default router
