import React, { useRef, useEffect, useState } from 'react'
import { HardDrive, Activity, Gauge, Radio } from 'lucide-react'
import { formatBytes } from '../../utils/formatters'

/**
 * SystemStats - System metrics and disk information sidebar
 * 
 * Displays:
 * - Local disk usage with visual bar
 * - Remote disk usage with visual bar
 * - Active sensors list
 * - System metrics
 */
const SystemStats = ({
    localDiskInfo,
    remoteDiskInfo,
    activeSensors = [],
    stats = {}
}) => {
    // Cache for previous sensors to prevent flickering
    const prevSensorsRef = useRef([])
    const [displaySensors, setDisplaySensors] = useState([])

    // Update display sensors only when we have actual data
    useEffect(() => {
        if (activeSensors.length > 0) {
            prevSensorsRef.current = activeSensors
            setDisplaySensors(activeSensors)
        } else if (prevSensorsRef.current.length > 0) {
            // Keep previous sensors if new data is empty
            setDisplaySensors(prevSensorsRef.current)
        }
    }, [activeSensors])
    /**
     * Renders disk info panel
     */
    const renderDiskInfo = (diskInfo, title, icon) => {
        if (!diskInfo || !diskInfo.available) {
            return (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        {icon}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">No disponible</p>
                </div>
            )
        }

        const usePercent = diskInfo.usePercent || 0
        const bgColor = usePercent >= 90 ? 'bg-red-500' : usePercent >= 75 ? 'bg-yellow-500' : 'bg-green-500'

        return (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        {icon}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
                    </div>
                    <span className={`text-xs font-medium ${usePercent >= 90 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {usePercent}%
                    </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                    <div
                        className={`${bgColor} h-2 rounded-full transition-all`}
                        style={{ width: `${usePercent}%` }}
                    ></div>
                </div>

                {/* Disk stats */}
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>{diskInfo.freeGB || 0} GB libres</span>
                    <span>{diskInfo.totalGB || 0} GB total</span>
                </div>

                {diskInfo.isMount && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {diskInfo.mountPath}
                    </p>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Disk Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-indigo-500" />
                    Almacenamiento
                </h3>
                <div className="space-y-3">
                    {renderDiskInfo(
                        localDiskInfo,
                        'Disco Local',
                        <Gauge className="w-4 h-4 text-blue-500" />
                    )}
                    {renderDiskInfo(
                        remoteDiskInfo,
                        'Disco Remoto',
                        <Gauge className="w-4 h-4 text-purple-500" />
                    )}
                </div>
            </div>

            {/* System Stats - Now after storage */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-orange-500" />
                    Estadísticas
                </h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Cámaras activas</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                            {stats.activeCameras || 0}/{stats.totalCameras || 0}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Grabaciones</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                            {stats.recordingCameras || 0}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Sensores</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                            {stats.activeSensors || 0}/{stats.totalSensors || 0}
                        </span>
                    </div>
                    {stats.messagesPerSecond !== undefined && (
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Msg/s</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {stats.messagesPerSecond.toFixed(1)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Sensors - Now at the bottom */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-green-500" />
                    Sensores Activos
                    {displaySensors.length > 0 && (
                        <span className="ml-auto text-xs font-normal text-gray-500 dark:text-gray-400">
                            {displaySensors.length}
                        </span>
                    )}
                </h3>
                <div className="space-y-2">
                    {displaySensors.length > 0 ? (
                        displaySensors.map((sensor) => {
                            // Format sensor value - handle objects and primitives
                            const formatValue = (val) => {
                                if (val === undefined || val === null) return '-'
                                if (typeof val === 'object') {
                                    // For xyz coordinates like accel/gyro
                                    if ('x' in val && 'y' in val && 'z' in val) {
                                        return `x:${val.x?.toFixed?.(1) ?? val.x} y:${val.y?.toFixed?.(1) ?? val.y} z:${val.z?.toFixed?.(1) ?? val.z}`
                                    }
                                    // For other objects, just show key count
                                    return `${Object.keys(val).length} campos`
                                }
                                if (typeof val === 'number') return val.toFixed(2)
                                return String(val)
                            }

                            return (
                                <div
                                    key={sensor.id}
                                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={sensor.id}>
                                            {sensor.type || sensor.id?.split('/').pop() || 'Sensor'}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[80px]" title={String(sensor.value)}>
                                        {formatValue(sensor.value)}
                                    </span>
                                </div>
                            )
                        })
                    ) : (
                        <div className="text-center py-2 text-xs text-gray-400 dark:text-gray-500">
                            Esperando datos de sensores...
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default SystemStats
