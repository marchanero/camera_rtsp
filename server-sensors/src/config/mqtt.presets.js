// Configuraciones MQTT predefinidas para Galgo-School
const MQTT_PRESETS = {
  'EMQX Local (localhost:1883)': {
    host: 'localhost',
    port: 1883,
    ssl: false,
    username: '',
    password: '',
    description: 'Broker EMQX local para desarrollo'
  },
  'EMQX Remoto (100.107.238.60:1883)': {
    host: '100.107.238.60',
    port: 1883,
    ssl: false,
    username: 'admin',
    password: 'galgo2526',
    description: 'Broker EMQX del laboratorio'
  },
  'EMQX Test (100.82.84.24:1883)': {
    host: '100.82.84.24',
    port: 1883,
    ssl: false,
    username: 'admin',
    password: 'galgo2526',
    description: 'Broker EMQX de pruebas'
  },
  'HiveMQ Cloud': {
    host: '',
    port: 8883,
    ssl: true,
    username: '',
    password: '',
    description: 'Broker en la nube de HiveMQ'
  },
  'Mosquitto Local': {
    host: 'localhost',
    port: 1883,
    ssl: false,
    username: '',
    password: '',
    description: 'Broker Mosquitto local'
  },
  'Custom': {
    host: '',
    port: 1883,
    ssl: false,
    username: '',
    password: '',
    description: 'Configuración personalizada'
  }
};

// Función para obtener configuración por nombre
const getMqttPreset = (presetName) => {
  return MQTT_PRESETS[presetName] || MQTT_PRESETS['Custom'];
};

// Función para construir URL del broker
const buildBrokerUrl = (config) => {
  const protocol = config.ssl ? 'mqtts' : 'mqtt';
  return `${protocol}://${config.host}:${config.port}`;
};

// Función para aplicar preset a configuración
const applyPresetToConfig = (presetName, currentConfig) => {
  const preset = getMqttPreset(presetName);
  return {
    ...currentConfig,
    defaultBroker: presetName,
    host: preset.host,
    port: preset.port,
    ssl: preset.ssl,
    username: preset.username,
    password: preset.password
  };
};

module.exports = {
  MQTT_PRESETS,
  getMqttPreset,
  buildBrokerUrl,
  applyPresetToConfig
};