import { memo } from 'react'
import EmotibitDisplay from './EmotibitDisplay'
import MotaDisplay, { extractMotaData } from './MotaDisplay'

/**
 * SensorValueDisplay — Memoized display dispatcher.
 *
 * Decides which specialized display to use based on data shape:
 *   1. EmotiBit  → sensor.type === 'emotibit'
 *   2. MOTA      → data has MOTA keys (temp, hum, light, etc.)
 *   3. Generic   → scalar or object with arbitrary keys
 */

const LABEL_MAP = {
    temperatura: '🌡️', humedad: '💧', aqi: '🌬️', tvoc: '🧪', eco2: '☁️',
    bmp_temperatura: '🔥', bmp_presion: '🎚️', bmp_altitud: '⛰️',
    luz: '☀️', ruido_dbfs: '🔊', heart_rate: '❤️', eda: '⚡',
    ppg: '📈', hrv: '💚', temperature: '🌡️', accel: '📐', gyro: '🔄', mag: '🧲'
}

const UNIT_MAP = {
    temperatura: '°C', humedad: '%', aqi: '', tvoc: 'ppb', eco2: 'ppm',
    bmp_temperatura: '°C', bmp_presion: 'hPa', bmp_altitud: 'm',
    luz: 'lux', ruido_dbfs: 'dB', heart_rate: 'bpm', eda: 'μS',
    ppg: '', hrv: 'ms', temperature: '°C', accel: 'g', gyro: '°/s', mag: 'μT'
}

const PRIORITY_KEYS = ['temperatura', 'humedad', 'aqi', 'luz', 'ruido_dbfs', 'heart_rate', 'eda']

function formatGenericValue(val) {
    if (val === null || val === undefined) return '--'
    if (typeof val === 'number') return val.toFixed(1)
    if (typeof val === 'object') {
        const keys = Object.keys(val)
        if (keys.length <= 3) {
            return keys.map(k => `${k}:${typeof val[k] === 'number' ? val[k].toFixed(0) : val[k]}`).join(' ')
        }
        return `{${keys.length} props}`
    }
    return String(val)
}

function extractValue(rawData) {
    if (!rawData) return null
    if (rawData.value !== undefined) return rawData.value
    if (rawData.data?.value !== undefined) return rawData.data.value
    const dataKeys = Object.keys(rawData).filter(k =>
        !['sensorId', 'sensor_id', 'timestamp', 'topic', 'type', 'location', 'name', 'recording', 'values'].includes(k)
    )
    if (dataKeys.length === 1) return rawData[dataKeys[0]]
    if (dataKeys.length > 1) return dataKeys.reduce((obj, key) => ({ ...obj, [key]: rawData[key] }), {})
    return null
}

const SensorValueDisplay = memo(function SensorValueDisplay({ data, sensor }) {
    const unit = sensor?.unit || ''
    const sensorType = sensor?.type?.toLowerCase() || ''

    // 1 — EmotiBit
    if (sensorType === 'emotibit') {
        return <EmotibitDisplay data={data} />
    }

    // 2 — MOTA (detect by data structure)
    const motaData = extractMotaData(data)
    if (motaData) {
        return <MotaDisplay motaData={motaData} />
    }

    // 3 — Generic
    const value = extractValue(data)

    if (value === null || value === undefined) {
        return <span className="text-gray-400">--</span>
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value)
        const sorted = entries.sort((a, b) => {
            const ai = PRIORITY_KEYS.indexOf(a[0])
            const bi = PRIORITY_KEYS.indexOf(b[0])
            if (ai === -1 && bi === -1) return 0
            if (ai === -1) return 1
            if (bi === -1) return -1
            return ai - bi
        })
        return (
            <div className="flex flex-col gap-1 w-full h-full overflow-y-auto">
                {sorted.map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="flex-shrink-0 text-base">{LABEL_MAP[key] || '📊'}</span>
                            <span className="text-gray-700 dark:text-gray-200 font-semibold text-sm truncate">{key.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="font-semibold tabular-nums text-right ml-2 flex items-baseline gap-1">
                            <span className="text-gray-900 dark:text-white text-sm">{formatGenericValue(val)}</span>
                            {UNIT_MAP[key] && <span className="text-xs text-gray-400 dark:text-gray-500">{UNIT_MAP[key]}</span>}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (typeof value === 'number') {
        return (
            <span className="tabular-nums whitespace-nowrap text-2xl">
                {value.toFixed(1)}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{unit}</span>
            </span>
        )
    }

    return <span className="text-gray-700 dark:text-gray-300">{String(value)}</span>
})

export default SensorValueDisplay
