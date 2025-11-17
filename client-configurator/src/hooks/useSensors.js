import { useContext } from 'react';
import { SensorContext } from '../contexts/SensorContext';

/**
 * Hook para usar el SensorContext
 * Proporciona acceso a sensores, cámaras y funciones de CRUD
 */
export const useSensors = () => {
  const context = useContext(SensorContext);
  
  if (!context) {
    throw new Error('useSensors debe usarse dentro de un SensorProvider');
  }
  
  return context;
};

export default useSensors;
