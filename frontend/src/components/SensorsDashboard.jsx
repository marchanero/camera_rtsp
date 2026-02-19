import { useMQTTStore } from '../stores/useMQTTStore'
import { useEmqxData } from '../hooks/useEmqxData'
import { useSensorList } from '../hooks/useSensorList'
import SensorCard from './sensors/SensorCard'
import {
  Activity, Radio, RefreshCw, Wifi, WifiOff,
  MessageSquare, MapPin, Loader2, AlertCircle
} from 'lucide-react'
import {
  Activity as ActivityIcon, Radio as RadioIcon,
  Heart, Thermometer, Droplets, Wind, Volume2, Sun, Gauge, Settings
} from 'lucide-react'

// Icon lookup for sensor types
const SENSOR_ICONS = {
  temperature: Thermometer, humidity: Droplets, presion: Gauge,
  ruido: Volume2, luz: Sun, co2: Wind, voc: Activity,
  'gases/no2': Activity, 'gases/so2': Activity, 'gases/o3': Activity, 'gases/co': Activity,
  emotibit: Heart, mota: Settings
}

function getSensorIcon(type) {
  return SENSOR_ICONS[type] || Radio
}

export default function SensorsDashboard() {
  const isConnected = useMQTTStore(s => s.isConnected)
  const lastMessage = useMQTTStore(s => s.lastMessage)

  const {
    clusterStats,
    sensorClients,
    loading: emqxLoading,
    refetch: refetchEmqx
  } = useEmqxData(true, 5000)

  const { scenarioSensors, activeSensors, generalSensors, loading, error, refetch } = useSensorList(sensorClients)

  // Determine which sections to show
  const showScenario = scenarioSensors.length > 0
  const showGeneral = !showScenario || generalSensors.length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Cargando sensores...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-500" />
          Sensores en Tiempo Real
        </h2>
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${isConnected
            ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                Desconectado
              </>
            )}
          </div>

          <button
            onClick={() => { refetch(); refetchEmqx() }}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors flex items-center gap-2"
            disabled={emqxLoading}
          >
            <RefreshCw className={`w-4 h-4 ${emqxLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Scenario sensors section */}
      {showScenario && (
        <ScenarioSection sensors={scenarioSensors} />
      )}

      {/* General / all sensors section */}
      {!showScenario && (
        <GeneralSection sensors={activeSensors} />
      )}

      {/* Extra sensors not in scenario */}
      {showScenario && generalSensors.length > 0 && (
        <GeneralSection sensors={generalSensors} title="Otros sensores detectados" />
      )}

      {/* Last MQTT message */}
      {lastMessage && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm">Último mensaje:</span>
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">{lastMessage.topic}</code>
          </div>
          <span className="text-xs text-gray-500">{new Date(lastMessage.timestamp).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  )
}

// ─── Section components ────────────────────────────────────────────────────────

function ScenarioSection({ sensors }) {
  const onlineCount = sensors.filter(s => s.isOnline).length
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Sensores del escenario</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{onlineCount} activos de {sensors.length}</p>
          </div>
        </div>
        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-xs font-medium">
          Escenario Activo
        </span>
      </div>
      <div className="p-4">
        {sensors.length > 0 ? (
          <SensorGrid sensors={sensors} colorScheme="indigo" />
        ) : (
          <EmptyState message="No hay sensores asignados a este escenario" />
        )}
      </div>
    </div>
  )
}

function GeneralSection({ sensors, title = 'Sensores Detectados' }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-500" />
          {title}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">{sensors.length} en tiempo real</span>
      </div>
      <div className="p-4">
        {sensors.length > 0 ? (
          <SensorGrid sensors={sensors} colorScheme="cyan" />
        ) : (
          <EmptyState message="No hay sensores enviando datos" sub="Activa un escenario o inicia un publisher MQTT" />
        )}
      </div>
    </div>
  )
}

function SensorGrid({ sensors, colorScheme }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {sensors.map(sensor => (
        <SensorCard
          key={sensor.id || sensor.sensorId}
          sensor={sensor}
          colorScheme={colorScheme}
          SensorIcon={getSensorIcon(sensor.type)}
        />
      ))}
    </div>
  )
}

function EmptyState({ message, sub }) {
  return (
    <div className="text-center py-8">
      <Radio className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
      <p className="text-gray-500 dark:text-gray-400">{message}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
