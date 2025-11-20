#!/usr/bin/env node

/**
 * Script de prueba para verificar si los mensajes MQTT se reciben correctamente
 * en el navegador desde el broker EMQX.
 * 
 * Este script:
 * 1. Se conecta al broker EMQX
 * 2. Publica mensajes de prueba
 * 3. Muestra estadísticas de publicación
 * 4. Proporciona instrucciones para verificar que se reciben en el navegador
 */

const mqtt = require('mqtt')

const BROKER_URL = 'mqtt://localhost:1883'
const WEB_BROKER_URL = 'ws://localhost:8083/mqtt'
const USERNAME = 'emqx_user'
const PASSWORD = 'emqx_password'

const testTopics = [
  'sensors/temperature',
  'sensors/humidity',
  'sensors/pressure',
  'sensors/voltage',
  'test/message'
]

let messageCount = 0
const client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clean: true,
  clientId: `test-publisher-${Date.now()}`
})

client.on('connect', () => {
  console.log('\n✅ Conectado al broker EMQX')
  console.log(`📍 Broker: ${BROKER_URL}`)
  console.log(`🌐 WebSocket: ${WEB_BROKER_URL}`)
  console.log('\n📤 Iniciando publicación de mensajes de prueba...\n')

  // Publicar mensajes en bucle
  const publishInterval = setInterval(() => {
    const topic = testTopics[Math.floor(Math.random() * testTopics.length)]
    const payload = {
      timestamp: new Date().toISOString(),
      value: Math.random() * 100,
      unit: topic.includes('temperature') ? '°C' : 
            topic.includes('humidity') ? '%' :
            topic.includes('pressure') ? 'hPa' :
            topic.includes('voltage') ? 'V' : 'units',
      deviceId: `device-${Math.floor(Math.random() * 5) + 1}`,
      sequence: messageCount + 1
    }

    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ Error publicando en ${topic}:`, err.message)
      } else {
        messageCount++
        console.log(`✓ [${new Date().toLocaleTimeString()}] Publicado #${messageCount} en ${topic}`)
        console.log(`  Payload: ${JSON.stringify(payload)}`)
      }
    })
  }, 2000)

  // Detener después de 30 segundos
  setTimeout(() => {
    clearInterval(publishInterval)
    console.log('\n\n📊 Resumen:')
    console.log(`✓ Mensajes publicados: ${messageCount}`)
    console.log('\n🔍 Para verificar que se reciben en el navegador:')
    console.log('1. Abre http://localhost:5173 en tu navegador')
    console.log('2. Ve a la sección "Monitor de Mensajes MQTT"')
    console.log('3. Selecciona un tópico (ej: sensors/temperature o #)')
    console.log('4. Haz clic en "Iniciar"')
    console.log('5. Deberías ver los mensajes publicados en tiempo real')
    console.log('\n📝 Notas importantes:')
    console.log('- Este script publica cada 2 segundos')
    console.log('- La aplicación web se conecta vía WebSocket (puerto 8083)')
    console.log('- Este script se conecta vía MQTT (puerto 1883)')
    console.log('- Si no ves mensajes, revisa la consola del navegador (F12 → Console)')
    console.log('- Busca mensajes de debug del hook useMQTT\n')
    
    client.end()
    process.exit(0)
  }, 30000)
})

client.on('error', (error) => {
  console.error('\n❌ Error de conexión:', error.message)
  console.log('\n💡 Soluciones:')
  console.log('1. Verifica que EMQX está corriendo: docker ps | grep emqx')
  console.log('2. Verifica las credenciales (usuario: emqx_user, contraseña: emqx_password)')
  console.log('3. Verifica que el broker escucha en puerto 1883 (MQTT) y 8083 (WebSocket)')
  process.exit(1)
})

client.on('disconnect', () => {
  console.log('\n⚠️  Desconectado del broker')
})

console.log('\n🚀 Iniciando test de mensajes MQTT...')
