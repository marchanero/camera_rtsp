const express = require('express');
const router = express.Router();
const mqttController = require('../controllers/mqtt.controller');

/**
 * @swagger
 * /api/mqtt/status:
 *   get:
 *     summary: Get MQTT connection status
 *     tags: [MQTT]
 *     responses:
 *       200:
 *         description: MQTT connection status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                 broker:
 *                   type: string
 *                 clientId:
 *                   type: string
 *                 topics:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/status', mqttController.getStatus);

/**
 * @swagger
 * /api/mqtt/connect:
 *   post:
 *     summary: Connect to MQTT broker
 *     tags: [MQTT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - broker
 *             properties:
 *               broker:
 *                 type: string
 *                 example: "mqtt://localhost:1883"
 *     responses:
 *       200:
 *         description: Successfully connected to MQTT broker
 *       400:
 *         description: Invalid broker URL
 *       500:
 *         description: Connection failed
 */
router.post('/connect', mqttController.connect);

/**
 * @swagger
 * /api/mqtt/disconnect:
 *   post:
 *     summary: Disconnect from MQTT broker
 *     tags: [MQTT]
 *     responses:
 *       200:
 *         description: Successfully disconnected from MQTT broker
 *       500:
 *         description: Disconnection failed
 */
router.post('/disconnect', mqttController.disconnect);

/**
 * @swagger
 * /api/mqtt/topics:
 *   get:
 *     summary: Get all MQTT topics
 *     tags: [MQTT]
 *     responses:
 *       200:
 *         description: List of MQTT topics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 topics:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       topic:
 *                         type: string
 *                       active:
 *                         type: boolean
 *                       qos:
 *                         type: integer
 *                       retained:
 *                         type: boolean
 *   post:
 *     summary: Add a new MQTT topic
 *     tags: [MQTT]
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
 *                 example: "galgo/sensors/temperature"
 *               description:
 *                 type: string
 *                 example: "Temperature sensor readings"
 *               qos:
 *                 type: integer
 *                 default: 0
 *                 minimum: 0
 *                 maximum: 2
 *               retained:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Topic added successfully
 *       400:
 *         description: Invalid topic data
 *       500:
 *         description: Failed to add topic
 */
router.get('/topics', mqttController.getTopics);
router.post('/topics', mqttController.addTopic);

/**
 * @swagger
 * /api/mqtt/topics/{id}:
 *   put:
 *     summary: Update an MQTT topic
 *     tags: [MQTT]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Topic ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               active:
 *                 type: boolean
 *               qos:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 2
 *               retained:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Topic updated successfully
 *       404:
 *         description: Topic not found
 *       500:
 *         description: Failed to update topic
 *   delete:
 *     summary: Delete an MQTT topic
 *     tags: [MQTT]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Topic ID
 *     responses:
 *       200:
 *         description: Topic deleted successfully
 *       404:
 *         description: Topic not found
 *       500:
 *         description: Failed to delete topic
 */
router.put('/topics/:id', mqttController.updateTopic);
router.delete('/topics/:id', mqttController.deleteTopic);

/**
 * @swagger
 * /api/mqtt/messages:
 *   get:
 *     summary: Get recent MQTT messages
 *     tags: [MQTT]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of messages to return
 *     responses:
 *       200:
 *         description: List of recent MQTT messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       topic:
 *                         type: string
 *                       message:
 *                         type: string
 *                       qos:
 *                         type: integer
 *                       retain:
 *                         type: boolean
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 */
router.get('/messages', mqttController.getMessages);

/**
 * @swagger
 * /api/mqtt/publish:
 *   post:
 *     summary: Publish a message to an MQTT topic
 *     tags: [MQTT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *               - message
 *             properties:
 *               topic:
 *                 type: string
 *                 example: "galgo/sensors/temperature"
 *               message:
 *                 type: string
 *                 example: "23.5"
 *               qos:
 *                 type: integer
 *                 default: 0
 *                 minimum: 0
 *                 maximum: 2
 *               retain:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Message published successfully
 *       400:
 *         description: Invalid message data
 *       500:
 *         description: Failed to publish message
 */
router.post('/publish', mqttController.publishMessage);

module.exports = router;