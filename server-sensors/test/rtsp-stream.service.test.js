const { expect } = require('chai');
const sinon = require('sinon');
const { spawn } = require('child_process');
const RTSPStreamService = require('../src/services/rtsp-stream.service');
const rtspConfig = require('../src/config/rtsp.config');

describe('RTSP Stream Service', () => {
  let streamService;
  let mockLogger;

  beforeEach(() => {
    // Create a fresh instance for testing
    const RTSPStreamServiceClass = require('../src/services/rtsp-stream.service').constructor;
    streamService = new RTSPStreamServiceClass();

    mockLogger = {
      connection: sinon.stub(),
      reconnect: sinon.stub(),
      ffmpeg: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub()
    };

    // Mock the logger import
    sinon.stub(require('../src/utils/rtsp-logger'), 'connection').value(mockLogger.connection);
    sinon.stub(require('../src/utils/rtsp-logger'), 'reconnect').value(mockLogger.reconnect);
    sinon.stub(require('../src/utils/rtsp-logger'), 'ffmpeg').value(mockLogger.ffmpeg);
    sinon.stub(require('../src/utils/rtsp-logger'), 'error').value(mockLogger.error);
    sinon.stub(require('../src/utils/rtsp-logger'), 'warn').value(mockLogger.warn);
  });

  afterEach(() => {
    sinon.restore();
    // Clean up any running processes
    if (streamService.streams && streamService.streams.size > 0) {
      streamService.streams.forEach(stream => {
        if (stream.process) {
          stream.process.kill();
        }
      });
    }
  });

  describe('startStream', () => {
    let spawnStub;

    beforeEach(() => {
      spawnStub = sinon.stub(require('child_process'), 'spawn');
    });

    it('should start FFmpeg process with correct arguments', async () => {
      const mockProcess = {
        stdout: { on: sinon.stub() },
        stderr: { on: sinon.stub() },
        on: sinon.stub(),
        kill: sinon.stub(),
        killed: false
      };

      spawnStub.returns(mockProcess);
      mockProcess.on.withArgs('close').callsFake((callback) => {
        // Simulate successful start
        setTimeout(() => callback(0), 100);
      });

      const camera = {
        id: 1,
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream',
        quality: 'medium'
      };

      const result = await streamService.startStream(camera.id, camera, {});

      expect(result.success).to.be.true;
      expect(spawnStub.calledOnce).to.be.true;
      expect(spawnStub.firstCall.args[0]).to.equal('ffmpeg');

      // Verify FFmpeg arguments include RTSP URL
      const args = spawnStub.firstCall.args[1];
      expect(args).to.include('-i');
      expect(args).to.include('rtsp://192.168.1.100:554/stream');

      // Verify logger was called
      expect(mockLogger.connection.calledWith('Stream iniciado para cámara 1', 1, sinon.match.object)).to.be.true;
    });

    it('should handle FFmpeg process spawn error', async () => {
      spawnStub.throws(new Error('FFmpeg not found'));

      const camera = {
        id: 1,
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      try {
        await streamService.startStream(camera.id, camera, {});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('FFmpeg not found');
        expect(mockLogger.error.called).to.be.true;
      }
    });
  });

  describe('stopStream', () => {
    it('should stop active stream and clean up resources', () => {
      const cameraId = 1;
      const mockProcess = { kill: sinon.stub(), killed: false };

      // Simulate active stream
      streamService.streams.set(cameraId, {
        cameraId,
        process: mockProcess,
        camera: { id: cameraId },
        hlsPath: '/tmp/camera_1.m3u8',
        createdAt: new Date()
      });

      const result = streamService.stopStream(cameraId);

      expect(result.success).to.be.true;
      expect(mockProcess.kill.calledWith('SIGTERM')).to.be.true;
      expect(streamService.streams.has(cameraId)).to.be.false;
    });

    it('should handle stopping non-existent stream', () => {
      const result = streamService.stopStream(999);

      expect(result.success).to.be.false;
      expect(result.message).to.equal('Stream no encontrado');
    });
  });

  describe('getStreamStatus', () => {
    it('should return active stream status', () => {
      const cameraId = 1;
      const startTime = Date.now() - 60000; // 1 minute ago

      streamService.streams.set(cameraId, {
        cameraId,
        camera: { id: cameraId, name: 'Test Camera' },
        status: 'connected',
        attempts: 2,
        createdAt: new Date(startTime),
        hlsUrl: '/api/stream/hls/1'
      });

      const status = streamService.getStreamStatus(cameraId);

      expect(status.status).to.equal('connected');
      expect(status.cameraId).to.equal(cameraId);
      expect(status.uptime).to.be.greaterThan(59000); // At least 59 seconds
      expect(status.attempts).to.equal(2);
    });

    it('should return null for non-existent stream', () => {
      const status = streamService.getStreamStatus(999);
      expect(status).to.be.null;
    });
  });

  describe('_attemptReconnect', () => {
    let spawnStub;

    beforeEach(() => {
      spawnStub = sinon.stub(require('child_process'), 'spawn');
    });

    it('should attempt reconnection with exponential backoff', async () => {
      const mockProcess = {
        stdout: { on: sinon.stub() },
        stderr: { on: sinon.stub() },
        on: sinon.stub(),
        kill: sinon.stub(),
        killed: false
      };

      spawnStub.returns(mockProcess);
      mockProcess.on.withArgs('close').callsFake((callback) => {
        setTimeout(() => callback(0), 100);
      });

      const camera = {
        id: 1,
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      // Set up stream data
      const streamData = {
        cameraId: 1,
        rtspUrl: 'rtsp://192.168.1.100:554/stream',
        hlsPath: '/tmp/camera_1.m3u8',
        status: 'disconnected',
        attempts: 1,
        maxAttempts: 5,
        process: null,
        lastError: 'Connection lost',
        createdAt: new Date(),
        quality: 'medium',
        options: {}
      };

      streamService.streams.set(1, streamData);

      // Call private method (this is a test, so we access it directly)
      streamService._attemptReconnect(1, streamData);

      // Wait for the timeout
      await new Promise(resolve => setTimeout(resolve, 3100));

      expect(spawnStub.called).to.be.true;
      expect(mockLogger.reconnect.called).to.be.true;
    });

    it('should respect maximum reconnection attempts', () => {
      const camera = { id: 1, name: 'Test Camera' };
      const streamData = {
        cameraId: 1,
        attempts: rtspConfig.ffmpeg.reconnect.maxAttempts,
        maxAttempts: rtspConfig.ffmpeg.reconnect.maxAttempts,
        status: 'disconnected',
        lastError: 'Connection failed'
      };

      streamService.streams.set(1, streamData);

      streamService._attemptReconnect(1, streamData);

      expect(streamData.status).to.equal('failed');
      expect(mockLogger.error.called).to.be.true;
    });
  });

  describe('getActiveStreams', () => {
    it('should return all active streams', () => {
      const camera1 = { id: 1, name: 'Camera 1' };
      const camera2 = { id: 2, name: 'Camera 2' };

      streamService.streams.set(1, {
        cameraId: 1,
        camera: camera1,
        status: 'connected',
        createdAt: new Date(),
        attempts: 0,
        rtspUrl: 'rtsp://cam1',
        outputPort: 8554,
        startTime: new Date()
      });

      streamService.streams.set(2, {
        cameraId: 2,
        camera: camera2,
        status: 'connecting',
        createdAt: new Date(),
        attempts: 1,
        rtspUrl: 'rtsp://cam2',
        outputPort: 8555,
        startTime: new Date()
      });

      const activeStreams = streamService.getActiveStreams();

      expect(activeStreams).to.have.lengthOf(2);
      expect(activeStreams[0].cameraId).to.equal(1);
      expect(activeStreams[1].cameraId).to.equal(2);
    });
  });
});