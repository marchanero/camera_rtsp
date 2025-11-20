/**
 * EMQX API Service
 * Cliente para interactuar con la API REST de EMQX
 */

import axios from 'axios'

// Configuración de la API de EMQX
const EMQX_API_BASE = import.meta.env.VITE_EMQX_API_URL || 'http://100.82.84.24:18083/api/v5'
const EMQX_API_KEY = import.meta.env.VITE_EMQX_API_KEY || 'admin'
const EMQX_API_SECRET = import.meta.env.VITE_EMQX_API_SECRET || 'galgo2526'

// Crear instancia de axios
const emqxClient = axios.create({
  baseURL: EMQX_API_BASE,
  timeout: 10000
})

// Interceptor para agregar autenticación
emqxClient.interceptors.request.use(config => {
  const credentials = btoa(`${EMQX_API_KEY}:${EMQX_API_SECRET}`)
  config.headers.Authorization = `Basic ${credentials}`
  return config
})

export const emqxApi = {
  /**
   * Obtener estadísticas del cluster
   */
  async getClusterStats() {
    try {
      const response = await emqxClient.get('/stats')
      return response.data
    } catch (error) {
      console.error('Error obteniendo stats del cluster:', error)
      throw error
    }
  },

  /**
   * Obtener clientes conectados
   */
  async getConnectedClients(page = 1, limit = 100) {
    try {
      const response = await emqxClient.get('/clients', {
        params: { page, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error obteniendo clientes:', error)
      throw error
    }
  },

  /**
   * Obtener clientes por patrón de clientId
   */
  async getClientsByPattern(pattern) {
    try {
      const response = await emqxClient.get('/clients', {
        params: { 
          like_clientid: pattern,
          limit: 1000
        }
      })
      return response.data
    } catch (error) {
      console.error('Error obteniendo clientes por patrón:', error)
      throw error
    }
  },

  /**
   * Obtener detalles de un cliente específico
   */
  async getClientDetails(clientId) {
    try {
      const response = await emqxClient.get(`/clients/${encodeURIComponent(clientId)}`)
      return response.data
    } catch (error) {
      console.error(`Error obteniendo detalles del cliente ${clientId}:`, error)
      throw error
    }
  },

  /**
   * Obtener suscripciones activas
   */
  async getSubscriptions(page = 1, limit = 100) {
    try {
      const response = await emqxClient.get('/subscriptions', {
        params: { page, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error obteniendo suscripciones:', error)
      throw error
    }
  },

  /**
   * Obtener suscripciones de un cliente
   */
  async getClientSubscriptions(clientId) {
    try {
      const response = await emqxClient.get('/subscriptions', {
        params: { 
          clientid: clientId,
          limit: 100
        }
      })
      return response.data
    } catch (error) {
      console.error(`Error obteniendo suscripciones del cliente ${clientId}:`, error)
      throw error
    }
  },

  /**
   * Obtener nodos del cluster
   */
  async getNodes() {
    try {
      const response = await emqxClient.get('/nodes')
      return response.data
    } catch (error) {
      console.error('Error obteniendo nodos:', error)
      throw error
    }
  },

  /**
   * Obtener métricas de mensajes
   */
  async getMessageMetrics() {
    try {
      const response = await emqxClient.get('/stats')
      const data = response.data
      return {
        received: data['messages.received'] || 0,
        sent: data['messages.sent'] || 0,
        dropped: data['messages.dropped'] || 0,
        retained: data['messages.retained'] || 0,
        delivered: data['messages.delivered'] || 0,
        acked: data['messages.acked'] || 0
      }
    } catch (error) {
      console.error('Error obteniendo métricas de mensajes:', error)
      throw error
    }
  },

  /**
   * Obtener clientes de sensores (sensor-publisher-*)
   */
  async getSensorClients() {
    try {
      const response = await emqxClient.get('/clients', {
        params: { 
          like_clientid: 'sensor-',
          limit: 1000
        }
      })
      return response.data
    } catch (error) {
      console.error('Error obteniendo clientes de sensores:', error)
      throw error
    }
  },

  /**
   * Verificar si un sensor está conectado
   */
  async isSensorConnected(sensorId) {
    try {
      // Buscar cliente con patrón del sensorId
      const response = await emqxClient.get('/clients', {
        params: { 
          like_clientid: sensorId,
          limit: 10
        }
      })
      
      const clients = response.data?.data || []
      return clients.length > 0
    } catch (error) {
      console.error(`Error verificando conexión del sensor ${sensorId}:`, error)
      return false
    }
  },

  /**
   * Obtener tópicos activos
   */
  async getTopics(page = 1, limit = 100) {
    try {
      const response = await emqxClient.get('/topics', {
        params: { page, limit }
      })
      return response.data
    } catch (error) {
      console.error('Error obteniendo tópicos:', error)
      throw error
    }
  },

  /**
   * Obtener rutas (routes) de mensajes
   */
  async getRoutes(topic = null) {
    try {
      const params = topic ? { topic } : { limit: 1000 }
      const response = await emqxClient.get('/routes', { params })
      return response.data
    } catch (error) {
      console.error('Error obteniendo rutas:', error)
      throw error
    }
  }
}

export default emqxApi
