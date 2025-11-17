/**
 * Ejemplo de cómo consumir el stream RTSP desde el cliente
 * Este archivo muestra cómo integrar HLS.js para reproducir el stream
 */

import Hls from 'hls.js';

export function initializeRTSPStream(videoElementId, cameraId = 1) {
  const video = document.getElementById(videoElementId);
  
  if (!video) {
    console.error(`Video element with id "${videoElementId}" not found`);
    return;
  }

  // URL del stream HLS (servido por el backend)
  const hlsUrl = `/api/stream/hls/${cameraId}`;

  console.log(`🎬 Inicializando stream HLS: ${hlsUrl}`);

  // Verificar si HLS.js está disponible
  if (Hls.isSupported()) {
    const hls = new Hls({
      debug: true,
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 60,
    });

    hls.loadSource(hlsUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('✅ Manifest parsed, starting playback');
      video.play().catch(err => {
        console.error('❌ Error al reproducir video:', err);
      });
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.error('❌ Error de red:', data);
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.error('❌ Error de media:', data);
            hls.recoverMediaError();
            break;
          default:
            console.error('❌ Error fatal:', data);
            break;
        }
      }
    });

    hls.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
      console.log(`📊 Calidad cambiada: ${data.level}`);
    });

    return hls;
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Soporte nativo para HLS en Safari
    video.src = hlsUrl;
    video.addEventListener('loadedmetadata', () => {
      console.log('✅ Stream cargado (HLS nativo)');
      video.play();
    });
  } else {
    console.error('❌ HLS no es soportado en este navegador');
  }
}

export function stopRTSPStream(hls) {
  if (hls) {
    hls.destroy();
    console.log('✅ Stream detenido');
  }
}

// Ejemplo de uso:
/*
// En tu componente React/Vue/etc
import { initializeRTSPStream } from './rtsp-stream.js';

export function VideoPlayer() {
  let hls;

  function handlePlay() {
    hls = initializeRTSPStream('rtsp-video', 1);
  }

  function handleStop() {
    stopRTSPStream(hls);
  }

  return (
    <div>
      <video id="rtsp-video" controls width="800" height="600" />
      <button onClick={handlePlay}>Reproducir</button>
      <button onClick={handleStop}>Detener</button>
    </div>
  );
}
*/
