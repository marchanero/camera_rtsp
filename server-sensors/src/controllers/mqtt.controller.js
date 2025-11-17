const mqttService = require('../services/mqtt.service');

class MqttController {
  /**
   * Get MQTT connection status
   * GET /api/mqtt/status
   */
  async getStatus(req, res) {
    try {
      const status = mqttService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting MQTT status:', error);
      res.status(500).json({
        error: 'Failed to get MQTT status',
        message: error.message
      });
    }
  }

  /**
   * Connect to MQTT broker
   * POST /api/mqtt/connect
   */
  async connect(req, res) {
    try {
      const { broker, username, password, ssl } = req.body;

      if (!broker) {
        return res.status(400).json({
          error: 'Broker URL is required',
          message: 'Please provide a broker URL in the request body'
        });
      }

      // Validate broker URL format
      if (!broker.startsWith('mqtt://') && !broker.startsWith('mqtts://') && !broker.startsWith('ws://') && !broker.startsWith('wss://')) {
        return res.status(400).json({
          error: 'Invalid broker URL format',
          message: 'Broker URL must start with mqtt://, mqtts://, ws://, or wss://'
        });
      }

      // Prepare connection options
      const options = {};
      if (username) options.username = username;
      if (password) options.password = password;
      if (ssl !== undefined) options.rejectUnauthorized = false; // For self-signed certificates

      console.log(`Attempting to connect to MQTT broker: ${broker}`);
      if (username) console.log(`Using authentication with username: ${username}`);

      const result = await mqttService.connect(broker, options);

      res.json({
        success: true,
        message: 'Connected to MQTT broker successfully',
        data: result
      });

    } catch (error) {
      console.error('Error connecting to MQTT broker:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to connect to MQTT broker',
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      });
    }
  }

  /**
   * Disconnect from MQTT broker
   * POST /api/mqtt/disconnect
   */
  async disconnect(req, res) {
    try {
      const result = await mqttService.disconnect();

      res.json({
        success: true,
        message: 'Disconnected from MQTT broker successfully',
        data: result
      });

    } catch (error) {
      console.error('Error disconnecting from MQTT broker:', error);
      res.status(500).json({
        error: 'Failed to disconnect from MQTT broker',
        message: error.message
      });
    }
  }

  /**
   * Get all MQTT topics
   * GET /api/mqtt/topics
   */
  async getTopics(req, res) {
    try {
      const topics = mqttService.getTopics();
      res.json({ topics });
    } catch (error) {
      console.error('Error getting MQTT topics:', error);
      res.status(500).json({
        error: 'Failed to get MQTT topics',
        message: error.message
      });
    }
  }

  /**
   * Add a new MQTT topic
   * POST /api/mqtt/topics
   */
  async addTopic(req, res) {
    try {
      const { topic, description, qos = 0, retained = false } = req.body;

      if (!topic) {
        return res.status(400).json({
          error: 'Topic is required',
          message: 'Please provide a topic in the request body'
        });
      }

      // Validate topic format (basic MQTT topic validation)
      if (!topic || topic.trim() === '') {
        return res.status(400).json({
          error: 'Invalid topic',
          message: 'Topic cannot be empty'
        });
      }

      // Check for invalid characters in topic
      if (topic.includes('#') && topic !== '#') {
        return res.status(400).json({
          error: 'Invalid topic',
          message: 'Wildcard # can only be used alone'
        });
      }

      if (topic.includes('+') && (topic.startsWith('+') || topic.endsWith('+') || topic.includes('/+/'))) {
        // Allow + as single level wildcard, but validate it's not at start/end incorrectly
      }

      const result = await mqttService.addTopic(topic, {
        qos: parseInt(qos) || 0,
        retained: Boolean(retained),
        active: true // New topics are active by default
      });

      res.status(201).json({
        success: true,
        message: 'MQTT topic added successfully',
        data: result
      });

    } catch (error) {
      console.error('Error adding MQTT topic:', error);
      res.status(500).json({
        error: 'Failed to add MQTT topic',
        message: error.message
      });
    }
  }

  /**
   * Update an MQTT topic
   * PUT /api/mqtt/topics/:id
   */
  async updateTopic(req, res) {
    try {
      const { id } = req.params;
      const { active, qos, retained } = req.body;

      // Find topic by ID (convert ID back to topic)
      const topics = mqttService.getTopics();
      const topicData = topics.find(t => t.id === id);

      if (!topicData) {
        return res.status(404).json({
          error: 'Topic not found',
          message: `No topic found with ID: ${id}`
        });
      }

      const updates = {};
      if (active !== undefined) updates.active = Boolean(active);
      if (qos !== undefined) updates.qos = parseInt(qos) || 0;
      if (retained !== undefined) updates.retained = Boolean(retained);

      const result = await mqttService.updateTopic(topicData.topic, updates);

      res.json({
        success: true,
        message: 'MQTT topic updated successfully',
        data: result
      });

    } catch (error) {
      console.error('Error updating MQTT topic:', error);
      res.status(500).json({
        error: 'Failed to update MQTT topic',
        message: error.message
      });
    }
  }

  /**
   * Delete an MQTT topic
   * DELETE /api/mqtt/topics/:id
   */
  async deleteTopic(req, res) {
    try {
      const { id } = req.params;

      // Find topic by ID
      const topics = mqttService.getTopics();
      const topicData = topics.find(t => t.id === id);

      if (!topicData) {
        return res.status(404).json({
          error: 'Topic not found',
          message: `No topic found with ID: ${id}`
        });
      }

      const result = await mqttService.deleteTopic(topicData.topic);

      res.json({
        success: true,
        message: 'MQTT topic deleted successfully',
        data: result
      });

    } catch (error) {
      console.error('Error deleting MQTT topic:', error);
      res.status(500).json({
        error: 'Failed to delete MQTT topic',
        message: error.message
      });
    }
  }

  /**
   * Get MQTT messages
   * GET /api/mqtt/messages
   */
  async getMessages(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const messages = mqttService.getMessages(limit);

      res.json({ messages });

    } catch (error) {
      console.error('Error getting MQTT messages:', error);
      res.status(500).json({
        error: 'Failed to get MQTT messages',
        message: error.message
      });
    }
  }

  /**
   * Publish a message to an MQTT topic
   * POST /api/mqtt/publish
   */
  async publishMessage(req, res) {
    try {
      const { topic, message, qos = 0, retain = false } = req.body;

      if (!topic) {
        return res.status(400).json({
          error: 'Topic is required',
          message: 'Please provide a topic in the request body'
        });
      }

      if (message === undefined || message === null) {
        return res.status(400).json({
          error: 'Message is required',
          message: 'Please provide a message in the request body'
        });
      }

      const result = await mqttService.publish(topic, String(message), {
        qos: parseInt(qos) || 0,
        retain: Boolean(retain)
      });

      res.json({
        success: true,
        message: 'MQTT message published successfully',
        data: result
      });

    } catch (error) {
      console.error('Error publishing MQTT message:', error);
      res.status(500).json({
        error: 'Failed to publish MQTT message',
        message: error.message
      });
    }
  }
}

module.exports = new MqttController();