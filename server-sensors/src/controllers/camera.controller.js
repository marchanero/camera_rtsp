const { getDatabase } = require('../config/database');
const rtspService = require('../services/rtsp.service');

class CameraController {
  /**
   * GET /api/cameras - Obtener todas las cámaras
   */
  async getAllCameras(req, res) {
    try {
      const db = getDatabase();

      db.all(
        'SELECT id, name, ip, port, username, password, path, active, connection_status, last_checked, created_at, updated_at FROM cameras ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) {
            console.error('Error fetching cameras:', err);
            return res.status(500).json({ error: 'Error al obtener cámaras' });
          }

          // Don't return passwords in the response
          const cameras = rows.map(camera => ({
            id: camera.id,
            name: camera.name,
            ip: camera.ip,
            port: camera.port,
            username: camera.username,
            path: camera.path,
            active: camera.active === 1,
            connection_status: camera.connection_status,
            last_checked: camera.last_checked,
            created_at: camera.created_at,
            updated_at: camera.updated_at
          }));

          res.json({ cameras, count: cameras.length });
        }
      );
    } catch (error) {
      console.error('Error fetching cameras:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * GET /api/cameras/:id - Obtener una cámara específica
   */
  async getCamera(req, res) {
    try {
      const { id } = req.params;
      const db = getDatabase();

      db.get(
        'SELECT id, name, ip, port, username, path, active, connection_status, last_checked, created_at, updated_at FROM cameras WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            console.error('Error fetching camera:', err);
            return res.status(500).json({ error: 'Error al obtener cámara' });
          }

          if (!row) {
            return res.status(404).json({ error: 'Cámara no encontrada' });
          }

          res.json({ camera: row });
        }
      );
    } catch (error) {
      console.error('Error fetching camera:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * POST /api/cameras - Crear una nueva cámara
   */
  async createCamera(req, res) {
    try {
      const { name, ip, port = 554, username = '', password = '', path = '/stream' } = req.body;

      // Validate required fields
      if (!name || !ip) {
        return res.status(400).json({ error: 'Nombre e IP son requeridos' });
      }

      // Validate IP format
      if (!this.isValidIP(ip)) {
        return res.status(400).json({ error: 'Formato de IP inválido' });
      }

      // Validate port
      const parsedPort = parseInt(port);
      if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        return res.status(400).json({ error: 'Puerto debe estar entre 1 y 65535' });
      }

      const db = getDatabase();

      db.run(
        'INSERT INTO cameras (name, ip, port, username, password, path, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, ip, parsedPort, username, password, path, 1],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(409).json({ error: 'Ya existe una cámara con ese nombre' });
            }
            console.error('Error creating camera:', err);
            return res.status(500).json({ error: 'Error al crear cámara' });
          }

          res.status(201).json({
            success: true,
            message: 'Cámara creada exitosamente',
            camera: {
              id: this.lastID,
              name,
              ip,
              port: parsedPort,
              username,
              path,
              active: true,
              connection_status: 'disconnected'
            }
          });
        }
      );
    } catch (error) {
      console.error('Error creating camera:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * PUT /api/cameras/:id - Actualizar una cámara
   */
  async updateCamera(req, res) {
    try {
      const { id } = req.params;
      const { name, ip, port, username, password, path, active } = req.body;

      // Validate IP if provided
      if (ip && !this.isValidIP(ip)) {
        return res.status(400).json({ error: 'Formato de IP inválido' });
      }

      // Validate port if provided
      if (port) {
        const parsedPort = parseInt(port);
        if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
          return res.status(400).json({ error: 'Puerto debe estar entre 1 y 65535' });
        }
      }

      const db = getDatabase();

      // Build dynamic update query
      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (ip !== undefined) {
        updates.push('ip = ?');
        params.push(ip);
      }
      if (port !== undefined) {
        updates.push('port = ?');
        params.push(parseInt(port));
      }
      if (username !== undefined) {
        updates.push('username = ?');
        params.push(username);
      }
      if (password !== undefined) {
        updates.push('password = ?');
        params.push(password);
      }
      if (path !== undefined) {
        updates.push('path = ?');
        params.push(path);
      }
      if (active !== undefined) {
        updates.push('active = ?');
        params.push(active ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      db.run(
        `UPDATE cameras SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(409).json({ error: 'Ya existe una cámara con ese nombre' });
            }
            console.error('Error updating camera:', err);
            return res.status(500).json({ error: 'Error al actualizar cámara' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: 'Cámara no encontrada' });
          }

          res.json({ success: true, message: 'Cámara actualizada exitosamente' });
        }
      );
    } catch (error) {
      console.error('Error updating camera:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * DELETE /api/cameras/:id - Eliminar una cámara
   */
  async deleteCamera(req, res) {
    try {
      const { id } = req.params;
      const db = getDatabase();

      db.run('DELETE FROM cameras WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting camera:', err);
          return res.status(500).json({ error: 'Error al eliminar cámara' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Cámara no encontrada' });
        }

        res.json({ success: true, message: 'Cámara eliminada exitosamente' });
      });
    } catch (error) {
      console.error('Error deleting camera:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * POST /api/cameras/:id/test - Probar conexión a una cámara
   */
  async testCameraConnection(req, res) {
    try {
      const { id } = req.params;
      const db = getDatabase();

      db.get('SELECT id, ip, port, username, password, path FROM cameras WHERE id = ?', [id], async (err, camera) => {
        if (err) {
          console.error('Error fetching camera:', err);
          return res.status(500).json({ error: 'Error al obtener cámara' });
        }

        if (!camera) {
          return res.status(404).json({ error: 'Cámara no encontrada' });
        }

        try {
          // Actualizar estado a "testing"
          await rtspService.updateCameraStatus(camera.id, 'testing');

          // Probar conexión RTSP real
          const testResult = await rtspService.testRTSPConnection(camera);

          // Actualizar estado final
          await rtspService.updateCameraStatus(camera.id, testResult.status);

          // Obtener información adicional del stream si la conexión fue exitosa
          let streamInfo = null;
          if (testResult.success) {
            const infoResult = await rtspService.getStreamInfo(camera);
            if (infoResult.success) {
              streamInfo = infoResult.stream_info;
            }
          }

          res.json({
            success: testResult.success,
            connection_status: testResult.status,
            rtsp_url: testResult.rtsp_url,
            stream_info: streamInfo,
            message: testResult.message
          });

        } catch (testError) {
          console.error('Error testing RTSP connection:', testError);

          // Actualizar estado a error
          await rtspService.updateCameraStatus(camera.id, 'error');

          res.status(500).json({
            success: false,
            connection_status: 'error',
            rtsp_url: null,
            message: `Error al probar conexión: ${testError.message}`
          });
        }
      });
    } catch (error) {
      console.error('Error testing camera connection:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * POST /api/cameras/:id/start-relay - Iniciar retransmisión RTSP
   */
  async startStreamRelay(req, res) {
    try {
      const { id } = req.params;
      const { outputPort } = req.body;

      const db = getDatabase();

      db.get('SELECT id, name FROM cameras WHERE id = ?', [id], async (err, camera) => {
        if (err) {
          console.error('Error fetching camera:', err);
          return res.status(500).json({ error: 'Error al obtener cámara' });
        }

        if (!camera) {
          return res.status(404).json({ error: 'Cámara no encontrada' });
        }

        try {
          const relayResult = await rtspService.startStreamRelay(id, outputPort);

          if (relayResult.success) {
            res.json({
              success: true,
              relay_url: relayResult.relay_url,
              message: relayResult.message
            });
          } else {
            res.status(500).json({
              success: false,
              message: relayResult.message
            });
          }

        } catch (relayError) {
          console.error('Error starting RTSP relay:', relayError);
          res.status(500).json({
            success: false,
            message: `Error al iniciar retransmisión: ${relayError.message}`
          });
        }
      });
    } catch (error) {
      console.error('Error starting stream relay:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * POST /api/cameras/:id/stop-relay - Detener retransmisión RTSP
   */
  async stopStreamRelay(req, res) {
    try {
      const { id } = req.params;

      const relayResult = await rtspService.stopStreamRelay(id);

      if (relayResult.success) {
        res.json({
          success: true,
          message: relayResult.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: relayResult.message
        });
      }

    } catch (error) {
      console.error('Error stopping stream relay:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * GET /api/cameras/streams/active - Obtener streams activos
   */
  async getActiveStreams(req, res) {
    try {
      const activeStreams = rtspService.getActiveStreams();

      res.json({
        streams: activeStreams,
        count: activeStreams.length
      });

    } catch (error) {
      console.error('Error getting active streams:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * GET /api/cameras/:id/stream-info - Obtener información del stream
   */
  async getStreamInfo(req, res) {
    try {
      const { id } = req.params;
      const db = getDatabase();

      db.get('SELECT id, ip, port, username, password, path FROM cameras WHERE id = ?', [id], async (err, camera) => {
        if (err) {
          console.error('Error fetching camera:', err);
          return res.status(500).json({ error: 'Error al obtener cámara' });
        }

        if (!camera) {
          return res.status(404).json({ error: 'Cámara no encontrada' });
        }

        try {
          const infoResult = await rtspService.getStreamInfo(camera);

          if (infoResult.success) {
            res.json({
              success: true,
              stream_info: infoResult.stream_info,
              message: infoResult.message
            });
          } else {
            res.status(500).json({
              success: false,
              stream_info: null,
              message: infoResult.message
            });
          }

        } catch (infoError) {
          console.error('Error getting stream info:', infoError);
          res.status(500).json({
            success: false,
            stream_info: null,
            message: `Error al obtener información del stream: ${infoError.message}`
          });
        }
      });
    } catch (error) {
      console.error('Error getting stream info:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * Validate IP address format
   */
  isValidIP(ip) {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const hostPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

    if (ipv4Pattern.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
    }

    return hostPattern.test(ip);
  }
}

module.exports = new CameraController();
