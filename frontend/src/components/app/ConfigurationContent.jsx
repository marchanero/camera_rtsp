import { lazy, Suspense } from 'react'
import { Settings, Theater, Radio, Wifi, FolderSync, HardDrive, Film, Clapperboard, Gauge, Loader2 } from 'lucide-react'

// ─── Lazy-load all sub-tab panels ────────────────────────────────────────────
// Each is now a separate chunk downloaded ONLY when the user first visits it.
// Before: one 398KB bundle loaded on first click of "Configuración".
// After:  ~8 chunks of ~30-60KB each, loaded on demand.
const ScenarioManager = lazy(() => import('../ScenarioManager'))
const SensorManager = lazy(() => import('../SensorManager'))
const MQTTConfig = lazy(() => import('../MQTTConfig'))
const BackupPanel = lazy(() => import('../BackupPanel'))
const StorageManager = lazy(() => import('../StorageManager'))
const RecordingDashboard = lazy(() => import('../RecordingDashboard'))
const VideoProcessing = lazy(() => import('../VideoProcessing'))
const PerformanceDashboard = lazy(() => import('../PerformanceDashboard'))

// ─── Tab definitions ─────────────────────────────────────────────────────────
const CONFIG_TABS = [
    { id: 'scenarios', label: 'Escenarios', icon: Theater, color: 'blue', Component: ScenarioManager },
    { id: 'sensors', label: 'Sensores', icon: Radio, color: 'green', Component: SensorManager },
    { id: 'mqtt', label: 'MQTT', icon: Wifi, color: 'violet', Component: MQTTConfig },
    { id: 'replication', label: 'Replicación', icon: FolderSync, color: 'purple', Component: BackupPanel },
    { id: 'storage', label: 'Almacenamiento', icon: HardDrive, color: 'orange', Component: StorageManager },
    { id: 'recordings', label: 'Grabaciones', icon: Film, color: 'red', Component: RecordingDashboard },
    { id: 'processing', label: 'Procesamiento', icon: Clapperboard, color: 'cyan', Component: VideoProcessing },
    { id: 'performance', label: 'Rendimiento', icon: Gauge, color: 'emerald', Component: PerformanceDashboard },
]

// ─── Active-tab color map ─────────────────────────────────────────────────────
const ACTIVE_COLORS = {
    blue: 'text-blue-600    dark:text-blue-400    border-b-2 border-blue-600    dark:border-blue-400    bg-blue-50    dark:bg-blue-900/20',
    green: 'text-green-600   dark:text-green-400   border-b-2 border-green-600   dark:border-green-400   bg-green-50   dark:bg-green-900/20',
    violet: 'text-violet-600  dark:text-violet-400  border-b-2 border-violet-600  dark:border-violet-400  bg-violet-50  dark:bg-violet-900/20',
    purple: 'text-purple-600  dark:text-purple-400  border-b-2 border-purple-600  dark:border-purple-400  bg-purple-50  dark:bg-purple-900/20',
    orange: 'text-orange-600  dark:text-orange-400  border-b-2 border-orange-600  dark:border-orange-400  bg-orange-50  dark:bg-orange-900/20',
    red: 'text-red-600     dark:text-red-400     border-b-2 border-red-600     dark:border-red-400     bg-red-50     dark:bg-red-900/20',
    cyan: 'text-cyan-600    dark:text-cyan-400    border-b-2 border-cyan-600    dark:border-cyan-400    bg-cyan-50    dark:bg-cyan-900/20',
    emerald: 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
}
const INACTIVE_CLASSES = 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'

// ─── Sub-tab loading skeleton ─────────────────────────────────────────────────
function SubTabFallback() {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400 dark:text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Cargando panel...</span>
        </div>
    )
}

/**
 * ConfigurationContent — Configuration tab with lazily-loaded sub-panels.
 *
 * Lazy strategy: each sub-tab (ScenarioManager, SensorManager, etc.) is
 * split into its own JS chunk and downloaded only on first visit.
 */
export default function ConfigurationContent({ configSubTab, setConfigSubTab }) {
    const activeTab = CONFIG_TABS.find(t => t.id === configSubTab) || CONFIG_TABS[0]
    const ActiveComponent = activeTab.Component

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 dark:from-gray-500 dark:to-gray-700 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Configuración del Sistema
                    </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400 ml-13">
                    Gestiona escenarios, sensores y replicación del sistema
                </p>
            </div>

            {/* Tab bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
                    {CONFIG_TABS.map(tab => {
                        const Icon = tab.icon
                        const isActive = configSubTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setConfigSubTab(tab.id)}
                                className={`px-3 py-3 font-medium transition-all duration-200 text-sm ${isActive ? ACTIVE_COLORS[tab.color] : INACTIVE_CLASSES
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-1.5">
                                    <Icon className={`w-4 h-4 ${isActive ? '' : 'opacity-70'}`} />
                                    <span className="truncate">{tab.label}</span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Active sub-tab content — lazy-loaded */}
            <div className="mt-6">
                <Suspense fallback={<SubTabFallback />}>
                    <ActiveComponent />
                </Suspense>
            </div>
        </div>
    )
}
