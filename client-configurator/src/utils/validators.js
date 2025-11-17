/**
 * Módulo de validadores centralizados para la aplicación
 * Proporciona funciones de validación reutilizables para:
 * - Direcciones IP (IPv4)
 * - Puertos TCP/UDP
 * - URLs RTSP
 * - URLs HTTP/HTTPS
 * - Nombres de host
 * - Credenciales
 */

/**
 * Validador de IPv4
 * @param {string} ip - Dirección IP a validar
 * @returns {object} { valid: boolean, error?: string }
 */
export const validateIPv4 = (ip) => {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'La IP debe ser una cadena de texto' }
  }

  const trimmedIP = ip.trim()

  // Regex para IPv4
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  
  if (!ipv4Regex.test(trimmedIP)) {
    return { 
      valid: false, 
      error: 'Formato de IP inválido. Debe ser IPv4 válido (ej: 192.168.1.100)' 
    }
  }

  // Validación adicional: ningún octeto debe ser mayor a 255
  const octets = trimmedIP.split('.').map(Number)
  if (octets.some(octet => octet > 255)) {
    return { 
      valid: false, 
      error: 'Cada octeto de la IP debe ser menor a 256' 
    }
  }

  return { valid: true }
}

/**
 * Validador de puerto TCP/UDP
 * @param {number|string} port - Puerto a validar
 * @param {boolean} allowWellKnown - Permitir puertos 0-1023 (default: false)
 * @returns {object} { valid: boolean, error?: string }
 */
export const validatePort = (port, allowWellKnown = false) => {
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port

  if (!Number.isInteger(portNum)) {
    return { valid: false, error: 'El puerto debe ser un número entero' }
  }

  const minPort = 1
  const maxPort = 65535

  if (portNum < minPort || portNum > maxPort) {
    return { 
      valid: false, 
      error: `El puerto debe estar entre ${minPort} y ${maxPort}` 
    }
  }

  // Puertos bien conocidos (0-1023)
  if (!allowWellKnown && portNum < 1024) {
    return { 
      valid: false, 
      error: 'Usar puertos < 1024 requiere permisos elevados. Usa puertos >= 1024' 
    }
  }

  // Puertos registrados comunes que causan conflictos
  const reservedPorts = [22, 23, 25, 53, 80, 443, 3306, 5432, 6379]
  if (reservedPorts.includes(portNum)) {
    return {
      valid: false,
      error: `El puerto ${portNum} está reservado para otro servicio. Usa un puerto diferente`
    }
  }

  return { valid: true }
}

/**
 * Validador de URL RTSP
 * @param {string} url - URL RTSP a validar
 * @returns {object} { valid: boolean, error?: string }
 */
export const validateRTSPUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'La URL debe ser una cadena de texto' }
  }

  const trimmedURL = url.trim()

  // Regex para RTSP - formato: rtsp://[user:pass@]host:port[/path]
  const rtspRegex = /^rtsp:\/\/([a-zA-Z0-9\-._~%!$&'()*+,;=:]*@)?([a-zA-Z0-9\-._~%]*|\[:[a-fA-F0-9:]+\]|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:(\d{1,5}))?([/].*)?$/

  if (!rtspRegex.test(trimmedURL)) {
    return {
      valid: false,
      error: 'Formato de URL RTSP inválido. Debe ser rtsp://[user:pass@]host[:port][/path]'
    }
  }

  // Extrae y valida el puerto
  const portMatch = trimmedURL.match(/:(\d{1,5})([/?]|$)/)
  if (portMatch) {
    const port = parseInt(portMatch[1], 10)
    const portValidation = validatePort(port, true) // allow well-known ports for RTSP
    if (!portValidation.valid) {
      return { valid: false, error: `Puerto RTSP inválido: ${portValidation.error}` }
    }
  }

  return { valid: true }
}

/**
 * Validador de URL HTTP/HTTPS
 * @param {string} url - URL a validar
 * @returns {object} { valid: boolean, error?: string }
 */
export const validateHTTPUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'La URL debe ser una cadena de texto' }
  }

  try {
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        valid: false,
        error: 'La URL debe usar protocolo http:// o https://'
      }
    }
    return { valid: true }
  } catch (error) {
    return { valid: false, error: 'Formato de URL inválido' }
  }
}

/**
 * Validador de nombre de host (FQDN o localhost)
 * @param {string} hostname - Nombre de host a validar
 * @returns {object} { valid: boolean, error?: string }
 */
