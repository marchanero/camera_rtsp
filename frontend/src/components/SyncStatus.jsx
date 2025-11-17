import React, { useState, useEffect } from 'react'

function SyncStatus() {
  const [syncStatus, setSyncStatus] = useState({
    isConnected: false,
    isSyncing: false,
    lastSyncTime: null,
    pendingFiles: 0,
    syncedFiles: 0,
    totalSize: 0,
    currentFile: null,
    progress: 0,
    error: null,
    remoteServer: null,
    lastSyncResult: null, // 'success', 'error', 'partial'
    lastSyncDetails: null // Información detallada de la última sincronización
  })

  useEffect(() => {
    fetchSyncStatus()
    const interval = setInterval(fetchSyncStatus, 5000) // Actualizar cada 5 segundos
    return () => clearInterval(interval)
  }, [])

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync/status')
      
      // Verificar si la respuesta es JSON válida
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        // El endpoint no existe o devuelve HTML (404)
        setSyncStatus(prev => ({ 
          ...prev, 
          error: null, // No mostrar error si el endpoint no está implementado
          isConnected: false 
        }))
        return
      }
      
      const data = await response.json()
      if (data.success) {
        setSyncStatus(data.data)
      } else {
        setSyncStatus(prev => ({ ...prev, error: data.message || 'Error desconocido' }))
      }
    } catch (error) {
      console.error('Error fetching sync status:', error)
      // No mostrar error en UI si el endpoint no está implementado
      setSyncStatus(prev => ({ 
        ...prev, 
        error: null,
        isConnected: false 
      }))
    }
  }

  const triggerSync = async () => {
    try {
      const response = await fetch('/api/sync/trigger', { method: 'POST' })
      
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        alert('Servicio de sincronización no disponible. Implementa los endpoints en el backend.')
        return
      }
      
      const data = await response.json()
      if (data.success) {
        fetchSyncStatus()
      } else {
        alert('Error al iniciar sincronización: ' + (data.message || 'Error desconocido'))
      }
    } catch (error) {
      console.error('Error triggering sync:', error)
      alert('Servicio de sincronización no disponible')
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Nunca'
    const now = new Date()
    const syncTime = new Date(timestamp)
    const diffMs = now - syncTime
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Hace un momento'
    if (diffMins < 60) return `Hace ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Hace ${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    return `Hace ${diffDays} días`
  }

  const getStatusColor = () => {
    if (syncStatus.error) return 'bg-red-500'
    if (syncStatus.isSyncing) return 'bg-blue-500 animate-pulse'
    if (!syncStatus.isConnected) return 'bg-yellow-500'
    if (syncStatus.pendingFiles > 0) return 'bg-orange-500'
    return 'bg-green-500'
  }

  const getStatusText = () => {
    if (syncStatus.error) return 'Error'
    if (syncStatus.isSyncing) return 'Sincronizando'
    if (!syncStatus.isConnected) return 'Desconectado'
    if (syncStatus.pendingFiles > 0) return 'Pendiente'
    return 'Sincronizado'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🔄</span>
            <span>Sincronización de Datos</span>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Videos y sensores al servidor remoto
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-white text-sm font-semibold flex items-center gap-2 ${getStatusColor()}`}>
          <span className={syncStatus.isSyncing ? 'animate-spin' : ''}>
            {syncStatus.isSyncing ? '⟳' : syncStatus.error ? '⚠' : syncStatus.isConnected ? '✓' : '○'}
          </span>
          {getStatusText()}
        </div>
      </div>

      {/* Mensaje si el servicio no está disponible */}
      {!syncStatus.isConnected && !syncStatus.isSyncing && !syncStatus.lastSyncTime && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div className="flex-1">
              <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Servicio de sincronización no configurado
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Para habilitar la sincronización automática de videos y datos de sensores:
              </div>
              <ul className="mt-2 text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>Implementa el endpoint <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">GET /api/sync/status</code></li>
                <li>Implementa el endpoint <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">POST /api/sync/trigger</code></li>
                <li>Configura rsync con el servidor remoto</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Información del Servidor */}
      {syncStatus.remoteServer && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">🖥️ Servidor:</span>
            <code className="text-gray-900 dark:text-white font-mono">
              {syncStatus.remoteServer}
            </code>
          </div>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {syncStatus.pendingFiles}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Pendientes
          </div>
        </div>
        
        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {syncStatus.syncedFiles}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Sincronizados
          </div>
        </div>
        
        <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatBytes(syncStatus.totalSize)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Tamaño Total
          </div>
        </div>
        
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-sm font-bold text-gray-900 dark:text-white">
            {formatTimeAgo(syncStatus.lastSyncTime)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Última Sync
          </div>
        </div>
      </div>

      {/* Estado de Sincronización en Curso */}
      {syncStatus.isSyncing && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg border-l-4 border-blue-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-xl animate-spin">⟳</span>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-blue-900 dark:text-blue-100">
                Sincronización en progreso
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                {syncStatus.currentFile ? (
                  <span className="font-mono text-xs">📄 {syncStatus.currentFile}</span>
                ) : (
                  'Preparando archivos para transferir...'
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {syncStatus.progress}%
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                completado
              </div>
            </div>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-900/50 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500 ease-out relative"
              style={{ width: `${syncStatus.progress}%` }}
            >
              <div className="absolute inset-0 bg-blue-400 opacity-50 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* Última Sincronización Completada */}
      {!syncStatus.isSyncing && syncStatus.lastSyncTime && (
        <div className={`mb-6 p-4 rounded-lg border-l-4 ${
          syncStatus.lastSyncResult === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
            : syncStatus.lastSyncResult === 'partial'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
            : syncStatus.lastSyncResult === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
            : 'bg-gray-50 dark:bg-gray-800/50 border-gray-500'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              syncStatus.lastSyncResult === 'success' 
                ? 'bg-green-500'
                : syncStatus.lastSyncResult === 'partial'
                ? 'bg-yellow-500'
                : syncStatus.lastSyncResult === 'error'
                ? 'bg-red-500'
                : 'bg-gray-500'
            }`}>
              <span className="text-white text-xl">
                {syncStatus.lastSyncResult === 'success' ? '✓' : 
                 syncStatus.lastSyncResult === 'partial' ? '⚠' :
                 syncStatus.lastSyncResult === 'error' ? '✕' : 'ℹ'}
              </span>
            </div>
            <div className="flex-1">
              <div className={`font-semibold ${
                syncStatus.lastSyncResult === 'success' 
                  ? 'text-green-900 dark:text-green-100'
                  : syncStatus.lastSyncResult === 'partial'
                  ? 'text-yellow-900 dark:text-yellow-100'
                  : syncStatus.lastSyncResult === 'error'
                  ? 'text-red-900 dark:text-red-100'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {syncStatus.lastSyncResult === 'success' 
                  ? 'Última sincronización exitosa'
                  : syncStatus.lastSyncResult === 'partial'
                  ? 'Sincronización parcial'
                  : syncStatus.lastSyncResult === 'error'
                  ? 'Última sincronización falló'
                  : 'Última sincronización'}
              </div>
              <div className={`text-sm mt-1 ${
                syncStatus.lastSyncResult === 'success' 
                  ? 'text-green-700 dark:text-green-300'
                  : syncStatus.lastSyncResult === 'partial'
                  ? 'text-yellow-700 dark:text-yellow-300'
                  : syncStatus.lastSyncResult === 'error'
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span>🕐 {new Date(syncStatus.lastSyncTime).toLocaleString('es-ES')}</span>
                  <span className="text-xs opacity-70">({formatTimeAgo(syncStatus.lastSyncTime)})</span>
                </div>
                {syncStatus.lastSyncDetails && (
                  <div className="mt-2 space-y-1">
                    {syncStatus.lastSyncDetails.filesTransferred !== undefined && (
                      <div className="flex items-center gap-1 text-xs">
                        <span>📦</span>
                        <span>{syncStatus.lastSyncDetails.filesTransferred} archivos transferidos</span>
                      </div>
                    )}
                    {syncStatus.lastSyncDetails.bytesTransferred !== undefined && (
                      <div className="flex items-center gap-1 text-xs">
                        <span>💾</span>
                        <span>{formatBytes(syncStatus.lastSyncDetails.bytesTransferred)} transferidos</span>
                      </div>
                    )}
                    {syncStatus.lastSyncDetails.duration !== undefined && (
                      <div className="flex items-center gap-1 text-xs">
                        <span>⏱️</span>
                        <span>Duración: {syncStatus.lastSyncDetails.duration}s</span>
                      </div>
                    )}
                    {syncStatus.lastSyncDetails.errorCount > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span>⚠️</span>
                        <span>{syncStatus.lastSyncDetails.errorCount} archivos con errores</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progreso de Sincronización (Legacy - Se puede eliminar si usamos el nuevo) */}
      {syncStatus.isSyncing && false && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {syncStatus.currentFile ? (
                <span className="font-mono text-xs">📄 {syncStatus.currentFile}</span>
              ) : (
                'Preparando archivos...'
              )}
            </span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {syncStatus.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500 ease-out"
              style={{ width: `${syncStatus.progress}%` }}
            >
              <div className="h-full bg-blue-400 opacity-50 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {syncStatus.error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-red-600 dark:text-red-400">⚠️</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                Error de Sincronización
              </div>
              <div className="text-xs text-red-600 dark:text-red-500 mt-1">
                {syncStatus.error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-3">
        <button
          onClick={triggerSync}
          disabled={syncStatus.isSyncing || !syncStatus.isConnected}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            syncStatus.isSyncing || !syncStatus.isConnected
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg'
          }`}
        >
          {syncStatus.isSyncing ? (
            <>
              <span className="inline-block animate-spin mr-2">⟳</span>
              Sincronizando...
            </>
          ) : (
            <>
              <span className="mr-2">🔄</span>
              Sincronizar Ahora
            </>
          )}
        </button>
        
        <button
          onClick={fetchSyncStatus}
          className="px-4 py-2 rounded-lg font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-all duration-200"
        >
          ♻️ Actualizar
        </button>
      </div>

      {/* Información Adicional */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
          <span>ℹ️</span>
          <div>
            <strong>Sincronización automática:</strong> Videos y datos de sensores se sincronizan 
            automáticamente cada 5 minutos después de finalizar una grabación o según el 
            temporizador configurado. También puedes forzar una sincronización manual usando 
            el botón "Sincronizar Ahora".
          </div>
        </div>
      </div>
    </div>
  )
}

export default SyncStatus
