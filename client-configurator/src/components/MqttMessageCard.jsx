import React from 'react'

const MqttMessageCard = ({ message }) => {
  const formatMessage = (msg) => {
    if (typeof msg === 'string') {
      return msg
    }
    try {
      return JSON.stringify(msg, null, 2)
    } catch {
      return String(msg)
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="font-medium text-blue-600 dark:text-blue-400 text-sm truncate">{message.topic}</span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>

      <div className="mb-2">
        <div className="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-800 p-3 rounded border">
          {formatMessage(message.message)}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <span className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
          QoS: {message.qos}
        </span>
        {message.retain && (
          <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
            Retained
          </span>
        )}
      </div>
    </div>
  )
}

export default MqttMessageCard