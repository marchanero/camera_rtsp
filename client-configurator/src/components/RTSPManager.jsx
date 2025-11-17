import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useSensors } from '../hooks/useSensors';

const RTSPManager = () => {
  const { cameras, addCamera, deleteCamera, updateCamera } = useSensors();
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [streamInfo, setStreamInfo] = useState(null);

  // Formulario para agregar nueva cámara
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    port: 554,
    username: '',
    password: '',
    path: '/',
    protocol: 'rtsp'
  });

  const API_URL = 'http://localhost:3001';

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) : value
    }));
  };

  const handleAddCamera = async (e) => {
    e.preventDefault();

    // Validaciones del frontend
    const errors = [];

    if (!formData.name.trim()) {
      errors.push('El nombre es requerido');
    } else if (formData.name.trim().length < 2) {
      errors.push('El nombre debe tener al menos 2 caracteres');
    }

    if (!formData.ip.trim()) {
      errors.push('La dirección IP es requerida');
    } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(formData.ip.trim())) {
      errors.push('Formato de IP inválido');
    } else {
      const parts = formData.ip.trim().split('.');
      if (parts.some(part => parseInt(part) > 255)) {
        errors.push('Cada octeto de la IP debe ser menor o igual a 255');
      }
    }

    if (formData.port < 1 || formData.port > 65535) {
      errors.push('El puerto debe estar entre 1 y 65535');
    }

    if (formData.path && !formData.path.startsWith('/')) {
      errors.push('La ruta debe comenzar con /');
    }

    if (errors.length > 0) {
      toast.error(`Errores de validación: ${errors.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      await addCamera({
        ...formData,
        name: formData.name.trim(),
        ip: formData.ip.trim(),
        path: formData.path || '/'
      });
      setFormData({
        name: '',
        ip: '',
        port: 554,
        username: '',
        password: '',
        path: '/',
        protocol: 'rtsp'
      });
      setShowForm(false);
      toast.success('Cámara agregada exitosamente');
    } catch (error) {
      const message = error.message || 'Error al agregar cámara';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCamera = async (cameraId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta cámara?')) {
      return;
    }

    setLoading(true);
    try {
      await deleteCamera(cameraId);
      if (selectedCamera?.id === cameraId) {
        setSelectedCamera(null);
        setTestResult(null);
        setStreamInfo(null);
      }
      toast.success('Cámara eliminada exitosamente');
    } catch {
      toast.error('Error al eliminar cámara');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCamera = async (cameraId, currentStatus) => {
    try {
      const cameraToUpdate = cameras.find(c => c.id === cameraId);
      if (cameraToUpdate) {
        await updateCamera(cameraId, { enabled: !currentStatus });
        toast.success(currentStatus ? 'Cámara deshabilitada' : 'Cámara habilitada');
      }
    } catch {
      toast.error('Error al cambiar estado de cámara');
    }
  };

  const handleEditCamera = (camera) => {
    setIsEditing(true);
    setFormData({
      name: camera.name,
      ip: camera.ip,
      port: camera.port,
      username: camera.username || '',
      password: camera.password || '',
      path: camera.path || '/',
      protocol: camera.protocol || 'rtsp'
    });
    setShowForm(true);
  };

  const handleSaveCamera = async (e) => {
    e.preventDefault();

    // Validaciones del frontend
    const errors = [];

    if (!formData.name.trim()) {
      errors.push('El nombre es requerido');
    } else if (formData.name.trim().length < 2) {
      errors.push('El nombre debe tener al menos 2 caracteres');
    }

    if (!formData.ip.trim()) {
      errors.push('La dirección IP es requerida');
    } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(formData.ip.trim())) {
      errors.push('Formato de IP inválido');
    } else {
      const parts = formData.ip.trim().split('.');
      if (parts.some(part => parseInt(part) > 255)) {
        errors.push('Cada octeto de la IP debe ser menor o igual a 255');
      }
    }

    if (formData.port < 1 || formData.port > 65535) {
      errors.push('El puerto debe estar entre 1 y 65535');
    }

    if (formData.path && !formData.path.startsWith('/')) {
      errors.push('La ruta debe comenzar con /');
    }

    if (errors.length > 0) {
      toast.error(`Errores de validación: ${errors.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      // Preparar datos para actualizar
      const updateData = {
        name: formData.name.trim(),
        ip: formData.ip.trim(),
        port: formData.port,
        username: formData.username?.trim() || '',
        password: formData.password || '',
        path: (formData.path || '/').trim() || '/',  // Asegurar que siempre hay una ruta válida
        protocol: formData.protocol || 'rtsp'
      };

      console.log('📤 Datos a enviar:', updateData);
      
      if (!isEditing || !selectedCamera) {
        toast.error('Error: No hay cámara seleccionada para editar');
        return;
      }
      
      await updateCamera(selectedCamera.id, updateData);
      
      setSelectedCamera({
        ...selectedCamera,
        ...formData
      });
      
      setFormData({
        name: '',
        ip: '',
        port: 554,
        username: '',
        password: '',
        path: '/',
        protocol: 'rtsp'
      });
      setShowForm(false);
      setIsEditing(false);
      toast.success('Cámara actualizada exitosamente');
    } catch (error) {
      const message = error.message || 'Error al actualizar cámara';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };


  const testConnection = async (camera) => {
    setSelectedCamera(camera);
    setLoading(true);
    setTestResult(null);
    setStreamInfo(null);

    try {
      const response = await axios.post(`${API_URL}/api/rtsp/cameras/${camera.id}/test`);
      setTestResult(response.data);

      if (response.data.success) {
        toast.success('Conexión exitosa');
      } else {
        toast.error('No se pudo conectar a la cámara');
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || 'Error al probar conexión'
      });
      toast.error('Error al probar conexión');
    } finally {
      setLoading(false);
    }
  };

  const getStreamInfo = async (camera) => {
    try {
      const response = await axios.get(`${API_URL}/api/rtsp/cameras/${camera.id}/stream-info`);
      setStreamInfo(response.data.stream_info);
      toast.success('Información de stream obtenida');
    } catch {
      toast.error('Error al obtener información del stream');
    }
  };

  const getStatusColor = (enabled, status) => {
    if (!enabled) return 'bg-gray-100 border-gray-300';
    switch (status) {
      case 'connected': return 'bg-green-50 border-green-300';
      case 'error': return 'bg-red-50 border-red-300';
      case 'testing': return 'bg-yellow-50 border-yellow-300';
      default: return 'bg-gray-50 border-gray-300';
    }
  };

  const getStatusBadge = (enabled, status) => {
    if (!enabled) return { text: 'Deshabilitada', color: 'bg-gray-500' };
    switch (status) {
      case 'connected': return { text: 'Conectada', color: 'bg-green-500' };
      case 'error': return { text: 'Error', color: 'bg-red-500' };
      case 'testing': return { text: 'Probando...', color: 'bg-yellow-500' };
      default: return { text: 'Desconocida', color: 'bg-gray-500' };
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🎥 Gestor de Cámaras RTSP</h1>
        <p className="text-gray-600">Configura y gestiona múltiples cámaras RTSP</p>
      </div>

      {/* Botón para agregar cámara */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="mb-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition"
      >
        {showForm ? '✕ Cancelar' : '+ Agregar Cámara'}
      </button>

      {/* Formulario para agregar/editar cámara */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 border border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">
              {isEditing && selectedCamera ? `Editar: ${selectedCamera.name}` : 'Nueva Cámara RTSP'}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setIsEditing(false);
                setFormData({
                  name: '',
                  ip: '',
                  port: 554,
                  username: '',
                  password: '',
                  path: '/',
                  protocol: 'rtsp'
                });
              }}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          <form onSubmit={isEditing ? handleSaveCamera : handleAddCamera} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Cámara *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="Ej: Cámara Entrada"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección IP *
              </label>
              <input
                type="text"
                name="ip"
                value={formData.ip}
                onChange={handleFormChange}
                placeholder="Ej: 192.168.1.100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Puerto
              </label>
              <input
                type="number"
                name="port"
                value={formData.port}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="65535"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuario (opcional)
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleFormChange}
                placeholder="admin"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña (opcional)
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ruta del Stream
              </label>
              <input
                type="text"
                name="path"
                value={formData.path}
                onChange={handleFormChange}
                placeholder="/"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protocolo
              </label>
              <select
                name="protocol"
                value={formData.protocol}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="rtsp">RTSP</option>
                <option value="rtsps">RTSPS</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full text-white py-2 rounded-lg font-semibold transition disabled:opacity-50 ${
                  isEditing
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {loading 
                  ? (isEditing ? 'Actualizando...' : 'Agregando...')
                  : (isEditing ? 'Actualizar Cámara' : 'Agregar Cámara')
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Cámaras */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cameras.map((camera) => {
          const status = getStatusBadge(camera.enabled, camera.last_connection_status);
          
          return (
            <div
              key={camera.id}
              className={`rounded-lg shadow-md p-5 border-2 transition cursor-pointer ${getStatusColor(camera.enabled, camera.last_connection_status)} ${
                selectedCamera?.id === camera.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedCamera(camera)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{camera.name}</h3>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold text-white mt-1 ${status.color}`}>
                    {status.text}
                  </span>
                </div>
              </div>

              <div className="text-sm text-gray-700 space-y-1 mb-4">
                <p><strong>IP:</strong> {camera.ip}:{camera.port}</p>
                {camera.path && <p><strong>Ruta:</strong> {camera.path}</p>}
                {camera.username && <p><strong>Usuario:</strong> {camera.username}</p>}
                {camera.last_connection_time && (
                  <p className="text-xs text-gray-500">
                    <strong>Última conexión:</strong> {new Date(camera.last_connection_time).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    testConnection(camera);
                  }}
                  disabled={loading || !camera.enabled}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition"
                >
                  📡 Probar
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    getStreamInfo(camera);
                  }}
                  disabled={loading || !camera.enabled}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition"
                >
                  ℹ️ Info
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditCamera(camera);
                  }}
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition"
                >
                  ✏️ Editar
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleCamera(camera.id, camera.enabled);
                  }}
                  disabled={loading}
                  className={`text-white px-3 py-1 rounded text-sm transition ${
                    camera.enabled
                      ? 'bg-yellow-500 hover:bg-yellow-600'
                      : 'bg-gray-500 hover:bg-gray-600'
                  }`}
                >
                  {camera.enabled ? '🔴 Deshabilitar' : '🟢 Habilitar'}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCamera(camera.id);
                  }}
                  disabled={loading}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 transition"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {cameras.length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No hay cámaras configuradas</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition"
          >
            Agregar la primera cámara
          </button>
        </div>
      )}

      {/* Panel de detalles de la cámara seleccionada */}
      {selectedCamera && (
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6 border-2 border-blue-300">
          <h2 className="text-2xl font-semibold mb-4">📋 Detalles: {selectedCamera.name}</h2>

          {testResult && (
            <div className={`mb-4 p-4 rounded-lg ${testResult.success ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'}`}>
              <p className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                {testResult.message}
              </p>
              {testResult.rtsp_url && (
                <p className="text-sm text-gray-700 mt-2">
                  <strong>RTSP URL:</strong> {testResult.rtsp_url}
                </p>
              )}
            </div>
          )}

          {streamInfo && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">Información del Stream:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {streamInfo.video_codec && (
                  <p><strong>Video:</strong> {streamInfo.video_codec}</p>
                )}
                {streamInfo.audio_codec && (
                  <p><strong>Audio:</strong> {streamInfo.audio_codec}</p>
                )}
                {streamInfo.resolution && (
                  <p><strong>Resolución:</strong> {streamInfo.resolution}</p>
                )}
                {streamInfo.fps && (
                  <p><strong>FPS:</strong> {streamInfo.fps}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RTSPManager;