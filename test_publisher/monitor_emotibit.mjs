#!/usr/bin/env node
/**
 * MONITOR DE EMOTIBIT REAL
 * 
 * Suscribe al topic del EmotiBit y muestra los mensajes recibidos
 * Topic: ETSIIAB/emotibit/0CDC7ECC5F10/#
 */

import mqtt from 'mqtt';

// Configuración - Ajustar según tu broker
const BROKER_URL = process.env.MQTT_BROKER || 'mqtt://100.82.84.24:1883';
const USERNAME = process.env.MQTT_USERNAME || 'admin';
const PASSWORD = process.env.MQTT_PASSWORD || 'galgo2526';

// Topic del EmotiBit real
const EMOTIBIT_TOPIC = 'ETSIIAB/emotibit/0CDC7ECC5F10/#';

// Estadísticas
const stats = {
  connected: false,
  messagesReceived: 0,
  topicsDetected: new Set(),
  startTime: Date.now()
};

console.log('\n' + '='.repeat(70));
console.log('  📡 MONITOR EMOTIBIT REAL');
console.log('='.repeat(70));
console.log(`\n🔗 Conectando a ${BROKER_URL}...`);
console.log(`📋 Topic: ${EMOTIBIT_TOPIC}\n`);

const client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clientId: `emotibit-monitor-${Date.now()}`
});

client.on('connect', () => {
  stats.connected = true;
  console.log('✅ Conectado al broker MQTT');
  
  client.subscribe(EMOTIBIT_TOPIC, { qos: 1 }, (err, granted) => {
    if (err) {
      console.error('❌ Error suscribiendo:', err.message);
      return;
    }
    console.log(`✅ Suscrito a: ${EMOTIBIT_TOPIC}`);
    console.log('\n⏳ Esperando mensajes del EmotiBit...');
    console.log('   (Si no llegan mensajes, verifica que el EmotiBit esté encendido y conectado)');
    console.log('   Presiona Ctrl+C para detener\n');
    console.log('-'.repeat(70));
  });
});

client.on('message', (topic, message) => {
  stats.messagesReceived++;
  stats.topicsDetected.add(topic);
  
  const timestamp = new Date().toLocaleTimeString();
  let payload;
  
  try {
    payload = JSON.parse(message.toString());
  } catch {
    payload = message.toString();
  }
  
  // Mostrar mensaje formateado
  console.log(`\n📨 [${timestamp}] #${stats.messagesReceived}`);
  console.log(`   Topic: ${topic}`);
  
  if (typeof payload === 'object') {
    console.log('   Payload (JSON):');
    for (const [key, value] of Object.entries(payload)) {
      console.log(`     • ${key}: ${JSON.stringify(value)}`);
    }
  } else {
    console.log(`   Payload (raw): ${payload}`);
  }
});

client.on('error', (err) => {
  console.error('\n❌ Error MQTT:', err.message);
});

client.on('close', () => {
  console.log('\n🔌 Conexión cerrada');
});

// Mostrar resumen cada 30 segundos
setInterval(() => {
  if (stats.messagesReceived > 0) {
    const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
    const rate = (stats.messagesReceived / elapsed).toFixed(2);
    console.log('\n' + '-'.repeat(70));
    console.log(`📊 Resumen: ${stats.messagesReceived} mensajes en ${elapsed}s (${rate} msg/s)`);
    console.log(`   Topics detectados: ${Array.from(stats.topicsDetected).join(', ')}`);
    console.log('-'.repeat(70));
  }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Deteniendo monitor...');
  console.log('\n📊 RESUMEN FINAL:');
  console.log(`   Mensajes recibidos: ${stats.messagesReceived}`);
  console.log(`   Topics detectados: ${stats.topicsDetected.size}`);
  if (stats.topicsDetected.size > 0) {
    console.log('   Lista de topics:');
    stats.topicsDetected.forEach(t => console.log(`     • ${t}`));
  }
  console.log('='.repeat(70) + '\n');
  client.end();
  process.exit(0);
});
