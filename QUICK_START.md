# 🚀 Guía Rápida de Desarrollo

## Credenciales de las Cámaras RTSP

- **IP**: `192.168.8.210`
- **Usuario**: `admin`
- **Contraseña**: `galgo2526`
- **Puerto**: `554`
- **Protocolo**: RTSP

## URLs de Streaming Disponibles

```
rtsp://admin:galgo2526@192.168.8.210:554/stream1
rtsp://admin:galgo2526@192.168.8.210:554/stream2
rtsp://admin:galgo2526@192.168.8.210:554/stream3
```

## Inicio Rápido

### Opción 1: Terminal Separada (Recomendado)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Opción 2: Script de Inicio (macOS/Linux)

```bash
chmod +x start-dev.sh
./start-dev.sh
```

## Acceso a la Aplicación

- **Frontend**: http://localhost:5173
- **API Backend**: http://localhost:3000
- **Cámaras Endpoint**: http://localhost:3000/cameras
- **Stream Endpoint**: http://localhost:3000/stream/:cameraId

## Prueba de API

### Obtener todas las cámaras

```bash
curl http://localhost:3000/cameras
```

### Obtener una cámara específica

```bash
curl http://localhost:3000/cameras/1
```

### Crear una nueva cámara

```bash
curl -X POST http://localhost:3000/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Cámara",
    "rtspUrl": "rtsp://admin:galgo2526@192.168.8.210:554/stream4",
    "description": "Nueva cámara de prueba"
  }'
```

### Actualizar una cámara

```bash
curl -X PUT http://localhost:3000/cameras/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Entrada Principal",
    "isActive": true
  }'
```

### Eliminar una cámara

```bash
curl -X DELETE http://localhost:3000/cameras/1
```

## Base de Datos

### Ver datos en Prisma Studio

```bash
cd backend
npm run prisma:studio
```

Se abrirá en: http://localhost:5555

### Resetear y Sembrar Base de Datos

```bash
cd backend
npm run seed
```

## Estructura de la Aplicación

```
camera_rtsp/
├── backend/
│   ├── src/
│   │   ├── config.js              # Configuración de cámaras
│   │   ├── index.js               # Servidor Express
│   │   ├── controllers/           # Lógica de negocio
│   │   └── routes/                # Rutas de API
│   ├── prisma/
│   │   ├── schema.prisma          # Modelo de BD
│   │   └── seed.js                # Script de semilla
│   └── .env                       # Variables de entorno
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CameraList.jsx     # Listado de cámaras
│   │   │   └── CameraViewer.jsx   # Visor de stream
│   │   └── App.jsx                # App principal
│   └── vite.config.js
│
└── README.md
```

## Próximos Pasos

1. ✅ Estructura MERN base creada
2. ✅ Base de datos SQLite con Prisma
3. ✅ API REST funcionando
4. ✅ Credenciales configuradas
5. ⏳ Implementar streaming RTSP con FFmpeg
6. ⏳ Convertir RTSP a HLS/WebRTC
7. ⏳ Agregar autenticación
8. ⏳ Deploy en producción

## Notas Importantes

- El streaming directo de RTSP en navegadores requiere conversión a HLS, DASH o WebRTC
- Se puede usar **ffmpeg**, **GStreamer** o **libav** para convertir los streams
- Alternativa: usar librerías como `node-rtsp-stream` para proxy de streams
- Los placeholders en la UI funcionarán hasta configurar el streaming real

## Troubleshooting

### Puerto 3000 en uso
```bash
lsof -i :3000
kill -9 <PID>
```

### Puerto 5173 en uso
```bash
lsof -i :5173
kill -9 <PID>
```

### Errores de Prisma
```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### Reinstalar dependencias
```bash
rm -rf node_modules package-lock.json
npm install
```

---

¡Listo para comenzar! 🎉
