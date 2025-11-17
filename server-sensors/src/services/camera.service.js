const { getDatabase } = require('../config/database');

class CameraService {
  /**
   * Agregar una nueva cámara RTSP
   */
  addCamera(cameraData) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const { name, ip, port = 554, username = '', password = '', path = '/', protocol = 'rtsp' } = cameraData;

      const query = `
        INSERT INTO rtsp_cameras (name, ip, port, username, password, path, protocol)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [name, ip, port, username, password, path, protocol], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject({ code: 'DUPLICATE_NAME', message: 'Ya existe una cámara con este nombre' });
          } else {
            reject({ code: 'DB_ERROR', message: err.message });
          }
        } else {
          resolve({
            id: this.lastID,
            name,
            ip,
            port,
            username,
            password,
            path,
            protocol,
            enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      });
    });
  }

  /**
   * Obtener todas las cámaras
   */
  getAllCameras() {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const query = `SELECT * FROM rtsp_cameras ORDER BY created_at DESC`;

      db.all(query, [], (err, rows) => {
        if (err) {
          reject({ code: 'DB_ERROR', message: err.message });
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Obtener una cámara por ID
   */
  getCameraById(id) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const query = `SELECT * FROM rtsp_cameras WHERE id = ?`;

      db.get(query, [id], (err, row) => {
        if (err) {
          reject({ code: 'DB_ERROR', message: err.message });
        } else if (!row) {
          reject({ code: 'NOT_FOUND', message: 'Cámara no encontrada' });
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Actualizar una cámara
   */
  updateCamera(id, cameraData) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const { name, ip, port, username, password, path, protocol, enabled } = cameraData;

      const query = `
        UPDATE rtsp_cameras
        SET name = ?, ip = ?, port = ?, username = ?, password = ?, path = ?, protocol = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.run(query, [name, ip, port, username, password, path, protocol, enabled, id], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject({ code: 'DUPLICATE_NAME', message: 'Ya existe una cámara con este nombre' });
          } else {
            reject({ code: 'DB_ERROR', message: err.message });
          }
        } else if (this.changes === 0) {
          reject({ code: 'NOT_FOUND', message: 'Cámara no encontrada' });
        } else {
          resolve({ success: true, message: 'Cámara actualizada correctamente' });
        }
      });
    });
  }

  /**
   * Eliminar una cámara
   */
  deleteCamera(id) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const query = `DELETE FROM rtsp_cameras WHERE id = ?`;

      db.run(query, [id], function(err) {
        if (err) {
          reject({ code: 'DB_ERROR', message: err.message });
        } else if (this.changes === 0) {
          reject({ code: 'NOT_FOUND', message: 'Cámara no encontrada' });
        } else {
          resolve({ success: true, message: 'Cámara eliminada correctamente' });
        }
      });
    });
  }

  /**
   * Actualizar estado de conexión
   */
  updateConnectionStatus(id, status) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const query = `
        UPDATE rtsp_cameras
        SET last_connection_status = ?, last_connection_time = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.run(query, [status, id], function(err) {
        if (err) {
          reject({ code: 'DB_ERROR', message: err.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  /**
   * Habilitar/deshabilitar una cámara
   */
  toggleCamera(id, enabled) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const query = `UPDATE rtsp_cameras SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

      db.run(query, [enabled ? 1 : 0, id], function(err) {
        if (err) {
          reject({ code: 'DB_ERROR', message: err.message });
        } else if (this.changes === 0) {
          reject({ code: 'NOT_FOUND', message: 'Cámara no encontrada' });
        } else {
          resolve({ success: true, enabled });
        }
      });
    });
  }
}

module.exports = new CameraService();
