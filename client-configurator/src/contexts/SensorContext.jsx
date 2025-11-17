import { createContext, useCallback, useEffect, useState } from 'react';

/**
 * Contexto centralizado para sensores y cámaras RTSP
 * Sincroniza estado entre todos los componentes (Dashboard, RTSPManager, RTSPCameraGallery, etc.)
 */
export const SensorContext = createContext();

export const SensorProvider = ({ children, apiUrl = 'http://127.0.0.1:3001' }) => {
  // Sensors: environmental, emotibit, rfid, rtsp
  const [sensors, setSensors] = useState([]);
  
  // Cameras (RTSP)
  const [cameras, setCameras] = useState([]);
  
  // Loading states
  const [sensorsLoading, setSensorsLoading] = useState(false);
  const [camerasLoading, setCamerasLoading] = useState(false);
  
  // Error states
  const [sensorsError, setSensorsError] = useState(null);
  const [camerasError, setCamerasError] = useState(null);

  /**
   * Cargar todos los sensores desde el servidor
   */
  const loadSensors = useCallback(async () => {
    try {
      setSensorsLoading(true);
      setSensorsError(null);
      
      const response = await fetch(`${apiUrl}/api/sensors`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const sensorsList = Array.isArray(data) ? data : data.sensors || [];
      setSensors(sensorsList);
      
      console.log(`✅ Cargados ${sensorsList.length} sensores desde servidor`);
      return sensorsList;
    } catch (err) {
      console.error('❌ Error cargando sensores:', err.message);
      setSensorsError(err.message);
      return [];
    } finally {
      setSensorsLoading(false);
    }
  }, [apiUrl]);

  /**
   * Cargar todas las cámaras RTSP desde el servidor
   */
  const loadCameras = useCallback(async () => {
    try {
      setCamerasLoading(true);
      setCamerasError(null);
      
      const response = await fetch(`${apiUrl}/api/rtsp/cameras`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const camerasList = Array.isArray(data) ? data : data.cameras || [];
      setCameras(camerasList);
      
      console.log(`✅ Cargadas ${camerasList.length} cámaras RTSP desde servidor`);
      return camerasList;
    } catch (err) {
      console.error('❌ Error cargando cámaras:', err.message);
      setCamerasError(err.message);
      return [];
    } finally {
      setCamerasLoading(false);
    }
  }, [apiUrl]);

  /**
   * Cargar sensores y cámaras en paralelo
   */
  const loadAll = useCallback(async () => {
    console.log('🔄 Sincronizando sensores y cámaras...');
    await Promise.all([loadSensors(), loadCameras()]);
  }, [loadSensors, loadCameras]);

  /**
   * Agregar sensor
   */
  const addSensor = useCallback(async (sensorData) => {
    try {
      const response = await fetch(`${apiUrl}/api/sensors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sensorData)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const newSensor = await response.json();
      setSensors(prev => [...prev, newSensor]);
      console.log('✅ Sensor agregado:', newSensor);
      return newSensor;
    } catch (err) {
      console.error('❌ Error agregando sensor:', err.message);
      throw err;
    }
  }, [apiUrl]);

  /**
   * Actualizar sensor
   */
  const updateSensor = useCallback(async (sensorId, updates) => {
    try {
      const response = await fetch(`${apiUrl}/api/sensors/${sensorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const updated = await response.json();
      setSensors(prev => prev.map(s => s.id === sensorId ? updated : s));
      console.log('✅ Sensor actualizado:', updated);
      return updated;
    } catch (err) {
      console.error('❌ Error actualizando sensor:', err.message);
      throw err;
    }
  }, [apiUrl]);

  /**
   * Eliminar sensor
   */
  const deleteSensor = useCallback(async (sensorId) => {
    try {
      const response = await fetch(`${apiUrl}/api/sensors/${sensorId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSensors(prev => prev.filter(s => s.id !== sensorId));
      console.log('✅ Sensor eliminado:', sensorId);
    } catch (err) {
      console.error('❌ Error eliminando sensor:', err.message);
      throw err;
    }
  }, [apiUrl]);

  /**
   * Agregar cámara RTSP
   */
  const addCamera = useCallback(async (cameraData) => {
    try {
      console.log('📤 Enviando cámara:', JSON.stringify(cameraData, null, 2));
      console.log('🌐 URL:', `${apiUrl}/api/rtsp/cameras`);
      
      const response = await fetch(`${apiUrl}/api/rtsp/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cameraData)
      });
      
      const responseText = await response.text();
      console.log('📥 Respuesta del servidor:', responseText);
      
      if (!response.ok) {
        console.error('❌ Error HTTP:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
      
      const newCamera = JSON.parse(responseText);
      setCameras(prev => [...prev, newCamera]);
      console.log('✅ Cámara agregada:', newCamera);
      return newCamera;
    } catch (err) {
      console.error('❌ Error agregando cámara:', err.message);
      throw err;
    }
  }, [apiUrl]);

  /**
   * Actualizar cámara RTSP
   */
  const updateCamera = useCallback(async (cameraId, updates) => {
    try {
      console.log('📤 Actualizando cámara:', cameraId);
      console.log('📋 Datos a actualizar:', updates);
      
      const response = await fetch(`${apiUrl}/api/rtsp/cameras/${cameraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      const responseText = await response.text();
      console.log('📥 Respuesta del servidor:', responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
      
      const updated = JSON.parse(responseText);
      setCameras(prev => prev.map(c => c.id === cameraId ? { ...c, ...updated.camera || updated } : c));
      console.log('✅ Cámara actualizada:', updated);
      return updated;
    } catch (err) {
      console.error('❌ Error actualizando cámara:', err.message);
      throw err;
    }
  }, [apiUrl]);

  /**
   * Eliminar cámara RTSP
   */
  const deleteCamera = useCallback(async (cameraId) => {
    try {
      const response = await fetch(`${apiUrl}/api/rtsp/cameras/${cameraId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setCameras(prev => prev.filter(c => c.id !== cameraId));
      console.log('✅ Cámara eliminada:', cameraId);
    } catch (err) {
      console.error('❌ Error eliminando cámara:', err.message);
      throw err;
    }
  }, [apiUrl]);

  /**
   * Obtener sensores filtrados por tipo
   */
  const getSensorsByType = useCallback((type) => {
    return sensors.filter(s => s.type === type);
  }, [sensors]);

  /**
   * Cargar datos al montar el provider
   */
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /**
   * Monitorear estado de cámaras periódicamente
   */
  useEffect(() => {
    const monitorCameras = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/rtsp/cameras`);
        if (!response.ok) return;
        
        const data = await response.json();
        const camerasList = Array.isArray(data) ? data : data.cameras || [];
        
        // Actualizar solo las cámaras que cambiaron
        setCameras(prev => {
          const hasChanges = prev.length !== camerasList.length ||
            prev.some((camera, idx) => 
              JSON.stringify(camera) !== JSON.stringify(camerasList[idx])
            );
          
          if (hasChanges) {
            console.log('📹 Estado de cámaras actualizado');
          }
          return camerasList;
        });
      } catch (err) {
        console.warn('⚠️ Error monitoreando cámaras:', err.message);
      }
    };

    // Iniciar monitoreo cada 15 segundos
    const interval = setInterval(monitorCameras, 15000);
    
    return () => clearInterval(interval);
  }, [apiUrl]);

  const value = {
    // Sensors
    sensors,
    setSensors,
    sensorsLoading,
    sensorsError,
    loadSensors,
    addSensor,
    updateSensor,
    deleteSensor,
    getSensorsByType,
    
    // Cameras
    cameras,
    setCameras,
    camerasLoading,
    camerasError,
    loadCameras,
    addCamera,
    updateCamera,
    deleteCamera,
    
    // Utilities
    loadAll,
  };

  return (
    <SensorContext.Provider value={value}>
      {children}
    </SensorContext.Provider>
  );
};

export default SensorContext;
