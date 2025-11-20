# 📡 Test Publishers - Camera RTSP Sensors

Scripts para simular publicación de datos de sensores IoT vía MQTT para testing de la aplicación Camera RTSP.

## 🚀 Instalación

```bash
cd test_publisher
npm install
```

## 📦 Scripts Disponibles

### 1️⃣ `publish-sensors-multi.js` - Publicador Normal (RECOMENDADO)

Publica datos de 4 sensores de forma continua y realista con **frecuencias variables**.

**Sensores:**
- 🌡️ Temperatura (18-28°C) - **2 segundos**
- 💧 Humedad (40-70%) - **2 segundos**
- 🌫️ CO2 (400-1200 ppm) - **2 segundos**
- 💓 EmotiBit (biométrico completo) - **40ms (25Hz)** ⚡

**EmotiBit - Simulación Realista:**

El EmotiBit ahora simula las frecuencias reales del dispositivo:

- **PPG (Photoplethysmogram)**: 25Hz - Señal de onda cardíaca
- **Heart Rate**: Calculado en tiempo real de la onda PPG
- **EDA (Electrodermal Activity)**: 15Hz - Conductancia de la piel
- **Temperatura corporal**: 7Hz - Muy estable (36-37.5°C)
- **HRV (Heart Rate Variability)**: RMSSD en milisegundos
- **IBI (Inter-Beat Interval)**: Tiempo entre latidos

**Datos publicados por EmotiBit:**
```json
{
  "ppg": 0.847,           // Señal cruda PPG (0.4-1.0)
  "heart_rate": 75,       // BPM calculado
  "eda": 5.23,            // μS (microsiemens)
  "temperature": 36.8,    // °C corporal
  "hrv": 52,              // RMSSD en ms
  "ibi": 800              // ms entre latidos
}
```

**Uso:**
```bash
node publish-sensors-multi.js
```

**Topics generados:**
```
camera_rtsp/sensors/temperature/TEMP001
camera_rtsp/sensors/humidity/HUM001
camera_rtsp/sensors/co2/CO2001
camera_rtsp/sensors/emotibit/EMO001
```

**Características:**

- ✅ Valores realistas con variación gradual
- ✅ Tendencias suaves (no saltos bruscos)
- ✅ **EmotiBit con frecuencia real de 25Hz** (como el dispositivo real)
- ✅ Simulación de onda PPG cardíaca realista
- ✅ HRV (variabilidad cardíaca) calculada en tiempo real
- ✅ Perfecto para testing de reglas de grabación
- ✅ Fácil de seguir en el dashboard

---

### 2️⃣ `publish-sensors-stress.js` - Stress Test

Publica datos de MUCHOS sensores a alta frecuencia para testing de rendimiento.

**Configuración:**
- 5x Temperatura (cada 1s)
- 5x Humedad (cada 1.5s)
- 3x CO2 (cada 2s)
- 2x EmotiBit (cada 500ms)

**Total:** 15 sensores, ~30 mensajes/segundo

**Uso:**
```bash
node publish-sensors-stress.js
```

**Características:**
- ⚡ Alta frecuencia de publicación
- 📊 Estadísticas en tiempo real cada 5s
- 🔥 Prueba límites del sistema
- 💪 Perfecto para testing de carga

---

## 🔧 Configuración

### Editar Credenciales MQTT

Ambos scripts usan estas configuraciones (líneas 13-15):

```javascript
const BROKER_URL = 'mqtt://100.82.84.24:1883'
const USERNAME = 'admin'
const PASSWORD = 'galgo2526'
```

**Si usas un broker diferente:**

1. Abre el script con un editor
2. Modifica `BROKER_URL`, `USERNAME`, `PASSWORD`
3. Guarda y ejecuta

### Personalizar Sensores

**En `publish-sensors-multi.js` (línea 18):**

```javascript
const SENSORS = [
  { id: 'TEMP001', type: 'temperature', name: 'Sensor Temperatura Lab', location: 'Laboratorio', min: 18, max: 28 },
  // Agrega más sensores aquí
  { id: 'TEMP002', type: 'temperature', name: 'Temp Oficina', location: 'Oficina', min: 20, max: 26 },
]
```

**En `publish-sensors-stress.js` (línea 17):**

```javascript
const SENSOR_COUNT = {
  temperature: 10,  // Aumenta el número de sensores por tipo
  humidity: 8,
  co2: 5,
  emotibit: 3
}
```

### Cambiar Intervalos

**Multi (línea 26):**
```javascript
const PUBLISH_INTERVAL = 2000 // ms (2 segundos)
```

**Stress (línea 24):**
```javascript
const INTERVALS = {
  temperature: 1000,  // Cada 1s
  humidity: 1500,     // Cada 1.5s
  co2: 2000,          // Cada 2s
  emotibit: 500       // Cada 500ms
}
```

---

## 📊 Formato de Mensajes

### Sensores normales (temp, humidity, co2):

```json
{
  "sensorId": "TEMP001",
  "timestamp": "2025-11-17T10:30:45.123Z",
  "value": 24.5,
  "location": "Laboratorio",
  "sequence": 42
}
```

### EmotiBit (multi-valor):

