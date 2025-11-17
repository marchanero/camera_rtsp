// App.tsx - Versión simplificada para usuario final
import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import RFIDIdentification from './components/RFIDIdentification';
import RecordingControl from './components/RecordingControl';
import SensorCard from './components/SensorCard';
import { UserProvider } from './contexts/UserContext';
import type { MqttStatus, Sensor } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>({
    connected: false,
    broker: null,
    clientId: null,
    lastChecked: null
  });
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'finished'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pausedTime, setPausedTime] = useState(0);
  const [totalRecordingTime, setTotalRecordingTime] = useState(0);

  // Fetch initial MQTT status
  const fetchInitialMqttStatus = async () => {
    console.log('🚀 fetchInitialMqttStatus - Consultando estado inicial del broker MQTT...');
    try {
      const response = await axios.get(`${API_URL}/api/mqtt/status`);
      console.log('✅ fetchInitialMqttStatus - Estado recibido del servidor:', response.data);

      setMqttStatus(prev => ({
        ...prev,
        connected: response.data.connected,
        broker: response.data.broker,
        clientId: response.data.clientId,
        lastChecked: new Date().toISOString()
      }));
    } catch (error) {
      console.error('❌ fetchInitialMqttStatus - Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sensors
  const fetchSensors = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sensors`);
      setSensors(response.data);
    } catch (error) {
      console.error('❌ Error fetching sensors:', error);
    }
  };

  // Recording timer
  useEffect(() => {
    let interval: number;
    if (recordingState === 'recording') {
      interval = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
        setTotalRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (recordingState === 'paused') {
      interval = window.setInterval(() => {
        setPausedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [recordingState]);

  // Recording functions
  const startRecording = async () => {
    try {
      await axios.post(`${API_URL}/api/recording/start`);
      setRecordingState('recording');
      setRecordingDuration(0);
      setPausedTime(0);
      setTotalRecordingTime(0);
    } catch (error) {
      console.error('❌ Error starting recording:', error);
    }
  };

  const pauseRecording = async () => {
    try {
      setRecordingState('paused');
    } catch (error) {
      console.error('❌ Error pausing recording:', error);
    }
  };

  const resumeRecording = async () => {
    try {
      setRecordingState('recording');
    } catch (error) {
      console.error('❌ Error resuming recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      await axios.post(`${API_URL}/api/recording/stop`);
      setRecordingState('idle');
      setRecordingDuration(0);
      setPausedTime(0);
      setTotalRecordingTime(0);
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
    }
  };

  const finishRecording = async () => {
    try {
      await axios.post(`${API_URL}/api/recording/stop`);
      setRecordingState('finished');
    } catch (error) {
      console.error('❌ Error finishing recording:', error);
    }
  };

  // Fallback polling every 10 seconds
  useEffect(() => {
    console.log('⏰ Polling de respaldo iniciado - Verificación cada 10 segundos');

    const fallbackInterval = setInterval(async () => {
      console.log('🔄 Polling de respaldo - Consultando estado MQTT...');
      try {
        const response = await axios.get(`${API_URL}/api/mqtt/status`);
        console.log('✅ Polling de respaldo - Estado recibido:', response.data);

        setMqttStatus(prev => ({
          ...prev,
          connected: response.data.connected,
          broker: response.data.broker,
          clientId: response.data.clientId,
          lastChecked: new Date().toISOString()
        }));
      } catch (error) {
        console.error('❌ Polling de respaldo - Error:', error);
      }
    }, 10000);

    return () => {
      console.log('⏹️ Polling de respaldo detenido');
      clearInterval(fallbackInterval);
    };
  }, []);

  // Initial load
  useEffect(() => {
    fetchInitialMqttStatus();
    fetchSensors();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando Galgo Config...</p>
        </div>
      </div>
    );
  }

  return (
    <UserProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Navbar />

          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
              {/* Control de Grabación */}
              <RecordingControl
                recordingState={recordingState}
                elapsedTime={recordingDuration}
                pausedTime={pausedTime}
                totalRecordingTime={totalRecordingTime}
                onStart={startRecording}
                onPause={pauseRecording}
                onResume={resumeRecording}
                onStop={stopRecording}
                onFinish={finishRecording}
              />

              {/* Identificación de Usuario */}
              <RFIDIdentification />            {/* Broker Conectado */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Broker MQTT
              </h2>
              <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Estado:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                      mqttStatus.connected
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {mqttStatus.connected ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Broker:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {mqttStatus.broker || 'No disponible'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Client ID:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {mqttStatus.clientId || 'No disponible'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Última verificación:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {mqttStatus.lastChecked
                        ? new Date(mqttStatus.lastChecked).toLocaleTimeString('es-ES')
                        : 'Nunca'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dispositivos Conectados */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Dispositivos Conectados
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sensors.length > 0 ? (
                  sensors.map(sensor => (
                    <SensorCard key={sensor.id} sensor={sensor} />
                  ))
                ) : (
                  <div className="col-span-full card text-center">
                    <div className="text-gray-500 dark:text-gray-400">
                      <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p>No hay dispositivos conectados en este momento</p>
                      <p className="text-sm mt-1">Los dispositivos aparecerán aquí automáticamente cuando se conecten.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Componente temporal de debug */}
        {/* <ThemeDebug /> */}
      </div>
    </div>
    </UserProvider>
  );
}

export default App;