# 🎥 Visor de Cámaras RTSP - MERN Stack

Una aplicación web moderna para visualizar streams de cámaras RTSP usando **React + Vite** en el frontend y **Node.js + Express** en el backend, con **SQLite** y **Prisma ORM** para la gestión de datos.

## 🚀 Características

- ✅ Frontend moderno con React 18 y Vite
- ✅ Backend API REST con Express.js
- ✅ Base de datos SQLite con Prisma ORM
- ✅ Gestión completa de cámaras RTSP
- ✅ Interfaz responsive y moderna
- ✅ Stream de video en tiempo real
- ✅ Control de reproducción (play/pause)
- ✅ Información en tiempo real de cámaras

## 📋 Requisitos Previos

- Node.js 16+ (recomendado 18 o superior)
- npm o yarn
- Terminal/CMD

## 🎥 Configuración de Cámaras

La aplicación está configurada para conectarse a las siguientes cámaras RTSP:

| Parámetro | Valor |
|-----------|-------|
| **IP** | `192.168.8.210` |
| **Usuario** | `admin` |
| **Contraseña** | `galgo2526` |
| **Puerto** | `554` |
| **Protocolo** | RTSP |

**URLs de Streaming:**
- `rtsp://admin:galgo2526@192.168.8.210:554/stream1`
- `rtsp://admin:galgo2526@192.168.8.210:554/stream2`
- `rtsp://admin:galgo2526@192.168.8.210:554/stream3`

## 🛠️ Instalación

### 1. Instalación del Backend

```bash
cd backend
npm install
```

Generar el cliente Prisma:
```bash
npm run prisma:generate
```

Crear la base de datos y ejecutar migraciones:
```bash
npm run prisma:migrate
```

### 2. Instalación del Frontend

```bash
cd frontend
npm install
```

## 🚀 Uso

### Desarrollar localmente

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

El backend estará disponible en `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

### Scripts disponibles

#### Backend
- `npm run dev` - Ejecutar en modo desarrollo con hot-reload
- `npm start` - Ejecutar en producción
- `npm run prisma:generate` - Generar cliente Prisma
- `npm run prisma:migrate` - Ejecutar migraciones
- `npm run prisma:studio` - Abrir Prisma Studio (interfaz gráfica de BD)

#### Frontend
- `npm run dev` - Ejecutar en modo desarrollo
- `npm run build` - Construir para producción
- `npm run preview` - Previsualizar build de producción
- `npm run lint` - Ejecutar linter

## 📁 Estructura del Proyecto

```
camera_rtsp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Esquema de la base de datos
│   │   └── migrations/         # Migraciones de BD
│   ├── src/
│   │   ├── controllers/        # Lógica de negocio
│   │   ├── routes/             # Rutas de la API
│   │   ├── utils/              # Funciones auxiliares
│   │   └── index.js            # Punto de entrada
│   ├── .env                    # Variables de entorno
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Componentes React
│   │   ├── App.jsx             # Componente principal
│   │   └── main.jsx            # Punto de entrada
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

## 🔌 Endpoints de la API

### Cámaras

- `GET /cameras` - Obtener todas las cámaras
- `GET /cameras/:id` - Obtener cámara por ID
- `POST /cameras` - Crear nueva cámara
- `PUT /cameras/:id` - Actualizar cámara
- `DELETE /cameras/:id` - Eliminar cámara

### Ejemplo de solicitud POST

```bash
curl -X POST http://localhost:3000/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cámara Entrada",
    "rtspUrl": "rtsp://192.168.1.100:554/stream",
    "description": "Cámara de entrada principal"
  }'
```

## 🗄️ Modelo de Base de Datos

### Camera
```prisma
{
  id: Int (PRIMARY KEY)
  name: String (UNIQUE)
  rtspUrl: String (UNIQUE)
  description: String?
  isActive: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

### StreamLog
```prisma
{
  id: Int (PRIMARY KEY)
  cameraId: Int (FOREIGN KEY)
  status: String ("success", "failed", "offline")
  message: String?
  createdAt: DateTime
}
```

## 🔧 Variables de Entorno

### Backend (.env)
```
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=development
MQTT_BROKER_URL=mqtt://localhost:1883

# Credenciales de Cámara (Opcional - Defaults en código)
CAMERA_IP=192.168.8.210
CAMERA_USER=admin
CAMERA_PASS=galgo2526
CAMERA_PORT=554
```

## 🐳 Docker Deployment

El proyecto incluye configuración para despliegue con Docker y Docker Compose, ideal para Raspberry Pi o servidores.

### Requisitos
- Docker
- Docker Compose

### Despliegue Rápido

1. Clonar el repositorio
2. Crear archivo `.env` en `backend/` (usar `.env.example` como guía)
3. Ejecutar:

```bash
docker-compose up -d
```

Esto iniciará:
- **Backend**: http://localhost:3000
- **Frontend**: http://localhost (Puerto 80)
- **MQTT Broker**: Puerto 1883

### Volúmenes Persistentes
- `backend/prisma`: Base de datos SQLite
- `backend/recordings`: Grabaciones de video
- `backend/media`: Archivos temporales de streaming
- `mosquitto/data`: Persistencia MQTT

## 📦 Dependencias Principales

### Backend
- `express` - Framework web
- `cors` - Middleware para CORS
- `@prisma/client` - Cliente ORM
- `dotenv` - Variables de entorno

### Frontend
- `react` - Librería UI
- `vite` - Build tool
- `axios` - Cliente HTTP

## 🌐 Visualizar Base de Datos

Para ver y gestionar los datos en la base de datos usando Prisma Studio:

```bash
cd backend
npm run prisma:studio
```

Se abrirá en `http://localhost:5555`

## 🔄 Workflow de Desarrollo

1. Crear una cámara vía API:
```bash
curl -X POST http://localhost:3000/cameras \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Camera","rtspUrl":"rtsp://example.com/stream"}'
```

2. Acceder a `http://localhost:5173`
3. La cámara aparecerá en el listado
4. Seleccionar cámara para visualizar stream

## 🚢 Deployment

### Build para producción

**Backend:**
```bash
cd backend
npm install --production
```

**Frontend:**
```bash
cd frontend
npm run build
```

Los archivos estáticos compilados estarán en `frontend/dist`

## 📝 Notas Importantes

- La visualización de streams RTSP requiere un proxy o servidor que maneje el protocolo RTSP
- Se puede usar `ffmpeg` o `GStreamer` para convertir RTSP a HLS/DASH
- Por defecto, la app usa placeholders para las imágenes del stream

## 🤝 Contribuir

Este es un proyecto base. Siéntete libre de modificar y mejorar según tus necesidades.

## 📄 Licencia

Este proyecto está disponible bajo licencia MIT.

## 📞 Soporte

Para más información sobre:
- **React + Vite**: https://vitejs.dev/guide/
- **Prisma**: https://www.prisma.io/docs/
- **Express**: https://expressjs.com/

---

**¡Disfruta visualizando tus cámaras RTSP!** 🎉
