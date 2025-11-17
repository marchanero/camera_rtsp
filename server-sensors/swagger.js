const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Galgo School API',
      version: '1.0.0',
      description: 'API para el sistema de gestión de sensores Galgo School con soporte MQTT',
      contact: {
        name: 'Galgo School Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'http://0.0.0.0:3001',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Sensors',
        description: 'Gestión de sensores',
      },
      {
        name: 'MQTT',
        description: 'Operaciones MQTT',
      },
      {
        name: 'Recording',
        description: 'Control de grabación',
      },
      {
        name: 'Configuration',
        description: 'Gestión de configuraciones',
      },
    ],
  },
  apis: ['./server.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = specs;
