const express = require('express');
const router = express.Router();
const configurationController = require('../controllers/configuration.controller');

/**
 * @swagger
 * /api/configurations:
 *   get:
 *     summary: Obtener todas las configuraciones del sistema
 *     tags: [Configurations]
 *     responses:
 *       200:
 *         description: Configuraciones obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configurations:
 *                   $ref: '#/components/schemas/Configuration'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', configurationController.getConfigurations);

/**
 * @swagger
 * /api/configurations:
 *   post:
 *     summary: Guardar una configuración individual
 *     tags: [Configurations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - key
 *               - value
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [general, recordings, mqtt, cameras, sensors, topics]
 *                 example: general
 *               key:
 *                 type: string
 *                 example: theme
 *               value:
 *                 oneOf:
 *                   - type: string
 *                   - type: boolean
 *                   - type: integer
 *                   - type: object
 *                 example: dark
 *     responses:
 *       200:
 *         description: Configuración guardada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', configurationController.saveConfiguration);

/**
 * @swagger
 * /api/configurations:
 *   put:
 *     summary: Guardar todas las configuraciones (PUT alternativo a /bulk)
 *     tags: [Configurations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - configurations
 *             properties:
 *               configurations:
 *                 $ref: '#/components/schemas/Configuration'
 *     responses:
 *       200:
 *         description: Todas las configuraciones guardadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/', configurationController.saveAllConfigurations);

/**
 * @swagger
 * /api/configurations/bulk:
 *   put:
 *     summary: Guardar todas las configuraciones de una vez
 *     tags: [Configurations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - configurations
 *             properties:
 *               configurations:
 *                 $ref: '#/components/schemas/Configuration'
 *     responses:
 *       200:
 *         description: Todas las configuraciones guardadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/bulk', configurationController.saveAllConfigurations);

/**
 * @swagger
 * /api/configurations/sync-sensors:
 *   put:
 *     summary: Sincronizar sensores desde configuraciones
 *     tags: [Configurations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sensors
 *             properties:
 *               sensors:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Sensor'
 *     responses:
 *       200:
 *         description: Sensores sincronizados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/sync-sensors', configurationController.syncSensorsFromConfig);

/**
 * @swagger
 * /api/configurations/sync-topics:
 *   put:
 *     summary: Sincronizar topics MQTT desde configuraciones
 *     tags: [Configurations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topics
 *             properties:
 *               topics:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/MQTTTopic'
 *     responses:
 *       200:
 *         description: Topics sincronizados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/sync-topics', configurationController.syncTopicsFromConfig);

/**
 * @swagger
 * /api/configurations/reset:
 *   post:
 *     summary: Restaurar todas las configuraciones a valores por defecto
 *     tags: [Configurations]
 *     responses:
 *       200:
 *         description: Configuraciones restauradas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/reset', configurationController.resetConfigurations);

/**
 * @swagger
 * /api/configurations/validate-recordings:
 *   post:
 *     summary: Validar configuración de grabaciones
 *     tags: [Configurations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               directory:
 *                 type: string
 *                 description: Ruta absoluta del directorio de grabaciones
 *                 example: /home/roberto/galgo-recordings
 *               format:
 *                 type: string
 *                 enum: [MP4 (H.264), MP4 (H.265), AVI, MKV]
 *                 example: MP4 (H.264)
 *               maxDuration:
 *                 type: number
 *                 description: Duración máxima en segundos (1-3600)
 *                 example: 60
 *               quality:
 *                 type: string
 *                 enum: [Baja (480p), Media (720p), Alta (1080p), 4K (2160p)]
 *                 example: Alta (1080p)
 *     responses:
 *       200:
 *         description: Configuración válida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       400:
 *         description: Configuración inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/validate-recordings', configurationController.validateRecordingsConfig);

module.exports = router;