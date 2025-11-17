import { useState, useEffect } from 'react'
import './App.css'
import CameraList from './components/CameraList'
import WebRTCViewer from './components/WebRTCViewer'
import CameraModal from './components/CameraModal'
import ConfirmModal from './components/ConfirmModal'
import api from './services/api'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { RecordingProvider, useRecording } from './contexts/RecordingContext'

function AppContent() {
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, cameraId: null, cameraName: '' })
  const { theme, toggleTheme } = useTheme()
  const { isRecording, activeRecordingsCount, startRecording, stopRecording } = useRecording()

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
      
      // Auto-iniciar grabación (el backend ya lo hace, esto es para actualizar el contexto)
      await startRecording(newCamera.id, newCamera.name)
      
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

  const confirmDeleteCamera = async () => {
    try {
      // Detener grabación primero
      await stopRecording(confirmDelete.cameraId)
      
      await api.deleteCamera(confirmDelete.cameraId)
      fetchCameras()
      if (selectedCamera?.id === confirmDelete.cameraId) {
        setSelectedCamera(null)
      }
      setError(null)
    } catch (err) {
      setError(`Error al eliminar cámara: ${err.message}`)
    }
  }

  return (
    <div className="app min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      <header className="bg-gray-50 dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div>
              <h1 className="text-2xl font-bold gradient-text">🎥 Camera RTSP</h1>
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
        </div>
      </header>
      
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        <aside className="card w-80 flex flex-col flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
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
          
          <div className="flex-1 overflow-y-auto">
            <CameraList 
              cameras={cameras} 
              selectedCamera={selectedCamera}
              onSelectCamera={setSelectedCamera}
              onDeleteCamera={handleDeleteCamera}
            />
          </div>
          
          <button onClick={fetchCameras} className="btn-secondary w-full mt-4">
            🔄 Refrescar
          </button>
        </aside>

        <main className="card flex-1 flex flex-col overflow-hidden">
          {selectedCamera ? (
            <div className="flex-1 overflow-hidden">
              <WebRTCViewer camera={selectedCamera} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <p className="text-xl">Selecciona una cámara</p>
            </div>
          )}
        </main>
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
      <RecordingProvider>
        <AppContent />
      </RecordingProvider>
    </ThemeProvider>
  )
}

export default App
