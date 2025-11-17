import React from 'react'

const MqttTopicCard = ({ topic, onToggle, onDelete }) => {
  return (
    <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h4 className="font-medium text-gray-900 dark:text-white truncate">{topic.topic}</h4>
          </div>

          {topic.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{topic.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
              QoS: {topic.qos}
            </span>
            {topic.retained && (
              <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                Retained
              </span>
            )}
            <span className={`text-xs px-2 py-1 rounded ${
              topic.active
                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
            }`}>
              {topic.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 ml-4">
          <button
            onClick={() => onToggle(topic.id, { active: !topic.active })}
            className={`p-2 rounded-md transition-colors duration-200 ${
              topic.active
                ? 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900'
                : 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900'
            }`}
            title={topic.active ? 'Desactivar topic' : 'Activar topic'}
          >
            {topic.active ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => onDelete(topic.id)}
            className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-md transition-colors duration-200"
            title="Eliminar topic"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default MqttTopicCard