#!/usr/bin/env node

/**
 * Script para iniciar servidor RTSP con streaming de cámara
 * Uso: node start-camera-stream.js
 */

const RTSPStreamService = require('./src/services/rtsp-stream.service');
const rtspConfig = require('./src/config/rtsp.config');

const cameraConfig = {
  id: 1,
  name: 'Galgo School Camera',
  ip: '192.168.8.210',
  port: 554,
  username: 'admin',
  password: 'galgo2526',
  path: '/Preview_01_main'
};

async function startCameraStream() {
  console.log('\n🎥 INICIANDO STREAMING DE CÁMARA\n');

  try {
    // Inicializar directorio de salida
    await RTSPStreamService.initializeOutputDir();
    console.log('✅ Directorio de salida inicializado\n');

    // Iniciar stream
    console.log('🚀 Iniciando stream...\n');
    const result = await RTSPStreamService.startStream(
      cameraConfig.id,
      cameraConfig,
      { quality: 'medium' }
    );

    if (result.success) {
      console.log('✅ Stream iniciado exitosamente!');
      console.log(`   HLS URL: ${result.hlsUrl}`);
      console.log(`   Quality: ${result.quality}`);
      console.log(`   Acceder en: http://localhost:3000${result.hlsUrl}\n`);

      // Escuchar eventos
      RTSPStreamService.on('stream:connected', (data) => {
        console.log(`✅ [EVENTO] Stream conectado:`, data);
      });

      RTSPStreamService.on('stream:reconnecting', (data) => {
        console.log(`⚠️  [EVENTO] Reconectando (intento ${data.attempt}/${data.maxAttempts})`);
      });

      RTSPStreamService.on('stream:error', (data) => {
        console.log(`❌ [EVENTO] Error en stream:`, data);
      });

      RTSPStreamService.on('stream:failed', (data) => {
        console.log(`❌ [EVENTO] Stream falló:`, data);
      });

      // Mostrar estado cada 10 segundos
      setInterval(() => {
        const status = RTSPStreamService.getStreamStatus(cameraConfig.id);
        if (status) {
          console.log(`📊 Estado: ${status.status} | Uptime: ${Math.floor(status.uptime / 1000)}s | Intentos: ${status.attempts}`);
        }
      }, 10000);

      console.log('⏸️  Presione Ctrl+C para detener el stream\n');

      // Manejo de SIGINT
      process.on('SIGINT', async () => {
        console.log('\n🛑 Deteniendo stream...');
        const stopResult = await RTSPStreamService.stopStream(cameraConfig.id);
        if (stopResult.success) {
          console.log('✅ Stream detenido');
        }
        process.exit(0);
      });

    } else {
      console.log('❌ Error al iniciar stream');
      console.log(result);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

startCameraStream();
