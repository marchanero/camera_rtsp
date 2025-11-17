const { getDatabase } = require('../config/database');

class ConfigurationController {
  // GET /api/configurations - Obtener todas las configuraciones
  async getConfigurations(req, res) {
    try {
      const db = getDatabase();

      // Configuraciones por defecto
      const defaultConfigs = {
        general: {
          theme: 'light',
          recordingAutoStart: false,
          language: 'es',
          timezone: 'America/Mexico_City'  // Zona horaria por defecto: México
        },
        recordings: {
          directory: '/home/roberto/galgo-recordings',
          format: 'MP4 (H.264)',
          maxDuration: 60,
          quality: 'Alta (1080p)'
        },
        mqtt: {
          defaultBroker: 'EMQX Local (localhost:1883)',
          host: 'localhost',
          port: 1883,
          username: '',
          password: '',
          ssl: false
        },
        cameras: {
          defaultRtspPort: 554,
          defaultRtspPath: '/stream',
          connectionTimeout: 10,
          defaultQuality: '1080p (Alta)',
          defaultFrameRate: '30 FPS',
          autoReconnect: true,
          videoBuffer: true,
          bufferSize: 5,
          cameraIPs: []
        },
        sensors: {
          autoLoad: true,
          defaultActive: true,
          refreshInterval: 30,
          sensors: []
        },
        topics: {
          autoSubscribe: true,
          defaultQos: 0,
          defaultRetained: false,
          topics: []
        }
      };

      // Obtener todas las configuraciones de la base de datos
      db.all('SELECT category, key, value FROM configurations', [], (err, rows) => {
        let configurations = { ...defaultConfigs };

        if (!err && rows) {
          // Group configurations by category
          const savedConfigs = {};
          rows.forEach(row => {
            if (!savedConfigs[row.category]) {
              savedConfigs[row.category] = {};
            }

            // Parse value if it's JSON, otherwise keep as string
            let parsedValue = row.value;
            try {
              parsedValue = JSON.parse(row.value);
            } catch (e) {
              // Keep as string if not JSON
            }

            savedConfigs[row.category][row.key] = parsedValue;
          });

          // Merge saved configurations with defaults
          configurations = {
            general: { ...defaultConfigs.general, ...savedConfigs.general },
            recordings: { ...defaultConfigs.recordings, ...savedConfigs.recordings },
            mqtt: { ...defaultConfigs.mqtt, ...savedConfigs.mqtt },
            cameras: { ...defaultConfigs.cameras, ...savedConfigs.cameras },
            sensors: { ...defaultConfigs.sensors, ...savedConfigs.sensors },
            topics: { ...defaultConfigs.topics, ...savedConfigs.topics }
          };
        }

        // Load current sensors and topics from database
        Promise.all([
          new Promise((resolve, reject) => {
            db.all('SELECT id, type, name, topic, description, unit, min_value, max_value, active, created_at FROM sensors ORDER BY created_at DESC', [], (err, sensorRows) => {
              if (err) reject(err);
              else resolve(sensorRows);
            });
          }),
          new Promise((resolve, reject) => {
            db.all('SELECT id, topic, description, qos, retained, active, created_at FROM mqtt_topics ORDER BY created_at DESC', [], (err, topicRows) => {
              if (err) reject(err);
              else resolve(topicRows);
            });
          })
        ]).then(([sensors, topics]) => {
          // Update configurations with current database state
          configurations.sensors.sensors = sensors.map(sensor => ({
            id: sensor.id,
            type: sensor.type,
            name: sensor.name,
            topic: sensor.topic,
            description: sensor.description,
            unit: sensor.unit,
            min_value: sensor.min_value,
            max_value: sensor.max_value,
            active: sensor.active,
            created_at: sensor.created_at
          }));

          configurations.topics.topics = topics.map(topic => ({
            id: topic.id,
            topic: topic.topic,
            description: topic.description,
            qos: topic.qos,
            retained: topic.retained,
            active: topic.active,
            created_at: topic.created_at
          }));

          res.json({ configurations });
        }).catch(error => {
          console.error('Error loading sensors/topics:', error);
          // Return configurations without current database state
          res.json({ configurations });
        });
      });
    } catch (error) {
      console.error('Error getting configurations:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // POST /api/configurations - Guardar una configuración individual
  async saveConfiguration(req, res) {
    try {
      const { category, key, value } = req.body;

      if (!category || !key) {
        return res.status(400).json({ error: 'Categoría y clave son requeridas' });
      }

      const db = getDatabase();

      // Convert value to string (JSON if object/array)
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

      db.run(
        'INSERT OR REPLACE INTO configurations (category, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [category, key, valueStr],
        function(err) {
          if (err) {
            console.error('Error saving configuration:', err);
            return res.status(500).json({ error: 'Error al guardar configuración' });
          }

          res.json({ success: true, message: 'Configuración guardada exitosamente' });
        }
      );
    } catch (error) {
      console.error('Error saving configuration:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // PUT /api/configurations/bulk - Guardar todas las configuraciones
  async saveAllConfigurations(req, res) {
    try {
      const { configurations } = req.body;

      if (!configurations) {
        return res.status(400).json({ error: 'Configuraciones son requeridas' });
      }

      const db = getDatabase();
      const statements = [];
      const params = [];

      // Handle sensors synchronization
      if (configurations.sensors && configurations.sensors.sensors) {
        // This will be handled by separate sensor management endpoints
        // For now, we'll just save the sensor settings (not the sensor list itself)
        const sensorSettings = { ...configurations.sensors };
        delete sensorSettings.sensors; // Remove the sensors array from config

        Object.entries(sensorSettings).forEach(([key, value]) => {
          const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          statements.push('INSERT OR REPLACE INTO configurations (category, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)');
          params.push('sensors', key, valueStr);
        });
      }

      // Handle topics synchronization
      if (configurations.topics && configurations.topics.topics) {
        // This will be handled by separate topic management endpoints
        // For now, we'll just save the topic settings (not the topic list itself)
        const topicSettings = { ...configurations.topics };
        delete topicSettings.topics; // Remove the topics array from config

        Object.entries(topicSettings).forEach(([key, value]) => {
          const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          statements.push('INSERT OR REPLACE INTO configurations (category, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)');
          params.push('topics', key, valueStr);
        });
      }

      // Build bulk update statements for other configurations
      Object.entries(configurations).forEach(([category, categoryConfigs]) => {
        if (category === 'sensors' || category === 'topics') {
          // Skip sensors and topics as they're handled separately above
          return;
        }

        Object.entries(categoryConfigs).forEach(([key, value]) => {
          const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          statements.push('INSERT OR REPLACE INTO configurations (category, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)');
          params.push(category, key, valueStr);
        });
      });

      if (statements.length === 0) {
        return res.status(400).json({ error: 'No configurations to update' });
      }

      // Execute all statements in a transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        let completed = 0;
        let hasError = false;

        statements.forEach((stmt, index) => {
          db.run(stmt, params.slice(index * 3, (index + 1) * 3), (err) => {
            if (err && !hasError) {
              hasError = true;
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            completed++;
            if (completed === statements.length && !hasError) {
              db.run('COMMIT', (err) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, message: 'Todas las configuraciones guardadas exitosamente' });
              });
            }
          });
        });
      });
    } catch (error) {
      console.error('Error saving all configurations:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  // PUT /api/configurations/sync-sensors - Sincronizar sensores desde configuraciones
  async syncSensorsFromConfig(req, res) {
    try {
      const { sensors } = req.body;

      if (!Array.isArray(sensors)) {
        return res.status(400).json({ error: 'Sensores debe ser un array' });
      }

      const db = getDatabase();

      // Clear existing sensors and insert new ones
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Delete all existing sensors
        db.run('DELETE FROM sensors', [], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          // Insert new sensors
          let completed = 0;
          let hasError = false;

          if (sensors.length === 0) {
            db.run('COMMIT', (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.json({ success: true, message: 'Sensores sincronizados exitosamente' });
            });
            return;
          }

          sensors.forEach(sensor => {
            db.run(
              'INSERT INTO sensors (type, name, topic, description, unit, min_value, max_value, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                sensor.type,
                sensor.name,
                sensor.topic || '',
                sensor.description || '',
                sensor.unit || '',
                sensor.min_value || null,
                sensor.max_value || null,
                sensor.active !== false
              ],
              function(err) {
                if (err && !hasError) {
                  hasError = true;
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }

                completed++;
                if (completed === sensors.length && !hasError) {
                  db.run('COMMIT', (err) => {
                    if (err) {
                      return res.status(500).json({ error: err.message });
                    }
                    res.json({ success: true, message: 'Sensores sincronizados exitosamente' });
                  });
                }
              }
            );
          });
        });
      });
    } catch (error) {
      console.error('Error syncing sensors:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // PUT /api/configurations/sync-topics - Sincronizar topics desde configuraciones
  async syncTopicsFromConfig(req, res) {
    try {
      const { topics } = req.body;

      if (!Array.isArray(topics)) {
        return res.status(400).json({ error: 'Topics debe ser un array' });
      }

      const db = getDatabase();

      // Clear existing topics and insert new ones
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Delete all existing topics
        db.run('DELETE FROM mqtt_topics', [], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          // Insert new topics
          let completed = 0;
          let hasError = false;

          if (topics.length === 0) {
            db.run('COMMIT', (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.json({ success: true, message: 'Topics sincronizados exitosamente' });
            });
            return;
          }

          topics.forEach(topic => {
            db.run(
              'INSERT INTO mqtt_topics (topic, description, qos, retained, active) VALUES (?, ?, ?, ?, ?)',
              [topic.topic, topic.description || '', topic.qos || 0, topic.retained || false, topic.active !== false],
              function(err) {
                if (err && !hasError) {
                  hasError = true;
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }

                completed++;
                if (completed === topics.length && !hasError) {
                  db.run('COMMIT', (err) => {
                    if (err) {
                      return res.status(500).json({ error: err.message });
                    }
                    res.json({ success: true, message: 'Topics sincronizados exitosamente' });
                  });
                }
              }
            );
          });
        });
      });
    } catch (error) {
      console.error('Error syncing topics:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // POST /api/configurations/reset - Restaurar configuraciones por defecto
  async resetConfigurations(req, res) {
    try {
      const db = getDatabase();

      db.run('DELETE FROM configurations', [], (err) => {
        if (err) {
          console.error('Error deleting configurations:', err);
          return res.status(500).json({ error: 'Error al restaurar configuraciones' });
        }

        res.json({ success: true, message: 'Configuraciones restauradas a valores por defecto' });
      });
    } catch (error) {
      console.error('Error resetting configurations:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Validate recording directory
  validateRecordingDirectory(directory) {
    const fs = require('fs');
    const path = require('path');

    // Check if path is absolute
    if (!path.isAbsolute(directory)) {
      return { valid: false, error: 'La ruta debe ser absoluta' };
    }

    // Check if parent directory exists (create if needed)
    const parentDir = path.dirname(directory);
    if (!fs.existsSync(parentDir)) {
      return { valid: false, error: 'El directorio padre no existe' };
    }

    // Try to create the directory if it doesn't exist
    try {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      return { valid: true, message: 'Directorio válido' };
    } catch (error) {
      return { valid: false, error: `No se puede crear el directorio: ${error.message}` };
    }
  }

  // POST /api/configurations/validate-recordings - Validar configuración de grabaciones
  async validateRecordingsConfig(req, res) {
    try {
      const { directory, format, maxDuration, quality } = req.body;

      const errors = [];

      // Validate directory
      if (directory) {
        const dirValidation = this.validateRecordingDirectory(directory);
        if (!dirValidation.valid) {
          errors.push({ field: 'directory', message: dirValidation.error });
        }
      }

      // Validate format
      const validFormats = ['MP4 (H.264)', 'MP4 (H.265)', 'AVI', 'MKV'];
      if (format && !validFormats.includes(format)) {
        errors.push({ field: 'format', message: 'Formato de video no soportado' });
      }

      // Validate maxDuration
      if (maxDuration) {
        const duration = parseInt(maxDuration);
        if (isNaN(duration) || duration < 1 || duration > 3600) {
          errors.push({ field: 'maxDuration', message: 'Duración debe estar entre 1 y 3600 segundos' });
        }
      }

      // Validate quality
      const validQualities = ['Baja (480p)', 'Media (720p)', 'Alta (1080p)', '4K (2160p)'];
      if (quality && !validQualities.includes(quality)) {
        errors.push({ field: 'quality', message: 'Calidad de video no válida' });
      }

      if (errors.length > 0) {
        return res.status(400).json({ valid: false, errors });
      }

      res.json({ valid: true, message: 'Configuración de grabaciones válida' });
    } catch (error) {
      console.error('Error validating recordings config:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}

module.exports = new ConfigurationController();