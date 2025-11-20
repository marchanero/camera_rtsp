#!/usr/bin/env node

/**
 * PUBLICADOR CONTINUO PARA TESTING EN TIEMPO REAL - APLICACIÓN VR
 * Publica mensajes MQTT simulando dispositivos VR cada segundo para probar el monitor
 *
 * Topics generados:
 * - vr/status/ID - Estado de dispositivos VR (batería, conexión, temperatura, etc.)
 * - vr/commands/ID - Comandos enviados a dispositivos VR
 * - vr/datos_reloj/ID - Datos de sincronización de reloj
 * - vr/acciones_json/ID - Acciones del usuario en formato JSON
 * - vr/wandering_data/ID - Datos de movimiento libre y entorno
 * - vr/head_movement/ID - Seguimiento de movimiento de cabeza y ojos
 *
 * IDs de dispositivo: VR001-VR010 (aleatorios)
 */

const mqtt = require('mqtt')

const BROKER_URL = 'mqtt://localhost:1883'
const USERNAME = 'emqx_user'
const PASSWORD = 'emqx_password'

// Topics de la aplicación VR
const vrTopics = [
  'vr/status',
  'vr/commands',
  'vr/datos_reloj',
  'vr/acciones_json',
  'vr/wandering_data',
  'vr/head_movement'
]

// Estados posibles para dispositivos VR
const deviceStates = ['online', 'offline', 'connecting', 'error', 'maintenance']
const commandTypes = ['start_session', 'end_session', 'calibrate', 'reset', 'update_firmware']
const actionTypes = ['move_forward', 'move_backward', 'turn_left', 'turn_right', 'jump', 'crouch']

let messageCount = 0
const client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clean: true,
  clientId: `continuous-publisher-${Date.now()}`
})

client.on('connect', () => {
  console.log('\n✅ Conectado al broker EMQX')
  console.log('📤 Publicando mensajes VR cada 1 segundo...')
  console.log('🔍 Abre el monitor en http://localhost:5173 y activa auto-monitor')
  console.log('🛑 Presiona Ctrl+C para detener\n')

  // Función para generar payload según el tipo de topic
  const generateVRPayload = (topicType, deviceId) => {
    const basePayload = {
      timestamp: new Date().toISOString(),
      deviceId: deviceId,
      sequence: ++messageCount,
      test: true
    }

    switch (topicType) {
      case 'vr/status':
        return {
          ...basePayload,
          status: deviceStates[Math.floor(Math.random() * deviceStates.length)],
          batteryLevel: Math.floor(Math.random() * 100) + 1,
          connectionStrength: Math.floor(Math.random() * 100) + 1,
          temperature: Math.round((Math.random() * 20 + 20) * 10) / 10, // 20-40°C
          uptime: Math.floor(Math.random() * 86400), // segundos
          firmwareVersion: `1.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`
        }

      case 'vr/commands':
        return {
          ...basePayload,
          command: commandTypes[Math.floor(Math.random() * commandTypes.length)],
          parameters: {
            duration: Math.floor(Math.random() * 300) + 30, // 30-330 segundos
            intensity: Math.random(),
            target: Math.random() > 0.5 ? 'user' : 'system'
          },
          priority: Math.random() > 0.8 ? 'high' : 'normal'
        }

      case 'vr/datos_reloj':
        const now = new Date()
        return {
          ...basePayload,
          serverTime: now.toISOString(),
          deviceTime: new Date(now.getTime() + (Math.random() - 0.5) * 1000).toISOString(), // ±500ms drift
          timezone: 'Europe/Madrid',
          ntpSync: Math.random() > 0.1, // 90% sincronizado
          timeDrift: (Math.random() - 0.5) * 2000, // ±1000ms
          precision: Math.random() * 10 // ms de precisión
        }

      case 'vr/acciones_json':
        return {
          ...basePayload,
          action: actionTypes[Math.floor(Math.random() * actionTypes.length)],
          coordinates: {
            x: (Math.random() - 0.5) * 20,
            y: Math.random() * 5,
            z: (Math.random() - 0.5) * 20
          },
          velocity: {
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10,
            z: (Math.random() - 0.5) * 10
          },
          duration: Math.floor(Math.random() * 2000) + 100, // 100-2100ms
          success: Math.random() > 0.05 // 95% éxito
        }

      case 'vr/wandering_data':
        return {
          ...basePayload,
          position: {
            x: (Math.random() - 0.5) * 100,
            y: 0,
            z: (Math.random() - 0.5) * 100
          },
          orientation: {
            yaw: Math.random() * 360,
            pitch: (Math.random() - 0.5) * 90,
            roll: (Math.random() - 0.5) * 30
          },
          movement: {
            speed: Math.random() * 5,
            direction: Math.random() * 360,
            acceleration: (Math.random() - 0.5) * 2
          },
          environment: {
            obstacles: Math.floor(Math.random() * 10),
            lightLevel: Math.random(),
            soundLevel: Math.random() * 100
          }
        }

      case 'vr/head_movement':
        return {
          ...basePayload,
          headPose: {
            position: {
              x: (Math.random() - 0.5) * 0.5,
              y: (Math.random() - 0.5) * 0.5 + 1.7, // altura típica
              z: (Math.random() - 0.5) * 0.5
            },
            rotation: {
              yaw: (Math.random() - 0.5) * 180,
              pitch: (Math.random() - 0.5) * 90,
              roll: (Math.random() - 0.5) * 45
            }
          },
          eyeTracking: {
            leftEye: {
              open: Math.random() > 0.1,
              gaze: {
                x: Math.random(),
                y: Math.random()
              }
            },
            rightEye: {
              open: Math.random() > 0.1,
              gaze: {
                x: Math.random(),
                y: Math.random()
              }
            }
          },
          confidence: Math.random() * 0.3 + 0.7 // 70-100%
        }

      default:
        return basePayload
    }
  }

  // Publicar mensajes cada 1 segundo
  const interval = setInterval(() => {
    // Seleccionar topic y dispositivo aleatorios
    const topicType = vrTopics[Math.floor(Math.random() * vrTopics.length)]
    const deviceId = `VR${String(Math.floor(Math.random() * 10) + 1).padStart(3, '0')}` // VR001-VR010
    const fullTopic = `${topicType}/${deviceId}`

    const payload = generateVRPayload(topicType, deviceId)

    client.publish(fullTopic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ Error publicando:`, err.message)
      } else {
        console.log(`✓ [${new Date().toLocaleTimeString()}] #${messageCount} → ${fullTopic}: ${topicType.split('/')[1]} (${JSON.stringify(payload).length} bytes)`)
      }
    })
  }, 1000)

  // Limpiar al salir
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo publicador...')
    clearInterval(interval)
    client.end()
    process.exit(0)
  })
})

client.on('error', (error) => {
  console.error('\n❌ Error de conexión:', error.message)
  process.exit(1)
})