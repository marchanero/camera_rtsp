#!/usr/bin/env node

/**
 * LAUNCHER INTERACTIVO PARA TEST PUBLISHERS
 * Inicia publishers de sensores de forma interactiva
 */

const { spawn } = require('child_process')
const readline = require('readline')
const path = require('path')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log('\n' + '═'.repeat(60))
console.log('  📡 Camera RTSP - Test Publishers')
console.log('═'.repeat(60) + '\n')

console.log('Selecciona el tipo de publicador:\n')
console.log('  1️⃣  Normal (Multi-Sensor)    - 4 sensores cada 2s [RECOMENDADO]')
console.log('  2️⃣  Stress Test              - 15 sensores alta frecuencia')
console.log('  3️⃣  Diagnóstico MQTT         - Verificar conectividad')
console.log('  0️⃣  Salir\n')

rl.question('Opción [1]: ', (answer) => {
  const choice = answer.trim() || '1'
  
  let script = null
  
  switch (choice) {
    case '1':
      console.log('\n🚀 Iniciando publicador multi-sensor...')
      console.log('─'.repeat(60) + '\n')
      script = 'publish-sensors-multi.js'
      break
    
    case '2':
      console.log('\n⚡ Iniciando stress test...')
      console.log('─'.repeat(60) + '\n')
      script = 'publish-sensors-stress.js'
      break
    
    case '3':
      console.log('\n🔍 Ejecutando diagnóstico MQTT...')
      console.log('─'.repeat(60) + '\n')
      script = 'diagnostic_mqtt.js'
      break
    
    case '0':
      console.log('\n👋 Saliendo...\n')
      rl.close()
      process.exit(0)
      break
    
    default:
      console.error('\n❌ Opción inválida\n')
      rl.close()
      process.exit(1)
  }
  
  if (script) {
    const scriptPath = path.join(__dirname, script)
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: __dirname
    })
    
    child.on('close', (code) => {
      console.log(`\n✅ Proceso finalizado con código: ${code}\n`)
      rl.close()
      process.exit(code)
    })
    
    child.on('error', (err) => {
      console.error(`\n❌ Error ejecutando script: ${err.message}\n`)
      rl.close()
      process.exit(1)
    })
  }
  
  rl.close()
})

rl.on('close', () => {
  // Cleanup
})
