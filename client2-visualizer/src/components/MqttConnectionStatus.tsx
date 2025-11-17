// components/MqttConnectionStatus.tsx
import React from 'react';
import { Wifi, WifiOff, Clock } from 'lucide-react';
import type { MqttStatus } from '../types';

interface MqttConnectionStatusProps {
  mqttStatus: MqttStatus;
  mqttConnecting: boolean;
}

const MqttConnectionStatus: React.FC<MqttConnectionStatusProps> = ({
  mqttStatus,
  mqttConnecting
}) => {
  const getStatusInfo = () => {
    if (mqttConnecting) {
      return {
        icon: <Wifi className="w-5 h-5 animate-pulse" />,
        text: 'Conectando...',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
      };
    }

    if (mqttStatus.connected) {
      return {
        icon: <Wifi className="w-5 h-5" />,
        text: 'Conectado',
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20'
      };
    }

    return {
      icon: <WifiOff className="w-5 h-5" />,
      text: 'Desconectado',
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    };
  };

  const statusInfo = getStatusInfo();

  const formatLastChecked = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'Desconocido';
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={statusInfo.color}>
            {statusInfo.icon}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              Estado MQTT
            </h3>
            <p className={`text-sm ${statusInfo.color}`}>
              {statusInfo.text}
            </p>
          </div>
        </div>

        {mqttStatus.lastChecked && (
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3 mr-1" />
            {formatLastChecked(mqttStatus.lastChecked)}
          </div>
        )}
      </div>

      {mqttStatus.broker && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium">Broker:</span> {mqttStatus.broker}
        </div>
      )}

      {mqttStatus.clientId && (
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium">Cliente:</span> {mqttStatus.clientId}
        </div>
      )}
    </div>
  );
};

export default MqttConnectionStatus;