const express = require('express');
const router = express.Router();
const nfcEventController = require('../controllers/nfc-event.controller');

/**
 * @swagger
 * components:
 *   schemas:
 *     NfcEvent:
 *       type: object
 *       required:
 *         - cardId
 *         - eventType
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated event ID
 *         userId:
 *           type: integer
 *           description: Associated user ID (null for denied access)
 *         cardId:
 *           type: string
 *           description: NFC card ID
 *         eventType:
 *           type: string
 *           enum: [access, exit, denied, attempt]
 *           description: Type of NFC event
 *         sensorId:
 *           type: integer
 *           description: Associated sensor ID
 *         location:
 *           type: string
 *           description: Location where event occurred
 *         metadata:
 *           type: object
 *           description: Additional event data
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Event timestamp
 *         user:
 *           $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /api/nfc-events:
 *   get:
 *     summary: Get NFC events with filtering and pagination
 *     tags: [NFC Events]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of events to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of events to skip
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [access, exit, denied, attempt]
 *         description: Filter by event type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter events from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter events until this date
 *     responses:
 *       200:
 *         description: List of NFC events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/NfcEvent'
 *                       - type: object
 *                         properties:
 *                           userName:
 *                             type: string
 *                             description: User's name
 *                           userSubject:
 *                             type: string
 *                             description: User's subject
 *                           sensorName:
 *                             type: string
 *                             description: Sensor name
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of events
 *                     limit:
 *                       type: integer
 *                       description: Items per page
 *                     offset:
 *                       type: integer
 *                       description: Items skipped
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more items
 */
router.get('/', nfcEventController.getEvents);

/**
 * @swagger
 * /api/nfc-events/stats:
 *   get:
 *     summary: Get NFC event statistics
 *     tags: [NFC Events]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: "24 hours"
 *         description: Time period for statistics (SQLite datetime modifier)
 *     responses:
 *       200:
 *         description: NFC event statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     eventTypeStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           eventType:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     topUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           subject:
 *                             type: string
 *                           accessCount:
 *                             type: integer
 *                     recentEvents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           eventType:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                           userName:
 *                             type: string
 *                           userSubject:
 *                             type: string
 *                     period:
 *                       type: string
 */
router.get('/stats', nfcEventController.getStats);

/**
 * @swagger
 * /api/nfc-events:
 *   post:
 *     summary: Record a new NFC event
 *     tags: [NFC Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cardId
 *               - eventType
 *             properties:
 *               cardId:
 *                 type: string
 *                 description: NFC card ID
 *               eventType:
 *                 type: string
 *                 enum: [access, exit, denied, attempt]
 *                 description: Type of event
 *               sensorId:
 *                 type: integer
 *                 description: Associated sensor ID
 *               location:
 *                 type: string
 *                 description: Location description
 *               metadata:
 *                 type: object
 *                 description: Additional event data
 *     responses:
 *       201:
 *         description: Event recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "NFC event recorded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     eventId:
 *                       type: integer
 *                       description: Event ID
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     eventType:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: Access denied for unknown card
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/', nfcEventController.recordEvent);

/**
 * @swagger
 * /api/rfid-tags:
 *   get:
 *     summary: Get all RFID tags
 *     tags: [RFID Tags]
 *     responses:
 *       200:
 *         description: List of all RFID tags
 */
router.get('/rfid-tags', nfcEventController.getAllTags);

module.exports = router;