/**
 * MotaDisplay — Renders MOTA sensor data payload.
 *
 * MOTA publishes all env variables in a single payload:
 * temperatura, humedad, luz, ruido_dbfs, aqi, tvoc, eco2,
 * bmp_temperatura, bmp_presion, bmp_altitud
 */

const MOTA_VARS = [
    { key: 'temperatura', emoji: '🌡️', unit: '°C', label: 'Temperatura' },
    { key: 'humedad', emoji: '💧', unit: '%', label: 'Humedad' },
    { key: 'luz', emoji: '☀️', unit: 'lux', label: 'Luz' },
    { key: 'ruido_dbfs', emoji: '🔊', unit: 'dB', label: 'Ruido' },
    { key: 'aqi', emoji: '🌬️', unit: '', label: 'AQI' },
    { key: 'tvoc', emoji: '🧪', unit: 'ppb', label: 'TVOC' },
    { key: 'eco2', emoji: '☁️', unit: 'ppm', label: 'eCO2' },
    { key: 'bmp_temperatura', emoji: '🔥', unit: '°C', label: 'Temp BMP' },
    { key: 'bmp_presion', emoji: '🎚️', unit: 'hPa', label: 'Presión' },
    { key: 'bmp_altitud', emoji: '⛰️', unit: 'm', label: 'Altitud' },
]

const MOTA_KEYS = MOTA_VARS.map(v => v.key)

/**
 * Checks if raw sensor data contains MOTA-format keys.
 * Looks at the top level, values.data, and data sub-objects.
 */
export function extractMotaData(rawData) {
    if (!rawData) return null

    if (MOTA_KEYS.some(k => rawData[k] !== undefined)) return rawData

    if (rawData.values?.data && typeof rawData.values.data === 'object') {
        if (MOTA_KEYS.some(k => rawData.values.data[k] !== undefined)) return rawData.values.data
    }

    if (rawData.data && typeof rawData.data === 'object') {
        if (MOTA_KEYS.some(k => rawData.data[k] !== undefined)) return rawData.data
    }

    return null
}

const formatMotaValue = (val) => {
    if (val === null || val === undefined) return '--'
    if (typeof val === 'number') return val.toFixed(1)
    return String(val)
}

export default function MotaDisplay({ motaData }) {
    const availableVars = MOTA_VARS.filter(v => motaData[v.key] !== undefined)

    return (
        <div className="flex flex-col gap-1 w-full h-full overflow-y-auto">
            {availableVars.map(({ key, emoji, unit, label }) => (
                <div
                    key={key}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 text-base">{emoji}</span>
                        <span className="text-gray-700 dark:text-gray-200 font-semibold text-sm truncate">{label}</span>
                    </div>
                    <div className="font-semibold tabular-nums text-right ml-2 flex items-baseline gap-1">
                        <span className="text-gray-900 dark:text-white text-sm">{formatMotaValue(motaData[key])}</span>
                        {unit && <span className="text-xs text-gray-400 dark:text-gray-500">{unit}</span>}
                    </div>
                </div>
            ))}
            {availableVars.length === 0 && (
                <div className="text-center text-gray-400 py-4 text-sm">Esperando datos MOTA...</div>
            )}
        </div>
    )
}
