const cameraService = require('../services/camera.service');
const rtspService = require('../services/rtsp.service');
const rtspConfig = require('../config/rtsp.config');

class RTSPCameraController {
  /**
   * GET /api/rtsp/cameras - Obtener todas las cámaras RTSP
   */
  async getAllCameras(req, res) {
    try {
      const cameras = await cameraService.getAllCameras();
      res.json({ cameras, count: cameras.length });
    } catch (error) {
      console.error('Error fetching cameras:', error);
      res.status(500).json({ error: error.message || 'Error al obtener cámaras' });
    }
  }

  /**
   * GET /api/rtsp/cameras/:id - Obtener una cámara específica
   */
  async getCamera(req, res) {
    try {
      const { id } = req.params;
      const camera = await cameraService.getCameraById(id);
      res.json({ camera });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error fetching camera:', error);
      res.status(500).json({ error: error.message || 'Error al obtener cámara' });
    }
  }

  /**
   * POST /api/rtsp/cameras - Crear una nueva cámara RTSP
   */
  async createCamera(req, res) {
    try {
      const { name, ip, port, username, password, path, protocol } = req.body;

      // Usar validaciones centralizadas
      const validation = rtspConfig.validateCameraConfig({
        name,
        ip,
        port: port || rtspConfig.rtsp.defaultPort,
        path: path || rtspConfig.rtsp.defaultPath,
        protocol: protocol || 'rtsp'
      });

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Datos de validación inválidos',
          details: validation.errors
        });
      }

      // Validaciones adicionales específicas del negocio
      if (name.length < 2) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
      }

      const camera = await cameraService.addCamera({
        name: name.trim(),
        ip: ip.trim(),
        port: port || rtspConfig.rtsp.defaultPort,
        username: username?.trim(),
        password, // No trim para preservar espacios si existen
        path: path || rtspConfig.rtsp.defaultPath,
        protocol: protocol || 'rtsp'
      });

      res.status(201).json({
        success: true,
        message: 'Cámara creada exitosamente',
        camera
      });
    } catch (error) {
      if (error.code === 'DUPLICATE_NAME') {
        return res.status(409).json({ error: error.message });
      }
      console.error('Error creating camera:', error);
      res.status(500).json({ error: error.message || 'Error al crear cámara' });
    }
  }

  /**
   * PUT /api/rtsp/cameras/:id - Actualizar una cámara
   */
  async updateCamera(req, res) {
    try {
      const { id } = req.params;
      const { name, ip, port, username, password, path, protocol, enabled } = req.body;

      // Obtener cámara actual para merge
      const currentCamera = await cameraService.getCameraById(id);

      // Preparar datos actualizados
      const updatedData = {
        name: name !== undefined ? name.trim() : currentCamera.name,
        ip: ip !== undefined ? ip.trim() : currentCamera.ip,
        port: port !== undefined ? port : currentCamera.port,
        username: username !== undefined ? username?.trim() : currentCamera.username,
        password: password !== undefined ? password : currentCamera.password,
        path: path !== undefined ? path : currentCamera.path,
        protocol: protocol !== undefined ? protocol : currentCamera.protocol,
        enabled: enabled !== undefined ? enabled : currentCamera.enabled
      };

      // Validar datos actualizados
      const validation = rtspConfig.validateCameraConfig(updatedData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Datos de validación inválidos',
          details: validation.errors
        });
      }

      // Validaciones adicionales
      if (updatedData.name.length < 2) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
      }

      await cameraService.updateCamera(id, updatedData);

      res.json({
        success: true,
        message: 'Cámara actualizada exitosamente',
        camera: updatedData
      });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      if (error.code === 'DUPLICATE_NAME') {
        return res.status(409).json({ error: error.message });
      }
      console.error('Error updating camera:', error);
      res.status(500).json({ error: error.message || 'Error al actualizar cámara' });
    }
  }

  /**
   * DELETE /api/rtsp/cameras/:id - Eliminar una cámara
   */
  async deleteCamera(req, res) {
    try {
      const { id } = req.params;
      await cameraService.deleteCamera(id);
      res.json({
        success: true,
        message: 'Cámara eliminada exitosamente'
      });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error deleting camera:', error);
      res.status(500).json({ error: error.message || 'Error al eliminar cámara' });
    }
  }

  /**
   * POST /api/rtsp/cameras/:id/test - Probar conexión a una cámara
   */
  async testConnection(req, res) {
    try {
      const { id } = req.params;
      const camera = await cameraService.getCameraById(id);

      // Actualizar estado a "testing"
      await cameraService.updateConnectionStatus(id, 'testing');

      // Probar conexión RTSP real
      const testResult = await rtspService.testRTSPConnection(camera);

      // Actualizar estado final
      await cameraService.updateConnectionStatus(id, testResult.success ? 'connected' : 'error');

      // Obtener información adicional del stream si la conexión fue exitosa
      let streamInfo = null;
      if (testResult.success) {
        try {
          const infoResult = await rtspService.getStreamInfo(camera);
          if (infoResult.success) {
            streamInfo = infoResult.stream_info;
          }
        } catch (infoError) {
          console.warn('Error getting stream info:', infoError);
        }
      }

      res.json({
        success: testResult.success,
        connection_status: testResult.success ? 'connected' : 'error',
        rtsp_url: testResult.rtsp_url,
        stream_info: streamInfo,
        message: testResult.message
      });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error testing connection:', error);
      res.status(500).json({ error: error.message || 'Error al probar conexión' });
    }
  }

  /**
   * POST /api/rtsp/cameras/:id/toggle - Habilitar/deshabilitar una cámara
   */
  async toggleCamera(req, res) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      if (enabled === undefined) {
        return res.status(400).json({ error: 'El campo "enabled" es requerido' });
      }

      const result = await cameraService.toggleCamera(id, enabled);
      res.json(result);
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error toggling camera:', error);
      res.status(500).json({ error: error.message || 'Error al cambiar estado de cámara' });
    }
  }

  /**
   * GET /api/rtsp/cameras/:id/stream-info - Obtener información del stream
   */
  async getStreamInfo(req, res) {
    try {
      const { id } = req.params;
      const camera = await cameraService.getCameraById(id);

      const infoResult = await rtspService.getStreamInfo(camera);

      if (!infoResult.success) {
        return res.status(400).json({ error: infoResult.message });
      }

      res.json({
        success: true,
        stream_info: infoResult.stream_info
      });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error getting stream info:', error);
      res.status(500).json({ error: error.message || 'Error al obtener información del stream' });
    }
  }

  /**
   * Validar formato de IP
   */
  isValidIP(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;

    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part);
        return num >= 0 && num <= 255;
      });
    }

    return hostnameRegex.test(ip) || ip === 'localhost';
  }
}

module.exports = new RTSPCameraController();
