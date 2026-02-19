import { useState } from 'react'
import { Dog, Sun, Moon, Wifi, WifiOff, Circle, LayoutDashboard, Video, Settings, Sliders, Menu, X } from 'lucide-react'
import NotificationPanel from '../NotificationPanel'

/**
 * AppHeader — Sticky header with logo, status badges, nav tabs.
 *
 * Responsive strategy:
 * - <sm  : compact logo (no subtitle), status icon-only, mobile nav drawer
 * - ≥sm  : full badges visible, all tabs inline
 */
export default function AppHeader({
    serverStatus,
    activeRecordingsCount,
    theme,
    toggleTheme,
    activeTab,
    setActiveTab
}) {
    const [mobileNavOpen, setMobileNavOpen] = useState(false)

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'cameras', label: 'Cámaras', icon: Video },
        { id: 'rules', label: 'Reglas', icon: Sliders },
        { id: 'config', label: 'Configuración', icon: Settings },
    ]

    const handleTabClick = (id) => {
        setActiveTab(id)
        setMobileNavOpen(false)
    }

    const isOnline = serverStatus === 'online'

    return (
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
            {/* ── Top Bar ── */}
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
                <div className="flex justify-between h-14 sm:h-16 items-center gap-2">

                    {/* Logo */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
                            <Dog className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-none">Galgo-Hub</h1>
                            <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">Sistema de monitoreo</span>
                        </div>
                    </div>

                    {/* Right — Status + actions */}
                    <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">

                        {/* Server status — icon only on mobile, full badge on sm+ */}
                        <div className={`flex items-center gap-1.5 rounded-full font-medium transition-all
                            px-2 py-1 sm:px-3 sm:py-1.5 text-xs
                            ${isOnline
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                            }`}>
                            {isOnline
                                ? <Wifi className="w-3.5 h-3.5 flex-shrink-0" />
                                : <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />}
                            <span className="hidden sm:inline">{isOnline ? 'En línea' : 'Desconectado'}</span>
                        </div>

                        {/* Recording badge — icon + count only on mobile */}
                        {activeRecordingsCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-medium
                                bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                                <Circle className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current animate-pulse flex-shrink-0" />
                                <span className="hidden sm:inline">{activeRecordingsCount} Grabando</span>
                                <span className="sm:hidden font-bold">{activeRecordingsCount}</span>
                            </div>
                        )}

                        {/* Notification Bell */}
                        <NotificationPanel />

                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 sm:p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                            title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
                        >
                            {theme === 'light' ? <Moon className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sun className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </button>

                        {/* Hamburger — only on mobile */}
                        <button
                            onClick={() => setMobileNavOpen(v => !v)}
                            className="sm:hidden p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                            aria-label="Menú de navegación"
                        >
                            {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Desktop Tab Bar (sm+) ── */}
            <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <nav className="flex gap-1 -mb-px overflow-x-auto">
                    {tabs.map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabClick(tab.id)}
                                className={`group flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap ${isActive
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

            {/* ── Mobile Nav Drawer (< sm) ── */}
            {mobileNavOpen && (
                <div className="sm:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <nav className="px-3 py-2 flex flex-col gap-1">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabClick(tab.id)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'opacity-70'}`} />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </nav>
                </div>
            )}
        </header>
    )
}
