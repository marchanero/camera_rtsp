import { useState, useEffect } from 'react'
import './App.css'
import CameraList from './components/CameraList'
import WebRTCViewer from './components/WebRTCViewer'
import CameraModal from './components/CameraModal'
import ConfirmModal from './components/ConfirmModal'
import SensorsDashboard from './components/SensorsDashboard'
import RulesManager from './components/RulesManager'
import DashboardSummary from './components/DashboardSummary'
import ScenarioManager from './components/ScenarioManager'
import SensorManager from './components/SensorManager'
import api from './services/api'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { RecordingProvider, useRecording } from './contexts/RecordingContext'
import { MQTTProvider } from './contexts/MQTTContext'
import { ScenarioProvider, useScenario } from './contexts/ScenarioContext'

function AppContent() {
  const [cameras, setCameras] = useState([])
  // Recuperar cámara seleccionada del localStorage
  const [selectedCamera, setSelectedCamera] = useState(() => {
    const saved = localStorage.getItem('selectedCamera')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, cameraId: null, cameraName: '' })
  // Recuperar tab activo del localStorage
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard'
  })
  // Subtab para la sección de configuración
  const [configSubTab, setConfigSubTab] = useState(() => {
    return localStorage.getItem('configSubTab') || 'scenarios'
  })
  const { theme, toggleTheme } = useTheme()
  const { isRecording, activeRecordingsCount, startRecording, stopRecording } = useRecording()
  const { activeScenario } = useScenario()

  // Verificar estado del servidor
  useEffect(() => {
    const checkServer = async () => {
      try {
        await api.getHealth()
        setServerStatus('online')
        setError(null)
      } catch (err) {
        setServerStatus('offline')
        setError('❌ No se puede conectar al servidor')
      }
    }

    checkServer()
    const interval = setInterval(checkServer, 5000)
    return () => clearInterval(interval)
  }, [])

  // Persistir cámara seleccionada en localStorage
  useEffect(() => {
    if (selectedCamera) {
      localStorage.setItem('selectedCamera', JSON.stringify(selectedCamera))
    } else {
      localStorage.removeItem('selectedCamera')
    }
  }, [selectedCamera])

  // Persistir tab activo en localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  // Persistir subtab de configuración en localStorage
  useEffect(() => {
    localStorage.setItem('configSubTab', configSubTab)
  }, [configSubTab])

  // Advertir al usuario si hay grabaciones activas antes de cerrar/recargar
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

  // Obtener listado de cámaras
  useEffect(() => {
    fetchCameras()
  }, [])

  const fetchCameras = async () => {
    try {
      setLoading(true)
      const data = await api.getCameras()
      setCameras(data)
      setError(null)
    } catch (err) {
      setError(err.message)
      setCameras([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddCamera = async (formData) => {
    try {
      const newCamera = await api.createCamera(formData)
      fetchCameras()
      
      // Auto-iniciar grabación usando el escenario activo si existe
      console.log('📹 Nueva cámara agregada, iniciando grabación:', {
        cameraId: newCamera.id,
        cameraName: newCamera.name,
        activeScenario: activeScenario,
        willUseScenario: activeScenario ? activeScenario.name : 'sin_escenario'
      })
      
      await startRecording(newCamera.id, newCamera.name, {
        scenarioId: activeScenario?.id,
        scenarioName: activeScenario?.name
      })
      
      setError(null)
    } catch (err) {
      setError(`Error al crear cámara: ${err.message}`)
    }
  }

  const handleDeleteCamera = async (cameraId) => {
    const camera = cameras.find(c => c.id === cameraId)
    setConfirmDelete({
      isOpen: true,
      cameraId,
      cameraName: camera?.name || 'esta cámara'
    })
  }

  // Alias para compatibilidad con el botón de eliminar en configuración
  const handleDeleteRequest = (cameraId, cameraName) => {
    setConfirmDelete({
      isOpen: true,
      cameraId,
      cameraName: cameraName || 'esta cámara'
    })
  }

  const confirmDeleteCamera = async () => {
    try {
      // Detener grabación primero
      await stopRecording(confirmDelete.cameraId)
      
      await api.deleteCamera(confirmDelete.cameraId)
      fetchCameras()
      if (selectedCamera?.id === confirmDelete.cameraId) {
        setSelectedCamera(null)
      }
      setConfirmDelete({ isOpen: false, cameraId: null, cameraName: '' })
      setError(null)
    } catch (err) {
      setError(`Error al eliminar cámara: ${err.message}`)
    }
  }

  return (
    <div className="app min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      <header className="bg-gray-50 dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div>
              <h1 className="text-2xl font-bold gradient-text">🐕 Galgo-Hub - School</h1>
              <span className="text-sm text-gray-500 dark:text-gray-400">Visor y grabador de transmisiones</span>
            </div>
            <div className="flex items-center space-x-6">
              <span className={`live-indicator ${serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}>
                {serverStatus === 'online' ? '🟢 En línea' : '🔴 Fuera de línea'}
              </span>
              {activeRecordingsCount > 0 && (
                <span className="live-indicator bg-red-600 animate-pulse">
                  🔴 {activeRecordingsCount} Grabando
                </span>
              )}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex space-x-1 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setActiveTab('cameras')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'cameras'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📹 Cámaras
            </button>
            <button
              onClick={() => setActiveTab('sensors')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'sensors'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📊 Sensores
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'rules'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              ⚙️ Reglas
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'config'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🏫 Configuración
            </button>
          </div>
        </div>
      </header>
      
      {/* Tab Content */}
      <div className={`flex-1 ${activeTab === 'cameras' ? 'flex overflow-hidden' : 'overflow-y-auto'}`}>
        {/* Dashboard - siempre montado pero oculto cuando no está activo */}
        <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
          <div className="max-w-7xl mx-auto p-6">
            <DashboardSummary />
          </div>
        </div>

        {/* Cámaras - siempre montado pero oculto cuando no está activo */}
        <div className={activeTab === 'cameras' ? 'flex flex-1 gap-4 p-4 overflow-hidden min-h-0' : 'hidden'}>
          <aside className="card w-80 flex flex-col flex-shrink-0 min-h-0">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cámaras</h2>
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="btn-primary py-1 px-3 text-sm"
                title="Agregar cámara"
              >
                ➕
              </button>
            </div>
            
            {loading && <p className="text-sm text-gray-500">⏳ Cargando...</p>}
            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
            
            <div className="flex-1 overflow-y-auto min-h-0">
              <CameraList 
                cameras={cameras} 
                selectedCamera={selectedCamera}
                onSelectCamera={setSelectedCamera}
                onDeleteCamera={handleDeleteCamera}
              />
            </div>
            
            <button onClick={fetchCameras} className="btn-secondary w-full mt-4 flex-shrink-0">
              🔄 Refrescar
            </button>
          </aside>

          <main className="card flex-1 flex flex-col overflow-hidden min-h-0">
            {selectedCamera ? (
              <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                <WebRTCViewer camera={selectedCamera} />
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-500 dark:text-gray-400">
                <p className="text-xl">Selecciona una cámara</p>
              </div>
            )}
          </main>
        </div>

        {/* Sensores - montado solo cuando se visita */}
        {activeTab === 'sensors' && (
          <div className="max-w-7xl mx-auto p-6">
            <SensorsDashboard />
          </div>
        )}

        {/* Reglas - montado solo cuando se visita */}
        {activeTab === 'rules' && (
          <div className="max-w-7xl mx-auto p-6">
            <RulesManager />
          </div>
        )}

        {/* Configuración - montado solo cuando se visita */}
        {activeTab === 'config' && (
          <div className="max-w-7xl mx-auto p-6">
            {/* Header de Configuración */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                ⚙️ Configuración del Sistema
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Gestiona escenarios, sensores y cámaras del sistema
              </p>
            </div>

            {/* Tabs de Configuración */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setConfigSubTab('scenarios')}
                  className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                    configSubTab === 'scenarios'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">🎭</span>
                    <span>Escenarios</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setConfigSubTab('sensors')}
                  className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                    configSubTab === 'sensors'
                      ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">📡</span>
                    <span>Sensores</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setConfigSubTab('cameras')}
                  className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                    configSubTab === 'cameras'
                      ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">📹</span>
                    <span>Cámaras</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Contenido según subtab activo */}
            <div className="mt-6">
              {configSubTab === 'scenarios' && <ScenarioManager />}
              {configSubTab === 'sensors' && <SensorManager />}
              {configSubTab === 'cameras' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          📹 Gestión de Cámaras
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Administra las cámaras RTSP del sistema
                        </p>
                      </div>
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                      >
                        ➕ Nueva Cámara
                      </button>
                    </div>
                    
                    {/* Lista de cámaras en grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cameras.map(camera => (
                        <div
                          key={camera.id}
                          className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border-2 transition-all cursor-pointer ${
                            selectedCamera?.id === camera.id
                              ? 'border-blue-500 dark:border-blue-400'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                          onClick={() => setSelectedCamera(camera)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">📹</span>
                              <div>
                                <h4 className="font-bold text-gray-900 dark:text-white">
                                  {camera.name}
                                </h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  camera.isActive
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}>
                                  {camera.isActive ? 'Activa' : 'Inactiva'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {camera.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {camera.description}
                            </p>
                          )}
                          
                          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2 rounded font-mono truncate mb-3">
                            {camera.rtspUrl}
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedCamera(camera)
                                setActiveTab('cameras')
                              }}
                              className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                            >
                              👁️ Ver Stream
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteRequest(camera.id, camera.name)
                              }}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {cameras.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                          No hay cámaras registradas. Agrega una nueva para comenzar.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
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

function App() {
  return (
    <ThemeProvider>
      <ScenarioProvider>
        <MQTTProvider>
          <RecordingProvider>
            <AppContent />
          </RecordingProvider>
        </MQTTProvider>
      </ScenarioProvider>
    </ThemeProvider>
  )
}

export default App
