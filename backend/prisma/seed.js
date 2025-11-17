import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Sembrando base de datos...')
  
  // Limpiar datos existentes
  await prisma.streamLog.deleteMany({})
  await prisma.scenario.deleteMany({})
  await prisma.camera.deleteMany({})
  
  // Crear cámaras
  const camera1 = await prisma.camera.create({
    data: {
      name: 'Cámara Principal',
      rtspUrl: 'rtsp://admin:galgo2526@192.168.8.210:554/h264Preview_01_main',
      description: 'Cámara principal del sistema',
      isActive: true
    }
  })
  
  const camera2 = await prisma.camera.create({
    data: {
      name: 'Cámara Secundaria',
      rtspUrl: 'rtsp://admin:password@192.168.8.211:554/stream',
      description: 'Cámara de respaldo',
      isActive: false
    }
  })
  
  console.log('✅ Cámaras creadas:')
  console.log(camera1)
  console.log(camera2)
  
  // Crear escenarios de ejemplo
  const scenario1 = await prisma.scenario.create({
    data: {
      name: 'Aula 101 - Matemáticas',
      description: 'Configuración para clase de matemáticas en aula 101',
      active: true,
      cameras: JSON.stringify([camera1.id]),
      sensors: JSON.stringify(['sensor_temp_101', 'sensor_co2_101', 'sensor_hum_101']),
      thresholds: JSON.stringify({
        temperatura: { min: 18, max: 24, alertEnabled: true },
        humedad: { min: 30, max: 60, alertEnabled: true },
        co2: { min: 400, max: 1000, alertEnabled: true },
        ruido: { min: 30, max: 65, alertEnabled: true },
        luz: { min: 200, max: 800, alertEnabled: true }
      })
    }
  })
  
  const scenario2 = await prisma.scenario.create({
    data: {
      name: 'Aula 102 - Ciencias',
      description: 'Configuración para laboratorio de ciencias',
      active: false,
      cameras: JSON.stringify([camera1.id, camera2.id]),
      sensors: JSON.stringify(['sensor_temp_102', 'sensor_co2_102', 'sensor_voc_102', 'sensor_gases_102']),
      thresholds: JSON.stringify({
        temperatura: { min: 16, max: 22, alertEnabled: true },
        humedad: { min: 35, max: 65, alertEnabled: true },
        co2: { min: 400, max: 800, alertEnabled: true },
        voc: { min: 0, max: 400, alertEnabled: true },
        'gases/no2': { min: 0, max: 0.15, alertEnabled: true },
        'gases/so2': { min: 0, max: 0.08, alertEnabled: true }
      })
    }
  })
  
  const scenario3 = await prisma.scenario.create({
    data: {
      name: 'Sala de Conferencias',
      description: 'Monitorización de sala de conferencias principal',
      active: false,
      cameras: JSON.stringify([camera1.id]),
      sensors: JSON.stringify(['sensor_temp_conf', 'sensor_co2_conf', 'sensor_ruido_conf', 'sensor_emotibit_conf']),
      thresholds: JSON.stringify({
        temperatura: { min: 19, max: 23, alertEnabled: true },
        humedad: { min: 40, max: 60, alertEnabled: true },
        co2: { min: 400, max: 1200, alertEnabled: true },
        ruido: { min: 35, max: 70, alertEnabled: true },
        emotibit: { min: 60, max: 95, alertEnabled: true }
      })
    }
  })
  
  console.log('✅ Escenarios creados:')
  console.log(scenario1)
  console.log(scenario2)
  console.log(scenario3)
  
  // Crear algunos logs de ejemplo
  await prisma.streamLog.create({
    data: {
      cameraId: camera1.id,
      status: 'success',
      message: 'Stream iniciado correctamente'
    }
  })
  
  console.log('✅ Base de datos sembrada correctamente')
  console.log(`   - ${2} cámaras`)
  console.log(`   - ${3} escenarios`)
  console.log(`   - ${1} log de stream`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
