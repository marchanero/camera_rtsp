# 💓 EmotiBit - Frecuencias Realistas Implementadas

## Cambios Realizados

### Publisher Multi-Sensor (`publish-sensors-multi.js`)

Se ha actualizado para simular las **frecuencias reales del dispositivo EmotiBit**:

#### ⚡ Frecuencias por Sensor

| Sensor | Frecuencia | Intervalo | Realismo |
|--------|------------|-----------|----------|
| **Temperatura** | 0.5 Hz | 2000ms | Estándar |
| **Humedad** | 0.5 Hz | 2000ms | Estándar |
| **CO2** | 0.5 Hz | 2000ms | Estándar |
| **EmotiBit** | **25 Hz** | **40ms** | ✨ Alta frecuencia real |

#### 📊 Señales EmotiBit Simuladas

El EmotiBit ahora genera datos biométricos realistas:

**1. PPG (Photoplethysmogram) - 25Hz**
- Señal de onda cardíaca simulada con `sin(phase)`
- Valores normalizados: 0.4 - 1.0
- Fase actualizada en cada muestra para crear onda continua

**2. Heart Rate (BPM) - Derivado en tiempo real**
- Calculado a partir de intervalos entre latidos
- Rango: 60-100 BPM
- Variabilidad natural aplicada (±0.5 BPM por muestra)

**3. EDA (Electrodermal Activity) - 15Hz efectivo**
- Conductancia de la piel: 0-10 μS (microsiemens)
- Correlacionado con patrón de respiración simulado
- Cambios graduales reflejando estados emocionales

**4. Temperatura Corporal - 7Hz efectivo**
- Rango normal: 36.0 - 37.5°C
- Muy estable con pequeñas variaciones (±0.01°C)
- Ligeramente correlacionada con heart rate

**5. Temperatura del Sensor - 7Hz efectivo**
- Temperatura ambiente del dispositivo: 20.0 - 35.0°C
- Refleja temperatura del entorno
- Mayor variabilidad que temperatura corporal

**6. Acelerómetro 3 Ejes - 25Hz**
- **accel_x, accel_y, accel_z** en unidades de g (gravedad)
- Rango: -2.0g a +2.0g (±0.1g en reposo)
- Simula movimiento natural del usuario
- Componente Z incluye gravedad (~1.0g cuando horizontal)
- Permite detectar: movimiento, gestos, caídas, orientación

**7. HRV (Heart Rate Variability)**
- RMSSD calculado en tiempo real
- Rango: 20-100 ms
- Refleja variabilidad natural del ritmo cardíaco

**8. IBI (Inter-Beat Interval)**
- Tiempo entre latidos en milisegundos
- Calculado como: `60000 / heart_rate ± HRV`
- Ejemplo: 75 BPM = ~800ms IBI

## 🔧 Implementación Técnica

### Generación de Señales Fisiológicas

```javascript
// Estado del EmotiBit
const emotibitBuffer = {
  ppg: [],              // Buffer para onda PPG
  eda: 5.0,            // μS base
  temp: 36.5,          // °C corporal base
  heartRate: 75,       // BPM base
  hrv: 50,             // ms variabilidad
  lastBeat: Date.now(),
  beatInterval: 800,   // ms entre latidos
  // Acelerómetro
  accelX: 0,
  accelY: 0,
  accelZ: 1.0,         // Gravedad
  accelVelX: 0,
  accelVelY: 0,
  accelVelZ: 0,
  // Temperatura ambiente
  sensorTemp: 25.0     // °C del dispositivo
}

// Fases de simulación
sensorState[sensor.id] = {
  phase: 0,              // Fase cardíaca (0-2π)
  respirationPhase: 0    // Fase respiratoria (más lenta)
}
```

### Algoritmo de Generación

**Cada 40ms (25Hz):**

1. **Actualizar fase cardíaca**: `phase += 0.1`
2. **Generar onda PPG**: `sin(phase) * 0.3 + 0.7`
3. **Detectar latidos**: Cuando pasa suficiente tiempo según IBI
4. **Actualizar HRV**: Variación natural del IBI
5. **Simular respiración**: Fase lenta que afecta EDA
6. **Calcular temperatura**: Muy estable con micro-variaciones

## 📈 Formato de Datos

### Payload Publicado (cada 40ms para EmotiBit)

```json
{
  "sensorId": "EMO001",
  "timestamp": "2025-11-17T14:30:45.123Z",
  "value": {
    "ppg": 0.847,                 // Señal cruda normalizada
    "heart_rate": 75,             // BPM actual
    "eda": 5.23,                  // μS conductancia
    "temperature": 36.8,          // °C corporal
    "sensor_temperature": 25.3,   // °C del dispositivo
    "accel_x": 0.023,            // g aceleración X
    "accel_y": -0.015,           // g aceleración Y
    "accel_z": 1.012,            // g aceleración Z (gravedad)
    "hrv": 52,                   // ms RMSSD
    "ibi": 800                   // ms entre latidos
  },
  "location": "Usuario 1",
  "sequence": 12345
}
```

### Topic MQTT

```
camera_rtsp/sensors/emotibit/EMO001
```

Publicado **25 veces por segundo** (cada 40ms)

## 🎨 Visualización Frontend

El dashboard ahora muestra:

```
💓 EmotiBit Usuario 1

     75 bpm
     ▔▔▔▔▔▔

🌡️ Body: 36.8°C    Sensor: 25.3°C
⚡ EDA: 5.23μS      📈 PPG: 0.847
💚 HRV: 52ms        🏃 Accel: 1.0g
```

