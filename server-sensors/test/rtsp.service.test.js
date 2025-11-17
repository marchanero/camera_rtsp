const { expect } = require('chai');
const sinon = require('sinon');
const net = require('net');
const RTSPService = require('../src/services/rtsp.service');
const rtspConfig = require('../src/config/rtsp.config');

describe('RTSP Service', () => {
  let rtspService;

  beforeEach(() => {
    rtspService = RTSPService;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('buildRTSPUrl', () => {
    it('should build RTSP URL without credentials', () => {
      const camera = {
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const url = rtspService.buildRTSPUrl(camera);
      expect(url).to.equal('rtsp://192.168.1.100:554/stream');
    });

    it('should build RTSP URL with credentials', () => {
      const camera = {
        ip: '192.168.1.100',
        port: 554,
        username: 'admin',
        password: 'password123',
        path: '/stream'
      };

      const url = rtspService.buildRTSPUrl(camera);
      expect(url).to.equal('rtsp://admin:password123@192.168.1.100:554/stream');
    });

    it('should use default port if not provided', () => {
      const camera = {
        ip: '192.168.1.100',
        path: '/stream'
      };

      const url = rtspService.buildRTSPUrl(camera);
      expect(url).to.equal(`rtsp://192.168.1.100:${rtspConfig.rtsp.defaultPort}/stream`);
    });
  });

  describe('testRTSPConnection', () => {
    let socketStub;
    let createConnectionStub;

    beforeEach(() => {
      socketStub = {
        write: sinon.stub(),
        end: sinon.stub(),
        on: sinon.stub(),
        once: sinon.stub()
      };

      createConnectionStub = sinon.stub(net, 'createConnection').returns(socketStub);
    });

    it('should return success for valid RTSP connection', async () => {
      // Mock successful connection
      socketStub.on.withArgs('connect').callsFake((callback) => setTimeout(callback, 10));
      socketStub.on.withArgs('data').callsFake((callback) => {
        setTimeout(() => callback(Buffer.from('RTSP/1.0 200 OK\r\n\r\n')), 20);
      });

      const camera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const result = await rtspService.testRTSPConnection(camera);

      expect(result.success).to.be.true;
      expect(result.status).to.equal('connected');
      expect(result.rtsp_url).to.include('rtsp://192.168.1.100:554/stream');
    });

    it('should return error for invalid RTSP response', async () => {
      socketStub.on.withArgs('connect').callsFake((callback) => setTimeout(callback, 10));
      socketStub.on.withArgs('data').callsFake((callback) => {
        setTimeout(() => callback(Buffer.from('RTSP/1.0 404 Not Found\r\n\r\n')), 20);
      });

      const camera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const result = await rtspService.testRTSPConnection(camera);

      expect(result.success).to.be.false;
      expect(result.status).to.equal('error');
    });

    it('should handle connection timeout', async () => {
      socketStub.on.withArgs('timeout').callsFake((callback) => setTimeout(callback, 10));

      const camera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const result = await rtspService.testRTSPConnection(camera);

      expect(result.success).to.be.false;
      expect(result.status).to.equal('timeout');
    });

    it('should handle connection error', async () => {
      socketStub.on.withArgs('error').callsFake((callback) => {
        setTimeout(() => callback(new Error('Connection refused')), 10);
      });

      const camera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const result = await rtspService.testRTSPConnection(camera);

      expect(result.success).to.be.false;
      expect(result.status).to.equal('disconnected');
      expect(result.message).to.include('Connection refused');
    });

    it('should return error for invalid RTSP response', async () => {
      socketStub.on.withArgs('connect').callsFake((callback) => callback());
      socketStub.on.withArgs('data').callsFake((callback) => {
        callback(Buffer.from('RTSP/1.0 404 Not Found\r\n\r\n'));
      });

      const camera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const result = await rtspService.testRTSPConnection(camera);

      expect(result.success).to.be.false;
      expect(result.status).to.equal('error');
    });

    it('should handle connection timeout', async () => {
      socketStub.on.withArgs('timeout').callsFake((callback) => setTimeout(callback, 10));

      const camera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const result = await rtspService.testRTSPConnection(camera);

      expect(result.success).to.be.false;
      expect(result.status).to.equal('timeout');
    });

    it('should handle connection error', async () => {
      socketStub.on.withArgs('error').callsFake((callback) => {
        setTimeout(() => callback(new Error('Connection refused')), 10);
      });

      const camera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const result = await rtspService.testRTSPConnection(camera);

      expect(result.success).to.be.false;
      expect(result.status).to.equal('disconnected');
      expect(result.message).to.include('Connection refused');
    });
  });

  describe('getStreamInfo', () => {
    let socketStub;
    let createConnectionStub;

    beforeEach(() => {
      socketStub = {
        write: sinon.stub(),
        end: sinon.stub(),
        on: sinon.stub(),
        once: sinon.stub()
      };

      createConnectionStub = sinon.stub(net, 'createConnection').returns(socketStub);
    });

    it('should parse SDP stream info correctly', async () => {
      const mockSDP = `RTSP/1.0 200 OK\r\nContent-Type: application/sdp\r\n\r\nv=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\nm=audio 0 RTP/AVP 97\r\na=rtpmap:97 MPEG4-GENERIC/44100\r\n`;

      socketStub.on.withArgs('connect').callsFake((callback) => setTimeout(callback, 10));
      socketStub.on.withArgs('data').callsFake((callback) => {
        setTimeout(() => callback(Buffer.from(mockSDP)), 20);
      });

      const camera = {
        name: 'Test Camera',
        ip: '192.168.1.100',
        port: 554,
        path: '/stream'
      };

      const result = await rtspService.getStreamInfo(camera);

      expect(result.success).to.be.true;
      expect(result.stream_info.hasVideo).to.be.true;
      expect(result.stream_info.hasAudio).to.be.true;
      expect(result.stream_info.videoCodec).to.equal('H264');
      expect(result.stream_info.audioCodec).to.equal('MPEG4-GENERIC');
    });
  });
});