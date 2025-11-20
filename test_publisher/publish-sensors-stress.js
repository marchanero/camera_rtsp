#!/usr/bin/env node

/**
 * PUBLICADOR STRESS TEST - ALTA FRECUENCIA
 * 
 * Publica datos de MUCHOS sensores a alta frecuencia
 * para probar rendimiento y reglas de grabación
 */

const mqtt = require('mqtt')

const BROKER_URL = 'mqtt://100.82.84.24:1883'
const USERNAME = 'admin'
const PASSWORD = 'galgo2526'

// Número de sensores de cada tipo
const SENSOR_COUNT = {
  temperature: 5,
  humidity: 5,
  co2: 3,
  emotibit: 2
}

// Intervalos diferentes por tipo (ms)
const INTERVALS = {
  temperature: 1000,  // Cada 1s
  humidity: 1500,     // Cada 1.5s
  co2: 2000,         // Cada 2s
  emotibit: 500      // Cada 500ms (más frecuente)
}

// Rangos por tipo
const RANGES = {
  temperature: { min: 15, max: 35, unit: '°C' },
  humidity: { min: 30, max: 80, unit: '%' },
  co2: { min: 350, max: 2000, unit: 'ppm' },
  emotibit: { min: 55, max: 120, unit: 'bpm' }
}

const LOCATIONS = ['Lab A', 'Lab B', 'Oficina', 'Sala 1', 'Pasillo']

let messageCount = 0
let client = null
const sensorState = {}
const intervals = []

function generateSensors() {
  const sensors = []
  
  Object.entries(SENSOR_COUNT).forEach(([type, count]) => {
    for (let i = 1; i <= count; i++) {
      const id = `${type.toUpperCase().substring(0, 3)}${String(i).padStart(3, '0')}`
      const range = RANGES[type]
      
      sensors.push({
        id,
        type,
        name: `${type} #${i}`,
        location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
        ...range
      })
      
      // Estado inicial
      sensorState[id] = {
        value: (range.min + range.max) / 2,
        trend: 0
      }
    }
  })
  
  return sensors
}

function updateValue(sensor) {
  const state = sensorState[sensor.id]
  const range = sensor.max - sensor.min
  
  // Cambiar tendencia ocasionalmente
  if (Math.random() < 0.15) {
    state.trend = (Math.random() - 0.5) * (range * 0.15)
  }
  
  // Aplicar tendencia con ruido
  state.value += state.trend + (Math.random() - 0.5) * (range * 0.08)
  
  // Mantener en rango con rebote
  if (state.value < sensor.min) {
    state.value = sensor.min
    state.trend = Math.abs(state.trend)
  } else if (state.value > sensor.max) {
    state.value = sensor.max
    state.trend = -Math.abs(state.trend)
  }
  
  return Math.round(state.value * 10) / 10
}

function generateEmotiBitData(sensor) {
  const heartRate = updateValue(sensor)
  
  // Acelerómetro con movimiento simulado
  const accelX = (Math.random() - 0.5) * 0.5
  const accelY = (Math.random() - 0.5) * 0.5
  const accelZ = 1.0 + (Math.random() - 0.5) * 0.2 // Gravedad ±0.1g
  
  // Temperatura corporal correlacionada con frecuencia cardíaca
  const bodyTemp = 36.0 + (heartRate - 75) * 0.015
  
  // Temperatura del sensor (ambiente)
  const sensorTemp = 20.0 + Math.random() * 10
  
  return {
    heart_rate: Math.round(heartRate),
    ppg: Math.round((Math.sin(Date.now() / 40) * 0.3 + 0.7) * 1000) / 1000,
    eda: Math.round(Math.random() * 10 * 100) / 100,
    temperature: Math.round(bodyTemp * 10) / 10,
    sensor_temperature: Math.round(sensorTemp * 10) / 10,
    accel_x: Math.round(accelX * 1000) / 1000,
    accel_y: Math.round(accelY * 1000) / 1000,
    accel_z: Math.round(accelZ * 1000) / 1000,
    hrv: Math.round(30 + Math.random() * 50),
    ibi: Math.round(60000 / heartRate)
  }
}

function publishSensor(sensor) {
  const topic = `camera_rtsp/sensors/${sensor.type}/${sensor.id}`
  
  const payload = {
    sensorId: sensor.id,
    timestamp: new Date().toISOString(),
    value: sensor.type === 'emotibit' ? generateEmotiBitData(sensor) : updateValue(sensor),
    location: sensor.location,
    sequence: ++messageCount
  }
  
  client.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
    if (err) {
      console.error(`❌ ${sensor.id}:`, err.message)
    }
  })
}

// Iniciar
console.log('\n' + '='.repeat(70))
console.log('  ⚡ PUBLICADOR STRESS TEST - ALTA FRECUENCIA')
console.log('='.repeat(70))

const sensors = generateSensors()
console.log(`\n📊 Generando ${sensors.length} sensores virtuales:`)
Object.entries(SENSOR_COUNT).forEach(([type, count]) => {
  console.log(`  • ${count}x ${type} (cada ${INTERVALS[type]}ms)`)
})

console.log(`\n🔗 Conectando a ${BROKER_URL}...`)

client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clean: true,
  clientId: `stress-test-${Date.now()}`,
  reconnectPeriod: 5000
})

client.on('connect', () => {
  console.log('✅ Conectado al broker')
  console.log('⚡ Iniciando publicación de alta frecuencia...\n')
  
  // Agrupar sensores por tipo para diferentes intervalos
  const sensorsByType = {}
  sensors.forEach(sensor => {
    if (!sensorsByType[sensor.type]) {
      sensorsByType[sensor.type] = []
    }
    sensorsByType[sensor.type].push(sensor)
  })
  
  // Iniciar intervalo por tipo
  Object.entries(sensorsByType).forEach(([type, typeSensors]) => {
    const interval = setInterval(() => {
      typeSensors.forEach(sensor => publishSensor(sensor))
    }, INTERVALS[type])
    intervals.push(interval)
  })
  
  // Mostrar estadísticas cada 5 segundos
  const statsInterval = setInterval(() => {
    const rate = messageCount / ((Date.now() - startTime) / 1000)
    console.log(`📊 [${new Date().toLocaleTimeString()}] Total: ${messageCount} mensajes (${rate.toFixed(1)} msg/s)`)
  }, 5000)
  intervals.push(statsInterval)
  
  const startTime = Date.now()
  
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Deteniendo stress test...')
    const duration = (Date.now() - startTime) / 1000
    console.log(`\n📊 Estadísticas finales:`)
    console.log(`  • Total mensajes: ${messageCount}`)
    console.log(`  • Duración: ${duration.toFixed(1)}s`)
    console.log(`  • Tasa promedio: ${(messageCount / duration).toFixed(1)} msg/s`)
    
    intervals.forEach(clearInterval)
    client.end(false, () => {
      console.log('✅ Desconectado\n')
      process.exit(0)
    })
  })
})

client.on('error', (error) => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
