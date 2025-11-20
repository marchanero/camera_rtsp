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
   * @param {string|null} scenarioName - Nombre del escenario (opcional)
   */
  startRecording(cameraId, cameraName, scenarioId = null, scenarioName = null) {
    if (this.activeRecordings.has(cameraId)) {
      console.log(`⚠️ Ya hay una grabación de sensores activa para cámara ${cameraId}`)
      return this.activeRecordings.get(cameraId)
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    // Nueva estructura: recordings/{scenarioName}/{fecha}/camera_{id}/
    const scenarioFolder = scenarioName ? scenarioName.replace(/[^a-zA-Z0-9]/g, '_') : 'sin_escenario'
    const sensorDir = path.join(this.recordingsDir, scenarioFolder, today, `camera_${cameraId}`)
    
    // Crear directorio si no existe
    if (!fs.existsSync(sensorDir)) {
      fs.mkdirSync(sensorDir, { recursive: true })
    }

    // Nuevo formato: {scenarioName}_{cameraName}_sensors_{timestamp}.jsonl
    // Ejemplo: Aula_A_Camara_Principal_sensors_2025-11-17T14-30-45.jsonl
    const scenarioPrefix = scenarioName ? `${scenarioName.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''
    const cameraNameClean = cameraName.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `${scenarioPrefix}${cameraNameClean}_sensors_${timestamp}.jsonl`
    
    const filepath = path.join(sensorDir, filename)
    const stream = fs.createWriteStream(filepath, { flags: 'a' })

    const recording = {
      cameraId,
      cameraName,
      scenarioId,
      scenarioName,
      filename,
      filepath,
      stream,
      startTime: new Date(),
      recordCount: 0
    }

    this.activeRecordings.set(cameraId, recording)
    
    const scenarioInfo = scenarioName ? ` (Escenario: ${scenarioName})` : ''
    console.log(`🎬 Grabación de sensores iniciada: ${cameraName}${scenarioInfo} -> ${filename}`)
    
    return {
      success: true,
      filename,
      filepath,
      startTime: recording.startTime,
      scenarioId,
      scenarioName
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
        
        const scenarioInfo = recording.scenarioName ? ` (Escenario: ${recording.scenarioName})` : ''
        console.log(`🛑 Grabación de sensores detenida: ${recording.cameraName}${scenarioInfo}`)
        console.log(`   Registros: ${recording.recordCount}, Duración: ${duration}s`)
        
        resolve({
          success: true,
          filename: recording.filename,
          filepath: recording.filepath,
          recordCount: recording.recordCount,
          duration,
          startTime: recording.startTime,
          endTime,
          scenarioId: recording.scenarioId,
          scenarioName: recording.scenarioName
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
   * Busca en todas las carpetas de escenarios
   */
  getRecordings(cameraId, scenarioName = null) {
    const recordings = []
    
    // Si se especifica escenario, buscar solo en ese
    if (scenarioName) {
      const scenarioFolder = scenarioName.replace(/[^a-zA-Z0-9]/g, '_')
      const scenarioDir = path.join(this.recordingsDir, scenarioFolder)
      
      if (fs.existsSync(scenarioDir)) {
        this._scanRecordingsInDir(scenarioDir, cameraId, recordings, scenarioName)
      }
    } else {
      // Buscar en todos los escenarios
      if (fs.existsSync(this.recordingsDir)) {
        const scenarios = fs.readdirSync(this.recordingsDir)
        
        for (const scenario of scenarios) {
          const scenarioPath = path.join(this.recordingsDir, scenario)
          if (fs.statSync(scenarioPath).isDirectory()) {
            this._scanRecordingsInDir(scenarioPath, cameraId, recordings, scenario)
          }
        }
      }
    }

    return recordings.sort((a, b) => b.created - a.created)
  }

  /**
   * Escanea un directorio de escenario buscando grabaciones
   * @private
   */
  _scanRecordingsInDir(scenarioDir, cameraId, recordings, scenarioName) {
    // Recorrer fechas
    const dates = fs.readdirSync(scenarioDir)
    
    for (const date of dates) {
      const datePath = path.join(scenarioDir, date)
      if (!fs.statSync(datePath).isDirectory()) continue
      
      const sensorDir = path.join(datePath, `camera_${cameraId}`)
      
      if (fs.existsSync(sensorDir)) {
        const files = fs.readdirSync(sensorDir)
          .filter(file => file.endsWith('.jsonl'))
          .map(file => {
            const filepath = path.join(sensorDir, file)
            const stats = fs.statSync(filepath)
            
            // Contar líneas del archivo
            const content = fs.readFileSync(filepath, 'utf-8')
            const recordCount = content.split('\n').filter(line => line.trim()).length
            
            return {
              filename: file,
              path: filepath,
              size: stats.size,
              recordCount,
              scenarioName: scenarioName.replace(/_/g, ' '),
              date,
              created: stats.birthtime,
              modified: stats.mtime
            }
          })
        
        recordings.push(...files)
      }
    }
  }

  /**
   * Lee los datos de una grabación de sensores
   */
  readRecording(filepath) {
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
  deleteRecording(filepath) {
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
      scenarioName: recording.scenarioName,
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
