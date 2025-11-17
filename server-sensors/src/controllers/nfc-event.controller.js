const db = require('../database/init-sensors');
const mqttService = require('../services/mqtt.service');

class NfcEventController {
  /**
   * Helper method to get or create RFID tag
   */
  async getOrCreateTag(cardId, cardType, cardSize) {
    return new Promise((resolve, reject) => {
      // First, try to find existing tag
      const findQuery = 'SELECT * FROM rfid_tags WHERE tag_id = ?';
      db.get(findQuery, [cardId], (err, tag) => {
        if (err) {
          reject(err);
          return;
        }

        if (tag) {
          resolve(tag);
        } else {
          // Create new tag
          const insertQuery = `
            INSERT INTO rfid_tags (tag_id, card_type, card_size, last_detected)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `;
          db.run(insertQuery, [cardId, cardType || null, cardSize || null], function(insertErr) {
            if (insertErr) {
              reject(insertErr);
              return;
            }

            // Return the created tag
            const selectQuery = 'SELECT * FROM rfid_tags WHERE id = ?';
            db.get(selectQuery, [this.lastID], (selectErr, newTag) => {
              if (selectErr) {
                reject(selectErr);
              } else {
                resolve(newTag);
              }
            });
          });
        }
      });
    });
  }

  /**
   * Helper method to get user by ID
   */
  async getUserById(userId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id, name, subject FROM users WHERE id = ? AND active = 1';
      db.get(query, [userId], (err, user) => {
        if (err) {
          reject(err);
        } else {
          resolve(user);
        }
      });
    });
  }

  /**
   * Helper method to get user by card ID (legacy support)
   */
  async getUserByCardId(cardId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id, name, subject FROM users WHERE card_id = ? AND active = 1';
      db.get(query, [cardId], (err, user) => {
        if (err) {
          reject(err);
        } else {
          resolve(user);
        }
      });
    });
  }

  /**
   * Helper method to update tag's last detected time
   */
  async updateTagLastDetected(tagId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE rfid_tags SET last_detected = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      db.run(query, [tagId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Helper method to record access event
   */
  async recordAccessEvent(userId, cardId, sensorId, location, cardType, cardSize, metadata) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO nfc_events (user_id, tag_id, event_type, sensor_id, location, card_type, card_size, metadata)
        VALUES (?, ?, 'access', ?, ?, ?, ?, ?)
      `;
      db.run(query, [
        userId,
        cardId,
        sensorId || null,
        location || null,
        cardType || null,
        cardSize || null,
        metadata ? JSON.stringify(metadata) : null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          // Update user's last access time
          const updateQuery = 'UPDATE users SET last_access = CURRENT_TIMESTAMP WHERE id = ?';
          db.run(updateQuery, [userId], (updateErr) => {
            if (updateErr) {
              console.error('Error updating user last access:', updateErr);
            }
            resolve();
          });
        }
      });
    });
  }

  /**
   * Helper method to record exit event
   */
  async recordExitEvent(userId, cardId, sensorId, location, cardType, cardSize, metadata) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO nfc_events (user_id, tag_id, event_type, sensor_id, location, card_type, card_size, metadata)
        VALUES (?, ?, 'exit', ?, ?, ?, ?, ?)
      `;
      db.run(query, [
        userId,
        cardId,
        sensorId || null,
        location || null,
        cardType || null,
        cardSize || null,
        metadata ? JSON.stringify(metadata) : null
      ], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Helper method to record denied event
   */
  async recordDeniedEvent(userId, cardId, sensorId, location, cardType, cardSize, metadata) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO nfc_events (user_id, tag_id, event_type, sensor_id, location, card_type, card_size, metadata)
        VALUES (?, ?, 'denied', ?, ?, ?, ?, ?)
      `;
      db.run(query, [
        userId,
        cardId,
        sensorId || null,
        location || null,
        cardType || null,
        cardSize || null,
        metadata ? JSON.stringify(metadata) : null
      ], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Helper method to record generic event
   */
  async recordGenericEvent(userId, cardId, eventType, sensorId, location, cardType, cardSize, metadata) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO nfc_events (user_id, tag_id, event_type, sensor_id, location, card_type, card_size, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.run(query, [
        userId,
        cardId,
        eventType,
        sensorId || null,
        location || null,
        cardType || null,
        cardSize || null,
        metadata ? JSON.stringify(metadata) : null
      ], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  /**
   * Record NFC access event
   * POST /api/nfc-events
   */
  async recordEvent(req, res) {
    try {
      const { cardId, eventType, sensorId, location, cardType, cardSize, metadata } = req.body;

      // Validate required fields
      if (!cardId || !eventType) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Card ID and event type are required'
        });
      }

      // Valid event types
      const validEventTypes = ['access', 'exit', 'denied', 'detected', 'removed'];
      if (!validEventTypes.includes(eventType)) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid event type. Must be: access, exit, denied, detected, or removed'
        });
      }

      // First, ensure the RFID tag exists in the database
      let tag = await this.getOrCreateTag(cardId, cardType, cardSize);

      // Try to find user by card ID (legacy support) or by assigned RFID tag
      let user = null;
      if (tag.user_id) {
        // Tag is assigned to a user
        user = await this.getUserById(tag.user_id);
      } else {
        // Check legacy card_id field in users table
        user = await this.getUserByCardId(cardId);
      }

      // Handle different event types
      if (eventType === 'detected') {
        // Update tag's last detected time
        await this.updateTagLastDetected(tag.id);

        // If user found, this is an access event
        if (user) {
          await this.recordAccessEvent(user.id, cardId, sensorId, location, cardType, cardSize, metadata);
          this.publishMqttEvent({
            cardId,
            eventType: 'access',
            user: {
              id: user.id,
              name: user.name,
              subject: user.subject
            },
            sensorId,
            location,
            cardType,
            cardSize,
            timestamp: new Date().toISOString()
          });
        } else {
          // Unknown card detected
          await this.recordDeniedEvent(null, cardId, sensorId, location, cardType, cardSize, metadata);
          this.publishMqttEvent({
            cardId,
            eventType: 'denied',
            user: null,
            sensorId,
            location,
            cardType,
            cardSize,
            timestamp: new Date().toISOString()
          });
        }
      } else if (eventType === 'removed') {
        // Tag removed - could be exit event if user was identified
        if (user) {
          await this.recordExitEvent(user.id, cardId, sensorId, location, cardType, cardSize, metadata);
          this.publishMqttEvent({
            cardId,
            eventType: 'exit',
            user: {
              id: user.id,
              name: user.name,
              subject: user.subject
            },
            sensorId,
            location,
            cardType,
            cardSize,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Handle other event types (access, exit, denied)
        if (user) {
          await this.recordGenericEvent(user.id, cardId, eventType, sensorId, location, cardType, cardSize, metadata);
        } else {
          await this.recordDeniedEvent(null, cardId, sensorId, location, cardType, cardSize, metadata);
        }
      }

      res.status(201).json({
        success: true,
        message: 'NFC event recorded successfully',
        data: {
          cardId,
          eventType,
          user: user ? { id: user.id, name: user.name, subject: user.subject } : null,
          tagId: tag.id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error in recordEvent:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get NFC events
   * GET /api/nfc-events
   */
  async getEvents(req, res) {
    try {
      const { limit = 50, offset = 0, userId, eventType, startDate, endDate } = req.query;

      let query = `
        SELECT
          e.id,
          e.user_id,
          e.card_id,
          e.event_type,
          e.sensor_id,
          e.location,
          e.metadata,
          e.created_at,
          u.name as user_name,
          u.subject as user_subject,
          s.name as sensor_name
        FROM nfc_events e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN sensors s ON e.sensor_id = s.id
        WHERE 1=1
      `;

      const params = [];

      if (userId) {
        query += ' AND e.user_id = ?';
        params.push(userId);
      }

      if (eventType) {
        query += ' AND e.event_type = ?';
        params.push(eventType);
      }

      if (startDate) {
        query += ' AND e.created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND e.created_at <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error fetching NFC events:', err);
          return res.status(500).json({
            error: 'Failed to fetch NFC events',
            message: err.message
          });
        }

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM nfc_events WHERE 1=1';
        const countParams = [];

        if (userId) {
          countQuery += ' AND user_id = ?';
          countParams.push(userId);
        }

        if (eventType) {
          countQuery += ' AND event_type = ?';
          countParams.push(eventType);
        }

        if (startDate) {
          countQuery += ' AND created_at >= ?';
          countParams.push(startDate);
        }

        if (endDate) {
          countQuery += ' AND created_at <= ?';
          countParams.push(endDate);
        }

        db.get(countQuery, countParams, (countErr, countRow) => {
          if (countErr) {
            console.error('Error getting count:', countErr);
            return res.status(500).json({
              error: 'Failed to get event count',
              message: countErr.message
            });
          }

          res.json({
            success: true,
            data: rows,
            pagination: {
              total: countRow.total,
              limit: parseInt(limit),
              offset: parseInt(offset),
              hasMore: (parseInt(offset) + rows.length) < countRow.total
            }
          });
        });
      });
    } catch (error) {
      console.error('Error in getEvents:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get NFC event statistics
   * GET /api/nfc-events/stats
   */
  async getStats(req, res) {
    try {
      const { period = '24 hours' } = req.query;

      // Get event counts by type
      const typeStatsQuery = `
        SELECT event_type, COUNT(*) as count
        FROM nfc_events
        WHERE created_at >= datetime('now', '-${period}')
        GROUP BY event_type
      `;

      // Get top users by access count
      const userStatsQuery = `
        SELECT u.name, u.subject, COUNT(e.id) as access_count
        FROM nfc_events e
        JOIN users u ON e.user_id = u.id
        WHERE e.event_type = 'access' AND e.created_at >= datetime('now', '-${period}')
        GROUP BY u.id, u.name, u.subject
        ORDER BY access_count DESC
        LIMIT 10
      `;

      // Get recent events
      const recentEventsQuery = `
        SELECT
          e.id,
          e.event_type,
          e.created_at,
          u.name as user_name,
          u.subject as user_subject
        FROM nfc_events e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.created_at >= datetime('now', '-${period}')
        ORDER BY e.created_at DESC
        LIMIT 20
      `;

      db.all(typeStatsQuery, [], (typeErr, typeStats) => {
        if (typeErr) {
          console.error('Error getting type stats:', typeErr);
          return res.status(500).json({
            error: 'Failed to get statistics',
            message: typeErr.message
          });
        }

        db.all(userStatsQuery, [], (userErr, userStats) => {
          if (userErr) {
            console.error('Error getting user stats:', userErr);
            return res.status(500).json({
              error: 'Failed to get statistics',
              message: userErr.message
            });
          }

          db.all(recentEventsQuery, [], (recentErr, recentEvents) => {
            if (recentErr) {
              console.error('Error getting recent events:', recentErr);
              return res.status(500).json({
                error: 'Failed to get statistics',
                message: recentErr.message
              });
            }

            res.json({
              success: true,
              data: {
                eventTypeStats: typeStats,
                topUsers: userStats,
                recentEvents: recentEvents,
                period
              }
            });
          });
        });
      });
    } catch (error) {
      console.error('Error in getStats:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Assign RFID tag to user
   * POST /api/users/:userId/assign-tag
   */
  async assignTagToUser(req, res) {
    try {
      const { userId } = req.params;
      const { tagId } = req.body;

      if (!tagId) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Tag ID is required'
        });
      }

      // Check if user exists
      const user = await this.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: `User with ID ${userId} not found`
        });
      }

      // Check if tag exists
      const tag = await this.getOrCreateTag(tagId, null, null);

      // Check if tag is already assigned to another user
      if (tag.user_id && tag.user_id !== parseInt(userId)) {
        return res.status(409).json({
          error: 'Tag already assigned',
          message: 'This RFID tag is already assigned to another user'
        });
      }

      // Check if user already has a tag assigned
      const userTagsQuery = 'SELECT * FROM rfid_tags WHERE user_id = ?';
      const existingTag = await new Promise((resolve, reject) => {
        db.get(userTagsQuery, [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (existingTag) {
        return res.status(409).json({
          error: 'User already has tag',
          message: 'This user already has an RFID tag assigned'
        });
      }

      // Assign tag to user
      const assignQuery = 'UPDATE rfid_tags SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await new Promise((resolve, reject) => {
        db.run(assignQuery, [userId, tag.id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Update user's card_id for backward compatibility
      const updateUserQuery = 'UPDATE users SET card_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await new Promise((resolve, reject) => {
        db.run(updateUserQuery, [tagId, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Publish MQTT event
      this.publishMqttEvent({
        eventType: 'tag_assigned',
        tagId,
        user: {
          id: user.id,
          name: user.name,
          subject: user.subject
        },
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'RFID tag assigned to user successfully',
        data: {
          userId,
          tagId,
          tag: {
            id: tag.id,
            tagId,
            userId
          }
        }
      });
    } catch (error) {
      console.error('Error in assignTagToUser:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Unassign RFID tag from user
   * POST /api/users/:userId/unassign-tag
   */
  async unassignTagFromUser(req, res) {
    try {
      const { userId } = req.params;

      // Check if user exists
      const user = await this.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: `User with ID ${userId} not found`
        });
      }

      // Find user's assigned tag
      const tagQuery = 'SELECT * FROM rfid_tags WHERE user_id = ?';
      const tag = await new Promise((resolve, reject) => {
        db.get(tagQuery, [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!tag) {
        return res.status(404).json({
          error: 'No tag assigned',
          message: 'This user does not have an RFID tag assigned'
        });
      }

      // Unassign tag
      const unassignQuery = 'UPDATE rfid_tags SET user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await new Promise((resolve, reject) => {
        db.run(unassignQuery, [tag.id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Clear user's card_id for backward compatibility
      const updateUserQuery = 'UPDATE users SET card_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await new Promise((resolve, reject) => {
        db.run(updateUserQuery, [userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Publish MQTT event
      this.publishMqttEvent({
        eventType: 'tag_unassigned',
        tagId: tag.tag_id,
        user: {
          id: user.id,
          name: user.name,
          subject: user.subject
        },
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'RFID tag unassigned from user successfully',
        data: {
          userId,
          tagId: tag.tag_id
        }
      });
    } catch (error) {
      console.error('Error in unassignTagFromUser:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get all RFID tags
   * GET /api/rfid-tags
   */
  async getAllTags(req, res) {
    try {
      const query = `
        SELECT
          t.id,
          t.tag_id,
          t.user_id,
          t.last_detected,
          t.card_type,
          t.card_size,
          t.active,
          t.created_at,
          t.updated_at,
          u.name as user_name,
          u.subject as user_subject
        FROM rfid_tags t
        LEFT JOIN users u ON t.user_id = u.id
        ORDER BY t.last_detected DESC
      `;

      db.all(query, [], (err, rows) => {
        if (err) {
          console.error('Error fetching RFID tags:', err);
          return res.status(500).json({
            error: 'Failed to fetch RFID tags',
            message: err.message
          });
        }

        res.json({
          success: true,
          data: rows,
          count: rows.length
        });
      });
    } catch (error) {
      console.error('Error in getAllTags:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Publish MQTT event for NFC access
   * @private
   */
  publishMqttEvent(eventData) {
    try {
      const topic = 'galgo/nfc/events';
      const message = JSON.stringify(eventData);

      // Publish to MQTT if service is available
      if (mqttService && typeof mqttService.publish === 'function') {
        mqttService.publish(topic, message, { qos: 1, retain: false });
        console.log('📡 NFC event published to MQTT:', topic, eventData);
      }
    } catch (error) {
      console.error('Error publishing NFC event to MQTT:', error);
    }
  }
}

module.exports = new NfcEventController();