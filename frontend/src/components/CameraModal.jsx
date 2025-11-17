import { useState, useEffect } from 'react'

export default function CameraModal({ isOpen, onClose, onSubmit, title = 'Añadir Cámara' }) {
  const [formData, setFormData] = useState({
    name: '',
    rtspUrl: '',
    description: ''
  })

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: '', rtspUrl: '', description: '' })
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.name && formData.rtspUrl) {
      onSubmit(formData)
      onClose()
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none transition-colors"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              htmlFor="name" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Nombre de la cámara <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Ej: Cámara Principal"
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label 
              htmlFor="rtspUrl" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              URL RTSP <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="rtspUrl"
              name="rtspUrl"
              value={formData.rtspUrl}
              onChange={handleChange}
              required
              placeholder="rtsp://usuario:contraseña@192.168.1.100:554/stream"
              className="input-field"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Formato: rtsp://[usuario]:[contraseña]@[ip]:[puerto]/[ruta]
            </p>
          </div>

          <div>
            <label 
              htmlFor="description" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Descripción (opcional)
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Describe la ubicación o detalles de la cámara..."
              className="input-field resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
            >
              Añadir Cámara
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
