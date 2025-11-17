const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the database
const dbPath = path.join(__dirname, '../../sensors.db');

/**
 * Execute a database query with a promise
 */
function dbQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      db.all(query, params, (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows);
      });
    } else {
      db.run(query, params, function(err) {
        db.close();
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    }
  });
}

/**
 * Execute a single row database query
 */
function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    db.get(query, params, (err, row) => {
      db.close();
      if (err) reject(err);
      else resolve(row);
    });
  });
}

class SensorsController {
  /**
   * Get all sensors
   * GET /api/sensors
   */
  async getAllSensors(req, res) {
    try {
      const query = `
        SELECT 
          s.*,
          COUNT(sd.id) as data_count,
          MAX(sd.timestamp) as last_reading
        FROM sensors s
        LEFT JOIN sensor_data sd ON s.id = sd.sensor_id
        GROUP BY s.id
        ORDER BY s.id DESC
      `;

      const sensors = await dbQuery(query);

      // Parse JSON data field for each sensor
      const processedSensors = sensors.map(sensor => ({
        ...sensor,
        data: sensor.data ? JSON.parse(sensor.data) : null
      }));

      res.json({
        success: true,
        sensors: processedSensors
      });

    } catch (error) {
      console.error('Error in getAllSensors:', error);
      res.status(500).json({
        error: 'Failed to fetch sensors',
        message: error.message
      });
    }
  }

  /**
   * Get sensor by ID
   * GET /api/sensors/:id
   */
  async getSensorById(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          s.*,
          COUNT(sd.id) as data_count,
          MAX(sd.timestamp) as last_reading,
          AVG(sd.numeric_value) as avg_value,
          MIN(sd.numeric_value) as min_reading,
          MAX(sd.numeric_value) as max_reading
        FROM sensors s
        LEFT JOIN sensor_data sd ON s.id = sd.sensor_id
        WHERE s.id = ?
        GROUP BY s.id
      `;

      const sensor = await dbGet(query, [id]);

      if (!sensor) {
        return res.status(404).json({
          error: 'Sensor not found',
          message: `No sensor found with ID: ${id}`
        });
      }

      // Parse JSON data field
      const processedSensor = {
        ...sensor,
        data: sensor.data ? JSON.parse(sensor.data) : null
      };

      res.json({
        success: true,
        sensor: processedSensor
      });

    } catch (error) {
      console.error('Error in getSensorById:', error);
      res.status(500).json({
        error: 'Failed to fetch sensor',
        message: error.message
      });
    }
  }

  /**
   * Create new sensor
   * POST /api/sensors
   */
  async createSensor(req, res) {
    try {
      const {
        name,
        type,
        topic,
        description,
        unit,
        min_value,
        max_value,
        data,
        active = true
      } = req.body;

      // Validation
      if (!name || !type || !topic) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Name, type, and topic are required'
        });
      }

      // Check if sensor with same name or topic already exists
      const existingSensor = await dbGet(`
        SELECT id FROM sensors 
        WHERE name = ? OR topic = ?
      `, [name, topic]);

      if (existingSensor) {
        return res.status(409).json({
          error: 'Sensor already exists',
          message: 'A sensor with this name or topic already exists'
        });
      }

      // Insert new sensor
      const result = await dbQuery(`
        INSERT INTO sensors 
        (name, type, topic, description, unit, min_value, max_value, data, active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        name,
        type,
        topic,
        description || null,
        unit || null,
        min_value || null,
        max_value || null,
        data ? JSON.stringify(data) : null,
        active ? 1 : 0
      ]);

