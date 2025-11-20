// Configuración de cámaras y credenciales
import dotenv from 'dotenv'
dotenv.config()

export const cameraConfig = {
  ip: process.env.CAMERA_IP || '192.168.8.210',
  username: process.env.CAMERA_USER || 'admin',
  password: process.env.CAMERA_PASS || 'galgo2526',
  port: process.env.CAMERA_PORT || 554,
  protocol: 'rtsp'
}

// URLs de ejemplo
export const streamPaths = {
  stream1: '/stream1',
  stream2: '/stream2',
  stream3: '/stream3',
  mainStream: '/stream',
  subStream: '/stream?token=sub'
}
