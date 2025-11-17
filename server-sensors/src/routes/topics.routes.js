const express = require('express');
const router = express.Router();
const topicsController = require('../controllers/topics.controller');

/**
 * @swagger
 * /api/topics:
 *   get:
 *     summary: Obtener todos los topics MQTT
 *     tags: [Topics]
 *     responses:
 *       200:
 *         description: Lista de topics MQTT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 topics:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Topic'
 *                 mqtt_status:
 *                   type: object
 *                 active_subscriptions:
 *                   type: array
 */
router.get('/', topicsController.getAllTopics);

/**
 * @swagger
 * /api/topics/{id}:
 *   get:
 *     summary: Obtener un topic por ID
 *     tags: [Topics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del topic
 *     responses:
 *       200:
 *         description: Topic encontrado
 *       404:
 *         description: Topic no encontrado
 */
router.get('/:id', topicsController.getTopicById);

/**
 * @swagger
 * /api/topics:
 *   post:
 *     summary: Crear un nuevo topic MQTT
 *     tags: [Topics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *                 example: sensors/temperature/room1
 *               description:
 *                 type: string
 *                 example: Sensor de temperatura de la habitación 1
 *               qos:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0
 *               retain:
 *                 type: boolean
 *                 default: false
 *               active:
 *                 type: boolean
 *                 default: true
 *               sensor_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Topic creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Topic ya existe
 */
router.post('/', topicsController.createTopic);

/**
 * @swagger
 * /api/topics/{id}:
 *   put:
 *     summary: Actualizar un topic MQTT
 *     tags: [Topics]
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
 *               topic:
 *                 type: string
 *               description:
 *                 type: string
 *               qos:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 2
 *               retain:
 *                 type: boolean
 *               active:
 *                 type: boolean
 *               sensor_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Topic actualizado
 *       404:
 *         description: Topic no encontrado
 */
router.put('/:id', topicsController.updateTopic);

/**
 * @swagger
 * /api/topics/{id}:
 *   delete:
 *     summary: Eliminar un topic MQTT
 *     tags: [Topics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Topic eliminado
 *       404:
 *         description: Topic no encontrado
 */
router.delete('/:id', topicsController.deleteTopic);

/**
 * @swagger
 * /api/topics/{id}/subscribe:
 *   post:
 *     summary: Suscribirse a un topic MQTT
 *     tags: [Topics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Suscripción exitosa
 *       400:
 *         description: MQTT no conectado
 *       404:
 *         description: Topic no encontrado
 */
router.post('/:id/subscribe', topicsController.subscribeToTopic);

/**
 * @swagger
 * /api/topics/{id}/unsubscribe:
 *   post:
 *     summary: Desuscribirse de un topic MQTT
 *     tags: [Topics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Desuscripción exitosa
 *       400:
 *         description: MQTT no conectado
 *       404:
 *         description: Topic no encontrado
 */
router.post('/:id/unsubscribe', topicsController.unsubscribeFromTopic);

/**
 * @swagger
 * /api/topics/{id}/publish:
 *   post:
 *     summary: Publicar mensaje en un topic MQTT
 *     tags: [Topics]
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: "25.5"
 *               qos:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 2
 *               retain:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Mensaje publicado exitosamente
 *       400:
 *         description: MQTT no conectado o datos inválidos
 *       404:
 *         description: Topic no encontrado
 */
router.post('/:id/publish', topicsController.publishToTopic);

module.exports = router;