const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const nfcEventController = require('../controllers/nfc-event.controller');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - subject
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ID
 *         name:
 *           type: string
 *           description: User's full name
 *         subject:
 *           type: string
 *           description: Subject or course
 *         cardId:
 *           type: string
 *           description: NFC card ID
 *         studentId:
 *           type: string
 *           description: Student ID number
 *         email:
 *           type: string
 *           description: User's email
 *         active:
 *           type: boolean
 *           description: User status
 *           default: true
 *         lastAccess:
 *           type: string
 *           format: date-time
 *           description: Last access timestamp
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of all users
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
 *                     $ref: '#/components/schemas/User'
 *                 count:
 *                   type: integer
 *                   description: Number of users
 *       500:
 *         description: Server error
 */
router.get('/', userController.getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/:id', userController.getUser);

/**
 * @swagger
 * /api/users/card/{cardId}:
 *   get:
 *     summary: Get user by NFC card ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: NFC card ID
 *     responses:
 *       200:
 *         description: User data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/card/:cardId', userController.getUserByCard);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - subject
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *               subject:
 *                 type: string
 *                 description: Subject or course
 *               cardId:
 *                 type: string
 *                 description: NFC card ID
 *               studentId:
 *                 type: string
 *                 description: Student ID number
 *               email:
 *                 type: string
 *                 description: User's email
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *                   example: "User created successfully"
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate card ID
 *       500:
 *         description: Server error
 */
router.post('/', userController.createUser);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - subject
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *               subject:
 *                 type: string
 *                 description: Subject or course
 *               cardId:
 *                 type: string
 *                 description: NFC card ID
 *               studentId:
 *                 type: string
 *                 description: Student ID number
 *               email:
 *                 type: string
 *                 description: User's email
 *               active:
 *                 type: boolean
 *                 description: User status
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *                   example: "User updated successfully"
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       409:
 *         description: Duplicate card ID
 *       500:
 *         description: Server error
 */
router.put('/:id', userController.updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user (soft delete)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
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
 *                   example: "User deleted successfully"
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', userController.deleteUser);

/**
 * @swagger
 * /api/users/{userId}/assign-tag:
 *   post:
 *     summary: Assign RFID tag to user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tagId
 *             properties:
 *               tagId:
 *                 type: string
 *                 description: RFID tag ID to assign
 *     responses:
 *       200:
 *         description: Tag assigned successfully
 *       404:
 *         description: User or tag not found
 *       409:
 *         description: Tag already assigned or user already has tag
 *       500:
 *         description: Server error
 */
router.post('/:userId/assign-tag', nfcEventController.assignTagToUser);

/**
 * @swagger
 * /api/users/{userId}/unassign-tag:
 *   post:
 *     summary: Unassign RFID tag from user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Tag unassigned successfully
 *       404:
 *         description: User not found or no tag assigned
 *       500:
 *         description: Server error
 */
router.post('/:userId/unassign-tag', nfcEventController.unassignTagFromUser);

module.exports = router;