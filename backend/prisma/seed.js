import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Sembrando base de datos...')
  
  // Limpiar datos existentes
  await prisma.streamLog.deleteMany({})
  await prisma.camera.deleteMany({})
  
  // Crear cámara
  const camera1 = await prisma.camera.create({
    data: {
      name: 'Cámara Principal',
      rtspUrl: 'rtsp://admin:galgo2526@192.168.8.210:554/h264Preview_01_main',
      description: 'Cámara principal del sistema',
      isActive: true
    }
  })
  
  console.log('✅ Cámara creada:')
  console.log(camera1)
  
  // Crear algunos logs de ejemplo
  await prisma.streamLog.create({
    data: {
      cameraId: camera1.id,
      status: 'success',
      message: 'Stream iniciado correctamente'
    }
  })
  
  console.log('✅ Base de datos sembrada correctamente')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
