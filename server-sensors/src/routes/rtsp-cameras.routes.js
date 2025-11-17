const express = require('express');
const router = express.Router();
const rtspCameraController = require('../controllers/rtsp-camera.controller');

/**
 * @swagger
 * /api/rtsp/cameras:
 *   get:
 *     summary: Obtener todas las cámaras RTSP configuradas
 *     tags: [RTSP Cameras]
 *     responses:
 *       200:
 *         description: Lista de cámaras RTSP obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cameras:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       ip:
 *                         type: string
 *                       port:
 *                         type: integer
 *                       username:
 *                         type: string
 *                       path:
 *                         type: string
 *                       protocol:
 *                         type: string
 *                       enabled:
 *                         type: boolean
 *                       last_connection_status:
 *                         type: string
 *                       last_connection_time:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                       updated_at:
 *                         type: string
 *                 count:
 *                   type: integer
 *       500:
 *         description: Error interno del servidor
 */
router.get('/', rtspCameraController.getAllCameras.bind(rtspCameraController));

/**
 * @swagger
 * /api/rtsp/cameras/{id}:
 *   get:
 *     summary: Obtener una cámara RTSP específica
 *     tags: [RTSP Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cámara RTSP obtenida exitosamente
 *       404:
 *         description: Cámara no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.get('/:id', rtspCameraController.getCamera.bind(rtspCameraController));

/**
 * @swagger
 * /api/rtsp/cameras:
 *   post:
 *     summary: Crear una nueva cámara RTSP
 *     tags: [RTSP Cameras]
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
 *                 example: Cámara Entrada Principal
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
 *                 description: Usuario para autenticación
 *                 example: admin
 *               password:
 *                 type: string
 *                 description: Contraseña para autenticación
 *               path:
 *                 type: string
 *                 default: "/"
 *                 description: Ruta del stream RTSP
 *                 example: /stream1
 *               protocol:
 *                 type: string
 *                 default: rtsp
 *                 description: Protocolo de streaming
 *                 example: rtsp
 *     responses:
 *       201:
 *         description: Cámara RTSP creada exitosamente
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Ya existe una cámara con ese nombre
 *       500:
 *         description: Error interno del servidor
 */
router.post('/', rtspCameraController.createCamera.bind(rtspCameraController));

/**
 * @swagger
 * /api/rtsp/cameras/{id}:
 *   put:
 *     summary: Actualizar una cámara RTSP
 *     tags: [RTSP Cameras]
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
 *               protocol:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cámara RTSP actualizada exitosamente
 *       404:
 *         description: Cámara no encontrada
 *       409:
 *         description: Ya existe una cámara con ese nombre
 *       500:
 *         description: Error interno del servidor
 */
router.put('/:id', rtspCameraController.updateCamera.bind(rtspCameraController));

/**
 * @swagger
 * /api/rtsp/cameras/{id}:
 *   patch:
 *     summary: Actualizar parcialmente una cámara RTSP (PATCH)
 *     tags: [RTSP Cameras]
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
 *               protocol:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cámara RTSP actualizada exitosamente
 *       404:
 *         description: Cámara no encontrada
 *       409:
 *         description: Ya existe una cámara con ese nombre
 *       500:
 *         description: Error interno del servidor
 */
router.patch('/:id', rtspCameraController.updateCamera.bind(rtspCameraController));

/**
 * @swagger
 * /api/rtsp/cameras/{id}:
 *   delete:
 *     summary: Eliminar una cámara RTSP
 *     tags: [RTSP Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cámara RTSP eliminada exitosamente
 *       404:
 *         description: Cámara no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.delete('/:id', rtspCameraController.deleteCamera.bind(rtspCameraController));

/**
 * @swagger
 * /api/rtsp/cameras/{id}/test:
 *   post:
 *     summary: Probar conexión a una cámara RTSP
 *     tags: [RTSP Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Resultado de la prueba de conexión
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 connection_status:
 *                   type: string
 *                 rtsp_url:
 *                   type: string
 *                 stream_info:
 *                   type: object
 *                   properties:
 *                     video_codec:
 *                       type: string
 *                     audio_codec:
 *                       type: string
 *                     resolution:
 *                       type: string
 *                     fps:
 *                       type: string
 *                 message:
 *                   type: string
 *       404:
 *         description: Cámara no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.post('/:id/test', rtspCameraController.testConnection.bind(rtspCameraController));

/**
 * @swagger
 * /api/rtsp/cameras/{id}/toggle:
 *   post:
 *     summary: Habilitar/deshabilitar una cámara RTSP
 *     tags: [RTSP Cameras]
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
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Estado de la cámara actualizado
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Cámara no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.post('/:id/toggle', rtspCameraController.toggleCamera.bind(rtspCameraController));

/**
 * @swagger
 * /api/rtsp/cameras/{id}/stream-info:
 *   get:
 *     summary: Obtener información del stream RTSP
 *     tags: [RTSP Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Información del stream obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stream_info:
 *                   type: object
 *                   properties:
 *                     video_codec:
 *                       type: string
 *                     audio_codec:
 *                       type: string
 *                     resolution:
 *                       type: string
 *                     fps:
 *                       type: string
 *       404:
 *         description: Cámara no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.get('/:id/stream-info', rtspCameraController.getStreamInfo.bind(rtspCameraController));

module.exports = router;

module.exports = router;
