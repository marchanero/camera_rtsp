import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

/**
 * Componente para reproducir video HLS con controles y estado
 * Requiere: hls.js (https://github.com/video-dev/hls.js)
 */
const VideoPreview = ({
  cameraId,
  cameraName,
  hlsUrl,
  onStatusChange,
  showControls = true,
  autoPlay = true,
  muted = true,
}) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const initializedRef = useRef(false);
  
  // Refs para valores que no deberían causar re-inicialización
  const autoPlayRef = useRef(autoPlay);
  const cameraIdRef = useRef(cameraId);
  const onStatusChangeRef = useRef(onStatusChange);
  
  // Actualizar refs cuando cambien los props
  useEffect(() => {
    autoPlayRef.current = autoPlay;
    cameraIdRef.current = cameraId;
    onStatusChangeRef.current = onStatusChange;
  }, [autoPlay, cameraId, onStatusChange]);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uptime, setUptime] = useState(0);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);

  const uptimeIntervalRef = useRef(null);
  const autoplayAttemptedRef = useRef(false);

  // Inicializar HLS
  useEffect(() => {
    console.log('🎬 VideoPreview - useEffect llamado para hlsUrl:', hlsUrl);
    
    // Si ya está inicializado para esta URL, no hacer nada
    if (initializedRef.current === hlsUrl && hlsRef.current) {
      console.log('🎬 VideoPreview - Ya inicializado para esta URL, saltando');
      return;
    }

    // Si hay una instancia anterior con diferente URL, destruirla
    if (hlsRef.current && initializedRef.current !== hlsUrl) {
      console.log('🧹 VideoPreview - Destruyendo instancia anterior para nueva URL');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    console.log('🎬 VideoPreview - Inicializando para URL:', hlsUrl);

    if (!videoRef.current || !hlsUrl) {
      console.warn('🎬 VideoPreview - No hay videoRef o hlsUrl');
      return;
    }

    // Marcar como inicializado INMEDIATAMENTE para evitar reinicios
    initializedRef.current = hlsUrl;
    // Resetear el flag de autoplay
    autoplayAttemptedRef.current = false;

    const initHLS = async () => {
      try {
        console.log('🔧 Iniciando inicialización HLS...');
        setIsLoading(true);
        setError(null);
        setNeedsUserInteraction(false);
        autoplayAttemptedRef.current = false;

        // Función segura para intentar autoplay
        const attemptAutoplay = () => {
          if (!videoRef.current || autoplayAttemptedRef.current) {
            console.log('🎬 attemptAutoplay - Cancelado (no videoRef o ya intentado)');
            return;
          }

          // Verificar que el elemento esté aún en el documento
          if (!document.contains(videoRef.current)) {
            console.warn('🎬 Video element no está en el documento, cancelando autoplay');
            return;
          }

          console.log('🎬 Intentando autoplay inmediatamente...');
          autoplayAttemptedRef.current = true;

          // Intentar reproducir inmediatamente
          videoRef.current.play()
            .then(() => {
              console.log('✅ Autoplay exitoso');
              setIsPlaying(true);
            })
            .catch((error) => {
              console.warn('⚠️ No se pudo autoplay - requiere interacción del usuario:', error.name);
              setNeedsUserInteraction(true);
              setIsPlaying(false);
            });
        };

        // Comprobar si HLS.js está disponible
        console.log('🔍 Verificando soporte HLS.js:', typeof Hls, Hls.isSupported());
        if (Hls.isSupported()) {
          console.log('✅ HLS.js soportado, creando instancia...');
          const hls = new Hls({
            debug: true, // Habilitar debug para más información
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 5,
            maxMaxBufferLength: 10,
          });

          console.log('🎬 Cargando fuente HLS:', hlsUrl);
          hls.loadSource(hlsUrl);
          console.log('🎬 Adjuntando media al video element...');
          hls.attachMedia(videoRef.current);

          // Manejo de errores HLS
          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('❌ Error HLS:', data);
            if (data.fatal) {
              setError(`Error fatal: ${data.details}`);
              onStatusChangeRef.current?.({
                cameraId: cameraIdRef.current,
                status: 'error',
                error: data.details,
              });
            }
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('✅ Manifest HLS parseado correctamente');
            
            // Verificar que el componente sigue montado
            if (!videoRef.current || !document.contains(videoRef.current)) {
              console.warn('⚠️ Componente desmontado durante MANIFEST_PARSED');
              return;
            }
            
            setIsLoading(false);
            setIsPlaying(autoPlayRef.current);
            
            if (autoPlayRef.current) {
              console.log('🎬 Llamando attemptAutoplay desde MANIFEST_PARSED');
              attemptAutoplay();
            }
            
            onStatusChangeRef.current?.({
              cameraId: cameraIdRef.current,
              status: 'connected',
              error: null,
            });
          });

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            console.log('📺 Media adjuntada correctamente');
          });

          hls.on(Hls.Events.MANIFEST_LOADING, () => {
            console.log('📄 Cargando manifest...');
          });

          hls.on(Hls.Events.LEVEL_LOADING, () => {
            console.log('📊 Cargando nivel...');
          });

          hls.on(Hls.Events.FRAG_LOADING, () => {
            console.log('🎬 Cargando fragmento...');
          });

          hls.on(Hls.Events.FRAG_LOADED, () => {
            console.log('✅ Fragmento cargado');
          });

          hlsRef.current = hls;
        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          console.log('🍎 Usando soporte nativo HLS de Safari');
          videoRef.current.src = hlsUrl;
          videoRef.current.addEventListener('loadedmetadata', () => {
            console.log('✅ Metadata cargada para Safari');
            setIsLoading(false);
            if (autoPlayRef.current) {
              attemptAutoplay();
            }
          });
        } else {
          console.error('❌ Navegador no soporta reproducción HLS');
          setError('Tu navegador no soporta reproducción HLS');
          onStatusChangeRef.current?.({
            cameraId: cameraIdRef.current,
            status: 'error',
            error: 'Navegador no soportado',
          });
        }
      } catch (err) {
        console.error('Error inicializando HLS:', err);
        setError(err.message);
        onStatusChangeRef.current?.({
          cameraId: cameraIdRef.current,
          status: 'error',
          error: err.message,
        });
      }
    };

    initHLS();

    return () => {
      console.log('🧹 VideoPreview - Cleanup ejecutándose para URL:', initializedRef.current);
      
      // Solo destruir si realmente cambia la URL
      if (hlsRef.current) {
        console.log('🧹 VideoPreview - Destruyendo HLS instance');
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      initializedRef.current = null;
      autoplayAttemptedRef.current = false;
    };
  }, [hlsUrl]); // Solo depender de hlsUrl para minimizar re-renders

  // Formatear tiempo en HH:MM:SS
  const formatTime = (seconds) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
  };

  // Actualizar uptime
  useEffect(() => {
    if (!isPlaying) {
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
      }
      return;
    }

    uptimeIntervalRef.current = setInterval(() => {
      setUptime((prev) => prev + 1);
    }, 1000);

    return () => {
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
      }
    };
  }, [isPlaying]);

  // Manejadores de eventos
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleTimeUpdate = (e) => {
    setCurrentTime(e.target.currentTime);
  };

  const handleLoadedMetadata = (e) => {
    setDuration(e.target.duration);
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if (videoRef.current.webkitRequestFullscreen) {
        videoRef.current.webkitRequestFullscreen();
      }
    }
  };

  return (
    <div className="w-full bg-black rounded-lg overflow-hidden shadow-lg">
      {/* Video Container */}
      <div className="relative bg-gray-900 aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full"
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={() => console.log('🎬 Video puede reproducirse')}
          onPlay={() => console.log('▶️ Video empezó a reproducirse')}
          onPause={() => console.log('⏸️ Video pausado')}
          onError={(e) => console.error('❌ Error en video element:', e)}
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <div className="text-center text-red-400">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Click to Play Overlay */}
        {needsUserInteraction && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 cursor-pointer" onClick={handlePlayPause}>
            <div className="text-center text-white">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <p className="text-lg font-semibold">Haz clic para reproducir</p>
              <p className="text-sm opacity-75 mt-1">El navegador requiere interacción para iniciar el video</p>
            </div>
          </div>
        )}

        {/* Uptime Badge */}
        {!error && (
          <div className="absolute top-3 left-3 bg-gray-900/80 text-white px-3 py-1 rounded-full text-xs font-mono">
            Tiempo: {formatTime(uptime)}
          </div>
        )}
      </div>

      {/* Controls */}
      {showControls && !error && (
        <div className="bg-gray-900 p-4 space-y-3">
          {/* Camera Name */}
          <div className="text-white font-semibold">{cameraName}</div>

          {/* Progress Bar */}
          <div className="space-y-1">
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
              className="w-full h-1 bg-gray-700 rounded cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className="text-white hover:text-blue-400 transition"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Mute */}
              <button
                onClick={handleMute}
                className="text-white hover:text-blue-400 transition"
                title={isMuted ? 'Activar sonido' : 'Silenciar'}
              >
                {isMuted ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.26 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.26 2.5-4.02zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C21.63 14.91 22 13.5 22 12s-.37-2.91-.99-4.15L19.5 9.36c.34.82.54 1.7.54 2.64z" />
                  </svg>
                )}
              </button>

              {/* Volume */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-700 rounded cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              className="text-white hover:text-blue-400 transition"
              title="Pantalla completa"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPreview;
