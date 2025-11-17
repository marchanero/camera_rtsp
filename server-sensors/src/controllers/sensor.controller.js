const sensorService = require('../services/sensor.service');

class SensorController {
  async getAllSensors(req, res) {
    try {
      const sensors = await sensorService.getAllSensors();
      res.json({ sensors });
    } catch (error) {
      console.error('Error getting sensors:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getSensorById(req, res) {
    try {
      const { id } = req.params;
      const sensor = await sensorService.getSensorById(id);
      
      if (!sensor) {
        return res.status(404).json({ error: 'Sensor not found' });
      }
      
      res.json(sensor);
    } catch (error) {
      console.error('Error getting sensor:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async createSensor(req, res) {
    try {
      const { type, name, topic, description, unit, min_value, max_value, active } = req.body;
      
      if (!type || !name || !topic) {
        return res.status(400).json({ error: 'Type, name, and topic are required' });
      }
      
      const sensor = await sensorService.createSensor({ type, name, topic, description, unit, min_value, max_value, active });
      res.status(201).json(sensor);
    } catch (error) {
      console.error('Error creating sensor:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateSensor(req, res) {
    try {
      const { id } = req.params;
      const { type, name, topic, description, unit, min_value, max_value, active } = req.body;
      
      const sensor = await sensorService.updateSensor(id, { type, name, topic, description, unit, min_value, max_value, active });
      res.json(sensor);
    } catch (error) {
      console.error('Error updating sensor:', error);
      
      if (error.message === 'Sensor not found') {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({ error: error.message });
    }
  }

  async deleteSensor(req, res) {
    try {
      const { id } = req.params;
      await sensorService.deleteSensor(id);
      res.json({ success: true, message: 'Sensor deleted successfully' });
    } catch (error) {
      console.error('Error deleting sensor:', error);
      
      if (error.message === 'Sensor not found') {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new SensorController();