      res.status(201).json({
        success: true,
        message: 'Sensor created successfully',
        sensor: {
          id: result.id,
          name,
          type,
          topic,
          description,
          unit,
          min_value,
          max_value,
          data,
          active
        }
      });

    } catch (error) {
      console.error('Error in createSensor:', error);
      res.status(500).json({
        error: 'Failed to create sensor',
        message: error.message
      });
    }
  }

  /**
   * Update sensor
   * PUT /api/sensors/:id
   */
  async updateSensor(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        type,
        topic,
        description,
        unit,
        min_value,
        max_value,
        data,
        active
      } = req.body;

      // Check if sensor exists
      const sensor = await dbGet(`SELECT id FROM sensors WHERE id = ?`, [id]);

      if (!sensor) {
        return res.status(404).json({
          error: 'Sensor not found',
          message: `No sensor found with ID: ${id}`
        });
      }

      // Update sensor
      const result = await dbQuery(`
        UPDATE sensors 
        SET name = ?, type = ?, topic = ?, description = ?, 
            unit = ?, min_value = ?, max_value = ?, data = ?, active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name,
        type,
        topic,
        description || null,
        unit || null,
        min_value || null,
        max_value || null,
        data ? JSON.stringify(data) : null,
        active ? 1 : 0,
        id
      ]);

      res.json({
        success: true,
        message: 'Sensor updated successfully',
        changes: result.changes
      });

    } catch (error) {
      console.error('Error in updateSensor:', error);
      res.status(500).json({
        error: 'Failed to update sensor',
        message: error.message
      });
    }
  }

  /**
   * Delete sensor
   * DELETE /api/sensors/:id
   */
  async deleteSensor(req, res) {
    try {
      const { id } = req.params;

      // Check if sensor exists
      const sensor = await dbGet(`SELECT id, name FROM sensors WHERE id = ?`, [id]);

      if (!sensor) {
        return res.status(404).json({
          error: 'Sensor not found',
          message: `No sensor found with ID: ${id}`
        });
      }

      // Delete sensor (this will cascade delete sensor_data due to FK constraint)
      const result = await dbQuery(`DELETE FROM sensors WHERE id = ?`, [id]);

      res.json({
        success: true,
        message: `Sensor "${sensor.name}" deleted successfully`,
        changes: result.changes
      });

    } catch (error) {
      console.error('Error in deleteSensor:', error);
      res.status(500).json({
        error: 'Failed to delete sensor',
        message: error.message
      });
    }
  }

  /**
   * Get sensor data (readings)
   * GET /api/sensors/:id/data
   */
  async getSensorData(req, res) {
    try {
      const { id } = req.params;
      const { limit = 100, offset = 0, from, to } = req.query;

      let query = `
        SELECT * FROM sensor_data 
        WHERE sensor_id = ?
      `;
      let params = [id];

      // Add date filters if provided
      if (from) {
        query += ` AND timestamp >= ?`;
        params.push(from);
      }
      
      if (to) {
        query += ` AND timestamp <= ?`;
        params.push(to);
      }

      query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const data = await dbQuery(query, params);

      res.json({
        success: true,
        data: data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: data.length
        }
      });

    } catch (error) {
      console.error('Error in getSensorData:', error);
      res.status(500).json({
        error: 'Failed to fetch sensor data',
        message: error.message
      });
    }
  }

  /**
   * Add sensor data (reading)
   * POST /api/sensors/:id/data
   */
  async addSensorData(req, res) {
    try {
      const { id } = req.params;
      const { value, topic, timestamp, raw_message } = req.body;

      if (value === undefined || !topic) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Value and topic are required'
        });
      }

      // Parse numeric value if possible
      let numeric_value = null;
      const parsedValue = parseFloat(value);
      if (!isNaN(parsedValue)) {
        numeric_value = parsedValue;
      }

      const result = await dbQuery(`
        INSERT INTO sensor_data 
        (sensor_id, topic, value, numeric_value, timestamp, raw_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        id,
        topic,
        String(value),
        numeric_value,
        timestamp || new Date().toISOString(),
        raw_message || null
      ]);

      res.status(201).json({
        success: true,
        message: 'Sensor data added successfully',
        data: {
          id: result.id,
          sensor_id: id,
          value,
          numeric_value,
          topic,
          timestamp: timestamp || new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error in addSensorData:', error);
      res.status(500).json({
        error: 'Failed to add sensor data',
        message: error.message
      });
    }
  }

  /**
   * Get sensor types (available sensor categories)
   * GET /api/sensors/types
   */
  async getSensorTypes(req, res) {
    try {
      const sensorTypes = [
        { value: 'temperature', label: 'Temperatura', unit: '°C', icon: '🌡️' },
        { value: 'humidity', label: 'Humedad', unit: '%', icon: '💧' },
        { value: 'pressure', label: 'Presión', unit: 'hPa', icon: '🏔️' },
        { value: 'gas', label: 'Gas/Aire', unit: 'ppm', icon: '💨' },
        { value: 'light', label: 'Luz', unit: 'lux', icon: '💡' },
        { value: 'motion', label: 'Movimiento', unit: 'bool', icon: '🏃' },
        { value: 'sound', label: 'Sonido', unit: 'dB', icon: '🔊' },
        { value: 'proximity', label: 'Proximidad', unit: 'cm', icon: '📏' },
        { value: 'voltage', label: 'Voltaje', unit: 'V', icon: '⚡' },
        { value: 'current', label: 'Corriente', unit: 'A', icon: '🔌' },
        { value: 'power', label: 'Potencia', unit: 'W', icon: '⚡' },
        { value: 'energy', label: 'Energía', unit: 'kWh', icon: '🔋' },
        { value: 'flow', label: 'Flujo', unit: 'L/min', icon: '🌊' },
        { value: 'level', label: 'Nivel', unit: 'cm', icon: '📊' },
        { value: 'weight', label: 'Peso', unit: 'kg', icon: '⚖️' },
        { value: 'speed', label: 'Velocidad', unit: 'km/h', icon: '🏎️' },
        { value: 'acceleration', label: 'Aceleración', unit: 'm/s²', icon: '📈' },
        { value: 'rotation', label: 'Rotación', unit: 'rpm', icon: '🔄' },
        { value: 'ph', label: 'pH', unit: 'pH', icon: '🧪' },
        { value: 'custom', label: 'Personalizado', unit: '', icon: '⚙️' }
      ];

      res.json({
        success: true,
        types: sensorTypes
      });

    } catch (error) {
      console.error('Error in getSensorTypes:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = new SensorsController();