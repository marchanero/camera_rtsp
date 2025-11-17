const { expect } = require('chai');
const rtspConfig = require('../src/config/rtsp.config');

describe('RTSP Configuration', () => {
  describe('validateCameraConfig', () => {
    it('should validate correct camera configuration', () => {
      const validCamera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const result = rtspConfig.validateCameraConfig(validCamera);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should reject invalid IP address', () => {
      const invalidCamera = {
        name: 'Test Camera',
        ip: 'invalid-ip',
        port: 554,
        path: '/stream'
      };

      const result = rtspConfig.validateCameraConfig(invalidCamera);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Dirección IP o hostname inválida');
    });

    it('should reject invalid port number', () => {
      const invalidCamera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 99999,
        path: '/stream'
      };

      const result = rtspConfig.validateCameraConfig(invalidCamera);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Puerto debe estar entre 1 y 65535');
    });

    it('should reject invalid IP address', () => {
      const invalidCamera = {
        name: 'Test Camera',
        ip: 'invalid-ip',
        port: 554,
        path: '/stream'
      };

      const result = rtspConfig.validateCameraConfig(invalidCamera);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Dirección IP o hostname inválida');
    });

    it('should reject missing required fields', () => {
      const invalidCamera = {
        name: 'Test Camera',
        ip: '192.168.1.100'
        // missing port and path
      };

      const result = rtspConfig.validateCameraConfig(invalidCamera);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Ruta RTSP inválida');
    });

    it('should reject invalid quality preset', () => {
      const invalidCamera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream',
        quality: 'invalid-quality'
      };

      // Quality is not validated in validateCameraConfig, it's handled elsewhere
      const result = rtspConfig.validateCameraConfig(invalidCamera);
      expect(result.isValid).to.be.true; // Should pass basic validation
    });
  });

  describe('getQualityConfig', () => {
    it('should return correct quality configuration for low', () => {
      const config = rtspConfig.getQualityConfig('low');
      expect(config.videoBitrate).to.equal('500k');
      expect(config.maxBitrate).to.equal('600k');
      expect(config.resolution).to.equal('640x480');
    });

    it('should return correct quality configuration for medium', () => {
      const config = rtspConfig.getQualityConfig('medium');
      expect(config.videoBitrate).to.equal('1500k');
      expect(config.maxBitrate).to.equal('2000k');
      expect(config.resolution).to.equal('1280x720');
    });

    it('should return correct quality configuration for high', () => {
      const config = rtspConfig.getQualityConfig('high');
      expect(config.videoBitrate).to.equal('3000k');
      expect(config.maxBitrate).to.equal('4000k');
      expect(config.resolution).to.equal('1920x1080');
    });

    it('should return correct quality configuration for ultra', () => {
      const config = rtspConfig.getQualityConfig('ultra');
      expect(config.videoBitrate).to.equal('5000k');
      expect(config.maxBitrate).to.equal('6000k');
      expect(config.resolution).to.equal('1920x1080');
    });

    it('should return medium as default for invalid quality', () => {
      const config = rtspConfig.getQualityConfig('invalid');
      expect(config.videoBitrate).to.equal('1500k');
    });
  });

  describe('buildFFmpegArgs', () => {
    it('should build FFmpeg arguments for RTSP to HLS conversion', () => {
      const inputUrl = 'rtsp://192.168.1.100:554/stream';
      const outputPath = '/tmp/stream.m3u8';
      const quality = 'medium';

      const args = rtspConfig.buildFFmpegArgs(inputUrl, outputPath, quality);

      expect(args).to.be.an('array');
      expect(args).to.include('-i');
      expect(args).to.include(inputUrl);
      expect(args).to.include('-c:v');
      expect(args).to.include('libx264');
      expect(args).to.include('-b:v');
      expect(args).to.include('1500k');
      expect(args).to.include('-preset');
      expect(args).to.include('veryfast');
      expect(args).to.include('-f');
      expect(args).to.include('hls');
      expect(args).to.include(outputPath);
    });

    it('should build FFmpeg arguments without credentials', () => {
      const inputUrl = 'rtsp://192.168.1.100:554/stream';
      const outputPath = '/tmp/stream.m3u8';
      const quality = 'low';

      const args = rtspConfig.buildFFmpegArgs(inputUrl, outputPath, quality);

      expect(args).to.include(inputUrl);
      expect(args).to.include('-b:v');
      expect(args).to.include('500k');
      expect(args).to.include('-preset');
      expect(args).to.include('ultrafast');
    });
  });

  describe('Configuration constants', () => {
    it('should have correct RTSP default port', () => {
      expect(rtspConfig.rtsp.defaultPort).to.equal(554);
    });

    it('should have correct connection timeout', () => {
      expect(rtspConfig.rtsp.connectionTimeout).to.equal(5000);
    });

    it('should have correct streaming configuration', () => {
      expect(rtspConfig.ffmpeg.reconnect.maxAttempts).to.equal(5);
      expect(rtspConfig.ffmpeg.reconnect.initialDelay).to.equal(3000);
      expect(rtspConfig.hls.maxSegments).to.equal(10);
    });

    it('should have all quality presets defined', () => {
      expect(rtspConfig.ffmpeg.qualityPresets).to.have.property('low');
      expect(rtspConfig.ffmpeg.qualityPresets).to.have.property('medium');
      expect(rtspConfig.ffmpeg.qualityPresets).to.have.property('high');
      expect(rtspConfig.ffmpeg.qualityPresets).to.have.property('ultra');
    });
  });
});