```json
{
  "sensorId": "EMO001",
  "timestamp": "2025-11-17T10:30:45.123Z",
  "value": {
    "heart_rate": 75,
    "temperature": 36.8,
    "eda": 5.23
  },
  "location": "Usuario 1",
  "sequence": 43
}
```

---

## 🎯 Testing de Reglas

### Ejemplo: Activar grabación con temperatura alta

1. **Inicia el publicador:**
   ```bash
   node publish-sensors-multi.js
   ```

2. **Crea una regla en el dashboard:**
   - Sensor: `TEMP001`
   - Condición: `value > 25`
   - Acción: `start_recording` en cámara(s)
   - Duración: `300` segundos

3. **Observa:**
   - El publicador generará valores que subirán gradualmente
   - Cuando `value > 25`, la regla se activará
   - La grabación iniciará automáticamente
   - Verás logs en el backend

---

## 🔍 Troubleshooting

### ❌ Error de conexión

```
❌ Error de conexión: connect ECONNREFUSED
```

**Soluciones:**
1. Verifica que EMQX esté corriendo
2. Confirma la IP/puerto del broker
3. Revisa credenciales (usuario/contraseña)
4. Comprueba firewall/conectividad de red

### ⚠️ Mensajes no llegan al dashboard

1. Abre la consola del navegador (F12)
2. Busca errores de WebSocket
3. Verifica que el frontend use: `ws://100.82.84.24:8083/mqtt`
4. Confirma que MQTTContext esté conectado (indicador verde)
5. Revisa que los topics coincidan: `camera_rtsp/sensors/#`

### 📡 Testing de conectividad básica

```bash
# Instala mosquitto-clients (opcional)
brew install mosquitto  # macOS
apt install mosquitto-clients  # Linux

# Suscríbete manualmente
mosquitto_sub -h 100.82.84.24 -p 1883 -u admin -P galgo2526 -t "camera_rtsp/sensors/#" -v

# Publica manualmente
mosquitto_pub -h 100.82.84.24 -p 1883 -u admin -P galgo2526 -t "camera_rtsp/sensors/temperature/TEST" -m '{"value":25}'
```

---

## 📋 Uso Típico

### Durante desarrollo:

```bash
# Terminal 1: Backend
cd backend && npm start

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Publicador
cd test_publisher && node publish-sensors-multi.js
```

### Testing de reglas:

```bash
# Usa el publicador normal para ver activación de reglas
node publish-sensors-multi.js
```

### Testing de carga:

```bash
# Stress test para verificar límites del sistema
node publish-sensors-stress.js
```

---

## 🎨 Personalización Avanzada

### Simular alertas específicas

**Temperatura alta:**
```javascript
// En publish-sensors-multi.js, línea 18
{ id: 'TEMP001', type: 'temperature', name: 'Sensor Temp', location: 'Lab', min: 26, max: 32 },
```

**CO2 crítico:**
```javascript
{ id: 'CO2001', type: 'co2', name: 'Sensor CO2', location: 'Oficina', min: 900, max: 1500 },
```

### Múltiples publishers simultáneos

Ejecuta varios terminales con diferentes configuraciones:

```bash
# Terminal 1: Sensores normales
node publish-sensors-multi.js

# Terminal 2: Stress test adicional
node publish-sensors-stress.js
```

---

## 📝 Logs y Monitoreo

### Salida del publicador normal:

```
✓ [10:30:45] #1 → Sensor Temperatura Lab: 24.5°C
✓ [10:30:45] #2 → Sensor Humedad Lab: 65%
✓ [10:30:45] #3 → Sensor CO2 Lab: 800ppm
✓ [10:30:45] #4 → EmotiBit Usuario 1: HR:75 T:36.8°C EDA:5.23
```

### Salida del stress test:

```
📊 [10:30:50] Total: 150 mensajes (30.2 msg/s)
📊 [10:30:55] Total: 302 mensajes (30.4 msg/s)
```

---

## 🛑 Detener Publishers

Presiona `Ctrl+C` en cualquier momento para detener el publicador.

Se mostrará un resumen:
```
🛑 Deteniendo publicador...
📊 Total de mensajes enviados: 420
✅ Desconectado del broker
```

---

## 💡 Tips

1. **Inicia con el publicador normal** para familiarizarte
2. **Usa stress test solo para pruebas de carga**
3. **Monitorea el dashboard** mientras publicas
4. **Crea reglas** que se activen con los valores simulados
5. **Revisa logs del backend** para ver evaluación de reglas

---

## 🤝 Contribuir

Para agregar nuevos tipos de sensores:

1. Define el tipo en `SENSORS` o `SENSOR_COUNT`
2. Agrega rangos en `RANGES`
3. Implementa lógica de generación si necesaria
4. Actualiza esta documentación

---

## 📚 Recursos

- [MQTT.js Docs](https://github.com/mqttjs/MQTT.js)
- [EMQX Docs](https://www.emqx.io/docs/en/latest/)
- [Backend API](/backend/src/routes/mqtt.js)
- [Frontend Context](/frontend/src/contexts/MQTTContext.jsx)

---

¡Feliz testing! 🚀
