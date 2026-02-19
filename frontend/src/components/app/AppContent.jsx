import { useEffect, useState, lazy, Suspense } from 'react'
import { Video, Plus, RefreshCw, Radio, Loader2, ArrowLeft } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useRecording } from '../../contexts/RecordingContext'
import { useScenario } from '../../contexts/ScenarioContext'
import { useAppState } from '../../hooks/app/useAppState'
import AppHeader from './AppHeader'
import CameraList from '../CameraList'
import WebRTCViewer from '../WebRTCViewer'
import CameraModal from '../CameraModal'
import ConfirmModal from '../ConfirmModal'
import { ListItemSkeleton } from '../ui/Skeleton'

// Lazy load de tabs pesados — solo se descargan cuando el usuario navega a ellos
const DashboardSummary = lazy(() => import('../DashboardSummary'))
const SensorsDashboard = lazy(() => import('../SensorsDashboard'))
const RulesManager = lazy(() => import('../RulesManager'))
const ConfigurationContent = lazy(() => import('./ConfigurationContent'))

// Fallback de carga para tabs lazy
function TabLoadingFallback() {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Cargando...</span>
            </div>
        </div>
    )
}

/**
 * AppContent - Main application content with all views
 * 
 * Handles:
 * - View routing based on active tab
 * - Camera viewer layout
 * - Dashboard and rules views
 * - Configuration routing
 */
export default function AppContent() {
    const { theme, toggleTheme } = useTheme()
    const { activeRecordingsCount, startRecording, stopRecording } = useRecording()
    const { activeScenario } = useScenario()
    // Mobile: track whether to show list or viewer (only used on <md)
    const [mobileShowViewer, setMobileShowViewer] = useState(false)

    const {
        cameras,
        selectedCamera,
        setSelectedCamera,
        loading,
        error,
        activeTab,
        setActiveTab,
        configSubTab,
        setConfigSubTab,
        serverStatus,
        isModalOpen,
        setIsModalOpen,
        confirmDelete,
        setConfirmDelete,
        fetchCameras,
        handleAddCamera,
        handleDeleteCamera,
        confirmDeleteCamera
    } = useAppState({ startRecording, stopRecording, activeScenario })

    /**
     * Warn user before closing if recordings are active
     */
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (activeRecordingsCount > 0) {
                const message = `Hay ${activeRecordingsCount} grabación(es) en curso. ¿Estás seguro de cerrar? Las grabaciones se guardarán automáticamente.`
                e.preventDefault()
                e.returnValue = message
                return message
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [activeRecordingsCount])
    const handleSelectCamera = (camera) => {
        setSelectedCamera(camera)
        setMobileShowViewer(true) // auto-navigate to viewer on mobile
    }
    return (
        <div className="app min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300 flex flex-col">
            <AppHeader
                serverStatus={serverStatus}
                activeRecordingsCount={activeRecordingsCount}
                theme={theme}
                toggleTheme={toggleTheme}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />

            {/* Tab Content */}
            <div className={`flex-1 ${activeTab === 'cameras' ? 'flex overflow-hidden' : 'overflow-y-auto'}`}>
                {/* Dashboard */}
                <div className={activeTab === 'dashboard' ? 'block animate-fade-in' : 'hidden'}>
                    <Suspense fallback={<TabLoadingFallback />}>
                        <div className="max-w-7xl mx-auto p-6 space-y-6">
                            <DashboardSummary />

                            {/* Technical Sensors Dashboard */}
                            <div className="mt-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                        <Radio className="w-4 h-4 text-white" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard Técnico</h2>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        Métricas avanzadas y configuración de sensores
                                    </span>
                                </div>
                                <SensorsDashboard />
                            </div>
                        </div>
                    </Suspense>
                </div>

                {/* Cameras */}
                <div className={activeTab === 'cameras' ? 'flex flex-col md:flex-row flex-1 gap-4 p-3 sm:p-4 overflow-hidden min-h-0' : 'hidden'}>

                    {/* Sidebar list — hidden on mobile when viewer is active */}
                    <aside className={`card flex flex-col flex-shrink-0 min-h-0
                        md:w-64 lg:w-80
                        ${mobileShowViewer ? 'hidden md:flex' : 'flex w-full md:w-64 lg:w-80'}`}>
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <Video className="w-5 h-5 text-blue-500" />
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cámaras</h2>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                                title="Agregar cámara"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-3 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                {error}
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto min-h-0">
                            {loading ? (
                                <div className="space-y-2">
                                    <ListItemSkeleton />
                                    <ListItemSkeleton />
                                    <ListItemSkeleton />
                                </div>
                            ) : (
                                <CameraList
                                    cameras={cameras}
                                    selectedCamera={selectedCamera}
                                    onSelectCamera={handleSelectCamera}
                                    onDeleteCamera={handleDeleteCamera}
                                />
                            )}
                        </div>

                        <button
                            onClick={fetchCameras}
                            disabled={loading}
                            className="w-full mt-4 flex-shrink-0 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {loading ? 'Cargando...' : 'Refrescar'}
                        </button>
                    </aside>

                    {/* Main viewer — full width on mobile when camera selected */}
                    <main className={`card flex-1 flex flex-col overflow-hidden min-h-0
                        ${!mobileShowViewer && selectedCamera ? 'hidden md:flex' : ''}
                        ${mobileShowViewer || !selectedCamera ? 'flex' : 'hidden md:flex'}`}>

                        {/* Mobile back button */}
                        {mobileShowViewer && selectedCamera && (
                            <button
                                onClick={() => setMobileShowViewer(false)}
                                className="md:hidden flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border-b border-gray-100 dark:border-gray-800 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver a cámaras
                            </button>
                        )}

                        {selectedCamera ? (
                            <div className="flex-1 overflow-hidden min-h-0 flex flex-col animate-fade-in">
                                <WebRTCViewer camera={selectedCamera} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center flex-1 animate-fade-in">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4">
                                    <Video className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Visor de Cámara
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Selecciona una cámara de la lista para ver el stream
                                </p>
                            </div>
                        )}
                    </main>
                </div>

                {/* Rules */}
                {activeTab === 'rules' && (
                    <Suspense fallback={<TabLoadingFallback />}>
                        <div className="max-w-7xl mx-auto p-6 animate-fade-in">
                            <RulesManager />
                        </div>
                    </Suspense>
                )}

                {/* Configuration */}
                {activeTab === 'config' && (
                    <Suspense fallback={<TabLoadingFallback />}>
                        <div className="animate-fade-in">
                            <ConfigurationContent
                                configSubTab={configSubTab}
                                setConfigSubTab={setConfigSubTab}
                            />
                        </div>
                    </Suspense>
                )}
            </div>

            <CameraModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleAddCamera}
            />

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, cameraId: null, cameraName: '' })}
                onConfirm={confirmDeleteCamera}
                title="Eliminar Cámara"
                message={`¿Estás seguro que deseas eliminar "${confirmDelete.cameraName}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                isDanger={true}
            />
        </div>
    )
}
