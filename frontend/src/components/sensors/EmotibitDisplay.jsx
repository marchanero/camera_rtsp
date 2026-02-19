import React, { useState, useRef, useEffect, memo } from 'react'
import { calculateHeartRate } from '../../utils/heartRateCalculator'

/**
 * EmotibitDisplay — Renders EmotiBit sensor data.
 *
 * EmotiBit firmware sends data in multiple MQTT topics that get merged:
 *   /status  → { status, rssi, uptime }
 *   /data    → { ts, int, ppg, eda, temp, acc, gyr, mag, hr }
 *
 * Data arrives at 25 Hz (PPG). Uses a ref-based cache to preserve
 * values between packets and avoid UI flickering.
 */

const EMOTIBIT_VARS = [
    { key: 'hr', emoji: '❤️', label: 'Heart Rate', unit: '', subkeys: ['bpm', 'ibi'], subkeyUnits: { bpm: 'BPM', ibi: 'ms' } },
    { key: 'ppg', emoji: '💓', label: 'PPG', unit: 'counts', subkeys: ['g', 'r', 'ir'], subkeyUnits: { g: '', r: '', ir: '' } },
    { key: 'eda', emoji: '⚡', label: 'EDA', unit: 'µS', subkeys: ['uS', 'v'], subkeyUnits: { uS: 'µS', v: 'µS' } },
    { key: 'temp', emoji: '🌡️', label: 'Temp', unit: '°C', subkeys: ['c', 'skin'], subkeyUnits: { c: '°C', skin: '°C' } },
    { key: 'acc', emoji: '📐', label: 'Accel', unit: 'g', subkeys: ['x', 'y', 'z'], subkeyUnits: { x: 'g', y: 'g', z: 'g' } },
    { key: 'gyr', emoji: '🔄', label: 'Gyro', unit: '°/s', subkeys: ['x', 'y', 'z'], subkeyUnits: { x: '°/s', y: '°/s', z: '°/s' } },
    { key: 'mag', emoji: '🧲', label: 'Mag', unit: 'µT', subkeys: ['x', 'y', 'z'], subkeyUnits: { x: 'µT', y: 'µT', z: 'µT' } },
]

const STATUS_FIELDS = [
    { key: 'status', emoji: '📶', label: 'Estado' },
    { key: 'rssi', emoji: '📡', label: 'RSSI', unit: 'dB' },
    { key: 'uptime', emoji: '⏱️', label: 'Uptime', unit: 's' },
]

