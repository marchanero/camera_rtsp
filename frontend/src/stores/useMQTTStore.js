import { create } from 'zustand'
import mqtt from 'mqtt'
import axios from 'axios'
import { useNotificationStore } from './useNotificationStore'

const API_BASE = ''

/**
 * Zustand store unificado para todo el estado MQTT.
 * Reemplaza: MQTTConnectionContext + MQTTMessagesContext + MQTTSensorDataContext
 *
 * Beneficios vs React Context:
 * - Suscripción selectiva: cada componente solo re-renderiza cuando cambia SU slice
 * - Sin providers anidados
 * - Acceso fuera de React con getState()
 * - Batching de mensajes integrado (250ms)
 */
export const useMQTTStore = create((set, get) => ({
  // ═══════════════════════════════════════════════════════════════
  // CONNECTION STATE
  // ═══════════════════════════════════════════════════════════════
  isConnected: false,
  error: null,
  config: null,
  isLoadingConfig: true,
  reconnectState: { attempts: 0, isReconnecting: false, nextRetryIn: null },

  // ═══════════════════════════════════════════════════════════════
  // MESSAGES STATE
  // ═══════════════════════════════════════════════════════════════
  messages: [],
  lastMessage: null,
  messageRate: 0,
  totalMessages: 0,

  // ═══════════════════════════════════════════════════════════════
  // SENSOR DATA STATE
  // ═══════════════════════════════════════════════════════════════
  sensorData: new Map(),
  cameraStatus: {},

  // ═══════════════════════════════════════════════════════════════
  // INTERNAL (no causan re-render)
  // ═══════════════════════════════════════════════════════════════
  _client: null,
  _pendingMessages: [],
  _pendingCount: 0,
  _pendingSensorUpdates: new Map(), // sensorId → mergedData — flushed every 250ms
  _pendingCameraStatus: {},         // cameraId → status — flushed every 250ms
  _messageCount: 0,
  _lastRateUpdate: Date.now(),
  _messageHandlers: new Map(),
  _flushInterval: null,
  _rateInterval: null,
  _cleanupInterval: null,
  _reconnectTimer: null,
  _backoffState: { attempts: 0, currentDelay: 1000 },
  _dynamicTopics: [],
  _topicsLoaded: false,
  _initialized: false,

  // Backoff config
  _backoffConfig: {
    baseDelay: 1000,
    maxDelay: 60000,
    maxRetries: 10,
    multiplier: 2
  },

  // System topics (always subscribe)
  _systemTopics: [
    'camera_rtsp/sensors/#',
    'camera_rtsp/cameras/+/recording/status',
    'camera_rtsp/rules/#'
  ],

  // ═══════════════════════════════════════════════════════════════
  // CONNECTION ACTIONS
  // ═══════════════════════════════════════════════════════════════

  fetchConfig: async () => {
    try {
      set({ isLoadingConfig: true })
      const response = await axios.get(`${API_BASE}/api/mqtt/config`)

      if (response.data.success) {
        const mqttConfig = response.data.data
        try {
          const wsUrlObj = new URL(mqttConfig.wsUrl)
          wsUrlObj.hostname = window.location.hostname
          mqttConfig.wsUrl = wsUrlObj.toString()
        } catch (e) {
          mqttConfig.wsUrl = `ws://${window.location.hostname}:8083/mqtt`
        }
        set({ config: mqttConfig })
        console.log('✅ Configuración MQTT cargada:', mqttConfig.wsUrl)
        return mqttConfig
      }
    } catch (err) {
      console.warn('⚠️ Usando configuración por defecto:', err.message)
      const defaultConfig = {
        wsUrl: `ws://${window.location.hostname}:8083/mqtt`,
        username: '',
        hasPassword: false
      }
      set({ config: defaultConfig })
      return defaultConfig
    } finally {
      set({ isLoadingConfig: false })
    }
  },

  connect: async () => {
    const state = get()
    if (state._client?.connected) {
      console.log('✅ Ya conectado a MQTT')
      return state._client
    }

    let mqttConfig = state.config
    if (!mqttConfig) {
      mqttConfig = await state.fetchConfig()
    }

    if (!mqttConfig?.wsUrl) {
      console.error('❌ No hay URL de WebSocket MQTT configurada')
      set({ error: 'Configuración MQTT no disponible' })
      throw new Error('No MQTT config')
    }

    try {
      console.log('🔌 Conectando a MQTT:', mqttConfig.wsUrl)
      set({ error: null })

      const client = mqtt.connect(mqttConfig.wsUrl, {
        username: mqttConfig.username || '',
        password: '',
        clientId: `camera_rtsp_frontend_${Date.now()}`,
        clean: true,
        reconnectPeriod: 0,
        connectTimeout: 30000
      })

      client.on('connect', () => {
        console.log('✅ Conectado a MQTT broker')
        set({ isConnected: true, error: null })
        get()._resetBackoff()
        // Auto-subscribe after connect
        get()._subscribeToTopics()
        useNotificationStore.getState().addNotification({
          type: 'info',
          title: 'MQTT conectado',
          message: `Broker: ${mqttConfig.wsUrl}`,
          source: 'MQTT'
        })
      })

      client.on('error', (err) => {
        console.error('❌ MQTT Error:', err.message)
        set({ error: err.message })
        useNotificationStore.getState().addNotification({
          type: 'error',
          title: 'Error MQTT',
          message: err.message,
          source: 'MQTT'
        })
      })

      client.on('close', () => {
        console.log('🔌 MQTT desconectado')
        set({ isConnected: false })
        if (!get()._client?.reconnecting) {
          useNotificationStore.getState().addNotification({
            type: 'warning',
            title: 'MQTT desconectado',
            message: 'Intentando reconectar...',
            source: 'MQTT'
          })
          get()._scheduleReconnect()
        }
      })

      client.on('offline', () => {
        console.log('📴 MQTT offline')
        set({ isConnected: false })
      })

      // Message handler — acumula en buffer, no hace set()
      client.on('message', (topic, message) => {
        get()._handleMessage(topic, message)
      })

      // Store client (mutación directa, no reactiva)
      get()._client = client
      return client

    } catch (err) {
      console.error('❌ Error conectando a MQTT:', err.message)
      set({ error: err.message })
      get()._scheduleReconnect()
      throw err
    }
  },

  disconnect: () => {
    const state = get()
    if (state._client) {
      console.log('🔌 Desconectando MQTT...')
      state._client.end(false, () => {
        console.log('✅ MQTT desconectado limpiamente')
      })
      state._client = null
      set({ isConnected: false })
      state._resetBackoff()
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // MESSAGING ACTIONS
  // ═══════════════════════════════════════════════════════════════

  subscribe: (topic, qos = 1) => {
    const client = get()._client
    if (!client) {
      console.warn('MQTT client not available')
      return
    }
    client.subscribe(topic, { qos }, (error) => {
      if (error) console.error(`❌ Error suscribiendo a ${topic}:`, error)
      else console.log(`✅ Suscrito a: ${topic}`)
    })
  },

  unsubscribe: (topic) => {
    const client = get()._client
    if (!client) return
    client.unsubscribe(topic, (error) => {
      if (error) console.error(`❌ Error desuscribiendo de ${topic}:`, error)
      else console.log(`✅ Desuscrito de: ${topic}`)
    })
  },

  publish: (topic, message, options = {}) => {
    const client = get()._client
    if (!client) return Promise.reject(new Error('No MQTT client'))
    return new Promise((resolve, reject) => {
      client.publish(topic, message, options, (error) => {
        if (error) {
          console.error(`❌ Error publicando en ${topic}:`, error)
          reject(error)
        } else {
          resolve()
        }
      })
    })
  },

  registerHandler: (name, handler) => {
    get()._messageHandlers.set(name, handler)
  },

  unregisterHandler: (name) => {
    get()._messageHandlers.delete(name)
  },

  clearMessages: () => {
    set({ messages: [], lastMessage: null })
  },

  clearSensorData: () => {
    set({ sensorData: new Map() })
  },

  // ═══════════════════════════════════════════════════════════════
  // TOPIC MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  reloadTopics: async () => {
    try {
      const response = await fetch('/api/mqtt/sensor-topics')
      const data = await response.json()
      if (data.success && Array.isArray(data.data)) {
        const topics = data.data.map(t => t.topic)
        get()._dynamicTopics = topics
        get()._topicsLoaded = true
        console.log(`📡 Topics dinámicos cargados: ${topics.length}`)
        // Re-subscribe if connected
        if (get().isConnected) {
          get()._subscribeToTopics()
        }
      }
    } catch (error) {
      console.warn('⚠️ Error cargando topics de sensores:', error.message)
      get()._topicsLoaded = true
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SENSOR DATA HELPERS
  // ═══════════════════════════════════════════════════════════════

  getSensor: (sensorId) => {
    return get().sensorData.get(sensorId)
  },

  getActiveSensors: () => {
    const now = Date.now()
    const maxAge = 10000
    const active = []
    get().sensorData.forEach((data, id) => {
      const age = now - new Date(data.timestamp).getTime()
      if (age < maxAge) active.push({ id, ...data })
    })
    return active
  },

  matchTopic: (topic, pattern) => {
    const topicParts = topic.split('/')
    const patternParts = pattern.split('/')
    if (patternParts.length > topicParts.length) return false
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true
      if (patternParts[i] === '+') continue
      if (patternParts[i] !== topicParts[i]) return false
    }
    return patternParts.length === topicParts.length
  },

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION & CLEANUP
  // ═══════════════════════════════════════════════════════════════

  initialize: async () => {
    if (get()._initialized) return
    get()._initialized = true

    // Start intervals
    get()._startFlushInterval()
    get()._startRateInterval()
    get()._startCleanupInterval()

    // Load config and topics
    await get().fetchConfig()
    await get().reloadTopics()

    // Connect
    try {
      await get().connect()
    } catch (err) {
      console.error('❌ Error en conexión inicial MQTT:', err.message)
    }
  },

  destroy: () => {
    const state = get()
    if (state._flushInterval) clearInterval(state._flushInterval)
    if (state._rateInterval) clearInterval(state._rateInterval)
    if (state._cleanupInterval) clearInterval(state._cleanupInterval)
    if (state._reconnectTimer) clearTimeout(state._reconnectTimer)
    state._flushInterval = null
    state._rateInterval = null
    state._cleanupInterval = null
    state._reconnectTimer = null
    state._initialized = false
    state.disconnect()
  },

  // ═══════════════════════════════════════════════════════════════
  // INTERNAL METHODS
  // ═══════════════════════════════════════════════════════════════

  _handleMessage: (topic, message) => {
    try {
      const payload = message.toString()
      const state = get()

      // Increment counters (no reactivo)
      state._messageCount++
      state._pendingCount++

      // Create message object
      const msg = {
        topic,
        payload,
        timestamp: new Date(),
        id: `${topic}-${Date.now()}`
      }

      // Accumulate in buffer
      state._pendingMessages.push(msg)

      // Process sensor data (throttled — no set() call here)
      state._processSensorData(topic, payload)

      // Wire rule:triggered → notification store
      if (topic.startsWith('camera_rtsp/rules/') && topic.includes('/triggered')) {
        try {
          const data = JSON.parse(payload)
          useNotificationStore.getState().addNotification({
            type: 'rule',
            title: `Regla activada: ${data.ruleName || data.name || 'Regla desconocida'}`,
            message: data.description || data.condition || topic,
            source: 'reglas'
          })
        } catch { /* ignore parse errors */ }
      }

      // Call custom handlers
      state._messageHandlers.forEach(handler => {
        try { handler(topic, payload, msg) }
        catch (err) { console.error('Error en message handler:', err) }
      })
    } catch (error) {
      console.error('Error procesando mensaje MQTT:', error)
    }
  },


  _processSensorData: (topic, payload) => {
    try {
      const state = get()
      const isSensorTopic =
        state.matchTopic(topic, 'camera_rtsp/sensors/#') ||
        topic.includes('/emotibit/') ||
        topic.includes('/sensor/') ||
        topic.includes('/co2/') ||
        topic.includes('/humidity/') ||
        topic.includes('/temperature/') ||
        topic.includes('/pressure/') ||
        topic.includes('/light/') ||
        topic.includes('/noise/')

      if (isSensorTopic) {
        const data = JSON.parse(payload)
        const topicParts = topic.split('/')
        const variableName = topicParts[topicParts.length - 1]
        const sensorId = data.sensorId || data.sensor_id || data.device_id ||
          topicParts.slice(-2, -1)[0] || topic

        // --- THROTTLE: accumulate into _pendingSensorUpdates instead of set() ---
        // Merged with current sensorData AND any already-pending update for this sensor.
        const currentData = state._pendingSensorUpdates.get(sensorId)
          || state.sensorData.get(sensorId)
          || { values: {} }

        const mergedData = {
          ...currentData,
          timestamp: data.timestamp || new Date().toISOString(),
          topic,
          sensorId
        }

        if (variableName && variableName !== sensorId) {
          const existingPayload = currentData.values?.[variableName] || {}
          const mergedPayload = { ...existingPayload, ...data }

          const sensorKeys = ['ppg', 'eda', 'temp', 'acc', 'gyr', 'mag', 'hr']
          for (const key of sensorKeys) {
            if (existingPayload[key] && !data[key]) {
              mergedPayload[key] = existingPayload[key]
            }
          }

          mergedData.values = {
            ...(currentData.values || {}),
            [variableName]: mergedPayload
          }
          mergedData[variableName] = mergedPayload
        } else {
          Object.assign(mergedData, data)
        }

        state._pendingSensorUpdates.set(sensorId, mergedData)
      }

      // Camera recording status — also buffered
      if (get().matchTopic(topic, 'camera_rtsp/cameras/+/recording/status')) {
        const data = JSON.parse(payload)
        const cameraId = topic.split('/')[2]
        get()._pendingCameraStatus[cameraId] = {
          isRecording: data.isRecording,
          startTime: data.startTime,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      // Silently ignore parse errors for non-JSON messages
    }
  },

  /**
   * Flush buffer cada 250ms — drena mensajes Y actualizaciones de sensores.
   * 
   * Antes: _processSensorData llamaba set() sincrónicamente por cada mensaje,
   * causando 25 re-renders/s con EmotiBit a 25Hz.
   * Ahora: acumula en _pendingSensorUpdates y aplica en un solo set() aquí.
   */
  _startFlushInterval: () => {
    const interval = setInterval(() => {
      const state = get()
      const pending = state._pendingMessages
      const count = state._pendingCount
      const sensorUpdates = state._pendingSensorUpdates
      const cameraUpdates = state._pendingCameraStatus

      const hasMessages = pending.length > 0
      const hasSensors = sensorUpdates.size > 0
      const hasCamera = Object.keys(cameraUpdates).length > 0

      if (!hasMessages && !hasSensors && !hasCamera) return

      // Clear buffers (direct mutation, not reactive)
      state._pendingMessages = []
      state._pendingCount = 0
      state._pendingSensorUpdates = new Map()
      state._pendingCameraStatus = {}

      set(prev => {
        const next = {}

        if (hasMessages) {
          next.messages = [...prev.messages, ...pending].slice(-100)
          next.lastMessage = pending[pending.length - 1]
          next.totalMessages = prev.totalMessages + count
        }

        if (hasSensors) {
          const newMap = new Map(prev.sensorData)
          sensorUpdates.forEach((data, id) => newMap.set(id, data))
          next.sensorData = newMap
        }

        if (hasCamera) {
          next.cameraStatus = { ...prev.cameraStatus, ...cameraUpdates }
        }

        return next
      })
    }, 250)

    get()._flushInterval = interval
  },

  _startRateInterval: () => {
    const interval = setInterval(() => {
      const state = get()
      const now = Date.now()
      const timeDiff = (now - state._lastRateUpdate) / 1000
      const msgCount = state._messageCount

      if (timeDiff > 0) {
        set({ messageRate: msgCount / timeDiff })
      }

      state._messageCount = 0
      state._lastRateUpdate = now
    }, 1000)

    get()._rateInterval = interval
  },

  _startCleanupInterval: () => {
    const interval = setInterval(() => {
      const now = Date.now()
      const maxAge = 30000

      set(prev => {
        const newMap = new Map()
        prev.sensorData.forEach((data, id) => {
          const age = now - new Date(data.timestamp).getTime()
          if (age < maxAge) newMap.set(id, data)
        })
        return { sensorData: newMap }
      })
    }, 5000)

    get()._cleanupInterval = interval
  },

  _subscribeToTopics: () => {
    const state = get()
    const client = state._client
    if (!client || !state.isConnected) return

    const allTopics = [...new Set([...state._systemTopics, ...state._dynamicTopics])]

    console.log(`📡 Suscribiendo a ${allTopics.length} topics (${state._systemTopics.length} sistema + ${state._dynamicTopics.length} sensores)`)

    allTopics.forEach(topic => {
      client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) console.error(`❌ Error suscribiendo a ${topic}:`, error)
        else console.log(`✅ Suscrito a: ${topic}`)
      })
    })
  },

  _scheduleReconnect: () => {
    const state = get()
    const { attempts } = state._backoffState
    const config = state._backoffConfig

    if (attempts >= config.maxRetries) {
      console.error(`❌ MQTT: Máximo de reintentos alcanzado (${config.maxRetries})`)
      set(prev => ({ reconnectState: { ...prev.reconnectState, isReconnecting: false } }))
      return
    }

    const jitter = Math.random() * 0.3 + 0.85
    const delay = Math.min(
      state._backoffState.currentDelay * config.multiplier * jitter,
      config.maxDelay
    )
    state._backoffState.currentDelay = Math.round(delay)
    state._backoffState.attempts++

    console.log(`🔄 MQTT: Reconexión en ${Math.round(delay)}ms (intento ${state._backoffState.attempts}/${config.maxRetries})`)

    set({
      reconnectState: {
        attempts: state._backoffState.attempts,
        isReconnecting: true,
        nextRetryIn: Math.round(delay)
      }
    })

    state._reconnectTimer = setTimeout(async () => {
      try {
        await get().connect()
        get()._resetBackoff()
        console.log('✅ MQTT: Reconexión exitosa')
      } catch (err) {
        console.error('❌ MQTT: Reconexión fallida:', err.message)
        get()._scheduleReconnect()
      }
    }, delay)
  },

  _resetBackoff: () => {
    const state = get()
    if (state._reconnectTimer) {
      clearTimeout(state._reconnectTimer)
      state._reconnectTimer = null
    }
    state._backoffState = { attempts: 0, currentDelay: 1000 }
    set({ reconnectState: { attempts: 0, isReconnecting: false, nextRetryIn: null } })
  }
}))

export default useMQTTStore
