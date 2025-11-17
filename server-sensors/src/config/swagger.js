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
        url: process.env.API_URL || 'http://localhost:3001',
        description: 'API Server',
      },
    ],
    tags: [
      {
        name: 'Sensors',
        description: 'Gestión de sensores (RTSP, Environmental, EmotiBit)',
      },
      {
        name: 'Topics',
        description: 'Gestión de topics MQTT',
      },
      {
        name: 'MQTT',
        description: 'Operaciones MQTT (conexión, mensajes)',
      },
      {
        name: 'Recordings',
        description: 'Control y configuración de grabaciones',
      },
      {
        name: 'Configurations',
        description: 'Gestión de configuraciones del sistema',
      },
      {
        name: 'Cameras',
        description: 'Gestión de cámaras RTSP (Legacy)',
      },
      {
        name: 'RTSP Cameras',
        description: 'Gestión completa de cámaras RTSP con múltiples configuraciones',
      },
      {
        name: 'Health',
        description: 'Estado de salud de la aplicación',
      },
    ],
    components: {
      schemas: {
        Sensor: {
          type: 'object',
          required: ['type', 'name'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID único del sensor',
            },
            type: {
              type: 'string',
              enum: ['environmental', 'emotibit', 'rtsp'],
              description: 'Tipo de sensor',
              example: 'environmental',
            },
            name: {
              type: 'string',
              description: 'Nombre del sensor',
              example: 'Sensor Temperatura',
            },
            topic: {
              type: 'string',
              description: 'Topic MQTT asociado',
            },
            description: {
              type: 'string',
            },
            unit: {
              type: 'string',
              example: '°C',
            },
            data: {
              type: 'object',
              description: 'Datos adicionales según tipo de sensor',
            },
            active: {
              type: 'boolean',
              default: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Camera: {
          type: 'object',
          required: ['name', 'ip'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID único de la cámara',
            },
            name: {
              type: 'string',
              description: 'Nombre único de la cámara',
              example: 'Cámara Principal',
            },
            ip: {
              type: 'string',
              description: 'Dirección IP o hostname',
              example: '192.168.1.100',
            },
            port: {
              type: 'integer',
              default: 554,
              description: 'Puerto RTSP',
            },
            username: {
              type: 'string',
              description: 'Usuario para autenticación (opcional)',
            },
            path: {
              type: 'string',
              default: '/stream',
              description: 'Path del stream RTSP',
            },
            active: {
              type: 'boolean',
              default: true,
            },
            connection_status: {
              type: 'string',
              enum: ['connected', 'disconnected', 'testing'],
              description: 'Estado de conexión',
            },
            last_checked: {
              type: 'string',
              format: 'date-time',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        RTSPCamera: {
          type: 'object',
          required: ['name', 'ip'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID único de la cámara RTSP',
            },
            name: {
              type: 'string',
              description: 'Nombre único de la cámara',
              example: 'Cámara Entrada Principal',
            },
            ip: {
              type: 'string',
              description: 'Dirección IP o hostname de la cámara',
              example: '192.168.1.100',
            },
            port: {
              type: 'integer',
              default: 554,
              description: 'Puerto RTSP de la cámara',
              example: 554,
            },
            username: {
              type: 'string',
              description: 'Usuario para autenticación RTSP (opcional)',
              example: 'admin',
            },
            password: {
              type: 'string',
              description: 'Contraseña para autenticación RTSP (opcional)',
            },
            path: {
              type: 'string',
              default: '/',
              description: 'Ruta del stream RTSP',
              example: '/stream1',
            },
            protocol: {
              type: 'string',
              default: 'rtsp',
              enum: ['rtsp', 'rtsps'],
              description: 'Protocolo de streaming',
            },
            enabled: {
              type: 'boolean',
              default: true,
              description: 'Si la cámara está habilitada',
            },
            last_connection_status: {
              type: 'string',
              enum: ['connected', 'disconnected', 'testing', 'error', 'unknown'],
              description: 'Último estado de conexión',
            },
            last_connection_time: {
              type: 'string',
              format: 'date-time',
              description: 'Última vez que se intentó conectar',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        StreamInfo: {
          type: 'object',
          properties: {
            video_codec: {
              type: 'string',
              example: 'H.264',
            },
            audio_codec: {
              type: 'string',
              example: 'AAC',
            },
            resolution: {
              type: 'string',
              example: '1920x1080',
            },
            fps: {
              type: 'string',
              example: '30',
            },
          },
        },
        TestConnectionResult: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            connection_status: {
              type: 'string',
              enum: ['connected', 'error', 'testing'],
            },
            rtsp_url: {
              type: 'string',
              example: 'rtsp://admin:password@192.168.1.100:554/stream1',
            },
            stream_info: {
              $ref: '#/components/schemas/StreamInfo',
            },
            message: {
              type: 'string',
            },
          },
        },
        MQTTTopic: {
          type: 'object',
          required: ['topic'],
          properties: {
            id: {
              type: 'integer',
            },
            topic: {
              type: 'string',
              example: 'sensors/temperature',
            },
            description: {
              type: 'string',
            },
            qos: {
              type: 'integer',
              minimum: 0,
              maximum: 2,
              default: 0,
            },
            retained: {
              type: 'boolean',
              default: false,
            },
            active: {
              type: 'boolean',
              default: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Configuration: {
          type: 'object',
          properties: {
            general: {
              type: 'object',
              properties: {
                theme: {
                  type: 'string',
                  enum: ['light', 'dark'],
                },
                recordingAutoStart: {
                  type: 'boolean',
                },
                language: {
                  type: 'string',
                  enum: ['es', 'en'],
                },
                timezone: {
                  type: 'string',
                },
              },
            },
            recordings: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  example: '/home/roberto/galgo-recordings',
                },
                format: {
                  type: 'string',
                  enum: ['MP4 (H.264)', 'MP4 (H.265)', 'AVI', 'MKV'],
                },
                maxDuration: {
                  type: 'integer',
                  description: 'Duración máxima en segundos',
                },
                quality: {
                  type: 'string',
                  enum: ['Baja (480p)', 'Media (720p)', 'Alta (1080p)', '4K (2160p)'],
                },
              },
            },
            mqtt: {
              type: 'object',
              properties: {
                defaultBroker: {
                  type: 'string',
                },
                host: {
                  type: 'string',
                },
                port: {
                  type: 'integer',
                },
                username: {
                  type: 'string',
                },
                ssl: {
                  type: 'boolean',
                },
              },
            },
            cameras: {
              type: 'object',
              properties: {
                defaultRtspPort: {
                  type: 'integer',
                },
                defaultRtspPath: {
                  type: 'string',
                },
                autoReconnect: {
                  type: 'boolean',
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
            },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            valid: {
              type: 'boolean',
              example: false,
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                  },
                  message: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