export const validateHostname = (hostname) => {
  if (!hostname || typeof hostname !== 'string') {
    return { valid: false, error: 'El nombre de host debe ser una cadena de texto' }
  }

  const trimmedHostname = hostname.trim()

  // Permitir localhost, IPv4 o FQDN válido
  const hostnameRegex = /^(localhost|([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/

  if (!hostnameRegex.test(trimmedHostname)) {
    return {
      valid: false,
      error: 'Nombre de host inválido. Usa localhost, IP o FQDN válido'
    }
  }

  // Si es IP, valida que sea válida
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmedHostname)) {
    return validateIPv4(trimmedHostname)
  }

  return { valid: true }
}

/**
 * Validador de credenciales (usuario/contraseña)
 * @param {string} username - Nombre de usuario
 * @param {string} password - Contraseña
 * @returns {object} { valid: boolean, error?: string }
 */
export const validateCredentials = (username, password) => {
  // Ambos opcionales o ambos presentes
  const hasUsername = username && typeof username === 'string'
  const hasPassword = password && typeof password === 'string'

  if (hasUsername !== hasPassword) {
    return {
      valid: false,
      error: 'Usuario y contraseña deben estar juntos o vacíos'
    }
  }

  if (hasUsername) {
    if (username.length < 1 || username.length > 100) {
      return {
        valid: false,
        error: 'El usuario debe tener entre 1 y 100 caracteres'
      }
    }

    // Usuario no debe contener caracteres especiales problemáticos
    if (!/^[a-zA-Z0-9._\-@]+$/.test(username)) {
      return {
        valid: false,
        error: 'El usuario contiene caracteres no permitidos'
      }
    }
  }

  if (hasPassword) {
    if (password.length > 256) {
      return {
        valid: false,
        error: 'La contraseña es demasiado larga (máx 256 caracteres)'
      }
    }
  }

  return { valid: true }
}

/**
 * Validador de configuración de cámara RTSP
 * Valida todo el objeto de configuración de cámara
 * @param {object} camera - Objeto de cámara { name, ip, port, username, password, path }
 * @returns {object} { valid: boolean, errors: object }
 */
export const validateCameraConfig = (camera) => {
  const errors = {}

  // Validar nombre
  if (!camera.name || typeof camera.name !== 'string') {
    errors.name = 'El nombre de la cámara es requerido'
  } else if (camera.name.trim().length < 2) {
    errors.name = 'El nombre debe tener al menos 2 caracteres'
  } else if (camera.name.length > 50) {
    errors.name = 'El nombre no puede exceder 50 caracteres'
  }

  // Validar IP
  if (!camera.ip || typeof camera.ip !== 'string') {
    errors.ip = 'La dirección IP es requerida'
  } else {
    const ipValidation = validateIPv4(camera.ip)
    if (!ipValidation.valid) {
      errors.ip = ipValidation.error
    }
  }

  // Validar puerto
  if (!camera.port) {
    errors.port = 'El puerto es requerido'
  } else {
    const portValidation = validatePort(camera.port, true)
    if (!portValidation.valid) {
      errors.port = portValidation.error
    }
  }

  // Validar credenciales (opcionales pero juntas)
  if (camera.username || camera.password) {
    const credValidation = validateCredentials(camera.username, camera.password)
    if (!credValidation.valid) {
      errors.credentials = credValidation.error
    }
  }

  // Validar path (opcional)
  if (camera.path && typeof camera.path === 'string') {
    if (!camera.path.startsWith('/')) {
      errors.path = 'El path debe comenzar con /'
    } else if (camera.path.length > 255) {
      errors.path = 'El path es demasiado largo'
    }
  }

  const valid = Object.keys(errors).length === 0

  return { valid, errors }
}

/**
 * Validador de configuración de broker MQTT
 * @param {object} mqtt - Objeto MQTT { host, port, username, password, ssl }
 * @returns {object} { valid: boolean, errors: object }
 */
export const validateMQTTConfig = (mqtt) => {
  const errors = {}

  // Validar host
  if (!mqtt.host || typeof mqtt.host !== 'string') {
    errors.host = 'El host MQTT es requerido'
  } else {
    const hostValidation = validateHostname(mqtt.host)
    if (!hostValidation.valid) {
      errors.host = hostValidation.error
    }
  }

  // Validar puerto
  if (!mqtt.port) {
    errors.port = 'El puerto MQTT es requerido'
  } else {
    const portValidation = validatePort(mqtt.port, true)
    if (!portValidation.valid) {
      errors.port = portValidation.error
    }
  }

  // Validar credenciales
  if (mqtt.username || mqtt.password) {
    const credValidation = validateCredentials(mqtt.username, mqtt.password)
    if (!credValidation.valid) {
      errors.credentials = credValidation.error
    }
  }

  // Validar SSL
  if (typeof mqtt.ssl !== 'boolean') {
    errors.ssl = 'SSL debe ser true o false'
  }

  const valid = Object.keys(errors).length === 0

  return { valid, errors }
}

/**
 * Función auxiliar para mostrar errores de validación formateados
 * @param {object} validationResult - Resultado de validación { valid, errors }
 * @returns {string} Mensaje de error formateado
 */
export const formatValidationErrors = (validationResult) => {
  if (validationResult.valid) return null

  const errorMessages = Object.entries(validationResult.errors)
    .map(([field, message]) => `${field}: ${message}`)
    .join('\n')

  return errorMessages
}
