/**
 * Configuration Manager for multiple environments
 * Supports: development, test, production
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, `../../.env.${process.env.NODE_ENV || 'development'}`) });

// Fallback to .env if specific environment file doesn't exist
if (!process.env.MQTT_BROKER) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}

/**
 * Environment configurations
 */
const environments = {
  development: {
    port: 3001,
    mqtt: {
      broker: 'mqtt://100.82.84.24:1883',
      username: 'admin',
      password: 'galgo2526',
    },
    database: './sensors.db',
    cors: true,
    logging: 'verbose',
  },
  test: {
    port: 3001,
    mqtt: {
      broker: 'mqtt://localhost:1883', // Change this to your test broker
      username: 'test_user',
      password: 'test_password',
    },
    database: './sensors-test.db',
    cors: true,
    logging: 'silent',
  },
  production: {
    port: 3001,
    mqtt: {
      broker: process.env.MQTT_BROKER,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
    },
    database: './sensors.db',
    cors: false,
    logging: 'warn',
  },
};

/**
 * Get current environment config
 */
const getEnvironmentConfig = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envConfig = environments[nodeEnv] || environments.development;

  return {
    nodeEnv,
    ...envConfig,
    // Override with environment variables if present
    mqtt: {
      broker: process.env.MQTT_BROKER || envConfig.mqtt.broker,
      username: process.env.MQTT_USERNAME || envConfig.mqtt.username,
      password: process.env.MQTT_PASSWORD || envConfig.mqtt.password,
      clientId: process.env.MQTT_CLIENT_ID || 'galgo-school-server',
      connectTimeout: 4000,
      reconnectPeriod: 5000,
    },
    port: process.env.PORT || envConfig.port,
    database: process.env.DATABASE_PATH || envConfig.database,
  };
};

module.exports = getEnvironmentConfig();
