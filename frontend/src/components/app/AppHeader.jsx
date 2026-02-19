import { Dog, Sun, Moon, Wifi, WifiOff, Circle, LayoutDashboard, Video, Settings, Sliders } from 'lucide-react'
import NotificationPanel from '../NotificationPanel'

/**
 * AppHeader - Application header with logo, status badges, and navigation tabs
 */
export default function AppHeader({
    serverStatus,
    activeRecordingsCount,
    theme,
    toggleTheme,
    activeTab,
    setActiveTab
}) {
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'cameras', label: 'Cámaras', icon: Video },
        { id: 'rules', label: 'Reglas', icon: Sliders },
        { id: 'config', label: 'Configuración', icon: Settings }
    ]

    return (
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
            {/* Top Bar */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <Dog className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Galgo-Hub</h1>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Sistema de monitoreo</span>
                        </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-3">
                        {/* Server Status */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${serverStatus === 'online'
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                            }`}>
                            {serverStatus === 'online' ? (
                                <><Wifi className="w-3.5 h-3.5" /> En línea</>
                            ) : (
                                <><WifiOff className="w-3.5 h-3.5" /> Desconectado</>
                            )}
                        </div>

                        {/* Recording Status */}
                        {activeRecordingsCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                                <Circle className="w-3 h-3 fill-current animate-pulse" />
                                {activeRecordingsCount} Grabando
                            </div>
                        )}

                        {/* Notification Bell */}
                        <NotificationPanel />

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                            title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
                        >
                            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <nav className="flex gap-1 -mb-px">
                    {tabs.map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`group flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${isActive
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                            >
                                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-blue-500' : ''}`} />
                                {tab.label}
                            </button>
                        )
                    })}
                </nav>
            </div>
        </header>
    )
}
