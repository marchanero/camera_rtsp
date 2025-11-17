import fs from 'fs'
import path from 'path'

class SensorRecorder {
  constructor() {
    this.activeRecordings = new Map() // cameraId -> recording data
    this.recordingsDir = path.join(process.cwd(), 'recordings')
  }

  /**
   * Inicia la grabación de datos de sensores
   * @param {number} cameraId - ID de la cámara
   * @param {string} cameraName - Nombre de la cámara
   * @param {number|null} scenarioId - ID del escenario (opcional)
   */
  startRecording(cameraId, cameraName, scenarioId = null) {
    if (this.activeRecordings.has(cameraId)) {
      console.log(`⚠️ Ya hay una grabación de sensores activa para cámara ${cameraId}`)
      return this.activeRecordings.get(cameraId)
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const scenarioPrefix = scenarioId ? `scenario_${scenarioId}_` : ''
    const filename = `${scenarioPrefix}sensors_camera_${cameraId}_${timestamp}.jsonl`
    const sensorDir = path.join(this.recordingsDir, `camera_${cameraId}`)
    
    // Crear directorio si no existe
    if (!fs.existsSync(sensorDir)) {
      fs.mkdirSync(sensorDir, { recursive: true })
    }

    const filepath = path.join(sensorDir, filename)
    const stream = fs.createWriteStream(filepath, { flags: 'a' })

    const recording = {
      cameraId,
      cameraName,
      scenarioId,
      filename,
      filepath,
      stream,
      startTime: new Date(),
      recordCount: 0
    }

    this.activeRecordings.set(cameraId, recording)
    
    const scenarioInfo = scenarioId ? ` (Escenario ${scenarioId})` : ''
    console.log(`🎬 Grabación de sensores iniciada: ${cameraName}${scenarioInfo} -> ${filename}`)
    
    return {
      success: true,
      filename,
      startTime: recording.startTime,
      scenarioId
    }
  }

  /**
   * Registra datos de sensores en la grabación activa
   */
  recordSensorData(cameraId, sensorData) {
    const recording = this.activeRecordings.get(cameraId)
    
    if (!recording) {
      return false
    }

    try {
      // Escribir como JSONL (JSON Lines) - una línea por registro
      const record = {
        timestamp: new Date().toISOString(),
        ...sensorData
      }
      
      recording.stream.write(JSON.stringify(record) + '\n')
      recording.recordCount++
      
      return true
    } catch (error) {
      console.error('❌ Error grabando datos de sensor:', error)
      return false
    }
  }

  /**
   * Detiene la grabación de datos de sensores
   */
  stopRecording(cameraId) {
    const recording = this.activeRecordings.get(cameraId)
    
    if (!recording) {
      return {
        success: false,
        error: 'No hay grabación activa'
      }
    }

    return new Promise((resolve) => {
      recording.stream.end(() => {
        const endTime = new Date()
        const duration = Math.floor((endTime - recording.startTime) / 1000)
        
        this.activeRecordings.delete(cameraId)
        
        const scenarioInfo = recording.scenarioId ? ` (Escenario ${recording.scenarioId})` : ''
        console.log(`🛑 Grabación de sensores detenida: ${recording.cameraName}${scenarioInfo}`)
        console.log(`   Registros: ${recording.recordCount}, Duración: ${duration}s`)
        
        resolve({
          success: true,
          filename: recording.filename,
          recordCount: recording.recordCount,
          duration,
          startTime: recording.startTime,
          endTime,
          scenarioId: recording.scenarioId
        })
      })
    })
  }

  /**
   * Verifica si hay una grabación activa para una cámara
   */
  isRecording(cameraId) {
    return this.activeRecordings.has(cameraId)
  }

  /**
   * Obtiene información de la grabación activa
   */
  getActiveRecording(cameraId) {
    return this.activeRecordings.get(cameraId) || null
  }

  /**
   * Obtiene grabaciones de sensores de una cámara
   * Ahora incluye información del escenario si existe en el nombre del archivo
   */
  getRecordings(cameraId) {
    const sensorDir = path.join(this.recordingsDir, `camera_${cameraId}`)
    
    if (!fs.existsSync(sensorDir)) {
      return []
    }

    const files = fs.readdirSync(sensorDir)
      .filter(file => file.endsWith('.jsonl'))
      .map(file => {
        const filepath = path.join(sensorDir, file)
        const stats = fs.statSync(filepath)
        
        // Extraer scenarioId del nombre del archivo si existe
        const scenarioMatch = file.match(/scenario_(\d+)_/)
        const scenarioId = scenarioMatch ? parseInt(scenarioMatch[1]) : null
        
        // Contar líneas del archivo
        const content = fs.readFileSync(filepath, 'utf-8')
        const recordCount = content.split('\n').filter(line => line.trim()).length
        
        return {
          filename: file,
          path: filepath,
          size: stats.size,
          recordCount,
          scenarioId,
          created: stats.birthtime,
          modified: stats.mtime
        }
      })
      .sort((a, b) => b.created - a.created)

    return files
  }

  /**
   * Lee los datos de una grabación de sensores
   */
  readRecording(cameraId, filename) {
    const filepath = path.join(this.recordingsDir, `camera_${cameraId}`, filename)
    
    if (!fs.existsSync(filepath)) {
      throw new Error('Grabación no encontrada')
    }

    const content = fs.readFileSync(filepath, 'utf-8')
    const records = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
    
    return records
  }

  /**
   * Elimina una grabación de sensores
   */
  deleteRecording(cameraId, filename) {
    const filepath = path.join(this.recordingsDir, `camera_${cameraId}`, filename)
    
    if (!fs.existsSync(filepath)) {
      throw new Error('Grabación no encontrada')
    }

    fs.unlinkSync(filepath)
    
    return {
      success: true,
      message: 'Grabación de sensores eliminada'
    }
  }

  /**
   * Obtiene estado de la grabación activa
   */
  getRecordingStatus(cameraId) {
    const recording = this.activeRecordings.get(cameraId)
    
    if (!recording) {
      return null
    }

    const duration = Math.floor((new Date() - recording.startTime) / 1000)
    
    return {
      cameraId,
      cameraName: recording.cameraName,
      scenarioId: recording.scenarioId,
      filename: recording.filename,
      startTime: recording.startTime,
      duration,
      recordCount: recording.recordCount
    }
  }

  /**
   * Detiene todas las grabaciones
   */
  async stopAllRecordings() {
    const promises = []
    
    for (const cameraId of this.activeRecordings.keys()) {
      promises.push(this.stopRecording(cameraId))
    }

    return Promise.all(promises)
  }
}

// Singleton
const sensorRecorder = new SensorRecorder()

export default sensorRecorder
