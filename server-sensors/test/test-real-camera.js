#!/usr/bin/env node

/**
 * Script para probar conexión a cámara RTSP real
 * Uso: node test-real-camera.js
 */

const RTSPService = require('../src/services/rtsp.service');
const rtspConfig = require('../src/config/rtsp.config');

const cameraConfig = {
  name: 'Galgo School Camera',
  ip: '192.168.8.210',
  port: 554,
  username: 'admin',
  password: 'galgo2526',
  path: '/h264Preview_01_main'
};

async function testCamera() {
  console.log('🎥 Iniciando pruebas de conexión a cámara RTSP\n');
  console.log('📋 Configuración de cámara:');
  console.log(`   IP: ${cameraConfig.ip}`);
  console.log(`   Puerto: ${cameraConfig.port}`);
  console.log(`   Usuario: ${cameraConfig.username}`);
  console.log(`   Ruta: ${cameraConfig.path}\n`);

  // 1. Validar configuración
  console.log('1️⃣  Validando configuración...');
  const validation = rtspConfig.validateCameraConfig(cameraConfig);
  if (validation.isValid) {
    console.log('   ✅ Configuración válida\n');
  } else {
    console.log('   ❌ Configuración inválida:');
    validation.errors.forEach(error => console.log(`      - ${error}`));
    process.exit(1);
  }

  // 2. Construir URL RTSP
  console.log('2️⃣  Construyendo URL RTSP...');
  const rtspUrl = RTSPService.buildRTSPUrl(cameraConfig);
  console.log(`   ✅ URL: ${rtspUrl}\n`);

  // 3. Probar conexión
  console.log('3️⃣  Probando conexión RTSP (timeout: 10s)...');
  try {
    const connectionResult = await RTSPService.testRTSPConnection(cameraConfig);
    
    if (connectionResult.success) {
      console.log('   ✅ Conexión exitosa!');
      console.log(`   Status: ${connectionResult.status}`);
      console.log(`   Mensaje: ${connectionResult.message}\n`);
    } else {
      console.log('   ⚠️  Conexión no exitosa');
      console.log(`   Status: ${connectionResult.status}`);
      console.log(`   Mensaje: ${connectionResult.message}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // 4. Obtener información del stream
  console.log('4️⃣  Obteniendo información del stream (timeout: 10s)...');
  try {
    const streamInfo = await RTSPService.getStreamInfo(cameraConfig);
    
    if (streamInfo.success) {
      console.log('   ✅ Información obtenida:');
      console.log(`   ${JSON.stringify(streamInfo.stream_info, null, 2)}\n`);
    } else {
      console.log('   ⚠️  No se pudo obtener información');
      console.log(`   Mensaje: ${streamInfo.message}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // 5. Mostrar configuración de FFmpeg
  console.log('5️⃣  Configuración de FFmpeg para la cámara:');
  const ffmpegArgs = rtspConfig.buildFFmpegArgs(rtspUrl, '/tmp/camera.m3u8', 'medium');
  console.log(`   Argumentos: ${ffmpegArgs.join(' ')}\n`);

  console.log('✅ Pruebas completadas');
}

testCamera().catch(error => {
  console.error('❌ Error durante las pruebas:', error);
  process.exit(1);
});