**Componentes visualizados:**

- Heart Rate: Grande y prominente
- Temperatura Corporal: Con precisión de 0.1°C
- Temperatura Sensor: Temperatura ambiente del dispositivo
- EDA: Conductancia en microsiemens
- HRV: Variabilidad cardíaca
- PPG: Valor de señal cruda (opcional, para debugging)
- Acelerómetro: Magnitud total (√(x²+y²+z²))

## 🧪 Testing

### Iniciar Publisher

```bash
cd test_publisher
node start.js
# Opción 1: Multi-Sensor
```

### Observar en Dashboard

1. Ve a tab **Sensores**
2. Tarjeta de EmotiBit se actualizará **25 veces por segundo**
3. Verás cambios fluidos en heart rate, PPG, EDA

### Consola (Logs)

```
✓ [14:30:45] #1234 → EmotiBit Usuario 1: HR:75bpm PPG:0.847 EDA:5.23μS T:36.8°C HRV:52ms
✓ [14:30:45] #1235 → EmotiBit Usuario 1: HR:75bpm PPG:0.912 EDA:5.24μS T:36.8°C HRV:51ms
✓ [14:30:45] #1236 → EmotiBit Usuario 1: HR:76bpm PPG:0.956 EDA:5.22μS T:36.8°C HRV:53ms
...
```

**Nota:** EmotiBit genera ~25 mensajes por segundo, mientras temperatura/humedad/CO2 solo generan 1 mensaje cada 2 segundos.

## 📊 Estadísticas de Mensajes

### Publicación por Segundo

- Temperatura: **0.5 msg/s**
- Humedad: **0.5 msg/s**
- CO2: **0.5 msg/s**
- **EmotiBit: 25 msg/s** ⚡

**Total:** ~26.5 mensajes/segundo

### Volumen de Datos

**EmotiBit en 1 minuto:**
- Mensajes: 1,500
- Datos: ~225 KB (150 bytes/msg promedio)

**Todos los sensores en 1 minuto:**
- Mensajes: 1,590
- EmotiBit representa el **94%** del tráfico

## ⚙️ Configuración Avanzada

### Cambiar Frecuencia EmotiBit

Edita `publish-sensors-multi.js` línea 47:

```javascript
{ 
  id: 'EMO001', 
  type: 'emotibit', 
  name: 'EmotiBit Usuario 1', 
  location: 'Usuario 1', 
  min: 60, 
  max: 100,
  interval: 40, // 25Hz - CAMBIAR AQUÍ
}
```

**Opciones:**
- `40` → 25Hz (real EmotiBit)
- `100` → 10Hz (reducido)
- `200` → 5Hz (muy reducido)
- `1000` → 1Hz (testing)

### Ajustar Parámetros Fisiológicos

Edita líneas 69-76:

```javascript
const emotibitBuffer = {
  heartRate: 75,       // BPM inicial (60-100)
  hrv: 50,             // Variabilidad ms (20-100)
  eda: 5.0,            // EDA base μS (0-10)
  temp: 36.5,          // Temp base °C (36-37.5)
  beatInterval: 800    // IBI inicial ms
}
```

## 🎯 Casos de Uso

### 1. Testing de Reglas con EmotiBit

Crear regla: **"Si heart_rate > 90 → grabar"**

```javascript
{
  "sensorId": 1,  // EMO001
  "condition": {
    "field": "value.heart_rate",
    "operator": ">",
    "value": 90
  },
  "action": {
    "type": "start_recording",
    "cameras": [1, 2],
    "duration": 300
  }
}
```

### 2. Monitoreo de Alta Frecuencia

El EmotiBit es perfecto para:
- Detectar arritmias
- Análisis de HRV en tiempo real
- Respuesta emocional a estímulos
- Correlación con eventos de cámara

### 3. Stress Test del Sistema

Con 25Hz, el EmotiBit prueba:
- Capacidad de MQTT broker
- Rendimiento del backend
- Actualización UI en tiempo real
- Procesamiento de reglas a alta frecuencia

## 🔍 Debugging

### Ver Onda PPG en Tiempo Real

Usa el campo `ppg` para graficar la señal:

```javascript
// En el dashboard, agregar gráfico
const ppgValues = messages
  .filter(m => m.topic.includes('emotibit'))
  .map(m => m.value.ppg)
```

### Verificar Frecuencia Real

En backend, agregar contador:

```javascript
let emotibitCount = 0
let lastCheck = Date.now()

mqttService.on('sensor-data', (data) => {
  if (data.type === 'emotibit') {
    emotibitCount++
    
    if (Date.now() - lastCheck >= 1000) {
      console.log(`EmotiBit rate: ${emotibitCount} msg/s`)
      emotibitCount = 0
      lastCheck = Date.now()
    }
  }
})
```

## 📚 Referencias

- [EmotiBit Specifications](https://www.emotibit.com/specs)
- [PPG Signal Processing](https://en.wikipedia.org/wiki/Photoplethysmogram)
- [Heart Rate Variability](https://en.wikipedia.org/wiki/Heart_rate_variability)
- [EDA/GSR Measurement](https://en.wikipedia.org/wiki/Electrodermal_activity)

---

✨ **EmotiBit ahora simula frecuencias reales del dispositivo (25Hz) con señales fisiológicas realistas**
