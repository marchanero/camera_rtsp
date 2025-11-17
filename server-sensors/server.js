const app = require('./src/app');
const appConfig = require('./src/config/app.config');
const mqttService = require('./src/services/mqtt.service');

const PORT = appConfig.port || process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

/**
 * @swagger
 * /api/sensors:
 *   post:
 *     summary: Crear un nuevo sensor
 *     tags: [Sensors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - name
 *             properties:
 *               type:
 *                 type: string
 *                 example: environmental
 *               name:
 *                 type: string
 *                 example: Sensor Temperatura
 *               data:
 *                 type: object
 *                 example: { "location": "Lab 1" }
 *     responses:
 *       200:
 *         description: Sensor creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *       500:
 *         description: Error del servidor
 */
app.post('/api/sensors', (req, res) => {
  const { type, name, data } = req.body;
  db.run('INSERT INTO sensors (type, name, data) VALUES (?, ?, ?)', [type, name, JSON.stringify(data)], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID });
  });
});

// Recording endpoints

/**
 * @swagger
 * /api/recording/start:
 *   post:
 *     summary: Iniciar grabación
 *     tags: [Recording]
 *     responses:
 *       200:
 *         description: Grabación iniciada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sessionId:
 *                   type: number
 *                 startTime:
 *                   type: string
 *                 message:
 *                   type: string
 */
app.post('/api/recording/start', (req, res) => {
  const startTime = new Date().toISOString();
  const sessionId = Date.now(); // Simple session ID based on timestamp
  
  // In a real implementation, you might want to store this in a recordings table
  console.log(`Recording started at ${startTime} with session ID: ${sessionId}`);
  
  res.json({ 
    success: true, 
    sessionId: sessionId,
    startTime: startTime,
    message: 'Recording started successfully'
  });
});

/**
 * @swagger
 * /api/recording/stop:
 *   post:
 *     summary: Detener grabación
 *     tags: [Recording]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: number
 *     responses:
 *       200:
 *         description: Grabación detenida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 endTime:
 *                   type: string
 *                 message:
 *                   type: string
 */
app.post('/api/recording/stop', (req, res) => {
  const endTime = new Date().toISOString();
  const { sessionId } = req.body || {};
  
  // In a real implementation, you would save the recording data here
  console.log(`Recording stopped at ${endTime}${sessionId ? ` for session ${sessionId}` : ''}`);
  
  res.json({ 
    success: true, 
    endTime: endTime,
    message: 'Recording stopped and data saved successfully'
  });
});

// MQTT endpoints

/**
 * @swagger
 * /api/mqtt/status:
 *   get:
 *     summary: Obtener estado de conexión MQTT
 *     tags: [MQTT]
 *     responses:
 *       200:
 *         description: Estado de MQTT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                 broker:
 *                   type: string
 *                 clientId:
 *                   type: string
 */
app.get('/api/mqtt/status', (req, res) => {
  const status = mqttService.getStatus();
  res.json({
    connected: status.connected,
    broker: status.broker,
    clientId: status.clientId
  });
});

app.post('/api/mqtt/connect', async (req, res) => {
  try {
    const { broker, clientId } = req.body;

    if (!broker) {
      return res.status(400).json({ error: 'Broker URL is required' });
    }

    const result = await mqttService.connect(broker);

    res.json({
      success: true,
      message: 'MQTT connection initiated',
      broker: result.broker,
      clientId: result.clientId
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Failed to connect to MQTT broker'
    });
  }
});

app.post('/api/mqtt/disconnect', async (req, res) => {
  try {
    await mqttService.disconnect();
    res.json({
      success: true,
      message: 'MQTT disconnected'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Failed to disconnect from MQTT broker'
    });
  }
});

/**
 * @swagger
 * /api/mqtt/topics:
 *   get:
 *     summary: Obtener todos los topics MQTT
 *     tags: [MQTT]
 *     responses:
 *       200:
 *         description: Lista de topics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 topics:
 *                   type: array
 *                   items:
 *                     type: object
 *   post:
 *     summary: Crear un nuevo topic MQTT
 *     tags: [MQTT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *                 example: sensors/temperature
 *               description:
 *                 type: string
 *                 example: Topic para sensores de temperatura
 *               qos:
 *                 type: integer
 *                 example: 0
 *               retained:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Topic creado
 *       409:
 *         description: Topic ya existe
 */
