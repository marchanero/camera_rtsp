import React from 'react'
import SensorErrorBoundary from './SensorErrorBoundary'
import SensorValueDisplay from './SensorValueDisplay'

/**
 * SensorCard — Reusable card for a single sensor.
 *
 * Handles both "scenario" (indigo theme) and "general" (cyan theme) variants
 * by accepting a `colorScheme` prop.
 */
export default function SensorCard({ sensor, colorScheme = 'cyan', SensorIcon }) {
    const { isOnline = false, liveData = null, name, type, sensorId } = sensor

    const iconBase = isOnline
        ? colorScheme === 'indigo'
            ? 'bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-800/20'
            : 'bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-900/40 dark:to-cyan-800/20'
        : 'bg-gray-100 dark:bg-gray-700'

    const iconColor = isOnline
        ? colorScheme === 'indigo'
            ? 'w-5 h-5 text-indigo-600 dark:text-indigo-400'
            : 'w-5 h-5 text-cyan-600 dark:text-cyan-400'
        : 'w-5 h-5 text-gray-400 dark:text-gray-500'

    return (
        <SensorErrorBoundary key={sensor.id || sensorId}>
            <div
                className={`relative rounded-xl p-4 min-h-fit flex flex-col transition-none shadow-sm hover:shadow-md ${isOnline
                        ? 'bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700/50 ring-1 ring-emerald-100 dark:ring-emerald-900/20'
                        : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 opacity-70'
                    }`}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '0 200px' }}
            >
                {/* Header: Icon + Name + Status */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBase}`}>
                            {SensorIcon && <SensorIcon className={iconColor} />}
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate" title={name || type}>
                                {name || type}
                            </h4>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                {sensorId || type}
                            </p>
                        </div>
                    </div>

                    {/* Status badge */}
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${isOnline
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        {isOnline ? 'Online' : 'Offline'}
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100 dark:bg-gray-700 mb-3" />

                {/* Value display */}
                <div className="flex-1 overflow-hidden">
                    {isOnline && liveData
                        ? <SensorValueDisplay data={liveData} sensor={sensor} />
                        : (
                            <div className="h-full flex items-center justify-center">
                                <span className="text-sm text-gray-400 dark:text-gray-500">Sin datos</span>
                            </div>
                        )
                    }
                </div>
            </div>
        </SensorErrorBoundary>
    )
}
