import mqtt from 'mqtt';

const BROKER_URL = 'mqtt://localhost:1883';
const USERNAME = 'admin';
const PASSWORD = 'galgo2526';

// Configuración de frecuencia (igual que el original)
const ENV_INTERVAL_MS = 2000; // 1 mensaje cada 2 segundos
const DURATION_SEC = process.env.DURATION_SEC ? parseInt(process.env.DURATION_SEC) : 0; // 0 = infinito
const DURATION_MS = DURATION_SEC * 1000;

const client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clientId: `sim-mota-sensors-${Date.now()}`
});

// Estado interno para cada sensor MOTA
const motaState = {
  // MOTA Original (Aguas Nuevas)
  '20B96DF16E20': {
    topicBase: 'AGUASNUEVASAB/sensor/20B96DF16E20',
    location: 'Aguas Nuevas - Aula 1',
    temperatura: 23.5,
    humedad: 45,
    luz: 350,
    ruido_dbfs: -35,
    aqi: 50,
    tvoc: 120,
    eco2: 450,
    bmp_temperatura: 24.0,
    bmp_presion: 1013.25,
    bmp_altitud: 650
  },
  // MOTA 2 (ETSII Aula 2)
  'MOTA_AULA2_001': {
    topicBase: 'ETSIIAB/sensor/MOTA_AULA2_001',
    location: 'ETSII - Aula 2',
    temperatura: 22.0,
    humedad: 50,
    luz: 420,
    ruido_dbfs: -40,
    aqi: 35,
    tvoc: 80,
    eco2: 400,
    bmp_temperatura: 22.5,
    bmp_presion: 1015.00,
    bmp_altitud: 700
  },
  // MOTA 3 (Biblioteca)
  'MOTA_BIBLIO_001': {
    topicBase: 'BIBLIOTECA/sensor/MOTA_BIBLIO_001',
    location: 'Biblioteca Central',
    temperatura: 21.0,
    humedad: 55,
    luz: 280,
    ruido_dbfs: -50,
    aqi: 25,
    tvoc: 60,
    eco2: 380,
    bmp_temperatura: 21.5,
    bmp_presion: 1012.50,
    bmp_altitud: 680
  },
  // MOTA 4 (Laboratorio)
  'MOTA_LAB_001': {
    topicBase: 'LABORATORIO/sensor/MOTA_LAB_001',
    location: 'Laboratorio de Electrónica',
    temperatura: 24.5,
    humedad: 40,
    luz: 500,
    ruido_dbfs: -30,
    aqi: 65,
    tvoc: 150,
    eco2: 520,
    bmp_temperatura: 25.0,
    bmp_presion: 1010.00,
    bmp_altitud: 690
  }
};

// Generador de valores con variación (igual que el original)
const generateValue = (current, min, max, variance) => {
  const drift = (Math.random() - 0.5) * variance;
  let newValue = current + drift;
  newValue = Math.max(min, Math.min(max, newValue));
  return parseFloat(newValue.toFixed(2));
};

client.on('connect', () => {
  console.log('🚀 Simulación MOTA Multi-sensor Iniciada');
  console.log(`📡 Sensores: ${Object.keys(motaState).length} dispositivos MOTA`);
  console.log(`⏱️  Frecuencia: 1 mensaje cada ${ENV_INTERVAL_MS / 1000}s`);
  console.log(`⏱️  Duración: ${DURATION_SEC === 0 ? 'Infinita (hasta Ctrl+C)' : DURATION_SEC + ' segundos'}`);

  const startTime = Date.now();

  // Loop de Baja Frecuencia (0.5Hz) para sensores MOTA - igual que el original
  const timer = setInterval(() => {
    const now = Date.now();
    const elapsed = now - startTime;

    // Check duration
    if (DURATION_MS > 0 && elapsed >= DURATION_MS) {
      clearInterval(timer);
      console.log('\n✅ Simulación MOTA completada.');
      client.end();
      process.exit(0);
      return;
    }

    // Publicar datos para cada sensor MOTA
    Object.keys(motaState).forEach(sensorId => {
      const state = motaState[sensorId];

      // Generar nuevos valores con variación realista
      state.temperatura = generateValue(state.temperatura, 18, 30, 0.3);
      state.humedad = generateValue(state.humedad, 30, 70, 1);
      state.luz = generateValue(state.luz, 50, 800, 20);
      state.ruido_dbfs = generateValue(state.ruido_dbfs, -60, -20, 2);
      state.aqi = generateValue(state.aqi, 10, 100, 3);
      state.tvoc = generateValue(state.tvoc, 30, 300, 10);
      state.eco2 = generateValue(state.eco2, 350, 800, 15);
      state.bmp_temperatura = generateValue(state.bmp_temperatura, 18, 30, 0.2);
      state.bmp_presion = generateValue(state.bmp_presion, 1005, 1025, 0.5);
      state.bmp_altitud = generateValue(state.bmp_altitud, 600, 750, 2);

      // Construir payload en formato MOTA (igual que el original)
      const payload = {
        sensorId: sensorId,
        timestamp: new Date().toISOString(),
        temperatura: state.temperatura,
        humedad: state.humedad,
        luz: state.luz,
        ruido_dbfs: state.ruido_dbfs,
        aqi: state.aqi,
        tvoc: state.tvoc,
        eco2: state.eco2,
        bmp_temperatura: state.bmp_temperatura,
        bmp_presion: state.bmp_presion,
        bmp_altitud: state.bmp_altitud
      };

      // Publicar en el topic /data (igual que el original)
      client.publish(`${state.topicBase}/data`, JSON.stringify(payload));
    });

    process.stdout.write(`\r📡 [${new Date().toLocaleTimeString()}] MOTA x${Object.keys(motaState).length} publicados OK`);
  }, ENV_INTERVAL_MS);
});

client.on('error', (err) => {
  console.error('❌ Error MQTT:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo simulación...');
  client.end();
  process.exit(0);
});
