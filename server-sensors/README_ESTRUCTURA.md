# Galgo School API - Estructura del Proyecto

## 📁 Estructura de Directorios

```
server/
├── index.js                    # Punto de entrada de la aplicación
├── server.js                   # Archivo legacy (mantener para referencia)
├── package.json
├── sensors.db                  # Base de datos SQLite
├── swagger.js                  # Configuración de Swagger (legacy)
│
└── src/
    ├── app.js                  # Configuración principal de Express
    │
    ├── config/                 # Archivos de configuración
    │   ├── app.config.js       # Configuración general de la app
    │   ├── database.js         # Configuración y conexión a la BD
    │   └── swagger.js          # Configuración de Swagger/OpenAPI
    │
    ├── controllers/            # Controladores (lógica de negocio)
    │   ├── sensor.controller.js
    │   └── mqtt.controller.js
    │
    ├── services/               # Servicios (lógica de negocio compleja)
    │   ├── sensor.service.js
    │   └── mqtt.service.js
    │
    ├── routes/                 # Definición de rutas
    │   ├── index.js            # Router principal
    │   ├── sensor.routes.js
    │   └── mqtt.routes.js
    │
    ├── middlewares/            # Middlewares personalizados
    │   ├── errorHandler.js
    │   └── logger.js
    │
    ├── models/                 # Modelos de datos (futuro uso)
    │
    └── utils/                  # Utilidades y helpers (futuro uso)
```

## 🏗️ Arquitectura

### Patrón MVC/Layered Architecture

1. **Routes** (`src/routes/`): Define los endpoints de la API
2. **Controllers** (`src/controllers/`): Maneja las peticiones HTTP y respuestas
3. **Services** (`src/services/`): Contiene la lógica de negocio
4. **Config** (`src/config/`): Configuraciones centralizadas
5. **Middlewares** (`src/middlewares/`): Funciones intermedias de Express

## 🚀 Características

- ✅ Estructura modular y escalable
- ✅ Separación de responsabilidades
- ✅ Documentación automática con Swagger/OpenAPI
- ✅ Manejo centralizado de errores
- ✅ Logger de peticiones HTTP
- ✅ Configuración centralizada
- ✅ Soporte para MQTT
- ✅ Base de datos SQLite

## 📚 Endpoints Principales

### Sensors
- `GET /api/sensors` - Listar todos los sensores
- `GET /api/sensors/:id` - Obtener un sensor específico
- `POST /api/sensors` - Crear un nuevo sensor
- `PUT /api/sensors/:id` - Actualizar un sensor
- `DELETE /api/sensors/:id` - Eliminar un sensor

### MQTT
- `GET /api/mqtt/status` - Estado de la conexión MQTT
- `POST /api/mqtt/connect` - Conectar al broker
- `POST /api/mqtt/disconnect` - Desconectar del broker
- `GET /api/mqtt/topics` - Listar topics
- `POST /api/mqtt/topics` - Crear topic
- `PUT /api/mqtt/topics/:id` - Actualizar topic
- `DELETE /api/mqtt/topics/:id` - Eliminar topic
- `POST /api/mqtt/publish` - Publicar mensaje
- `GET /api/mqtt/messages` - Historial de mensajes

### Otros
- `GET /api/health` - Health check
- `GET /` - Info de la API
- `GET /api-docs` - Documentación Swagger UI

## 🔧 Variables de Entorno

```bash
PORT=3001
NODE_ENV=production
MQTT_BROKER=mqtt://localhost:1883
MQTT_CLIENT_ID=galgo-school-server
CORS_ORIGIN=*
```

## 🛠️ Scripts

```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start

# Tests (pendiente)
npm test
```

## 📖 Documentación API

La documentación completa de la API está disponible en:
- **Desarrollo**: http://localhost:3001/api-docs
- **Producción**: http://0.0.0.0:3001/api-docs

## 🔐 Seguridad

- CORS configurado
- Validación de datos en controladores
- Manejo de errores centralizado
- Health checks implementados

## 📝 Notas

- El archivo `server.js` legacy se mantiene para referencia
- Los archivos de configuración están centralizados en `src/config/`
- Toda la lógica de negocio está en `services/`
- Los controladores son delgados y delegan a los servicios
