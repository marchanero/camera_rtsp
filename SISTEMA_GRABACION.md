# Sistema de Grabación y Streaming RTSP

## 🚀 Inicio Rápido

### 1. Iniciar Backend
```bash
cd backend
npm start
```

Deberías ver:
```
✅ Servidor ejecutándose en http://localhost:3000
🎬 Node Media Server iniciado
📺 RTMP: rtmp://localhost:1935
🌐 HLS: http://localhost:8888
✅ Sistema de grabación y streaming iniciado
```

### 2. Iniciar Frontend
```bash
cd frontend
npm run dev
```

### 3. Usar la aplicación

1. Abre http://localhost:5173
2. Selecciona la cámara "Cámara Principal"
3. Presiona **"▶️ Iniciar Stream + Grabación"**
4. Espera 3-5 segundos (FFmpeg está conectando y generando segmentos HLS)
5. El video debería aparecer automáticamente

## 📋 Cómo funciona

```
[Cámara RTSP] 
    ↓
[FFmpeg Process 1] → [RTMP Server] → [HLS Transcoding] → [Navegador]
    ↓
[FFmpeg Process 2] → [MP4 Files en /recordings]
```

## 🎬 Funcionalidades

### Streaming en Vivo
- **Protocolo**: HLS (HTTP Live Streaming)
- **Latencia**: ~3-5 segundos
- **Puerto**: 8888
- **URL**: `http://localhost:8888/live/camera_{id}/index.m3u8`

### Grabación Continua
- **Formato**: MP4 (H.264)
- **Segmentación**: Archivos de 1 hora
- **Ubicación**: `backend/recordings/camera_{id}/`
- **Nombre**: `YYYY-MM-DD_XXX.mp4`

### Panel de Control
- ▶️ Iniciar/Detener stream
- 🖥️ Fullscreen
- 📸 Captura de pantalla
- 📼 Ver grabaciones
- ⬇️ Descargar videos
- 🗑️ Eliminar grabaciones

## 🔧 Configuración

### Cambiar tiempo de segmentación (por defecto 1 hora)
En `backend/src/services/mediaServer.js`:
```javascript
'-segment_time', '3600', // Cambiar a segundos deseados
```

### Cambiar calidad HLS
```javascript
hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]'
// hls_time: duración de cada segmento .ts (segundos)
// hls_list_size: cuántos segmentos mantener en playlist
```

## 🐛 Troubleshooting

### Error: "Tu navegador no soporta HLS"
- **Solución**: Usa Chrome, Firefox o Edge modernos
- Safari tiene soporte nativo de HLS

### Video no aparece después de 10 segundos
1. Revisa logs del backend
2. Verifica que FFmpeg esté corriendo:
   ```bash
   ps aux | grep ffmpeg
   ```
3. Verifica archivos HLS:
   ```bash
   ls -la backend/media/live/camera_9/
   ```

### Error de conexión RTSP
- Verifica IP de la cámara: `ping 192.168.8.210`
- Prueba con VLC: `vlc rtsp://admin:galgo2526@192.168.8.210:554/h264Preview_01_main`

### Puerto 8888 ocupado
Cambia el puerto en `backend/src/services/mediaServer.js`:
```javascript
http: {
  port: 9999, // Tu puerto preferido
  ...
}
```

## 📊 Estructura de Archivos

```
backend/
├── recordings/          # Grabaciones MP4
│   └── camera_9/
│       ├── 2025-11-03_000.mp4
│       ├── 2025-11-03_001.mp4
│       └── ...
├── media/              # Archivos HLS temporales
│   └── live/
│       └── camera_9/
│           ├── index.m3u8      # Playlist
│           ├── index0.ts       # Segmento 1
│           ├── index1.ts       # Segmento 2
│           └── index2.ts       # Segmento 3
└── src/
    ├── services/
    │   └── mediaServer.js      # Node Media Server
    └── routes/
        └── media.js            # API endpoints
```

## 🎯 API Endpoints

### Streaming
- `POST /api/media/start/:cameraId` - Iniciar
- `POST /api/media/stop/:cameraId` - Detener
- `GET /api/media/status` - Estado del sistema

### Grabaciones
- `GET /api/media/recordings/:cameraId` - Listar
- `GET /api/media/download/:cameraId/:filename` - Descargar
- `DELETE /api/media/recording/:cameraId/:filename` - Eliminar

## 💡 Tips

1. **Grabaciones grandes**: Los archivos de 1 hora pueden ser ~1-2GB cada uno
2. **Limpieza automática**: Considera agregar un cron job para eliminar videos antiguos
3. **Múltiples cámaras**: Puedes iniciar varias cámaras simultáneamente
4. **Backup**: Las grabaciones están en `backend/recordings/` - haz backups regularmente

## ⚙️ Requisitos del Sistema

- **Node.js**: 18+
- **FFmpeg**: 4.0+
- **RAM**: 2GB+ por cámara activa
- **Disco**: ~50GB por día por cámara (depende de resolución)
- **Red**: 10Mbps+ por cámara

## 📝 Notas

- El primer inicio puede tardar 3-5 segundos en mostrar video
- HLS tiene latencia inherente de 3-5 segundos
- Los segmentos .ts se eliminan automáticamente (solo últimos 3)
- Las grabaciones MP4 se mantienen hasta eliminarlas manualmente
