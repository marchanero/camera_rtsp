const express = require('express');
const router = express.Router();
const sensorsController = require('../controllers/sensors.controller');

/**
 * @swagger
 * /api/sensors:
 *   get:
 *     summary: Obtener todos los sensores
 *     tags: [Sensors]
 *     responses:
 *       200:
 *         description: Lista de sensores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sensors:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sensor'
 */
router.get('/', sensorsController.getAllSensors);

/**
 * @swagger
 * /api/sensors/types:
 *   get:
 *     summary: Obtener tipos de sensores disponibles
 *     tags: [Sensors]
 *     responses:
 *       200:
 *         description: Lista de tipos de sensores
 */
router.get('/types', sensorsController.getSensorTypes);

/**
 * @swagger
 * /api/sensors/{id}:
 *   get:
 *     summary: Obtener un sensor por ID
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del sensor
 *     responses:
 *       200:
 *         description: Sensor encontrado
 *       404:
 *         description: Sensor no encontrado
 */
router.get('/:id', sensorsController.getSensorById);

/**
 * @swagger
 * /api/sensors/{id}/data:
 *   get:
 *     summary: Obtener datos de un sensor
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Datos del sensor
 */
router.get('/:id/data', sensorsController.getSensorData);

/**
 * @swagger
 * /api/sensors:
 *   post:
 *     summary: Crear un nuevo sensor
 *     tags: [Sensors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - topic
 *             properties:
 *               name:
 *                 type: string
 *                 example: Sensor Temperatura
 *               type:
 *                 type: string
 *                 example: temperature
 *               topic:
 *                 type: string
 *                 example: sensors/temperature/room1
 *               description:
 *                 type: string
 *               unit:
 *                 type: string
 *               min_value:
 *                 type: number
 *               max_value:
 *                 type: number
 *               active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Sensor creado exitosamente
 */
router.post('/', sensorsController.createSensor);

/**
 * @swagger
 * /api/sensors/{id}/data:
 *   post:
 *     summary: Agregar datos a un sensor
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *               - topic
 *             properties:
 *               value:
 *                 type: string
 *               topic:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               raw_message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Datos agregados exitosamente
 */
router.post('/:id/data', sensorsController.addSensorData);

/**
 * @swagger
 * /api/sensors/{id}:
 *   put:
 *     summary: Actualizar un sensor
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               topic:
 *                 type: string
 *               description:
 *                 type: string
 *               unit:
 *                 type: string
 *               min_value:
 *                 type: number
 *               max_value:
 *                 type: number
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Sensor actualizado
 */
router.put('/:id', sensorsController.updateSensor);

/**
 * @swagger
 * /api/sensors/{id}:
 *   delete:
 *     summary: Eliminar un sensor
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sensor eliminado
 */
router.delete('/:id', sensorsController.deleteSensor);

module.exports = router;
