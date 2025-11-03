import React from 'react'
import './CameraList.css'

function CameraList({ cameras, selectedCamera, onSelectCamera, onDeleteCamera }) {
  return (
    <div className="camera-list">
      {cameras.length === 0 ? (
        <p className="empty">No hay cámaras disponibles</p>
      ) : (
        cameras.map(camera => (
          <div
            key={camera.id}
            className={`camera-item ${selectedCamera?.id === camera.id ? 'active' : ''}`}
          >
            <div 
              className="camera-content"
              onClick={() => onSelectCamera(camera)}
            >
              <div className="camera-name">{camera.name}</div>
              <div className="camera-url">{camera.rtspUrl}</div>
              <div className="camera-status">
                <span className={`status-dot ${camera.isActive ? 'active' : 'inactive'}`}></span>
                {camera.isActive ? 'En línea' : 'Offline'}
              </div>
            </div>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteCamera(camera.id)
              }}
              title="Eliminar cámara"
            >
              🗑️
            </button>
          </div>
        ))
      )}
    </div>
  )
}

export default CameraList
