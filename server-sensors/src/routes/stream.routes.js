const express = require('express');
const router = express.Router();
const streamController = require('../controllers/stream.controller');

/**
 * @swagger
 * /api/stream/preview/{id}:
 *   post:
 *     summary: Iniciar preview HLS de una cámara RTSP
 *     tags: [Stream]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cámara
 *     responses:
 *       201:
 *         description: Stream iniciado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 hlsUrl:
 *                   type: string
 *                   example: /api/stream/hls/1
 *                 cameraId:
 *                   type: integer
 *                   example: 1
 *                 message:
 *                   type: string
 *       404:
 *         description: Cámara no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.post('/preview/:id', streamController.startStreamPreview.bind(streamController));

/**
 * @swagger
 * /api/stream/preview/{id}:
 *   delete:
 *     summary: Detener preview HLS de una cámara
 *     tags: [Stream]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cámara
 *     responses:
 *       200:
 *         description: Stream detenido exitosamente
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
 *         description: Stream no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.delete('/preview/:id', streamController.stopStreamPreview.bind(streamController));

/**
 * @swagger
 * /api/stream/status/{id}:
 *   get:
 *     summary: Obtener estado de un stream específico
 *     tags: [Stream]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cámara
 *     responses:
 *       200:
 *         description: Estado del stream obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: object
 *                   properties:
 *                     cameraId:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: [connecting, connected, disconnected, error, failed]
 *                     hlsUrl:
 *                       type: string
 *                     attempts:
 *                       type: integer
 *                     maxAttempts:
 *                       type: integer
 *                     uptime:
 *                       type: integer
 *       404:
 *         description: Stream no encontrado
 */
router.get('/status/:id', streamController.getStreamStatus.bind(streamController));

/**
 * @swagger
 * /api/stream/status:
 *   get:
 *     summary: Obtener estado de todos los streams activos
 *     tags: [Stream]
 *     responses:
 *       200:
 *         description: Estado de todos los streams obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 streams:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 */
router.get('/status', streamController.getAllStreamsStatus.bind(streamController));

/**
 * @swagger
 * /api/stream/hls/{id}:
 *   get:
 *     summary: Obtener playlist M3U8 HLS de una cámara
 *     tags: [Stream]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cámara
 *     responses:
 *       200:
 *         description: Playlist HLS obtenida
 *         content:
 *           application/vnd.apple.mpegurl:
 *             schema:
 *               type: string
 *       404:
 *         description: Stream no encontrado
 */
router.get('/hls/:id', streamController.serveHLSPlaylist.bind(streamController));

/**
 * @swagger
 * /api/stream/segment/{id}/{segment}:
 *   get:
 *     summary: Obtener segmento TS de HLS
 *     tags: [Stream]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: segment
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Segmento de video
 *         content:
 *           video/mp2t:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/segment/:id/:segment', streamController.serveHLSSegment.bind(streamController));

module.exports = router;
