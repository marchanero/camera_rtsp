import React from 'react'
import { Theater, Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { formatTime } from '../../utils/formatters'

/**
 * StatusBar - Top status bar component
 * 
 * Displays:
 * - Active scenario with option to clear
 * - Recording timer with pulse animation
 * - MQTT connection status
 * - Sync service status
 */
const StatusBar = ({
    activeScenario,
    onScenarioChange,
    recordingState = 'idle',
    elapsedTime = 0,
    mqttConnected = false,
    syncStatus = { isConnected: false, isSyncing: false },
    isRecordingSyncing = false
}) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Escenario Activo */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <Theater className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                            {activeScenario?.name || 'Sin escenario'}
                        </span>
                        {activeScenario && (
                            <button
                                onClick={() => onScenarioChange(null)}
                                className="ml-1 text-purple-400 hover:text-purple-600 dark:hover:text-purple-300"
                                title="Desactivar escenario"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {activeScenario && (
                        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                                📹 {activeScenario.cameras?.length || 0}
                            </span>
                            <span className="flex items-center gap-1">
                                📡 {activeScenario.sensors?.length || 0}
                            </span>
                        </div>
                    )}
                </div>

                {/* Timer de grabación */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${recordingState === 'recording'
                    ? 'bg-red-50 dark:bg-red-900/20'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                    }`}>
                    <Clock className={`w-4 h-4 ${recordingState === 'recording'
                        ? 'text-red-500'
                        : 'text-gray-400'
                        }`} />
                    <span className={`font-mono text-sm font-medium ${recordingState === 'recording'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                        }`}>
                        {isRecordingSyncing ? (
                            <span className="text-xs">Sincronizando...</span>
                        ) : (
                            formatTime(elapsedTime)
                        )}
                    </span>
                    {recordingState === 'recording' && (
                        <span className="flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                    )}
                </div>

                {/* Status indicators */}
                <div className="flex items-center gap-2">
                    {/* MQTT Status */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${mqttConnected
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        }`}>
                        {mqttConnected ? (
                            <Wifi className="w-3.5 h-3.5" />
                        ) : (
                            <WifiOff className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">MQTT</span>
                    </div>

                    {/* Sync Status */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${syncStatus.isSyncing
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : syncStatus.isConnected
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                        <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Sync</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StatusBar
