/**
 * Configuración centralizada para el sistema RTSP
 * Contiene todos los parámetros configurables para streaming RTSP
 */

const rtspConfig = {
  // Configuración de FFmpeg
  ffmpeg: {
    // Argumentos base para conversión RTSP → HLS
    baseArgs: [
      '-rtsp_transport', 'tcp',           // Usar TCP para mejor confiabilidad
      '-i', null,                         // Input RTSP (se reemplaza dinámicamente)
      '-c:v', 'libx264',                  // Codec de video
      '-preset', 'veryfast',              // Preset de encoding (balance velocidad/calidad)
      '-b:v', '2000k',                    // Bitrate de video (2Mbps)
      '-maxrate', '2500k',                // Max bitrate
      '-bufsize', '4000k',                // Buffer size
      '-c:a', 'aac',                      // Codec de audio
      '-b:a', '128k',                     // Bitrate de audio
      '-ar', '44100',                     // Sample rate audio
      '-ac', '2',                         // Canales audio
      '-hls_time', '2',                   // Duración de segmentos HLS
      '-hls_list_size', '6',              // Número de segmentos en playlist
      '-hls_flags', 'delete_segments+independent_segments', // Eliminar segmentos antiguos
      '-hls_segment_filename', null,      // Nombre de segmentos (se reemplaza dinámicamente)
      '-f', 'hls',                        // Formato HLS
      '-y',                               // Sobrescribir archivos
      null                                // Output file (se reemplaza dinámicamente)
    ],

    // Configuraciones por calidad
    qualityPresets: {
      low: {
        videoBitrate: '500k',
        maxBitrate: '600k',
        preset: 'ultrafast',
        hlsTime: '4',
        resolution: '640x480',
        audioBitrate: '64k'
      },
      medium: {
        videoBitrate: '1500k',
        maxBitrate: '2000k',
        preset: 'veryfast',
        hlsTime: '2',
        resolution: '1280x720',
        audioBitrate: '128k'
      },
      high: {
        videoBitrate: '3000k',
        maxBitrate: '4000k',
        preset: 'fast',
        hlsTime: '2',
        resolution: '1920x1080',
        audioBitrate: '192k'
      },
      ultra: {
        videoBitrate: '5000k',
        maxBitrate: '6000k',
        preset: 'faster',
        hlsTime: '1',
        resolution: '1920x1080',
        audioBitrate: '256k'
      }
    },

    // Configuración de reconexión
    reconnect: {
      maxAttempts: 5,
      initialDelay: 3000,     // 3 segundos
      backoffMultiplier: 1.5,
      maxDelay: 30000         // 30 segundos máximo
    },

    // Timeouts
    timeouts: {
      connectionTimeout: 10000,  // 10 segundos para conectar
      readTimeout: 5000,         // 5 segundos para leer
      writeTimeout: 5000         // 5 segundos para escribir
    }
  },

  // Configuración de HLS
  hls: {
    outputDir: './public/hls',
    segmentPrefix: 'segment_',
    playlistExtension: '.m3u8',
    segmentExtension: '.ts',
    maxSegments: 10,           // Máximo número de segmentos a mantener
    cleanupInterval: 60000     // Limpiar cada 60 segundos
  },

  // Configuración de RTSP
  rtsp: {
    defaultPort: 554,
    defaultPath: '/stream',
    supportedProtocols: ['rtsp', 'rtsps'],
    connectionTimeout: 5000,   // 5 segundos para probar conexión
    streamInfoTimeout: 10000   // 10 segundos para obtener info del stream
  },

  // Configuración de retransmisión (relay)
  relay: {
    defaultOutputPort: 8554,
    maxConcurrentRelays: 5,
    relayTimeout: 30000
  },

  // Configuración de validación
  validation: {
    maxCameras: 50,            // Máximo número de cámaras por instancia
    nameMaxLength: 100,
    ipRegex: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/,
    hostnameRegex: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/,
    portRange: { min: 1, max: 65535 },
    pathRegex: /^\/[a-zA-Z0-9\-_.~!$&'()*+,;=:@%]*$/
  },

  // Configuración de logging
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    enableFFmpegLogs: false,    // Deshabilitar logs verbosos de FFmpeg en producción
    logConnections: true,
    logErrors: true,
    logReconnects: true
  },

  // Configuración de monitoreo
  monitoring: {
    enableMetrics: true,
    metricsInterval: 30000,    // Recopilar métricas cada 30 segundos
    healthCheckInterval: 60000 // Health check cada 60 segundos
  }
};

