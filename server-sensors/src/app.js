const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const appConfig = require('./config/app.config');
const { initializeDatabase } = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./middlewares/logger');

// Load environment variables
require('dotenv').config();

// Initialize MQTT service (optional auto-connect)
const mqttService = require('./services/mqtt.service');

const app = express();

// Initialize database
initializeDatabase();

// Auto-connect to MQTT broker on startup (persistent connection)
if (appConfig.mqtt.broker) {
  console.log('🔄 Auto-connecting to MQTT broker...');
  mqttService.connect(appConfig.mqtt.broker, {
    username: appConfig.mqtt.username,
    password: appConfig.mqtt.password,
    // do not pass a fixed clientId here so each instance gets a unique id
  }).catch(error => {
    console.log('⚠️ Auto-connection to MQTT broker failed:', error.message);
    console.log('Will retry connection automatically');
  });
}

// Middlewares
app.use(cors(appConfig.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Servir archivos estáticos desde la carpeta public (para HLS)
app.use('/hls', express.static(path.join(__dirname, '../public/hls'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (path.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=10');
    }
  }
}));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Galgo School API Documentation',
  customfavIcon: '/favicon.ico',
}));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Galgo School API',
    version: '1.0.0',
    docs: '/api-docs',
    health: '/api/health',
  });
});

// API routes
app.use('/api', routes);

// Error handler (must be last)
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
