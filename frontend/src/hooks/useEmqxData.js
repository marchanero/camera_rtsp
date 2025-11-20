import { useState, useEffect, useCallback } from 'react'
import emqxApi from '../services/emqxApi'

/**
 * Hook para obtener datos de EMQX API
 * Incluye estadísticas del cluster, clientes conectados, y métricas
 */
export const useEmqxData = (autoRefresh = true, interval = 10000) => {
  const [clusterStats, setClusterStats] = useState(null)
  const [clients, setClients] = useState([])
  const [sensorClients, setSensorClients] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [nodes, setNodes] = useState([])
  const [messageMetrics, setMessageMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [
        statsData,
        clientsData,
        sensorClientsData,
        subsData,
        nodesData,
        metricsData
      ] = await Promise.all([
        emqxApi.getClusterStats().catch(() => null),
        emqxApi.getConnectedClients(1, 100).catch(() => ({ data: [] })),
        emqxApi.getSensorClients().catch(() => ({ data: [] })),
        emqxApi.getSubscriptions(1, 100).catch(() => ({ data: [] })),
        emqxApi.getNodes().catch(() => ({ data: [] })),
        emqxApi.getMessageMetrics().catch(() => null)
      ])

      setClusterStats(statsData)
      setClients(clientsData.data || [])
      setSensorClients(sensorClientsData.data || [])
      setSubscriptions(subsData.data || [])
      setNodes(nodesData.data || [])
      setMessageMetrics(metricsData)

    } catch (err) {
      const errorMsg = err.message || 'Error al conectar con EMQX API'
      console.error('[useEmqxData] Error:', errorMsg)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [])

  // Verificar si un sensor específico está conectado
  const isSensorConnected = useCallback(async (sensorId) => {
    try {
      return await emqxApi.isSensorConnected(sensorId)
    } catch (err) {
      console.error(`Error verificando sensor ${sensorId}:`, err)
      return false
    }
  }, [])

  // Obtener detalles de un cliente
  const getClientDetails = useCallback(async (clientId) => {
    try {
      const response = await emqxApi.getClientDetails(clientId)
      return response
    } catch (err) {
      console.error(`Error obteniendo detalles del cliente ${clientId}:`, err)
      return null
    }
  }, [])

  // Fetch inicial
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const intervalId = setInterval(fetchData, interval)
    return () => clearInterval(intervalId)
  }, [autoRefresh, interval, fetchData])

  return {
    // Datos
    clusterStats,
    clients,
    sensorClients,
    subscriptions,
    nodes,
    messageMetrics,

    // Estado
    loading,
    error,

    // Métodos
    refetch: fetchData,
    isSensorConnected,
    getClientDetails
  }
}

export default useEmqxData
