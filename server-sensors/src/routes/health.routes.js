const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verificar estado de salud del sistema
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Sistema funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         error:
 *                           type: string
 *                     mqtt:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         broker:
 *                           type: string
 *                         clientId:
 *                           type: string
 *       503:
 *         description: Sistema con problemas
 */
router.get('/', healthController.getHealth);

module.exports = router;