// components/SensorCard.tsx
import React from 'react';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import type { Sensor } from '../types';

interface SensorCardProps {
  sensor: Sensor;
}

const SensorCard: React.FC<SensorCardProps> = ({ sensor }) => {
  const getStatusIcon = () => {
    switch (sensor.status) {
      case 'online':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'offline':
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              {sensor.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sensor.type}
            </p>
          </div>
        </div>

        {sensor.lastReading !== undefined && (
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {sensor.lastReading}
              {sensor.unit && <span className="text-sm text-gray-500 ml-1">{sensor.unit}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorCard;