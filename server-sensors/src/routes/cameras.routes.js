const express = require('express');
const router = express.Router();
const cameraController = require('../controllers/camera.controller');

/**
 * @swagger
 * /api/cameras:
 *   get:
 *     summary: Obtener todas las cámaras configuradas
 *     tags: [Cameras]
 *     responses:
 *       200:
 *         description: Lista de cámaras obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cameras:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Camera'
 *                 count:
 *                   type: integer
 *                   example: 2
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', cameraController.getAllCameras.bind(cameraController));

/**
 * @swagger
 * /api/cameras/{id}:
 *   get:
 *     summary: Obtener una cámara específica
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cámara
 *     responses:
 *       200:
 *         description: Cámara obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 camera:
 *                   $ref: '#/components/schemas/Camera'
 *       404:
 *         description: Cámara no encontrada
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
router.get('/:id', cameraController.getCamera.bind(cameraController));

/**
 * @swagger
 * /api/cameras:
 *   post:
 *     summary: Crear una nueva cámara
 *     tags: [Cameras]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - ip
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre único de la cámara
 *                 example: Cámara Principal
 *               ip:
 *                 type: string
 *                 description: Dirección IP o hostname
 *                 example: 192.168.1.100
 *               port:
 *                 type: integer
 *                 default: 554
 *                 description: Puerto RTSP
 *                 example: 554
 *               username:
 *                 type: string
 *                 description: Usuario para autenticación (opcional)
 *                 example: admin
 *               password:
 *                 type: string
 *                 description: Contraseña para autenticación (opcional)
 *                 example: password123
 *               path:
 *                 type: string
 *                 default: /stream
 *                 description: Path del stream RTSP
 *                 example: /stream
 *     responses:
 *       201:
 *         description: Cámara creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 camera:
 *                   $ref: '#/components/schemas/Camera'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Cámara con ese nombre ya existe
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
router.post('/', cameraController.createCamera.bind(cameraController));

/**
 * @swagger
 * /api/cameras/{id}:
 *   put:
 *     summary: Actualizar una cámara
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cámara
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               ip:
 *                 type: string
 *               port:
 *                 type: integer
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               path:
 *                 type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cámara actualizada exitosamente
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
 *       404:
 *         description: Cámara no encontrada
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
router.put('/:id', cameraController.updateCamera.bind(cameraController));

/**
 * @swagger
 * /api/cameras/{id}:
 *   delete:
 *     summary: Eliminar una cámara
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cámara
 *     responses:
 *       200:
 *         description: Cámara eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Cámara no encontrada
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
router.delete('/:id', cameraController.deleteCamera.bind(cameraController));

module.exports = router;