const DATA_META_FIELDS = [
    {
        key: 'ts', emoji: '🕐', label: 'Timestamp', format: (ts) => {
            if (!ts) return '--'
            try { return new Date(typeof ts === 'number' ? ts : parseInt(ts)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
            catch { return '--' }
        }
    },
    { key: 'int', emoji: '⏱️', label: 'Intervalo', unit: 'ms' },
]

function extractEmotibitData(rawData) {
    if (!rawData) return { status: null, sensorData: null, allVariables: {} }

    let status = null
    let sensorData = null
    let allVariables = {}

    if (rawData.values?.status) {
        status = rawData.values.status
        if (typeof status === 'object' && status.data) status = { ...status, ...status.data }
    } else if (rawData.status && typeof rawData.status === 'object') {
        status = rawData.status
    }

    if (rawData.values?.data) {
        sensorData = rawData.values.data
    } else if (rawData.data && typeof rawData.data === 'object') {
        sensorData = rawData.data
    }

    if (rawData.values && typeof rawData.values === 'object') {
        Object.entries(rawData.values).forEach(([key, value]) => {
            if (key !== 'status' && key !== 'data' && typeof value === 'object') {
                allVariables[key] = value
            }
        })
    }

    return { status, sensorData, allVariables }
}

const formatArrayValue = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return '--'
    const lastVal = arr[arr.length - 1]
    if (lastVal === null || lastVal === undefined) return '--'
    const formatted = typeof lastVal === 'number' ? lastVal.toFixed(2) : String(lastVal)
    return `${formatted} [${arr.length}]`
}

const formatSubkeyValue = (val) => {
    if (val === null || val === undefined) return '--'
    if (Array.isArray(val)) return formatArrayValue(val)
    if (typeof val === 'number') return val.toFixed(2)
    return String(val)
}

const formatStatusValue = (val) => {
    if (val === null || val === undefined) return '--'
    if (typeof val === 'number') return val.toFixed(1)
    if (typeof val === 'boolean') return val ? 'Sí' : 'No'
    return String(val)
}

const EmotibitDisplay = memo(function EmotibitDisplay({ data }) {
    const [calculatedHR, setCalculatedHR] = useState({ hr: 0, ibi: 0, quality: 0 })

    const cacheRef = useRef({ status: null, sensorData: null, allVariables: {} })

    // Calculate HR from PPG data
    useEffect(() => {
        if (!data) return
        const ppgData = data.values?.data?.ppg || data.data?.ppg || data.ppg
        const timestamp = data.timestamp || Date.now()
        if (ppgData) {
            const result = calculateHeartRate(ppgData, timestamp)
            if (result.hr > 0) setCalculatedHR(result)
        }
    }, [data])

    // Update cache with latest data (deep merge to survive intermittent packets)
    useEffect(() => {
        if (!data) return
        const { status, sensorData, allVariables } = extractEmotibitData(data)
        if (status) cacheRef.current.status = { ...cacheRef.current.status, ...status }
        if (sensorData) cacheRef.current.sensorData = { ...cacheRef.current.sensorData, ...sensorData }
        cacheRef.current.allVariables = { ...cacheRef.current.allVariables, ...allVariables }
    }, [data])

    const { status: extractedStatus, sensorData: extractedSensorData, allVariables: extractedVars } = extractEmotibitData(data)
    const status = extractedStatus || cacheRef.current.status
    const sensorData = extractedSensorData || cacheRef.current.sensorData
    const allVariables = { ...cacheRef.current.allVariables, ...extractedVars }

    return (
        <div className="flex flex-col gap-1 text-[10px] w-full h-full overflow-y-auto">
            {/* Status section */}
            {status && (
                <>
                    {STATUS_FIELDS.map(({ key, emoji, label, unit }) => {
                        if (status[key] === undefined) return null
                        return (
                            <div key={key} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 min-h-[24px]">
                                <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="flex-shrink-0">{emoji}</span>
                                    <span className="text-gray-600 dark:text-gray-300 font-medium truncate">{label}</span>
                                </span>
                                <span className="font-semibold tabular-nums text-right ml-2 flex items-baseline gap-1">
                                    <span className="text-gray-900 dark:text-white">{formatStatusValue(status[key])}</span>
                                    {unit && <span className="text-[9px] text-gray-400">{unit}</span>}
                                </span>
                            </div>
                        )
                    })}
                    <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
                </>
            )}

            {/* Data metadata (ts, int) */}
            {sensorData && (sensorData.ts || sensorData.int) && (
                <>
                    {DATA_META_FIELDS.map(({ key, emoji, label, unit, format }) => {
                        if (sensorData[key] === undefined) return null
                        const val = format ? format(sensorData[key]) : sensorData[key]
                        return (
                            <div key={`meta-${key}`} className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 rounded px-2 py-1 min-h-[24px]">
                                <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="flex-shrink-0">{emoji}</span>
                                    <span className="text-gray-600 dark:text-gray-300 font-medium truncate">{label}</span>
                                </span>
                                <span className="font-semibold tabular-nums text-right ml-2 flex items-baseline gap-1">
                                    <span className="text-gray-900 dark:text-white">{val}</span>
                                    {unit && <span className="text-[9px] text-gray-400">{unit}</span>}
                                </span>
                            </div>
                        )
                    })}
                    <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
                </>
            )}

            {/* Sensor variable rows: hr, ppg, eda, temp, acc, gyr, mag */}
            {EMOTIBIT_VARS.map(({ key, emoji, label, unit, subkeys, subkeyUnits }) => {
                const sensorVal = sensorData?.[key] || {}
                const hasSubkeys = subkeys.some(sk => sensorVal[sk] !== undefined)
                return (
                    <div key={key} className="bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="flex-shrink-0 text-base">{emoji}</span>
                            <span className="text-gray-700 dark:text-gray-200 font-semibold text-sm">{label}</span>
                            {unit && <span className="text-xs text-gray-400 dark:text-gray-500">({unit})</span>}
                        </div>
                        <div className="pl-6 space-y-1">
                            {subkeys.filter(sk => sensorVal[sk] !== undefined).map(sk => (
                                <div key={sk} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500 dark:text-gray-400 font-mono w-10">{sk}:</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-100 w-20 text-right">
                                            {formatSubkeyValue(sensorVal[sk])}
                                        </span>
                                        {subkeyUnits?.[sk] && <span className="text-[10px] text-gray-400 dark:text-gray-500 w-8">{subkeyUnits[sk]}</span>}
                                    </div>
                                </div>
                            ))}
                            {!hasSubkeys && <span className="text-[10px] text-gray-400">--</span>}
                        </div>
                    </div>
                )
            })}

            {/* Additional nested variables */}
            {Object.keys(allVariables).length > 0 && (
                <>
                    <div className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
                    <div className="text-[9px] text-gray-500 dark:text-gray-400 px-1">Variables adicionales:</div>
                    {Object.entries(allVariables).map(([varName, varData]) => {
                        if (!varData || typeof varData !== 'object') return null
                        let displayValue = '--'
                        if (varData.data !== undefined) {
                            if (Array.isArray(varData.data)) {
                                const last = varData.data[varData.data.length - 1]
                                displayValue = `[${varData.data.length}] ${typeof last === 'number' ? last.toFixed(2) : last}`
                            } else if (typeof varData.data === 'object') {
                                displayValue = Object.entries(varData.data)
                                    .map(([k, v]) => Array.isArray(v)
                                        ? `${k}:${v[v.length - 1]?.toFixed?.(1) || v[v.length - 1]}[${v.length}]`
                                        : `${k}:${typeof v === 'number' ? v.toFixed(1) : v}`)
                                    .join(' ')
                            } else {
                                displayValue = String(varData.data)
                            }
                        } else if (varData.value !== undefined) {
                            displayValue = String(varData.value)
                        }
                        return (
                            <div key={varName} className="flex flex-col gap-0.5 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 min-h-[24px]">
                                <span className="text-gray-600 dark:text-gray-300 font-medium">{varName}</span>
                                <span className="text-[9px] text-gray-700 dark:text-gray-200 pl-2 break-all">{displayValue}</span>
                            </div>
                        )
                    })}
                </>
            )}

            {!status && !sensorData && Object.keys(allVariables).length === 0 && (
                <div className="text-center text-gray-400 py-4">Esperando datos EmotiBit...</div>
            )}
        </div>
    )
})

export default EmotibitDisplay