// MQTT Topics CRUD
app.get('/api/mqtt/topics', (req, res) => {
  db.all('SELECT * FROM mqtt_topics ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ topics: rows });
  });
});

app.post('/api/mqtt/topics', async (req, res) => {
  const { topic, description, qos, retained } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    // Add topic to database first
    db.run('INSERT INTO mqtt_topics (topic, description, qos, retained) VALUES (?, ?, ?, ?)',
      [topic, description || '', qos || 0, retained || false], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({ error: 'Topic already exists' });
        }
        res.status(500).json({ error: err.message });
        return;
      }

      // Subscribe to the new topic if MQTT is connected
      mqttService.subscribe(topic, { qos: qos || 0 }).catch(error => {
        console.error(`Error subscribing to ${topic}:`, error);
      });

      res.json({ id: this.lastID, topic, description, qos, retained });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mqtt/topics/:id', async (req, res) => {
  const { id } = req.params;
  const { topic, description, qos, retained, active } = req.body;

  try {
    // Get current topic before updating
    db.get('SELECT topic FROM mqtt_topics WHERE id = ?', [id], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const oldTopic = row.topic;

      // Update database
      db.run('UPDATE mqtt_topics SET topic = ?, description = ?, qos = ?, retained = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [topic, description, qos, retained, active, id], async function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Topic not found' });
        }

        // Handle topic changes and subscriptions
        try {
          if (oldTopic !== topic) {
            // Topic name changed - unsubscribe from old and subscribe to new
            await mqttService.unsubscribe(oldTopic);
            if (active) {
              await mqttService.subscribe(topic, { qos: qos || 0 });
            }
          } else if (active !== undefined) {
            // Active status changed
            if (active) {
              await mqttService.subscribe(topic, { qos: qos || 0 });
            } else {
              await mqttService.unsubscribe(topic);
            }
          }
        } catch (mqttError) {
          console.error('MQTT subscription error:', mqttError);
        }

        res.json({ success: true });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mqtt/topics/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Get topic before deleting
    db.get('SELECT topic FROM mqtt_topics WHERE id = ?', [id], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const topic = row.topic;

      // Unsubscribe from MQTT
      try {
        await mqttService.unsubscribe(topic);
      } catch (mqttError) {
        console.error('MQTT unsubscribe error:', mqttError);
      }

      // Delete from database
      db.run('DELETE FROM mqtt_topics WHERE id = ?', [id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        res.json({ success: true });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/mqtt/publish:
 *   post:
 *     summary: Publicar un mensaje MQTT
 *     tags: [MQTT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *               - message
 *             properties:
 *               topic:
 *                 type: string
 *                 example: sensors/temperature
 *               message:
 *                 type: string
 *                 example: "25.5"
 *               qos:
 *                 type: integer
 *                 example: 0
 *               retain:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Mensaje publicado
 *       503:
 *         description: Cliente MQTT no conectado
 */
// Publish MQTT message
app.post('/api/mqtt/publish', async (req, res) => {
  try {
    const { topic, message, qos, retain } = req.body;

    if (!topic || message === undefined) {
      return res.status(400).json({ error: 'Topic and message are required' });
    }

    await mqttService.publish(topic, message.toString(), {
      qos: qos || 0,
      retain: retain || false
    });

    res.json({ success: true, message: 'Message published successfully' });
  } catch (error) {
    if (error.message.includes('not connected')) {
      res.status(503).json({ error: 'MQTT client not connected' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * @swagger
 * /api/mqtt/messages:
 *   get:
 *     summary: Obtener historial de mensajes MQTT
 *     tags: [MQTT]
 *     parameters:
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *         description: Filtrar por topic
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de mensajes
 *     responses:
 *       200:
 *         description: Lista de mensajes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 */
// Get MQTT messages history
app.get('/api/mqtt/messages', (req, res) => {
  const { topic, limit = 50 } = req.query;
  
  let query = 'SELECT * FROM mqtt_messages';
  let params = [];
  
  if (topic) {
    query += ' WHERE topic = ?';
    params.push(topic);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ messages: rows });
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});