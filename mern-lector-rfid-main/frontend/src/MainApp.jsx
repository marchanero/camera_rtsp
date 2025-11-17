import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './ThemeContext';
import App from './App';
import UserManagement from './UserManagement';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

function MainAppContent() {
  const [currentView, setCurrentView] = useState('rfid'); // 'rfid' o 'users'
  const [isConnected, setIsConnected] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    // Conectar Socket.IO
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navegación */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Sistema RFID
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setCurrentView('rfid')}
                  className={`${
                    currentView === 'rfid'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  📡 Lector RFID
                </button>
                <button
                  onClick={() => setCurrentView('users')}
                  className={`${
                    currentView === 'users'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  👥 Gestión de Usuarios
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Indicador de conexión */}
              <div className={`status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
              </div>

              {/* Toggle de tema moderno */}
              <button
                onClick={toggleTheme}
                className="theme-toggle"
                title={isDarkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                aria-label={isDarkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Contenido */}
      {currentView === 'rfid' ? <App /> : <UserManagement />}
    </div>
  );
}

function MainApp() {
  return (
    <ThemeProvider>
      <MainAppContent />
    </ThemeProvider>
  );
}

export default MainApp;