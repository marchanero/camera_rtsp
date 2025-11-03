import { spawn } from 'child_process'

export function captureRTSPFrame(rtspUrl) {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-rtsp_transport', 'tcp',
      '-stimeout', '5000000',  // 5 segundos en microsegundos
      '-i', rtspUrl,
      '-vframes', '1',
      '-f', 'image2',
      '-q:v', '5',
      '-'
    ]

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let buffer = Buffer.alloc(0)
    let timedOut = false

    // Timeout de 6 segundos
    const timeout = setTimeout(() => {
      timedOut = true
      ffmpegProcess.kill('SIGKILL')
      reject(new Error('Timeout capturando frame'))
    }, 6000)

    ffmpegProcess.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
    })

    ffmpegProcess.on('close', (code) => {
      clearTimeout(timeout)

      if (timedOut) {
        return
      }

      if (code === 0 && buffer.length > 0) {
        resolve(buffer)
      } else {
        reject(new Error(`FFmpeg exit code ${code}`))
      }
    })

    ffmpegProcess.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    ffmpegProcess.stderr.on('data', () => {
      // Ignorar stderr
    })
  })
}
