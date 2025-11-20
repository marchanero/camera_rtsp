#!/usr/bin/env node

/**
 * DIAGNÓSTICO COMPLETO DE FLUJO MQTT
 * 
 * Este script verifica:
 * 1. Conexión al broker EMQX
 * 2. Publicación y recepción de mensajes
 * 3. Patrones de suscripción (wildcards)
 * 4. Estadísticas de mensajes
 * 5. Estado de las suscripciones
 */

const mqtt = require('mqtt')

const BROKER_URL = 'mqtt://localhost:1883'
const USERNAME = 'emqx_user'
const PASSWORD = 'emqx_password'

console.log('\n' + '='.repeat(60))
console.log('  DIAGNÓSTICO DE FLUJO MQTT EMQX')
console.log('='.repeat(60))

// Estado global
let stats = {
  published: 0,
  received: 0,
  errors: 0,
  subscriptions: {}
}

// Crear cliente publisher
const publisher = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clientId: `diagnostic-pub-${Date.now()}`
})

// Crear cliente subscriber
const subscriber = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clientId: `diagnostic-sub-${Date.now()}`
})

const testTopics = [
  'sensors/temperature',
  'sensors/humidity',
  'sensors/+',
  'test/#'
]

let testComplete = false

publisher.on('connect', () => {
  console.log('\n✅ Publisher conectado')
})

publisher.on('error', (err) => {
  console.error('\n❌ Error Publisher:', err.message)
  stats.errors++
})

subscriber.on('connect', () => {
  console.log('✅ Subscriber conectado')
  
  // Suscribirse a todos los tópicos de prueba
  console.log('\n📡 Suscribiéndose a tópicos...')
  testTopics.forEach(topic => {
    subscriber.subscribe(topic, (err) => {
      if (err) {
        console.error(`  ❌ Error suscribiendo a ${topic}:`, err.message)
        stats.errors++
      } else {
        console.log(`  ✓ Suscrito a: ${topic}`)
        stats.subscriptions[topic] = 0
      }
    })
  })

  // Esperar a que se establezcan las suscripciones
  setTimeout(() => {
    console.log('\n📤 Publicando mensajes de prueba...')
    publishTestMessages()
  }, 1000)
})

subscriber.on('message', (topic, message) => {
  stats.received++
  
  try {
    const payload = JSON.parse(message.toString())
    if (stats.subscriptions[topic] !== undefined) {
      stats.subscriptions[topic]++
    }
    
    console.log(`  ✓ Recibido en ${topic}: ${JSON.stringify(payload)}`)
  } catch (e) {
    console.log(`  ✓ Recibido en ${topic}: ${message.toString()}`)
  }
})

subscriber.on('error', (err) => {
  console.error('\n❌ Error Subscriber:', err.message)
  stats.errors++
})

function publishTestMessages() {
  const messagesToPublish = [
    {
      topic: 'sensors/temperature',
      payload: { value: 25.5, unit: '°C', device: 'sensor-001' }
    },
    {
      topic: 'sensors/humidity',
      payload: { value: 65, unit: '%', device: 'sensor-002' }
    },
    {
      topic: 'test/message',
      payload: { message: 'Test message', timestamp: new Date().toISOString() }
    }
  ]

  let published = 0
  messagesToPublish.forEach(({ topic, payload }) => {
    publisher.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`  ❌ Error publicando en ${topic}:`, err.message)
        stats.errors++
      } else {
        stats.published++
        published++
        console.log(`  ✓ Publicado en ${topic}`)
      }
      
      // Si todos están publicados, esperar a recibir
      if (published === messagesToPublish.length) {
        setTimeout(finalizeTest, 2000)
      }
    })
  })
}

function finalizeTest() {
  if (testComplete) return
  testComplete = true

  console.log('\n' + '='.repeat(60))
  console.log('  RESULTADOS DEL DIAGNÓSTICO')
  console.log('='.repeat(60))
  
  console.log('\n📊 Estadísticas:')
  console.log(`  • Mensajes publicados: ${stats.published}`)
  console.log(`  • Mensajes recibidos: ${stats.received}`)
  console.log(`  • Errores: ${stats.errors}`)
  
  console.log('\n📡 Mensajes por suscripción:')
  Object.entries(stats.subscriptions).forEach(([topic, count]) => {
    console.log(`  • ${topic}: ${count} mensajes`)
  })

  console.log('\n🔍 Análisis:')
  if (stats.errors === 0 && stats.published === stats.received) {
    console.log('  ✅ Flujo MQTT funcionando correctamente')
    console.log('  ℹ️  El problema está en la integración con React')
  } else if (stats.errors > 0) {
    console.log('  ❌ Hay errores de conexión o publicación')
  } else if (stats.received < stats.published) {
    console.log('  ⚠️  Se publicaron más mensajes de los que se recibieron')
    console.log('  ℹ️  Posible problema con patrones de suscripción (wildcards)')
  } else {
    console.log('  ℹ️  Revisar logs para más información')
  }

  console.log('\n💡 Siguiente paso:')
  console.log('  Si el flujo MQTT funciona aquí pero no en la app React:')
  console.log('  1. Abre la consola del navegador (F12)')
  console.log('  2. En Console, busca logs del hook useMQTT')
  console.log('  3. Verifica que el WebSocket se conecta (ws://localhost:8083/mqtt)')
  console.log('  4. Busca logs de "Mensaje recibido en" para ver si llegan mensajes')
  
  console.log('\n' + '='.repeat(60) + '\n')

  // Limpiar
  publisher.end()
  subscriber.end()
  
  process.exit(stats.errors > 0 ? 1 : 0)
}

// Timeout de seguridad
setTimeout(() => {
  if (!testComplete) {
    console.log('\n⏱️  Timeout - finalizando test')
    finalizeTest()
  }
}, 15000)

console.log('\n⏳ Iniciando diagnóstico... (máx 15 segundos)\n')
