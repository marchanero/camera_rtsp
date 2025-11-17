import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';

interface VideoPreviewProps {
  cameraId: number | string;
  cameraName: string;
  hlsUrl: string;
  onStatusChange?: (status: { cameraId: number | string; status: string; error: string | null }) => void;
  showControls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
}

interface HLSConfig {
  debug?: boolean;
  enableWorker?: boolean;
  lowLatencyMode?: boolean;
  maxBufferLength?: number;
  maxMaxBufferLength?: number;
  testOnBitrateFallback?: boolean;
}

interface HLSErrorData {
  type: string;
  details: string;
  fatal?: boolean;
}

interface HLSInstance {
  loadSource: (url: string) => void;
  attachMedia: (video: HTMLVideoElement) => void;
  on: (event: string, callback: (event?: unknown, data?: HLSErrorData) => void) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    HLS?: {
      new (config?: HLSConfig): HLSInstance;
    };
  }
}

/**
 * Componente para reproducir video HLS con controles de estado
 * Requiere: hls.js (https://github.com/video-dev/hls.js)
 */
const VideoPreview: FC<VideoPreviewProps> = ({
  cameraId,
  cameraName,
  hlsUrl,
  onStatusChange = () => {},
  showControls = true,
  autoPlay = true,
  muted = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HLSInstance | null>(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;

    const initHLS = async () => {
      try {
        setStatus('loading');
        setError(null);

        const video = videoRef.current;
        if (!video) return;

        // Verificar si el navegador soporta HLS nativo
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari y algunos navegadores soportan HLS nativamente
          video.src = hlsUrl;
          video.addEventListener('loadedmetadata', () => {
            setStatus('playing');
            if (autoPlay) {
              video.play().catch((e: Error) => console.warn('Autoplay bloqueado:', e));
            }
          });
        } else if (window.HLS) {
          // Usar HLS.js para otros navegadores
          const hls = new window.HLS({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            testOnBitrateFallback: true,
          });

          hlsRef.current = hls;

          hls.loadSource(hlsUrl);
          if (video) {
            hls.attachMedia(video);
          }

          hls.on('hlsManifestParsed', () => {
            setStatus('playing');
            if (autoPlay && video) {
              video.play().catch((e: Error) => console.warn('Autoplay bloqueado:', e));
            }
          });

          hls.on('hlsError', (_event: unknown, data?: HLSErrorData) => {
            console.error('HLS Error:', data);
            if (data?.fatal) {
              setStatus('error');
              setError(`Error HLS: ${data.type}`);
            }
          });

          hls.on('error', (_event: unknown, data?: HLSErrorData) => {
            console.error('Error en HLS.js:', data);
            setStatus('error');
            setError(`Error: ${data?.details}`);
          });
        } else {
          setError(
            'Tu navegador no soporta reproducción HLS. Por favor, actualiza el navegador.'
          );
          setStatus('error');
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error al inicializar HLS:', error);
        setError(error.message);
        setStatus('error');
      }
    };

    initHLS();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl, autoPlay]);

  /**
   * Notificar cambios de estado
   */
  useEffect(() => {
    onStatusChange({ cameraId, status, error });
  }, [status, error, cameraId, onStatusChange]);

  /**
   * Manejar eventos del video
   */
  const handlePlayPause = () => {
    if (videoRef.current?.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-black rounded-lg overflow-hidden shadow-lg">
      {/* Video Container */}
      <div className="relative w-full bg-black aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full"
          controls={false}
          muted={muted}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Estado Loading */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-3"></div>
              <p className="text-white text-sm">Cargando stream...</p>
            </div>
          </div>
        )}

        {/* Estado Error */}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <svg
                className="h-12 w-12 text-red-500 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-white text-sm font-medium">Error al cargar el stream</p>
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            </div>
          </div>
        )}

        {/* Overlay de Información */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/50 to-transparent">
          <p className="text-white text-sm font-medium">{cameraName}</p>
          <p className="text-gray-300 text-xs">
            {status === 'playing'
              ? '🟢 En vivo'
              : status === 'loading'
                ? '⏳ Cargando'
                : '🔴 Offline'}
          </p>
        </div>
      </div>

      {/* Controles */}
      {showControls && (
        <div className="bg-gray-900 p-3 space-y-2">
          {/* Barra de progreso */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={(e) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = parseFloat(e.target.value);
                }
              }}
              className="flex-1 h-1 bg-gray-700 rounded cursor-pointer"
              title="Barra de progreso"
            />
            <span className="text-white text-xs whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Botones de control */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className="p-2 hover:bg-gray-800 rounded transition text-white"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Mute/Unmute */}
              <button
                onClick={handleMute}
                className="p-2 hover:bg-gray-800 rounded transition text-white"
                title="Silenciar"
              >
                {videoRef.current?.muted ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C23.16 15.07 24 13.16 24 11c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>

              {/* Volumen */}
              <div className="flex items-center gap-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-gray-700 rounded cursor-pointer"
                  title="Controlar volumen"
                />
              </div>
            </div>

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              className="p-2 hover:bg-gray-800 rounded transition text-white"
              title="Pantalla completa"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Información de Estado */}
      {status === 'playing' && (
        <div className="bg-gray-800 px-3 py-2 text-xs text-gray-300 flex justify-between">
          <span>Stream: {hlsUrl}</span>
          <span className="text-green-400">● En vivo</span>
        </div>
      )}
    </div>
  );
};

export default VideoPreview;
