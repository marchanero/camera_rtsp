const rtspStreamService = require('../services/rtsp-stream.service');
const cameraService = require('../services/camera.service');
const fs = require('fs');
const path = require('path');

class StreamController {
  /**
   * POST /api/stream/preview/:id - Iniciar preview HLS de una cámara
   */
  async startStreamPreview(req, res) {
    try {
      const { id } = req.params;

      // Obtener datos de la cámara
      const camera = await cameraService.getCameraById(id);

      if (!camera) {
        return res.status(404).json({ 
          success: false,
          error: 'Cámara no encontrada' 
        });
      }

      // Si el stream ya está activo, retornar la URL
      if (rtspStreamService.isStreamActive(id)) {
        const status = rtspStreamService.getStreamStatus(id);
        return res.json({
          success: true,
          message: 'Stream ya está activo',
          hlsUrl: status.hlsUrl,
          status: status.status
        });
      }

      // Iniciar stream
      const result = await rtspStreamService.startStream(id, camera);

      return res.status(201).json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error al iniciar preview:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al iniciar preview del stream',
        details: error.message
      });
    }
  }

  /**
   * DELETE /api/stream/preview/:id - Detener preview HLS de una cámara
   */
  async stopStreamPreview(req, res) {
    try {
      const { id } = req.params;

      const result = await rtspStreamService.stopStream(id);

      return res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error al detener preview:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al detener preview del stream',
        details: error.message
      });
    }
  }

  /**
   * GET /api/stream/status/:id - Obtener estado del stream
   */
  async getStreamStatus(req, res) {
    try {
      const { id } = req.params;

      const status = rtspStreamService.getStreamStatus(id);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Stream no encontrado'
        });
      }

      return res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Error al obtener estado del stream:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al obtener estado del stream'
      });
    }
  }

  /**
   * GET /api/stream/status - Obtener estado de todos los streams
   */
  async getAllStreamsStatus(req, res) {
    try {
      const status = rtspStreamService.getStreamStatus();

      return res.json({
        success: true,
        streams: status,
        count: status.length
      });
    } catch (error) {
      console.error('Error al obtener estado de todos los streams:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al obtener estado de los streams'
      });
    }
  }

  /**
   * GET /api/stream/hls/:id - Servir archivo M3U8 HLS
   * Este endpoint es llamado por el reproductor de video para obtener la playlist
   */
  async serveHLSPlaylist(req, res) {
    try {
      const { id } = req.params;
      const hlsPath = rtspStreamService.getHLSPath(id);

      if (!hlsPath || !fs.existsSync(hlsPath)) {
        return res.status(404).json({
          success: false,
          error: 'Archivo HLS no encontrado'
        });
      }

      let content = fs.readFileSync(hlsPath, 'utf8');

      // Modificar las URLs de los segmentos para que apunten a los endpoints correctos
      // Cambiar líneas como "camera_1_000.ts" por "/api/stream/segment/1/000.ts"
      content = content.replace(/camera_(\d+)_(\d+)\.ts/g, (match, cameraId, segmentNum) => {
        return `/api/stream/segment/${cameraId}/${segmentNum}.ts`;
      });

      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.send(content);
    } catch (error) {
      console.error('Error al servir playlist HLS:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al servir playlist HLS'
      });
    }
  }

  /**
   * GET /api/stream/segment/:id/:segment - Servir segmento TS de HLS
   */
  async serveHLSSegment(req, res) {
    try {
      const { id, segment } = req.params;
      const outputDir = path.join(__dirname, '../../public/hls');
      const segmentPath = path.join(outputDir, `camera_${id}_${segment}`);

      // Validar que el segmento sea seguro (prevenir directory traversal)
      if (!segmentPath.startsWith(outputDir)) {
        return res.status(403).json({
          success: false,
          error: 'Acceso denegado'
        });
      }

      if (!fs.existsSync(segmentPath)) {
        return res.status(404).json({
          success: false,
          error: 'Segmento no encontrado'
        });
      }

      res.set('Content-Type', 'video/mp2t');
      res.set('Cache-Control', 'public, max-age=10');
      res.sendFile(segmentPath);
    } catch (error) {
      console.error('Error al servir segmento HLS:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al servir segmento'
      });
    }
  }
}

module.exports = new StreamController();
