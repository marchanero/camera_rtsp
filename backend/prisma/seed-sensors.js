import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Sembrando base de datos...')

  // Crear sensores de ejemplo
  const sensors = [
    {
      sensorId: 'temp_001',
      name: 'Sensor Temperatura Lab 1',
      type: 'temperature',
      unit: '°C',
      location: 'Laboratorio 1',
      isActive: true
    },
    {
      sensorId: 'hum_001',
      name: 'Sensor Humedad Lab 1',
      type: 'humidity',
      unit: '%',
      location: 'Laboratorio 1',
      isActive: true
    },
    {
      sensorId: 'co2_001',
      name: 'Sensor CO2 Lab 1',
      type: 'co2',
      unit: 'ppm',
      location: 'Laboratorio 1',
      isActive: true
    },
    {
      sensorId: 'emotibit_001',
      name: 'EmotiBit Usuario 1',
      type: 'emotibit',
      unit: 'mixed',
      location: 'Usuario 1',
      isActive: true,
      config: JSON.stringify({
        sensors: ['heart_rate', 'temperature', 'eda', 'ppg', 'accelerometer']
      })
    }
  ]

  for (const sensorData of sensors) {
    const sensor = await prisma.sensor.upsert({
      where: { sensorId: sensorData.sensorId },
      update: {},
      create: sensorData
    })
    console.log(`✅ Sensor creado: ${sensor.name}`)
  }

  // Crear reglas de ejemplo (asumiendo que existe cámara con id=1)
  const rules = [
    {
      name: 'Alta Temperatura - Activar Grabación',
      description: 'Cuando la temperatura supera 30°C, iniciar grabación',
      sensorId: 1, // temp_001
      condition: JSON.stringify({
        field: 'value',
        operator: '>',
        value: 30
      }),
      action: JSON.stringify({
        type: 'start_recording',
        cameras: [1],
        duration: 300 // 5 minutos
      }),
      isActive: true,
      priority: 10
    },
    {
      name: 'CO2 Alto - Activar Grabación',
      description: 'Cuando el CO2 supera 1000 ppm, iniciar grabación',
      sensorId: 3, // co2_001
      condition: JSON.stringify({
        field: 'value',
        operator: '>',
        value: 1000
      }),
      action: JSON.stringify({
        type: 'start_recording',
        cameras: [1],
        duration: 600 // 10 minutos
      }),
      isActive: true,
      priority: 5
    }
  ]

  for (const ruleData of rules) {
    try {
      const rule = await prisma.recordingRule.create({
        data: ruleData
      })
      console.log(`✅ Regla creada: ${rule.name}`)
    } catch (error) {
      if (error.code === 'P2003') {
        console.log(`⚠️ Saltando regla "${ruleData.name}" - sensor no existe aún`)
      } else {
        throw error
      }
    }
  }

  // Crear configuración MQTT
  const mqttConfig = await prisma.mqttConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      broker: 'mqtt://100.82.84.24:1883',
      username: 'admin',
      password: 'galgo2526',
      clientId: 'camera_rtsp_server',
      isActive: true
    }
  })
  console.log(`✅ Configuración MQTT creada`)

  console.log('✅ Seed completado')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
