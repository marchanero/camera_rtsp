const app = require('./src/app');
const appConfig = require('./src/config/app.config');

const PORT = appConfig.port;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║         Galgo School API Server                       ║
║                                                       ║
║   Server running on: http://0.0.0.0:${PORT}            ║
║   Environment: ${appConfig.nodeEnv}                            ║
║   API Documentation: http://0.0.0.0:${PORT}/api-docs   ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
