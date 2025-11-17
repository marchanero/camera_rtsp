import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './ThemeContext';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

function UserManagementContent() {
  const [users, setUsers] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [liveAssignmentMode, setLiveAssignmentMode] = useState(false);
  const [selectedUserForAssignment, setSelectedUserForAssignment] = useState(null);
  const [detectedTag, setDetectedTag] = useState(null);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    fetchUsers();
    fetchAvailableTags();
  }, []);

  // Manejar eventos de RFID para asignación en vivo
  useEffect(() => {
    if (liveAssignmentMode && selectedUserForAssignment) {
      const handleRFIDDetected = (data) => {
        setDetectedTag(data);
        // Intentar asignar la tarjeta automáticamente
        handleLiveAssignTag(selectedUserForAssignment.id, data.tagId);
      };

      socket.on('rfid-detected', handleRFIDDetected);

      return () => {
        socket.off('rfid-detected', handleRFIDDetected);
      };
    }
  }, [liveAssignmentMode, selectedUserForAssignment]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Error al cargar usuarios');
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/tags');
      const data = await response.json();
      // Filtrar tarjetas que no están asignadas
      const available = data.filter(tag => !tag.userId);
      setAvailableTags(available);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) {
      setError('Nombre y email son requeridos');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(prev => [data, ...prev]);
        setNewUser({ name: '', email: '' });
        setSuccess('Usuario creado exitosamente');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Error al crear usuario');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTag = async (userId, tagId) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`http://localhost:3001/api/users/${userId}/assign-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(prev => prev.map(user =>
          user.id === userId ? data : user
        ));
        fetchAvailableTags(); // Actualizar tarjetas disponibles
        setSuccess('Tarjeta asignada exitosamente');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Error al asignar tarjeta');
      }
    } catch (error) {
      console.error('Error assigning tag:', error);
      setError('Error al asignar tarjeta');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignTag = async (userId) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`http://localhost:3001/api/users/${userId}/unassign-tag`, {
        method: 'POST',
      });

      if (response.ok) {
        setUsers(prev => prev.map(user => ({
          ...user,
          rfidTag: null,
          rfidTagId: null
        })));
        fetchAvailableTags(); // Actualizar tarjetas disponibles
        setSuccess('Tarjeta desasignada exitosamente');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Error al desasignar tarjeta');
      }
    } catch (error) {
      console.error('Error unassigning tag:', error);
      setError('Error al desasignar tarjeta');
    } finally {
      setLoading(false);
    }
  };

  const handleLiveAssignTag = async (userId, tagId) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`http://localhost:3001/api/users/${userId}/assign-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(prev => prev.map(user =>
          user.id === userId ? data : user
        ));
        fetchAvailableTags(); // Actualizar tarjetas disponibles
        setSuccess(`Tarjeta ${tagId} asignada exitosamente a ${data.name}`);
        setTimeout(() => setSuccess(''), 5000);
        
        // Salir del modo de asignación en vivo
        setLiveAssignmentMode(false);
        setSelectedUserForAssignment(null);
        setDetectedTag(null);
      } else {
        setError(data.error || 'Error al asignar tarjeta');
      }
    } catch (error) {
      console.error('Error assigning tag:', error);
      setError('Error al asignar tarjeta');
    } finally {
      setLoading(false);
    }
  };

  const startLiveAssignment = (user) => {
    setSelectedUserForAssignment(user);
    setLiveAssignmentMode(true);
    setDetectedTag(null);
    setError('');
    setSuccess(`Modo asignación activado para ${user.name}. Acerque una tarjeta RFID al lector.`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const cancelLiveAssignment = () => {
    setLiveAssignmentMode(false);
    setSelectedUserForAssignment(null);
    setDetectedTag(null);
    setError('');
    setSuccess('Modo asignación cancelado');
    setTimeout(() => setSuccess(''), 2000);
  };

  return (
    <div className="main-layout">
      {/* Header Moderno */}
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">
            👥 Gestión de Usuarios
          </h1>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="main-content">
        <div className="space-y-8">
          {/* Mensajes de error/éxito */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}

          {/* Modo de asignación en vivo */}
          {liveAssignmentMode && selectedUserForAssignment && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-600 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                    Modo Asignación RFID Activo
                  </h3>
                </div>
                <button
                  onClick={cancelLiveAssignment}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
              
              <div className="space-y-3">
                <p className="text-blue-700 dark:text-blue-300">
                  <strong>Usuario seleccionado:</strong> {selectedUserForAssignment.name}
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  <strong>Instrucciones:</strong> Acerque una tarjeta RFID al lector para asignarla automáticamente.
                </p>
                
                {detectedTag && (
                  <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-600 rounded p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="font-medium text-green-800 dark:text-green-200">
                        Tarjeta detectada:
                      </span>
                      <code className="bg-green-200 dark:bg-green-800 px-2 py-1 rounded text-sm font-mono">
                        {detectedTag.tagId}
                      </code>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Asignando tarjeta automáticamente...
                    </p>
                  </div>
                )}
                
                {!detectedTag && (
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-600 rounded p-4">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                      <span className="text-yellow-800 dark:text-yellow-200">
                        Esperando detección de tarjeta RFID...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formulario para crear usuario */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Crear Nuevo Usuario</h2>
            <form onSubmit={handleCreateUser} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Ingresa el nombre"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="usuario@ejemplo.com"
                    required
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </section>

          {/* Lista de usuarios */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Usuarios Registrados</h2>
            <div className="space-y-4">
              {users.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No hay usuarios registrados aún
                </div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{user.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Creado: {new Date(user.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        {user.rfidTag ? (
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
                              Tarjeta Asignada
                            </span>
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
                              {user.rfidTag.tagId}
                            </span>
                            <button
                              onClick={() => handleUnassignTag(user.id)}
                              disabled={loading}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm underline disabled:opacity-50"
                            >
                              Desasignar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></span>
                              Sin Tarjeta
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => startLiveAssignment(user)}
                                disabled={loading || liveAssignmentMode}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Asignar tarjeta usando el lector RFID"
                              >
                                📡 Asignar con lector
                              </button>
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignTag(user.id, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                disabled={loading}
                                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                              >
                                <option value="">Seleccionar tarjeta...</option>
                                {availableTags.map((tag) => (
                                  <option key={tag.id} value={tag.tagId}>
                                    {tag.tagId}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function UserManagement() {
  return <UserManagementContent />;
}

export default UserManagement;