# 🔧 Solución: Procesos Zombies FFmpeg

## ⚠️ Problema Identificado

El uso de `node --watch` (desarrollo con auto-reload) causa que:
1. Cada vez que se reinicia el backend, se crean nuevos procesos FFmpeg
2. Los procesos antiguos NO se matan correctamente
3. Resultado: Múltiples procesos FFmpeg duplicados grabando la misma cámara
4. Consumo excesivo de recursos y pérdida de estado en frontend

## ✅ Solución Implementada

### 1. Limpieza Automática al Iniciar

El backend ahora limpia procesos huérfanos automáticamente:
```javascript
// En mediaServer.js
async killOrphanProcesses() {
  // Busca y mata procesos FFmpeg huérfanos
  // Se ejecuta ANTES de iniciar nuevas grabaciones
}
```

### 2. Prevención de Duplicados

Auto-start ahora verifica si ya hay grabación activa:
```javascript
// En index.js
if (mediaServerManager.isRecording(camera.id)) {
  console.log(`⏭️ Grabación ya activa: ${camera.name} (omitiendo)`)
  continue
}
```

### 3. Script de Inicio Seguro

**USO RECOMENDADO EN DESARROLLO:**
```bash
# En lugar de: npm run dev
# Usar:
./start-safe.sh

# O añadir al package.json:
"dev:safe": "bash start-safe.sh"
```

## 🚀 Cómo Usar

### Opción 1: Script Seguro (Recomendado)
```bash
cd backend
./start-safe.sh
```

### Opción 2: Limpieza Manual
```bash
# 1. Limpiar procesos zombies
pkill -f "ffmpeg.*recordings"
pkill -f "node.*index.js"

# 2. Iniciar backend SIN --watch
npm start
```

### Opción 3: Desarrollo con --watch (Requiere limpieza manual periódica)
```bash
npm run dev
# NOTA: Cada vez que el backend se reinicie, los procesos FFmpeg anteriores
# quedarán huérfanos. Necesitarás limpiarlos manualmente.
```

## 📊 Verificar Estado

### Ver procesos FFmpeg activos:
```bash
ps aux | grep ffmpeg | grep recordings | grep -v grep
```

### Contar procesos zombies:
```bash
ps aux | grep ffmpeg | grep recordings | grep -v grep | wc -l
# Debería ser 0 o el número de cámaras grabando activamente
```

### Verificar backend:
```bash
ps aux | grep "node.*index" | grep -v grep
# Debería haber SOLO 1 proceso Node
```

## 🔍 Debugging

### Si el frontend pierde el estado:
1. Abrir DevTools Console
2. Buscar mensajes: `🔄 Sync status camera X`
3. Verificar que backend responde correctamente
4. Comprobar localStorage: `localStorage.getItem('recordingState')`

### Si las grabaciones no inician:
1. Verificar procesos: `ps aux | grep ffmpeg`
2. Ver logs del backend: buscar mensajes de inicio de grabación
3. Comprobar que no hay duplicados: `isRecording()` devuelve true
4. Verificar que la cámara es accesible: `curl <RTSP_URL>`

## 📝 Logs Importantes

```
✅ No hay procesos FFmpeg huérfanos
✅ Grabación iniciada: Cámara Principal
⏭️ Grabación ya activa: Cámara X (omitiendo)
🧹 Proceso FFmpeg 12345 terminado
```

## ⚡ Mejoras Futuras

- [ ] PM2 o nodemon con configuración correcta de limpieza
- [ ] Health check que mate procesos zombies automáticamente
- [ ] Dashboard de procesos activos
- [ ] Alertas si hay más de N procesos FFmpeg por cámara
