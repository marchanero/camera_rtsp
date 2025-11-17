const express = require('express');
const router = express.Router();
const rtspCameraController = require('./rtsp-camera.controller');

/**
 * @swagger
 * /api/rtsp/stream/start:
 *   post:
 *     summary: Iniciar streaming HLS para una cámara RTSP
 *     tags: [RTSP Streaming]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cameraId
 *               - rtspUrl
 *             properties:
 *               cameraId:
 *                 type: integer
 *                 description: ID de la cámara
 *                 example: 1
 *               rtspUrl:
 *                 type: string
 *                 description: URL RTSP completa
 *                 example: rtsp://admin:password@192.168.1.100:554/stream1
 *     responses:
 *       200:
 *         description: Stream HLS iniciado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 streamUrl:
 *                   type: string
 *                 hlsUrl:
 *                   type: string
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error interno del servidor
 */
router.post('/start', rtspCameraController.startStream.bind(rtspCameraController));

/**
 * @swagger
 * /api/rtsp/stream/stop:
 *   post:
 *     summary: Detener streaming HLS para una cámara
 *     tags: [RTSP Streaming]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cameraId
 *             properties:
 *               cameraId:
 *                 type: integer
 *                 description: ID de la cámara
 *                 example: 1
 *     responses:
 *       200:
 *         description: Stream HLS detenido exitosamente
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
 *       500:
 *         description: Error interno del servidor
 */
router.post('/stop', rtspCameraController.stopStream.bind(rtspCameraController));

module.exports = router;