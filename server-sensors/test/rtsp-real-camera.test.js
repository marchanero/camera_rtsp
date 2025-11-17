/**
 * Tests reales para conexión RTSP con cámara
 * Estos tests prueban la conexión real con tu cámara
 */

const { expect } = require('chai');
const RTSPService = require('../src/services/rtsp.service');

describe('RTSP Real Camera Connection', () => {
  const cameraConfig = {
    name: 'Galgo School Camera',
    ip: '192.168.8.210',
    port: 554,
    username: 'admin',
    password: 'galgo2526',
    path: '/h264Preview_01_main'
  };

  describe('Conexión a cámara real', () => {
    it('should build correct RTSP URL with credentials', () => {
      const url = RTSPService.buildRTSPUrl(cameraConfig);
      
      expect(url).to.equal('rtsp://admin:galgo2526@192.168.8.210:554/stream');
      console.log(`✅ URL RTSP construida: ${url}`);
    });

    it('should attempt to test RTSP connection', async function() {
      this.timeout(15000); // Aumentar timeout para conexión real

      const result = await RTSPService.testRTSPConnection(cameraConfig);
      
      console.log(`📡 Resultado de conexión:`, result);
      
      // No haremos assert aquí porque la cámara puede no estar disponible en el test
      // pero registramos el resultado para debugging
      expect(result).to.have.property('success');
      expect(result).to.have.property('status');
      expect(result).to.have.property('message');
    });

    it('should attempt to get stream info', async function() {
      this.timeout(15000); // Aumentar timeout para conexión real

      const result = await RTSPService.getStreamInfo(cameraConfig);
      
      console.log(`📊 Información del stream:`, result);
      
      // No haremos assert aquí porque la cámara puede no estar disponible
      expect(result).to.have.property('success');
      expect(result).to.have.property('message');
    });
  });

  describe('Validación de configuración', () => {
    it('should validate camera configuration', () => {
      const rtspConfig = require('../src/config/rtsp.config');
      const validation = rtspConfig.validateCameraConfig(cameraConfig);
      
      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.be.empty;
      
      console.log(`✅ Configuración válida:`, validation);
    });
  });
});