/**
 * Función para obtener configuración de calidad específica
 */
rtspConfig.getQualityConfig = (quality = 'medium') => {
  const preset = rtspConfig.ffmpeg.qualityPresets[quality] || rtspConfig.ffmpeg.qualityPresets.medium;
  return {
    ...preset,
    audioBitrate: rtspConfig.ffmpeg.baseArgs[rtspConfig.ffmpeg.baseArgs.indexOf('-b:a') + 1]
  };
};

/**
 * Función para construir argumentos FFmpeg con configuración específica
 */
rtspConfig.buildFFmpegArgs = (inputUrl, outputPath, quality = 'medium', options = {}) => {
  const qualityConfig = rtspConfig.getQualityConfig(quality);
  const args = [...rtspConfig.ffmpeg.baseArgs];

  // Reemplazar valores dinámicos
  const inputIndex = args.indexOf('-i');
  args[inputIndex + 1] = inputUrl;

  const presetIndex = args.indexOf('-preset');
  args[presetIndex + 1] = qualityConfig.preset;

  const videoBitrateIndex = args.indexOf('-b:v');
  args[videoBitrateIndex + 1] = qualityConfig.videoBitrate;

  const maxBitrateIndex = args.indexOf('-maxrate');
  args[maxBitrateIndex + 1] = qualityConfig.maxBitrate;

  const hlsTimeIndex = args.indexOf('-hls_time');
  args[hlsTimeIndex + 1] = qualityConfig.hlsTime;

  const segmentFilenameIndex = args.indexOf('-hls_segment_filename');
  args[segmentFilenameIndex + 1] = `${outputPath.replace('.m3u8', '_%03d.ts')}`;

  const outputIndex = args.lastIndexOf(null);
  args[outputIndex] = outputPath;

  // Agregar opciones adicionales si se especifican
  if (options.scale) {
    // Insertar escalado antes del output
    args.splice(outputIndex, 0, '-vf', `scale=${options.scale}`);
  }

  if (options.noAudio) {
    // Remover códecs de audio
    const audioCodecIndex = args.indexOf('-c:a');
    if (audioCodecIndex !== -1) {
      args.splice(audioCodecIndex, 4); // Remover -c:a, codec, -b:a, bitrate
    }
  }

  if (options.lowLatency) {
    // Agregar opciones de baja latencia
    args.splice(outputIndex, 0, '-fflags', 'nobuffer', '-flags', 'low_delay');
  }

  return args.filter(arg => arg !== null);
};

/**
 * Función para validar configuración de cámara
 */
rtspConfig.validateCameraConfig = (camera) => {
  const errors = [];

  // Validar nombre
  if (!camera.name || camera.name.length > rtspConfig.validation.nameMaxLength) {
    errors.push(`Nombre inválido o demasiado largo (máx ${rtspConfig.validation.nameMaxLength} caracteres)`);
  }

  // Validar IP/hostname
  if (!camera.ip || (!rtspConfig.validation.ipRegex.test(camera.ip) && !rtspConfig.validation.hostnameRegex.test(camera.ip))) {
    errors.push('Dirección IP o hostname inválida');
  }

  // Validar puerto
  const port = parseInt(camera.port) || rtspConfig.rtsp.defaultPort;
  if (port < rtspConfig.validation.portRange.min || port > rtspConfig.validation.portRange.max) {
    errors.push(`Puerto debe estar entre ${rtspConfig.validation.portRange.min} y ${rtspConfig.validation.portRange.max}`);
  }

  // Validar path - permitir vacío (se convertirá a /)
  const pathToValidate = camera.path || '/';
  if (!rtspConfig.validation.pathRegex.test(pathToValidate)) {
    errors.push('Ruta RTSP inválida');
  }

  // Validar protocolo
  if (camera.protocol && !rtspConfig.rtsp.supportedProtocols.includes(camera.protocol)) {
    errors.push(`Protocolo no soportado. Usar: ${rtspConfig.rtsp.supportedProtocols.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = rtspConfig;