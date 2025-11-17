// RTSP Stream Service Test
// Prueba básica del servicio de streaming RTSP

const rtspStreamService = require('./src/services/rtsp-stream.service');
const cameraService = require('./src/services/camera.service');

async function testStreamService() {
  console.log('🧪 Iniciando pruebas del servicio RTSP Stream...\n');

  try {
    // 1. Crear una cámara de prueba
    console.log('1️⃣  Creando cámara de prueba...');
    const camera = await cameraService.addCamera({
      name: 'Test Camera',
      ip: '192.168.1.100',
      port: 554,
      username: 'admin',
      password: 'password',
      path: '/stream',
      protocol: 'rtsp'
    });
    console.log('✅ Cámara creada:', camera);

    // 2. Iniciar stream
    console.log('\n2️⃣  Iniciando stream...');
    const streamResult = await rtspStreamService.startStream(camera.id, camera);
    console.log('✅ Stream iniciado:', streamResult);

    // 3. Monitorear eventos
    console.log('\n3️⃣  Monitoreando eventos del stream...');

    rtspStreamService.on('stream:connected', ({ cameraId, hlsUrl }) => {
      console.log(`✅ [Evento] Stream conectado para cámara ${cameraId}`);
      console.log(`   HLS URL: ${hlsUrl}`);
    });

    rtspStreamService.on('stream:reconnecting', ({ cameraId, attempt, maxAttempts }) => {
      console.log(`🔄 [Evento] Reconectando cámara ${cameraId} (intento ${attempt}/${maxAttempts})`);
    });

    rtspStreamService.on('stream:failed', ({ cameraId, attempts, error }) => {
      console.log(`❌ [Evento] Stream falló para cámara ${cameraId} después de ${attempts} intentos`);
      console.log(`   Error: ${error}`);
    });

    rtspStreamService.on('stream:error', ({ cameraId, error }) => {
      console.log(`⚠️  [Evento] Error en stream de cámara ${cameraId}: ${error}`);
    });

    // 4. Obtener estado
    console.log('\n4️⃣  Obteniendo estado del stream...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos

    const status = rtspStreamService.getStreamStatus(camera.id);
    console.log('✅ Estado del stream:', status);

    // 5. Obtener estado de todos los streams
    console.log('\n5️⃣  Obteniendo estado de todos los streams...');
    const allStatus = rtspStreamService.getStreamStatus();
    console.log('✅ Todos los streams:', allStatus);

    // 6. Detener stream
    console.log('\n6️⃣  Deteniendo stream...');
    const stopResult = await rtspStreamService.stopStream(camera.id);
    console.log('✅ Stream detenido:', stopResult);

    // 7. Limpiar
    console.log('\n7️⃣  Limpiando...');
    await cameraService.deleteCamera(camera.id);
    console.log('✅ Cámara de prueba eliminada');

    console.log('\n✨ Pruebas completadas exitosamente!');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
    process.exit(1);
  }
}

// Ejecutar pruebas
if (require.main === module) {
  testStreamService().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = { testStreamService };
