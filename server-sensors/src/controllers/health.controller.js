const { getDatabase } = require('../config/database');
const appConfig = require('../config/app.config');
const mqttService = require('../services/mqtt.service');

class HealthController {
  getHealth(req, res) {
    try {
      const db = getDatabase();
      const mqttStatus = mqttService.getStatus();

      // Test database connection
      db.get('SELECT 1', [], (err) => {
        const dbStatus = !err;

        const health = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          services: {
            database: {
              status: dbStatus ? 'connected' : 'disconnected',
              error: err ? err.message : null,
            },
            mqtt: {
              status: mqttStatus.connected ? 'connected' : 'disconnected',
              broker: mqttStatus.broker,
              clientId: mqttStatus.clientId,
            },
          },
          environment: {
            nodeEnv: appConfig.nodeEnv,
            port: appConfig.port,
          },
        };

        // For Docker healthcheck, only database connectivity matters
        // MQTT can be disconnected and that's OK
        if (!dbStatus) {
          health.status = 'error';
          res.status(503);
        } else {
          res.status(200);
        }

        res.json(health);
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }
}

module.exports = new HealthController();