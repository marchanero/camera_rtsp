import { useState, useEffect } from 'react'
import './App.css'
import CameraList from './components/CameraList'
import HLSViewer from './components/HLSViewer'
import api from './services/api'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'

function AppContent() {
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking')
  const { theme, toggleTheme } = useTheme()

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

  const handleAddCamera = async () => {
    const name = prompt('Nombre de la cámara:')
    const rtspUrl = prompt('URL RTSP:')
    const description = prompt('Descripción (opcional):')

    if (name && rtspUrl) {
      try {
        await api.createCamera({ name, rtspUrl, description })
        fetchCameras()
      } catch (err) {
        setError(`Error al crear cámara: ${err.message}`)
      }
    }
  }

  const handleDeleteCamera = async (cameraId) => {
    if (confirm('¿Eliminar esta cámara?')) {
      try {
        await api.deleteCamera(cameraId)
        fetchCameras()
        if (selectedCamera?.id === cameraId) {
          setSelectedCamera(null)
        }
      } catch (err) {
        setError(`Error al eliminar cámara: ${err.message}`)
      }
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
            <h2 className="text-lg font-semibold">Cámaras</h2>
            <button 
              onClick={handleAddCamera} 
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
            <HLSViewer camera={selectedCamera} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <p className="text-xl">Selecciona una cámara</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
