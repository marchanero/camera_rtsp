import React, { useEffect } from 'react'

const MqttConnectionStatus = ({ mqttStatus, mqttConnecting }) => {
  // Log del estado del componente para debugging
  useEffect(() => {
    console.log('🔍 MqttConnectionStatus - Estado actual:', {
      mqttStatus,
      mqttConnecting,
      connected: mqttStatus?.connected,
      broker: mqttStatus?.broker,
      clientId: mqttStatus?.clientId,
      lastChecked: mqttStatus?.lastChecked
    })
  }, [mqttStatus, mqttConnecting])

  const getStatusInfo = () => {
    console.log('📊 getStatusInfo - Evaluando estado:', {
      mqttConnecting,
      'mqttStatus.connected': mqttStatus?.connected,
      'Status completo': mqttStatus
    })

    if (mqttConnecting) {
      return {
        status: 'connecting',
        text: 'Conectando...',
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-700',
        icon: (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      }
    }

    if (mqttStatus.connected) {
      return {
        status: 'connected',
        text: 'Conectado al Broker',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-700',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      }
    }

    return {
      status: 'disconnected',
      text: 'Desconectado del Broker',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-700',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor} transition-all duration-300`}>
      <div className={`flex-shrink-0 ${statusInfo.color}`}>
        {statusInfo.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${statusInfo.color}`}>
          {statusInfo.text}
        </div>
        {mqttStatus.broker && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {mqttStatus.broker}
          </div>
        )}
        {mqttStatus.lastChecked && (
          <div className="text-xs text-gray-400 dark:text-gray-500">
            Última verificación: {new Date(mqttStatus.lastChecked).toLocaleTimeString()}
          </div>
        )}
      </div>
      {mqttStatus.connected && (
        <div className="flex-shrink-0">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  )
}

export default MqttConnectionStatus