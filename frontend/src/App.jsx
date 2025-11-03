import { useState, useEffect } from 'react'
import './App.css'
import CameraList from './components/CameraList'
import HLSViewer from './components/HLSViewer'
import api from './services/api'

function App() {
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking')

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
    <div className="app">
      <header className="header">
        <h1>🎥 Visor de Cámaras RTSP</h1>
        <div className="header-status">
          <span className={`status-badge ${serverStatus}`}>
            {serverStatus === 'online' ? '🟢 Conectado' : '🔴 Desconectado'}
          </span>
        </div>
      </header>
      
      <div className="container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Cámaras Disponibles</h2>
            <button onClick={handleAddCamera} className="add-camera-btn" title="Agregar cámara">
              ➕
            </button>
          </div>
          
          {loading && <p className="status-msg">Cargando...</p>}
          {error && <p className="error-msg">{error}</p>}
          
          <CameraList 
            cameras={cameras} 
            selectedCamera={selectedCamera}
            onSelectCamera={setSelectedCamera}
            onDeleteCamera={handleDeleteCamera}
          />
          
          <button onClick={fetchCameras} className="refresh-btn">
            🔄 Refrescar
          </button>
        </aside>

        <main className="viewer">
          {selectedCamera ? (
            <HLSViewer camera={selectedCamera} />
          ) : (
            <div className="placeholder">
              <p>Selecciona una cámara para ver el stream</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
