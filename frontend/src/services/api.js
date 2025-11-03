const API_BASE_URL = '/api'

export const api = {
  // Cámaras
  async getCameras() {
    const response = await fetch(`${API_BASE_URL}/cameras`)
    if (!response.ok) throw new Error('Error al obtener cámaras')
    return response.json()
  },

  async getCamera(id) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}`)
    if (!response.ok) throw new Error('Cámara no encontrada')
    return response.json()
  },

  async createCamera(data) {
    const response = await fetch(`${API_BASE_URL}/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Error al crear cámara')
    return response.json()
  },

  async updateCamera(id, data) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Error al actualizar cámara')
    return response.json()
  },

  async deleteCamera(id) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Error al eliminar cámara')
    return response.json()
  },

  async testCamera(id) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}/test`)
    if (!response.ok) throw new Error('Error al probar cámara')
    return response.json()
  },

  // Streams
  async getStreamStatus() {
    const response = await fetch(`${API_BASE_URL}/streams/status`)
    if (!response.ok) throw new Error('Error al obtener estado')
    return response.json()
  },

  async getHealth() {
    const response = await fetch(`${API_BASE_URL}/health`)
    if (!response.ok) throw new Error('Servidor no disponible')
    return response.json()
  }
}

export default api
