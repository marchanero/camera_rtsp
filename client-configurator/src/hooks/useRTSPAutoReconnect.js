import { useState, useEffect, useRef } from 'react';

/**
 * Hook para manejar auto-reconexión a streams RTSP
 * Implementa exponential backoff para reintentos
 */
export const useRTSPAutoReconnect = (cameraId, config = {}) => {
  const defaultConfig = {
    maxAttempts: 5,
    initialDelayMs: 3000,
    backoffMultiplier: 1.5,
    maxDelayMs: 30000,
  };

  const finalConfig = { ...defaultConfig, ...config };

  const [state, setState] = useState({
    isConnected: false,
    isReconnecting: false,
    currentAttempt: 0,
    nextRetryIn: 0,
    lastError: null,
  });

  const countdownIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Calcular delay con exponential backoff
  const calculateDelay = (attempt) => {
    const delay = Math.min(
      finalConfig.initialDelayMs * Math.pow(finalConfig.backoffMultiplier, attempt),
      finalConfig.maxDelayMs
    );
    return Math.round(delay);
  };

  // Iniciar countdown para próximo reintento
  const startCountdown = (nextRetryTime) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      const timeRemaining = Math.max(0, nextRetryTime - Date.now());
      setState((prev) => ({ ...prev, nextRetryIn: timeRemaining }));

      if (timeRemaining === 0) {
        clearInterval(countdownIntervalRef.current);
      }
    }, 100);
  };

  // Intentar conectar
  const attemptConnect = async (hlsUrl) => {
    try {
      const response = await fetch(hlsUrl, { method: 'HEAD' });
      if (response.ok) {
        setState({
          isConnected: true,
          isReconnecting: false,
          currentAttempt: 0,
          nextRetryIn: 0,
          lastError: null,
        });
        console.log(`✅ Conexión exitosa a cámara ${cameraId}`);
        return true;
      }
    } catch (error) {
      console.warn(`⚠️ Error de conexión a cámara ${cameraId}:`, error.message);
    }
    return false;
  };

  // Iniciar reconexión con exponential backoff
  const reconnect = async (hlsUrl) => {
    if (state.currentAttempt >= finalConfig.maxAttempts) {
      setState((prev) => ({
        ...prev,
        isReconnecting: false,
        lastError: `Máximo de reintentos alcanzado (${finalConfig.maxAttempts})`,
      }));
      console.error(`❌ Máximo de reintentos alcanzado para cámara ${cameraId}`);
      return;
    }

    const delay = calculateDelay(state.currentAttempt);
    const nextRetryTime = Date.now() + delay;

    setState((prev) => ({
      ...prev,
      isReconnecting: true,
      currentAttempt: prev.currentAttempt + 1,
      nextRetryIn: delay,
      lastError: null,
    }));

    console.log(`🔄 Intento ${state.currentAttempt + 1} en ${delay}ms para cámara ${cameraId}`);

    startCountdown(nextRetryTime);

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(async () => {
      const success = await attemptConnect(hlsUrl);
      if (!success) {
        await reconnect(hlsUrl);
      }
    }, delay);
  };

  // Desconectar
  const disconnect = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setState({
      isConnected: false,
      isReconnecting: false,
      currentAttempt: 0,
      nextRetryIn: 0,
      lastError: null,
    });
  };

  // Cleanup en unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    attemptConnect,
    reconnect,
    disconnect,
  };
};
