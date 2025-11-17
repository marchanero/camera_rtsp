const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const mqttService = require('../services/mqtt.service');

// Path to the database
const dbPath = path.join(__dirname, '../../sensors.db');

class TopicsController {
  constructor() {
    this.db = new sqlite3.Database(dbPath);
  }

  /**
   * Get all MQTT topics
   * GET /api/topics
   */
  async getAllTopics(req, res) {
    try {
      const query = `
        SELECT 
          t.*,
          s.name as sensor_name,
          s.type as sensor_type
        FROM mqtt_topics t
        LEFT JOIN sensors s ON t.sensor_id = s.id
        ORDER BY t.created_at DESC
      `;

      this.db.all(query, (err, rows) => {
        if (err) {
          console.error('Error fetching topics:', err);
          return res.status(500).json({
            error: 'Failed to fetch topics',
            message: err.message
          });
        }

        // Also get MQTT service status
        const mqttStatus = mqttService.getStatus();
        const mqttTopics = mqttService.getTopics();

        res.json({
          success: true,
          topics: rows,
          mqtt_status: mqttStatus,
          active_subscriptions: mqttTopics
        });
      });

    } catch (error) {
      console.error('Error in getAllTopics:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get topic by ID
   * GET /api/topics/:id
   */
  async getTopicById(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          t.*,
          s.name as sensor_name,
          s.type as sensor_type,
          s.unit as sensor_unit
        FROM mqtt_topics t
        LEFT JOIN sensors s ON t.sensor_id = s.id
        WHERE t.id = ?
      `;

      this.db.get(query, [id], (err, row) => {
        if (err) {
          console.error('Error fetching topic:', err);
          return res.status(500).json({
            error: 'Failed to fetch topic',
            message: err.message
          });
        }

        if (!row) {
          return res.status(404).json({
            error: 'Topic not found',
            message: `No topic found with ID: ${id}`
          });
        }

        res.json({
          success: true,
          topic: row
        });
      });

    } catch (error) {
      console.error('Error in getTopicById:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Create new topic
   * POST /api/topics
   */
  async createTopic(req, res) {
    try {
      const {
        topic,
        description,
        qos = 0,
        retain = false,
        active = true,
        sensor_id = null
      } = req.body;

      // Validation
      if (!topic) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Topic is required'
        });
      }

      // Validate topic format (basic MQTT topic validation)
      if (topic.includes('#') && !topic.endsWith('#')) {
        return res.status(400).json({
          error: 'Invalid topic format',
          message: 'Wildcard # can only be used at the end of a topic'
        });
      }

      // Check if topic already exists
      const checkQuery = `SELECT id FROM mqtt_topics WHERE topic = ?`;

      this.db.get(checkQuery, [topic], (err, existingTopic) => {
        if (err) {
          console.error('Error checking existing topic:', err);
          return res.status(500).json({
            error: 'Database error',
            message: err.message
          });
        }

        if (existingTopic) {
          return res.status(409).json({
            error: 'Topic already exists',
            message: 'A topic with this name already exists'
          });
        }

        // Insert new topic
        const insertQuery = `
          INSERT INTO mqtt_topics 
          (topic, description, qos, retain, active, sensor_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        this.db.run(insertQuery, [
          topic,
          description || null,
          parseInt(qos) || 0,
          retain ? 1 : 0,
          active ? 1 : 0,
          sensor_id || null
        ], function(err) {
          if (err) {
            console.error('Error creating topic:', err);
            return res.status(500).json({
              error: 'Failed to create topic',
              message: err.message
            });
          }

          // If active and MQTT is connected, subscribe to the topic
          if (active && mqttService.getStatus().connected) {
            mqttService.subscribe(topic, { qos: parseInt(qos) || 0 })
              .then(() => {
                console.log(`✅ Auto-subscribed to new topic: ${topic}`);
              })
              .catch((subscribeErr) => {
                console.error(`❌ Failed to auto-subscribe to topic ${topic}:`, subscribeErr);
              });
          }

          res.status(201).json({
            success: true,
            message: 'Topic created successfully',
            topic: {
              id: this.lastID,
              topic,
              description,
              qos: parseInt(qos) || 0,
              retain: retain ? 1 : 0,
              active: active ? 1 : 0,
              sensor_id
            }
          });
        });
      });

    } catch (error) {
      console.error('Error in createTopic:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Update topic
   * PUT /api/topics/:id
   */
  async updateTopic(req, res) {
    try {
      const { id } = req.params;
      const {
        topic,
        description,
        qos,
        retain,
        active,
        sensor_id
      } = req.body;

      // Check if topic exists
      const checkQuery = `SELECT * FROM mqtt_topics WHERE id = ?`;

      this.db.get(checkQuery, [id], (err, existingTopic) => {
        if (err) {
          console.error('Error checking topic:', err);
          return res.status(500).json({
            error: 'Database error',
            message: err.message
          });
        }

        if (!existingTopic) {
          return res.status(404).json({
            error: 'Topic not found',
            message: `No topic found with ID: ${id}`
          });
        }

        // Update topic
        const updateQuery = `
          UPDATE mqtt_topics 
          SET topic = ?, description = ?, qos = ?, retain = ?, 
              active = ?, sensor_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        this.db.run(updateQuery, [
          topic,
          description || null,
          parseInt(qos) || 0,
          retain ? 1 : 0,
          active ? 1 : 0,
          sensor_id || null,
          id
        ], function(err) {
          if (err) {
            console.error('Error updating topic:', err);
            return res.status(500).json({
              error: 'Failed to update topic',
              message: err.message
            });
          }

          // Handle MQTT subscription changes
          if (mqttService.getStatus().connected) {
            const wasActive = existingTopic.active === 1;
            const isActive = active === true || active === 1;

            if (!wasActive && isActive) {
              // Subscribe to topic
              mqttService.subscribe(topic, { qos: parseInt(qos) || 0 })
                .then(() => {
                  console.log(`✅ Subscribed to updated topic: ${topic}`);
                })
                .catch((subscribeErr) => {
                  console.error(`❌ Failed to subscribe to topic ${topic}:`, subscribeErr);
                });
            } else if (wasActive && !isActive) {
              // Unsubscribe from topic
              mqttService.unsubscribe(existingTopic.topic)
                .then(() => {
                  console.log(`✅ Unsubscribed from topic: ${existingTopic.topic}`);
                })
                .catch((unsubscribeErr) => {
                  console.error(`❌ Failed to unsubscribe from topic ${existingTopic.topic}:`, unsubscribeErr);
                });
            } else if (wasActive && isActive && existingTopic.topic !== topic) {
              // Topic name changed, unsubscribe from old and subscribe to new
              mqttService.unsubscribe(existingTopic.topic)
                .then(() => {
                  return mqttService.subscribe(topic, { qos: parseInt(qos) || 0 });
                })
                .then(() => {
                  console.log(`✅ Updated subscription from ${existingTopic.topic} to ${topic}`);
                })
                .catch((changeErr) => {
                  console.error(`❌ Failed to update subscription:`, changeErr);
                });
            }
          }

          res.json({
            success: true,
            message: 'Topic updated successfully',
            changes: this.changes
          });
        });
      });

    } catch (error) {
      console.error('Error in updateTopic:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Delete topic
   * DELETE /api/topics/:id
   */
  async deleteTopic(req, res) {
    try {
      const { id } = req.params;

      // Check if topic exists
      const checkQuery = `SELECT * FROM mqtt_topics WHERE id = ?`;

      this.db.get(checkQuery, [id], (err, topic) => {
        if (err) {
          console.error('Error checking topic:', err);
          return res.status(500).json({
            error: 'Database error',
            message: err.message
          });
        }

        if (!topic) {
          return res.status(404).json({
            error: 'Topic not found',
            message: `No topic found with ID: ${id}`
          });
        }

        // Unsubscribe from MQTT if active and connected
        if (topic.active && mqttService.getStatus().connected) {
          mqttService.unsubscribe(topic.topic)
            .then(() => {
              console.log(`✅ Unsubscribed from deleted topic: ${topic.topic}`);
            })
            .catch((unsubscribeErr) => {
              console.error(`❌ Failed to unsubscribe from topic ${topic.topic}:`, unsubscribeErr);
            });
        }

        // Delete topic
        const deleteQuery = `DELETE FROM mqtt_topics WHERE id = ?`;

        this.db.run(deleteQuery, [id], function(err) {
          if (err) {
            console.error('Error deleting topic:', err);
            return res.status(500).json({
              error: 'Failed to delete topic',
              message: err.message
            });
          }

          res.json({
            success: true,
            message: `Topic "${topic.topic}" deleted successfully`,
            changes: this.changes
          });
        });
      });

    } catch (error) {
      console.error('Error in deleteTopic:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Subscribe to topic via MQTT
   * POST /api/topics/:id/subscribe
   */
  async subscribeToTopic(req, res) {
    try {
      const { id } = req.params;

      // Get topic from database
      const query = `SELECT * FROM mqtt_topics WHERE id = ?`;

      this.db.get(query, [id], async (err, topic) => {
        if (err) {
          console.error('Error fetching topic:', err);
          return res.status(500).json({
            error: 'Database error',
            message: err.message
          });
        }

        if (!topic) {
          return res.status(404).json({
            error: 'Topic not found',
            message: `No topic found with ID: ${id}`
          });
        }

        if (!mqttService.getStatus().connected) {
          return res.status(400).json({
            error: 'MQTT not connected',
            message: 'Please connect to MQTT broker first'
          });
        }

        try {
          // Subscribe to topic
          const result = await mqttService.subscribe(topic.topic, { qos: topic.qos });

          // Update topic as active in database
          const updateQuery = `UPDATE mqtt_topics SET active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
          this.db.run(updateQuery, [id]);

          res.json({
            success: true,
            message: `Successfully subscribed to topic: ${topic.topic}`,
            data: result
          });

        } catch (subscribeError) {
          res.status(500).json({
            error: 'Failed to subscribe to topic',
            message: subscribeError.message
          });
        }
      });

    } catch (error) {
      console.error('Error in subscribeToTopic:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Unsubscribe from topic via MQTT
   * POST /api/topics/:id/unsubscribe
   */
  async unsubscribeFromTopic(req, res) {
    try {
      const { id } = req.params;

      // Get topic from database
      const query = `SELECT * FROM mqtt_topics WHERE id = ?`;

      this.db.get(query, [id], async (err, topic) => {
        if (err) {
          console.error('Error fetching topic:', err);
          return res.status(500).json({
            error: 'Database error',
            message: err.message
          });
        }

        if (!topic) {
          return res.status(404).json({
            error: 'Topic not found',
            message: `No topic found with ID: ${id}`
          });
        }

        if (!mqttService.getStatus().connected) {
          return res.status(400).json({
            error: 'MQTT not connected',
            message: 'MQTT broker is not connected'
          });
        }

        try {
          // Unsubscribe from topic
          const result = await mqttService.unsubscribe(topic.topic);

          // Update topic as inactive in database
          const updateQuery = `UPDATE mqtt_topics SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
          this.db.run(updateQuery, [id]);

          res.json({
            success: true,
            message: `Successfully unsubscribed from topic: ${topic.topic}`,
            data: result
          });

        } catch (unsubscribeError) {
          res.status(500).json({
            error: 'Failed to unsubscribe from topic',
            message: unsubscribeError.message
          });
        }
      });

    } catch (error) {
      console.error('Error in unsubscribeFromTopic:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Publish message to topic
   * POST /api/topics/:id/publish
   */
  async publishToTopic(req, res) {
    try {
      const { id } = req.params;
      const { message, qos, retain } = req.body;

      if (message === undefined || message === null) {
        return res.status(400).json({
          error: 'Missing message',
          message: 'Message content is required'
        });
      }

      // Get topic from database
      const query = `SELECT * FROM mqtt_topics WHERE id = ?`;

      this.db.get(query, [id], async (err, topic) => {
        if (err) {
          console.error('Error fetching topic:', err);
          return res.status(500).json({
            error: 'Database error',
            message: err.message
          });
        }

        if (!topic) {
          return res.status(404).json({
            error: 'Topic not found',
            message: `No topic found with ID: ${id}`
          });
        }

        if (!mqttService.getStatus().connected) {
          return res.status(400).json({
            error: 'MQTT not connected',
            message: 'Please connect to MQTT broker first'
          });
        }

        try {
          // Publish message
          const result = await mqttService.publish(topic.topic, String(message), {
            qos: qos !== undefined ? parseInt(qos) : topic.qos,
            retain: retain !== undefined ? Boolean(retain) : Boolean(topic.retain)
          });

          res.json({
            success: true,
            message: `Message published to topic: ${topic.topic}`,
            data: result
          });

        } catch (publishError) {
          res.status(500).json({
            error: 'Failed to publish message',
            message: publishError.message
          });
        }
      });

    } catch (error) {
      console.error('Error in publishToTopic:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = new TopicsController();