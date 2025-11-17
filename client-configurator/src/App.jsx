import { useState, useEffect, useCallback } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import SensorManagement from './components/SensorManagement'
import MqttConnectionStatus from './components/MqttConnectionStatus'
import RTSPManager from './components/RTSPManager'
import RTSPCameraGallery from './components/RTSPCameraGallery'
import { useFormValidation, validationRules } from './hooks/useFormValidation'
import { usePersistedConfig } from './hooks/usePersistedConfig'
import { useSensors } from './hooks/useSensors'
import { 
  validateMQTTConfig
} from './utils/validators'

// API URL - use environment variable for Docker deployment
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001'

function App() {
  // Usar contexto centralizado para sensores y cámaras
  const { sensors, cameras } = useSensors()
  
  const [currentSection, setCurrentSection] = useState('Dashboard')
  const [configTab, setConfigTab] = useState('general')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStartTime, setRecordingStartTime] = useState(null)
  const [isPaused, setIsPaused] = useState(false)
  const [pausedTime, setPausedTime] = useState(0)
  const [theme, setTheme] = useState('light')
  const [recordingAutoStart, setRecordingAutoStart] = useState(false)

  // MQTT Topics and Sensors Management
  const [mqttTopics, setMqttTopics] = useState([])

  // Configurations state with persistence
  const defaultConfigurations = {
    general: {
      theme: 'light',
      recordingAutoStart: false,
      language: 'es',
      timezone: 'America/Mexico_City'
    },
    recordings: {
      directory: '/home/roberto/galgo-recordings',
      format: 'MP4 (H.264)',
      maxDuration: 60,
      quality: 'Alta (1080p)'
    },
    mqtt: {
      defaultBroker: 'EMQX Test',
      host: '100.82.84.24',
      port: 1883,
      username: 'admin',
      password: 'galgo2526',
      ssl: false,
      autoPolling: {
        enabled: true,
        statusInterval: 30000, // 30 segundos
        messagesInterval: 10000 // 10 segundos
      }
    },
    cameras: {
      defaultRtspPort: 554,
      defaultRtspPath: '/stream',
      connectionTimeout: 10,
      defaultQuality: '1080p (Alta)',
      defaultFrameRate: '30 FPS',
      autoReconnect: true,
      videoBuffer: true,
      bufferSize: 5,
      cameraIPs: []
    }
  }

  const {
    state: configurations,
    setState: setConfigurations
  } = usePersistedConfig('appConfigurations', defaultConfigurations, API_URL, toast)

  // MQTT Status - Simplified state management
  const [mqttStatus, setMqttStatus] = useState({
    connected: false,
    broker: null,
    clientId: null,
    lastChecked: null
  })

  // MQTT connection loading state
  const [mqttConnecting, setMqttConnecting] = useState(false)

  // MQTT Messages
  const [mqttMessages, setMqttMessages] = useState([])
  const [mqttLoading, setMqttLoading] = useState(false)

  // Form validation hooks
  const sensorForm = useFormValidation(
    { type: '', name: '', data: {} },
    {
      type: [validationRules.required('El tipo de sensor es requerido')],
      name: [
        validationRules.required('El nombre del sensor es requerido'),
        validationRules.minLength(2, 'El nombre debe tener al menos 2 caracteres'),
        validationRules.maxLength(50, 'El nombre no puede tener más de 50 caracteres')
      ],
      data: (value, formValues) => {
        const errors = {}
        if (formValues.type === 'rtsp') {
          if (!value.host || !value.host.trim()) {
            errors.host = 'La dirección IP o host es requerida'
          } else if (!/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value.host) && !/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(value.host)) {
            errors.host = 'Formato de IP o dominio inválido'
          }
          if (!value.port || !value.port.toString().trim()) {
            errors.port = 'El puerto RTSP es requerido'
          } else if (value.port < 1 || value.port > 65535) {
            errors.port = 'El puerto debe estar entre 1 y 65535'
          }
          if (!value.path || !value.path.trim()) {
            errors.path = 'El path del stream es requerido'
          }
          // Usuario y contraseña son opcionales, no requieren validación
        } else if (formValues.type === 'emotibit') {
          if (!value.deviceId || !value.deviceId.trim()) {
            errors.deviceId = 'El ID del dispositivo es requerido'
          }
          if (!value.samplingRate || !value.samplingRate.trim()) {
            errors.samplingRate = 'La frecuencia de muestreo es requerida'
          }
        } else if (formValues.type === 'environmental') {
          if (!value.location || !value.location.trim()) {
            errors.location = 'La ubicación es requerida'
          }
          if (!value.parameters || !value.parameters.trim()) {
            errors.parameters = 'Los parámetros son requeridos'
          }
        }
        return Object.keys(errors).length > 0 ? errors : undefined
      }
    }
  )

  const topicForm = useFormValidation(
    { topic: '', description: '', qos: 0, retained: false },
    {
      topic: [
        validationRules.required('El topic es requerido'),
        validationRules.mqttTopic('Formato de topic MQTT inválido')
      ]
    }
  )

  // Load configurations from API on mount
  const loadConfigurations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/configurations`)
      if (response.ok) {
        const data = await response.json()
        setConfigurations(data.configurations)
      } else {
        console.error('Error loading configurations:', response.statusText)
      }
    } catch (error) {
      console.error('Error loading configurations:', error)
    }
  }

  // Fetch initial MQTT status on app load
  const fetchInitialMqttStatus = async () => {
    console.log('🚀 fetchInitialMqttStatus - Consultando estado inicial del broker MQTT...')
    console.log('🌐 URL:', `${API_URL}/api/mqtt/status`)
    try {
      const response = await fetch(`${API_URL}/api/mqtt/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      console.log('📥 fetchInitialMqttStatus - Respuesta recibida:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        type: response.type,
        url: response.url
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ fetchInitialMqttStatus - Estado recibido del servidor:', data)
        console.log('📊 fetchInitialMqttStatus - Detalles:', {
          connected: data.connected,
          broker: data.broker,
          clientId: data.clientId,
          topics: data.topics
        })
        
        setMqttStatus(prev => {
          const newStatus = {
            ...prev,
            connected: data.connected,
            broker: data.broker,
            clientId: data.clientId,
            lastChecked: new Date().toISOString()
          }
          console.log('📝 fetchInitialMqttStatus - Actualizando estado local de:', prev)
          console.log('📝 fetchInitialMqttStatus - A:', newStatus)
          return newStatus
        })
      } else {
        console.error('❌ fetchInitialMqttStatus - Error en respuesta:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('❌ fetchInitialMqttStatus - Respuesta del servidor:', errorText)
      }
    } catch (error) {
      console.error('❌ fetchInitialMqttStatus - Error capturado:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
      console.error('❌ fetchInitialMqttStatus - Tipo de error:', error.constructor.name)
      
      // Verificar si es un error de red
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 fetchInitialMqttStatus - Error de RED - El servidor puede no estar accesible')
        console.error('🌐 fetchInitialMqttStatus - Verifica que el servidor esté corriendo en:', API_URL)
      }
    }
  }
  // DEPRECATED: connectToDefaultBroker - Now handled in useEffect above
  // Keeping the function definition here for backwards compatibility if needed elsewhere

  useEffect(() => {
    const initApp = async () => {
      // Load configurations from API on mount
      try {
        const response = await fetch(`${API_URL}/api/configurations`)
        if (response.ok) {
          const data = await response.json()
          setConfigurations(data.configurations)
        } else {
          console.error('Error loading configurations:', response.statusText)
        }
      } catch (error) {
        console.error('Error loading configurations:', error)
      }

      // Fetch initial MQTT status
      console.log('🚀 fetchInitialMqttStatus - Consultando estado inicial del broker MQTT...')
      console.log('🌐 URL:', `${API_URL}/api/mqtt/status`)
      try {
        const response = await fetch(`${API_URL}/api/mqtt/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        if (response.ok) {
          const data = await response.json()
          console.log('📊 MQTT Status Response:', data)
          setMqttStatus(data)
        } else {
          console.error('Error fetching MQTT status:', response.statusText)
        }
      } catch (error) {
        console.error('Error fetching MQTT status:', error)
      }
    }
    initApp()
  }, [])

  // Monitor mqttStatus changes
  useEffect(() => {
    console.log('🔔 Estado MQTT actualizado:', mqttStatus)
  }, [mqttStatus])

  // Connect to default broker after configurations are loaded
  useEffect(() => {
    if (!configurations.mqtt.defaultBroker) return
    
    const connectBroker = async () => {
      // Find the default broker config
      const brokerConfig = configurations.mqtt.brokers?.find(
        b => b.name === configurations.mqtt.defaultBroker
      )

      if (brokerConfig) {
        try {
          const response = await fetch(`${API_URL}/api/mqtt/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(brokerConfig)
          })

          if (response.ok) {
            const data = await response.json()
            console.log('✅ Conectado al broker predeterminado:', configurations.mqtt.defaultBroker)
            setMqttStatus({
              connected: true,
              message: `Conectado a ${configurations.mqtt.defaultBroker}`,
              clientId: data.clientId || '',
              lastChecked: new Date().toISOString()
            })
          }
        } catch (err) {
          console.error('Error connecting to default broker:', err)
        }
      }
    }

    // Small delay to ensure configurations are fully loaded
    const timer = setTimeout(() => {
      connectBroker()
    }, 1000)

    return () => clearTimeout(timer)
  }, [configurations.mqtt.defaultBroker, configurations.mqtt.brokers])

  // Auto-polling for MQTT status
  useEffect(() => {
    if (!configurations.mqtt.autoPolling?.enabled) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/mqtt/status`)
        if (response.ok) {
          const data = await response.json()
          setMqttStatus(prev => ({
            ...prev,
            connected: data.connected,
            broker: data.broker,
            clientId: data.clientId,
            lastChecked: new Date().toISOString()
          }))
        }
      } catch (error) {
        console.error('Error polling MQTT status:', error)
      }
    }, configurations.mqtt.autoPolling.statusInterval || 30000)

    return () => clearInterval(interval)
  }, [configurations.mqtt.autoPolling?.enabled, configurations.mqtt.autoPolling?.statusInterval])

  // Fallback polling: Always check MQTT status every 10 seconds as a backup
  useEffect(() => {
    console.log('⏰ Polling de respaldo iniciado - Verificación cada 10 segundos')
    
    const fallbackInterval = setInterval(async () => {
      console.log('🔄 Polling de respaldo - Consultando estado MQTT...')
      try {
        const response = await fetch(`${API_URL}/api/mqtt/status`)
        if (response.ok) {
          const data = await response.json()
          console.log('✅ Polling de respaldo - Estado recibido:', data)
          setMqttStatus(prev => {
            const newStatus = {
              ...prev,
              connected: data.connected,
              broker: data.broker,
              clientId: data.clientId,
              lastChecked: new Date().toISOString()
            }
            console.log('📝 Polling de respaldo - Nuevo estado:', newStatus)
            return newStatus
          })
        } else {
          console.error('❌ Polling de respaldo - Error en respuesta:', response.status)
        }
      } catch (error) {
        console.error('❌ Polling de respaldo - Error:', error)
      }
    }, 10000) // Check every 10 seconds

    return () => {
      console.log('⏹️ Polling de respaldo detenido')
      clearInterval(fallbackInterval)
    }
  }, []) // Empty dependency array - runs always

  // Auto-polling for MQTT messages
  useEffect(() => {
    if (!configurations.mqtt.autoPolling?.enabled) return

    const interval = setInterval(async () => {
      try {
        await fetchMqttMessages()
      } catch (error) {
        console.error('Error polling MQTT messages:', error)
      }
    }, configurations.mqtt.autoPolling.messagesInterval || 10000)

    return () => clearInterval(interval)
  }, [configurations.mqtt.autoPolling?.enabled, configurations.mqtt.autoPolling?.messagesInterval])

  // Polling del estado de conexión MQTT cuando estamos en la tab de MQTT
  useEffect(() => {
    if (configTab !== 'mqtt') return

    const pollMQTTStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/mqtt/status`)
        if (response.ok) {
          const data = await response.json()
          setMqttStatus(prev => ({
            ...prev,
            connected: data.connected || false,
            broker: data.broker || 'Sin conectar',
            clientId: data.clientId || '',
            lastChecked: new Date().toISOString()
          }))
        }
      } catch (error) {
        console.error('Error polling MQTT status:', error)
      }
    }

    // Poll immediately and then every 5 seconds
    pollMQTTStatus()
    const interval = setInterval(pollMQTTStatus, 5000)

    return () => clearInterval(interval)
  }, [configTab])

  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    let interval;
    if (isRecording && !isPaused && recordingStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((new Date() - recordingStartTime) / 1000));
      }, 1000);
    } else {
      // No actualizar el temporizador cuando está pausado
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused, recordingStartTime]);

  const fetchSensors = async () => {
    setLoading(true)
    // setError(null)
    try {
      const response = await fetch(`${API_URL}/api/sensors`)
      if (!response.ok) {
        throw new Error('Failed to fetch sensors')
      }
      await response.json()
      // Sensors are now managed by SensorContext - no need to set them here
    } catch (error) {
      console.error('Error fetching sensors:', error)
      // setError('Failed to load sensors')
      toast.error('Error al cargar sensores', { duration: 3000 })
    } finally {
      setLoading(false)
    }
  }


  // Fetch MQTT topics
  const fetchTopics = async () => {
    try {
      const response = await fetch(`${API_URL}/api/topics`)
      if (response.ok) {
        const data = await response.json()
        setMqttTopics(data.topics || [])
      }
    } catch (error) {
      console.error('Error fetching topics:', error)
    }
  }

  // Update sensor
  const updateSensor = async (id, sensorData) => {
    try {
      const response = await fetch(`${API_URL}/api/sensors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sensorData)
      })

      if (response.ok) {
        await fetchSensors()
        toast.success('Sensor actualizado exitosamente')
        return true
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update sensor')
      }
    } catch (error) {
      console.error('Error updating sensor:', error)
      toast.error(`Error al actualizar sensor: ${error.message}`)
      return false
    }
  }

  // Delete sensor
  const deleteSensor = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/sensors/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchSensors()
        toast.success('Sensor eliminado exitosamente')
        return true
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete sensor')
      }
    } catch (error) {
      console.error('Error deleting sensor:', error)
      toast.error(`Error al eliminar sensor: ${error.message}`)
      return false
    }
  }



  // Subscribe to topic
  const subscribeToTopic = async (topicId) => {
    try {
      const response = await fetch(`${API_URL}/api/topics/${topicId}/subscribe`, {
        method: 'POST'
      })

      if (response.ok) {
        await fetchTopics()
        toast.success('Suscrito al topic exitosamente')
        return true
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to subscribe to topic')
      }
    } catch (error) {
      console.error('Error subscribing to topic:', error)
      toast.error(`Error al suscribirse: ${error.message}`)
      return false
    }
  }

  // Unsubscribe from topic
  const unsubscribeFromTopic = async (topicId) => {
    try {
      const response = await fetch(`${API_URL}/api/topics/${topicId}/unsubscribe`, {
        method: 'POST'
      })

      if (response.ok) {
        await fetchTopics()
        toast.success('Desuscrito del topic exitosamente')
        return true
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to unsubscribe from topic')
      }
    } catch (error) {
      console.error('Error unsubscribing from topic:', error)
      toast.error(`Error al desuscribirse: ${error.message}`)
      return false
    }
  }

  const addSensor = async () => {
    // Validate form before submission
    const isValid = sensorForm.validateForm()
    if (!isValid) {
      toast.error('Por favor corrige los errores del formulario', {
        duration: 4000
      })
      return
    }

    setLoading(true)
    // setError(null)

    // Prepare sensor data in the format expected by the backend
    let sensorData = { ...sensorForm.values }

    // Map the data based on sensor type
    let backendData = {
      name: sensorData.name,
      type: sensorData.type,
      topic: '', // Will be set based on type
      description: '',
      unit: '',
      min_value: null,
      max_value: null,
      active: true
    }

    // Set type-specific data
    if (sensorData.type === 'rtsp') {
      const { host, port, path, username, password } = sensorData.data
      let url = `rtsp://${host}:${port}${path}`
      
      // Add authentication if provided
      if (username && password) {
        url = `rtsp://${username}:${password}@${host}:${port}${path}`
      }
      
      backendData.topic = `rtsp/${sensorData.name.replace(/\s+/g, '_').toLowerCase()}`
      backendData.description = `Cámara RTSP: ${url}`
      backendData.unit = 'stream'
      backendData.data = {
        host,
        port,
        path,
        username,
        password,
        url
      }
    } else if (sensorData.type === 'emotibit') {
      backendData.topic = `emotibit/${sensorData.name.replace(/\s+/g, '_').toLowerCase()}`
      backendData.description = `EmotiBit Device: ${sensorData.data.deviceId}`
      backendData.unit = 'data'
      backendData.data = {
        deviceId: sensorData.data.deviceId,
        samplingRate: sensorData.data.samplingRate
      }
    } else if (sensorData.type === 'environmental') {
      backendData.topic = `environmental/${sensorData.name.replace(/\s+/g, '_').toLowerCase()}`
      backendData.description = `Sensor Ambiental: ${sensorData.data.location}`
      backendData.unit = sensorData.data.parameters || 'value'
      backendData.data = {
        location: sensorData.data.location,
        parameters: sensorData.data.parameters
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/sensors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to add sensor')
      }

      await response.json()
      
      // Store additional sensor data locally if needed
      // For now, we'll just use the backend response
      fetchSensors()
      sensorForm.resetForm()
      toast.success(`Sensor "${sensorData.name}" agregado exitosamente`, {
        duration: 3000,
        icon: '✅'
      })
    } catch (err) {
      toast.error('Error al agregar el sensor. Verifica la conexión con el servidor.', {
        duration: 5000
      })
      console.error('Error adding sensor:', err)
    } finally {
      setLoading(false)
    }
  }

  const startRecording = async () => {
    try {
      setIsRecording(true)
      setIsPaused(false)
      setPausedTime(0)
      setRecordingStartTime(new Date())
      toast.success('Grabación iniciada - Todos los sensores activos', {
        duration: 3000,
        icon: '🎥'
      })

      // Call API to start recording on server
      const response = await fetch(`${API_URL}/api/recording/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensors: sensors.map(s => s.id), // Send list of active sensor IDs
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start recording on server')
      }

      const data = await response.json()
      console.log('Server recording started:', data)
    } catch (error) {
      console.error('Error starting recording:', error)
      setIsRecording(false)
      setRecordingStartTime(null)
      setIsPaused(false)
      setPausedTime(0)
      toast.error('Error al iniciar la grabación. Verifica la conexión con el servidor.', {
        duration: 5000
      })
    }
  }

  const stopRecording = async () => {
    try {
      const duration = new Date() - recordingStartTime
      const durationText = `${Math.floor(duration / 60000)}:${Math.floor((duration % 60000) / 1000).toString().padStart(2, '0')}`
      toast.success(`Grabación detenida - Duración: ${durationText}`, {
        duration: 4000,
        icon: '⏹️'
      })

      // Call API to stop recording on server
      const response = await fetch(`${API_URL}/api/recording/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: Math.round(duration / 1000),
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to stop recording on server')
      }

      const data = await response.json()
      console.log('Server recording stopped:', data)

      setIsRecording(false)
      setRecordingStartTime(null)
      setIsPaused(false)
      setPausedTime(0)
      setElapsedTime(0) // Reset timer for next recording
    } catch (error) {
      console.error('Error stopping recording:', error)
      toast.error('Error al detener la grabación. Los datos pueden no haberse guardado correctamente.', {
        duration: 5000
      })
      // Still reset the local state even if server call fails
      setIsRecording(false)
      setRecordingStartTime(null)
      setIsPaused(false)
      setPausedTime(0)
      setElapsedTime(0) // Reset timer for next recording
    }
  }

  const pauseRecording = async () => {
    try {
      if (isPaused) {
        // Resume recording
        setIsPaused(false)
        setRecordingStartTime(new Date() - pausedTime)
        toast.success('Grabación reanudada', {
          duration: 3000,
          icon: '▶️'
        })
      } else {
        // Pause recording
        setIsPaused(true)
        setPausedTime(new Date() - recordingStartTime)
        toast.success('Grabación pausada', {
          duration: 3000,
          icon: '⏸️'
        })
      }
    } catch (error) {
      console.error('Error pausing/resuming recording:', error)
      toast.error('Error al pausar/reanudar la grabación', {
        duration: 5000
      })
    }
  }

  // MQTT Connection Functions
  const handleConnect = async () => {
    // Validate configuration before connecting
    const validation = validateMQTTConfig({
      host: configurations.mqtt.host,
      port: configurations.mqtt.port,
      username: configurations.mqtt.username,
      password: configurations.mqtt.password,
      ssl: configurations.mqtt.ssl
    })

    if (!validation.valid) {
      const errorMessage = Object.entries(validation.errors)
        .map(([field, error]) => `${field}: ${error}`)
        .join('\n')
      toast.error(`⚠️ Configuración inválida:\n${errorMessage}`, {
        duration: 5000,
        icon: '❌'
      })
      return
    }

    setMqttConnecting(true)
    const toastId = toast.loading('🔗 Conectando al broker MQTT...', { duration: 30000 })

    try {
      // Build MQTT broker URL
      const protocol = configurations.mqtt.ssl ? 'mqtts' : 'mqtt'
      const brokerUrl = `${protocol}://${configurations.mqtt.host}:${configurations.mqtt.port}`

      console.log(`Connecting to MQTT broker: ${brokerUrl}`)

      const requestBody = {
        broker: brokerUrl,
        username: configurations.mqtt.username || undefined,
        password: configurations.mqtt.password || undefined,
        ssl: configurations.mqtt.ssl
      }

      const response = await fetch(`${API_URL}/api/mqtt/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (response.ok) {
        setMqttStatus(prev => ({
          ...prev,
          connected: true,
          broker: brokerUrl,
          clientId: data.clientId || '',
          lastChecked: new Date().toISOString()
        }))
        toast.success(`✅ Conectado exitosamente a ${configurations.mqtt.host}:${configurations.mqtt.port}`, { 
          id: toastId,
          duration: 3000,
          icon: '🔗'
        })
      } else {
        throw new Error(data.message || 'Error al conectar')
      }
    } catch (error) {
      console.error('MQTT connection error:', error)
      setMqttStatus(prev => ({
        ...prev,
        connected: false,
        lastChecked: new Date().toISOString()
      }))
      toast.error(`❌ Error de conexión MQTT: ${error.message}`, { 
        id: toastId,
        duration: 5000,
        icon: '🚫'
      })
    } finally {
      setMqttConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setMqttConnecting(true)
    const toastId = toast.loading('🔌 Desconectando del broker...', { duration: 30000 })

    try {
      const response = await fetch(`${API_URL}/api/mqtt/disconnect`, {
        method: 'POST'
      })

      if (response.ok) {
        setMqttStatus(prev => ({
          ...prev,
          connected: false,
          lastChecked: new Date().toISOString()
        }))
        toast.success('✅ Desconectado del broker MQTT', { 
          id: toastId,
          duration: 3000,
          icon: '🔌'
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Error al desconectar')
      }
    } catch (error) {
      console.error('MQTT disconnect error:', error)
      setMqttStatus(prev => ({
        ...prev,
        connected: false,
        lastChecked: new Date().toISOString()
      }))
      toast.error(`Error al desconectar: ${error.message}`, { duration: 5000 })
    } finally {
      setMqttConnecting(false)
    }
  }

  const fetchMqttMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/mqtt/messages?limit=20`)
      if (response.ok) {
        const data = await response.json()
        setMqttMessages(data.messages)
      }
    } catch (error) {
      console.error('Error fetching MQTT messages:', error)
    }
  }

  const disconnectMqtt = async () => {
    setMqttLoading(true)
    const loadingToast = toast.loading('Desconectando del broker MQTT...', {
      duration: 5000
    })

    try {
      const response = await fetch(`${API_URL}/api/mqtt/disconnect`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.dismiss(loadingToast)
        toast.success('Desconectado exitosamente del broker MQTT', {
          duration: 3000,
          icon: '🔌'
        })
        // setError('')
      } else {
        const errorData = await response.json()
        toast.dismiss(loadingToast)
        toast.error(`Error al desconectar: ${errorData.error || 'Error desconocido'}`, {
          duration: 5000
        })
        // setError(errorData.error || 'Error disconnecting from MQTT')
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error('Error desconectando del broker MQTT', {
        duration: 5000
      })
      // setError('Error disconnecting from MQTT broker')
      console.error('MQTT disconnect error:', error)
    } finally {
      setMqttLoading(false)
    }
  }

  const addMqttTopic = async () => {
    // Validate form before submission
    const isValid = topicForm.validateForm()
    if (!isValid) {
      toast.error('Por favor corrige los errores del formulario', {
        duration: 4000
      })
      return
    }

    setMqttLoading(true)
    const loadingToast = toast.loading('Agregando topic MQTT...', {
      duration: 5000
    })

    try {
      const response = await fetch(`${API_URL}/api/mqtt/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicForm.values)
      })

      if (response.ok) {
        await fetchTopics()
        topicForm.resetForm()
        toast.dismiss(loadingToast)
        toast.success(`Topic "${topicForm.values.topic}" agregado exitosamente`, {
          duration: 3000,
          icon: '📡'
        })
        // setError('')
      } else {
        const errorData = await response.json()
        toast.dismiss(loadingToast)
        toast.error(`Error al agregar topic: ${errorData.error || 'Error desconocido'}`, {
          duration: 5000
        })
        // setError(errorData.error || 'Error adding topic')
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error('Error agregando topic MQTT', {
        duration: 5000
      })
      // setError('Error adding MQTT topic')
      console.error('Add topic error:', error)
    } finally {
      setMqttLoading(false)
    }
  }

  // Configuration management functions
  const updateConfiguration = (section, key, value) => {
    setConfigurations(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
  }

  // Validar y actualizar configuración MQTT con validación robusta
  const updateMQTTConfiguration = (field, value) => {
    // Get the current MQTT config with the new value
    const updatedMqtt = {
      ...configurations.mqtt,
      [field]: value
    }

    // Only validate critical fields
    if (['host', 'port', 'username', 'password'].includes(field)) {
      const validation = validateMQTTConfig(updatedMqtt)

      if (!validation.valid) {
        const errorMessage = Object.entries(validation.errors)
          .map(([fieldName, error]) => `${fieldName}: ${error}`)
          .join('\n')
        
        toast.error(`⚠️ Validación MQTT fallida:\n${errorMessage}`, {
          duration: 5000,
          icon: '❌'
        })
        return false
      }
    }

    // Show confirmation if changing critical fields and connection exists
    if ((field === 'host' || field === 'port') && mqttStatus.connected) {
      const confirmed = window.confirm(
        `⚠️ Atención!\n\nEstá cambiando ${field === 'host' ? 'el host' : 'el puerto'} del broker.\n\n¿Está seguro? Esto puede desconectar la sesión actual.`
      )
      if (!confirmed) return false
    }

    // If validation passes (or not needed), update the configuration
    updateConfiguration('mqtt', field, value)
    
    // Show success feedback for critical field changes
    if (['host', 'port'].includes(field)) {
      const fieldLabel = field === 'host' ? 'Host del broker' : 'Puerto MQTT'
      toast.success(`✅ ${fieldLabel} actualizado`, {
        duration: 2000,
        icon: '🔧'
      })
    }

    return true
  }

  // Aplicar configuración predefinida de broker MQTT con validación
  const applyMQTTPreset = (preset) => {
    // Validate the preset configuration
    const validation = validateMQTTConfig({
      host: preset.host,
      port: preset.port,
      username: preset.username || '',
      password: preset.password || '',
      ssl: preset.ssl || false
    })

    if (!validation.valid) {
      const errorMessage = Object.entries(validation.errors)
        .map(([field, error]) => `${field}: ${error}`)
        .join('\n')
      toast.error(`⚠️ Validación de preset fallida:\n${errorMessage}`, {
        duration: 5000,
        icon: '❌'
      })
      return false
    }

    // Show confirmation if already connected (to avoid accidental disconnection)
    if (mqttStatus.connected && mqttStatus.broker !== `mqtt://${preset.host}:${preset.port}`) {
      const currentBroker = mqttStatus.broker || configurations.mqtt.defaultBroker
      const confirmed = window.confirm(
        `⚠️ Atención!\n\nEstá conectado a:\n${currentBroker}\n\n¿Desconectar y cambiar a:\n${preset.name} (${preset.host}:${preset.port})?`
      )
      if (!confirmed) return false
    }

    // Apply the preset configuration
    updateConfiguration('mqtt', 'host', preset.host)
    updateConfiguration('mqtt', 'port', preset.port)
    updateConfiguration('mqtt', 'username', preset.username)
    updateConfiguration('mqtt', 'password', preset.password)
    updateConfiguration('mqtt', 'ssl', preset.ssl)
    updateConfiguration('mqtt', 'defaultBroker', `${preset.name} (${preset.host}:${preset.port})`)

    toast.success(`✅ Configuración "${preset.name}" aplicada`, { 
      duration: 3000,
      icon: '⚙️'
    })
    return true
  }

  const saveAllConfigurations = useCallback(async () => {
    const toastId = toast.loading('💾 Guardando configuración...', { duration: 30000 })
    
    try {
      // Guardar en servidor
      const response = await fetch(`${API_URL}/api/configurations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configurations })
      })

      if (response.ok) {
        toast.success('✅ Configuración guardada exitosamente', { 
          id: toastId,
          duration: 3000,
          icon: '💾'
        })
      } else {
        throw new Error('Failed to save configurations')
      }
    } catch (error) {
      console.error('Error saving configurations:', error)
      toast.error('❌ Error al guardar configuración', { 
        id: toastId,
        duration: 5000,
        icon: '⚠️'
      })
    }
  }, [configurations])

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    updateConfiguration('general', 'theme', newTheme)
  }

  const handleRecordingAutoStartChange = (value) => {
    setRecordingAutoStart(value)
    updateConfiguration('general', 'recordingAutoStart', value)
  }

  // Camera IP management functions - DEPRECATED
  // Use RTSPManager component instead for camera management via SensorContext

  const renderDataFields = (sensorType, form) => {
    switch (sensorType) {
      case 'rtsp':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Dirección IP o Host</label>
              <input
                type="text"
                placeholder="192.168.1.100"
                value={form.values.data.host || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, host: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.host ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.host && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.host}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Puerto RTSP</label>
              <input
                type="number"
                placeholder="554"
                value={form.values.data.port || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, port: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.port ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.port && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.port}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Path del Stream</label>
              <input
                type="text"
                placeholder="/stream"
                value={form.values.data.path || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, path: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.path ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.path && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.path}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Usuario (opcional)</label>
                <input
                  type="text"
                  placeholder="admin"
                  value={form.values.data.username || ''}
                  onChange={(e) => form.handleChange('data', {...form.values.data, username: e.target.value})}
                  onBlur={() => form.handleBlur('data')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    form.errors.data?.username ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {form.errors.data?.username && form.touched.data && (
                  <p className="text-red-500 text-sm mt-1">{form.errors.data.username}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Contraseña (opcional)</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.values.data.password || ''}
                  onChange={(e) => form.handleChange('data', {...form.values.data, password: e.target.value})}
                  onBlur={() => form.handleBlur('data')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    form.errors.data?.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {form.errors.data?.password && form.touched.data && (
                  <p className="text-red-500 text-sm mt-1">{form.errors.data.password}</p>
                )}
              </div>
            </div>
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <strong>URL RTSP generada:</strong>
                <div className="mt-1 font-mono text-xs bg-white dark:bg-gray-800 p-2 rounded border">
                  rtsp://{form.values.data.username && form.values.data.password ? `${form.values.data.username}:${form.values.data.password}@` : ''}{form.values.data.host || 'host'}:{form.values.data.port || '554'}{form.values.data.path || '/stream'}
                </div>
              </div>
            </div>
          </div>
        )
      case 'emotibit':
        return (
          <div className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="Device ID"
                value={form.values.data.deviceId || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, deviceId: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.deviceId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.deviceId && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.deviceId}</p>
              )}
            </div>
            <div>
              <input
                type="text"
                placeholder="Sampling Rate"
                value={form.values.data.samplingRate || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, samplingRate: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.samplingRate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.samplingRate && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.samplingRate}</p>
              )}
            </div>
          </div>
        )
      case 'environmental':
        return (
          <div className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="Location"
                value={form.values.data.location || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, location: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.location ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.location && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.location}</p>
              )}
            </div>
            <div>
              <input
                type="text"
                placeholder="Parameters (e.g., temperature, humidity)"
                value={form.values.data.parameters || ''}
                onChange={(e) => form.handleChange('data', {...form.values.data, parameters: e.target.value})}
                onBlur={() => form.handleBlur('data')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  form.errors.data?.parameters ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {form.errors.data?.parameters && form.touched.data && (
                <p className="text-red-500 text-sm mt-1">{form.errors.data.parameters}</p>
              )}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const renderSection = () => {
    switch (currentSection) {
      case 'Dashboard':
        return (
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h2>
              <p className="text-gray-600 dark:text-gray-300">Vista general del sistema Galgo-School</p>
            </div>
            
            {/* Estado de Conexión MQTT */}
            <div className="mb-8">
              <MqttConnectionStatus 
                mqttStatus={mqttStatus} 
                mqttConnecting={mqttConnecting}
              />
            </div>
            
            {/* Grid de métricas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-xl shadow-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-1">Total Sensores</h3>
                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{sensors.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-xl shadow-lg border border-green-200 dark:border-green-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-1">Cámaras RTSP</h3>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-300">{sensors.filter(s => s.type === 'rtsp').length}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-xl shadow-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-1">Sensores Ambientales</h3>
                    <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{sensors.filter(s => s.type === 'environmental').length}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 002 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-xl shadow-lg border border-orange-200 dark:border-orange-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-1">EmotiBit</h3>
                    <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{sensors.filter(s => s.type === 'emotibit').length}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Control de Grabación Rediseñado */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900/50 dark:via-blue-900/30 dark:to-indigo-900/30 p-8 rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 mb-8">
              {/* Patrón de fondo animado */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-pink-400/20 animate-pulse"></div>
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]"></div>
                <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.1),transparent_50%)]"></div>
              </div>
              
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Control de Grabación
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Inicia una grabación sincronizada de todos los sensores conectados
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Sensores listos</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{sensors.length}</div>
                    </div>
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="mb-6 md:mb-0 md:mr-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm p-4 rounded-xl border border-white/20 dark:border-gray-700/50">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full ${
                            isRecording && !isPaused ? 'bg-green-500 animate-pulse' : 
                            isPaused ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Ambientales</div>
                            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{sensors.filter(s => s.type === 'environmental').length}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm p-4 rounded-xl border border-white/20 dark:border-gray-700/50">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full ${
                            isRecording && !isPaused ? 'bg-green-500 animate-pulse' : 
                            isPaused ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Cámaras RTSP</div>
                            <div className="text-xl font-bold text-green-600 dark:text-green-400">{sensors.filter(s => s.type === 'rtsp').length}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm p-4 rounded-xl border border-white/20 dark:border-gray-700/50">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full ${
                            isRecording && !isPaused ? 'bg-green-500 animate-pulse' : 
                            isPaused ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">EmotiBit</div>
                            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{sensors.filter(s => s.type === 'emotibit').length}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Todos los datos se guardarán en la ubicación configurada en Ajustes
                    </p>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <div className="relative flex flex-col items-center space-y-4">
                      {/* Indicador de estado de grabación */}
                      {(isRecording || isPaused) && (
                        <div className="flex items-center space-x-3 px-4 py-2 rounded-full text-base font-medium animate-pulse shadow-lg bg-gradient-to-r from-gray-800 to-gray-900 text-white border border-gray-700">
                          <div className={`w-3 h-3 rounded-full ${
                            isPaused ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 animate-ping'
                          }`}></div>
                          <span>{isPaused ? 'Pausado' : 'Grabando...'}</span>
                          <span className="font-mono text-lg ml-2">{elapsedTime}</span>
                        </div>
                      )}

                      {/* Contenedor de botones */}
                      <div className="flex items-center space-x-6">
                        {/* Botón principal: Iniciar/Detener */}
                        <button
                          onClick={() => {
                            if (!isRecording && !isPaused) {
                              startRecording();
                            } else {
                              stopRecording();
                            }
                          }}
                          className={`group relative flex items-center justify-center px-10 py-5 rounded-full font-bold text-lg shadow-2xl transition-all duration-500 transform hover:scale-105 active:scale-95 ${
                            !isRecording && !isPaused
                              ? 'bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600 hover:from-emerald-600 hover:via-green-700 hover:to-teal-700 text-white shadow-emerald-500/50'
                              : 'bg-gradient-to-r from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white shadow-red-500/50'
                          }`}
                        >
                          {/* Efectos de fondo animados */}
                          <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
                            !isRecording && !isPaused ? 'bg-emerald-400' : 'bg-red-400'
                          }`}></div>
                          <div className={`absolute inset-1 rounded-3xl animate-pulse opacity-30 ${
                            !isRecording && !isPaused ? 'bg-emerald-300' : 'bg-red-300'
                          }`}></div>

                          {/* Contenido del botón */}
                          <div className="relative flex items-center space-x-2">
                            {!isRecording && !isPaused ? (
                              <>
                                <svg className="w-6 h-6 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                                </svg>
                                <span className="font-medium">Iniciar</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-6 h-6 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <rect x="6" y="6" width="12" height="12" strokeWidth="2" className="fill-current" />
                                </svg>
                                <span className="font-medium">Detener</span>
                              </>
                            )}
                          </div>

                          {/* Efecto de brillo */}
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 group-hover:animate-pulse"></div>
                        </button>

                        {/* Botón de pausa: aparece solo cuando está grabando */}
                        {isRecording && !isPaused && (
                          <button
                            onClick={pauseRecording}
                            className="group relative flex items-center justify-center px-8 py-4 rounded-full font-bold text-sm shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 bg-gradient-to-r from-yellow-500 via-orange-600 to-red-600 hover:from-yellow-600 hover:via-orange-700 hover:to-red-700 text-white shadow-yellow-500/50 animate-pulse"
                          >
                            {/* Efectos de fondo animados */}
                            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-yellow-400"></div>
                            <div className="absolute inset-0.5 rounded-3xl animate-pulse opacity-30 bg-yellow-300"></div>

                            {/* Contenido del botón */}
                            <div className="relative flex items-center space-x-2">
                              <svg className="w-4 h-4 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                                <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                              </svg>
                              <span className="font-medium">Pausar</span>
                            </div>

                            {/* Efecto de brillo */}
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 group-hover:animate-pulse"></div>
                          </button>
                        )}

                        {/* Botón de reanudar: aparece solo cuando está pausado */}
                        {isPaused && (
                          <button
                            onClick={pauseRecording}
                            className="group relative flex items-center justify-center px-8 py-4 rounded-full font-bold text-sm shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 bg-gradient-to-r from-blue-500 via-cyan-600 to-teal-600 hover:from-blue-600 hover:via-cyan-700 hover:to-teal-700 text-white shadow-blue-500/50 animate-pulse"
                          >
                            {/* Efectos de fondo animados */}
                            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-blue-400"></div>
                            <div className="absolute inset-0.5 rounded-3xl animate-pulse opacity-30 bg-blue-300"></div>

                            {/* Contenido del botón */}
                            <div className="relative flex items-center space-x-2">
                              <svg className="w-4 h-4 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <polygon points="5,3 19,12 5,21" fill="currentColor" />
                              </svg>
                              <span className="font-medium">Reanudar</span>
                            </div>

                            {/* Efecto de brillo */}
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 group-hover:animate-pulse"></div>
                          </button>
                        )}
                      </div>                      {/* Información adicional */}
                      <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {!isRecording && !isPaused ? 'Listo para iniciar grabación' : 
                           isRecording && !isPaused ? 'Grabación en progreso - puedes pausar o detener' : 
                           'Grabación pausada - reanuda o detén'}
                        </p>
                        {!isRecording && !isPaused && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Presiona "Iniciar" para comenzar
                          </p>
                        )}
                        {isRecording && !isPaused && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Usa los botones para pausar o detener
                          </p>
                        )}
                        {isPaused && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Presiona "Reanudar" para continuar o "Detener" para finalizar
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Características destacadas */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-white/30 dark:border-gray-700/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Grabación Sincronizada</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Todos los sensores al mismo tiempo</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-white/30 dark:border-gray-700/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Almacenamiento Seguro</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Datos protegidos y organizados</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-white/30 dark:border-gray-700/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Análisis en Tiempo Real</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Monitoreo continuo de sensores</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Actividad Reciente */}
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Actividad Reciente
              </h3>
              
              <div className="space-y-3">
                {/* Últimos mensajes MQTT */}
                {mqttMessages.slice(0, 3).map(message => (
                  <div key={`mqtt-${message.timestamp}`} className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Mensaje MQTT en {message.topic}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(message.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                      MQTT
                    </div>
                  </div>
                ))}
                
                {/* Eventos de sensores simulados */}
                <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Sensor Ambiental A1 reportando datos
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Hace 2 minutos
                    </div>
                  </div>
                  <div className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                    Sensor
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      EmotiBit P001 conectado exitosamente
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Hace 5 minutos
                    </div>
                  </div>
                  <div className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                    EmotiBit
                  </div>
                </div>
                
                {mqttMessages.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-gray-500 dark:text-gray-400">No hay actividad reciente</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      case 'Sensores':
        return (
          <div className="p-8">
            <SensorManagement
              sensors={sensors}
              mqttTopics={mqttTopics}
              onSensorUpdate={fetchSensors}
              onTopicUpdate={fetchTopics}
            />
          </div>
        )
      case 'Configuración':
        return (
          <div className="p-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Configuración del Sistema</h2>
            
            {/* Tabs Navigation */}
            <div className="mb-6">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'general', label: 'General', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                    { id: 'sensors', label: 'Sensores', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                    { id: 'cameras', label: 'Cámaras', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                    { id: 'rtsp', label: 'RTSP', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                    { id: 'camera-streaming', label: 'Cámaras Streaming', icon: 'M14.828 14.828a4 4 0 01-5.656 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
                    { id: 'recordings', label: 'Grabaciones', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                    { id: 'mqtt', label: 'MQTT', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setConfigTab(tab.id)}
                      className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                        configTab === tab.id
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                        </svg>
                        <span>{tab.label}</span>
                      </div>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px]">
              {configTab === 'general' && (
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Configuración General
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Modo Oscuro</span>
                      <button
                        onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          theme === 'dark' ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Inicio Automático de Grabación</span>
                      <button
                        onClick={() => handleRecordingAutoStartChange(!recordingAutoStart)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          recordingAutoStart ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            recordingAutoStart ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Idioma</label>
                      <select
                        value={configurations.general.language}
                        onChange={(e) => updateConfiguration('general', 'language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="es">Español</option>
                        <option value="en">Inglés</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Zona Horaria</label>
                      <select
                        value={configurations.general.timezone}
                        onChange={(e) => updateConfiguration('general', 'timezone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="America/Mexico_City">America/Mexico_City</option>
                        <option value="Europe/Madrid">Europe/Madrid</option>
                        <option value="America/New_York">America/New_York</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                    <button
                      onClick={() => saveAllConfigurations()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Guardar Configuración General
                    </button>
                  </div>
                </div>
              )}

              {configTab === 'sensors' && (
                <div className="p-8">
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Gestión de Sensores y Topics MQTT</h2>
                    <p className="text-gray-600 dark:text-gray-300">Administra sensores conectados y topics de mensajería</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Gestión de Sensores */}
                    <div className="space-y-6">
                      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Sensores Registrados ({sensors.length})
                        </h3>

                        {loading ? (
                          <div className="flex items-center justify-center py-8">
                            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="ml-2 text-gray-600 dark:text-gray-400">Cargando sensores...</span>
                          </div>
                        ) : sensors.length === 0 ? (
                          <div className="text-center py-8">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay sensores registrados</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Comienza agregando tu primer sensor</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {sensors.map(sensor => (
                              <div key={sensor.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                      sensor.type === 'rtsp' ? 'bg-green-500' :
                                      sensor.type === 'environmental' ? 'bg-blue-500' :
                                      sensor.type === 'emotibit' ? 'bg-purple-500' : 'bg-gray-500'
                                    }`}></div>
                                    <div>
                                      <h4 className="font-medium text-gray-900 dark:text-white">{sensor.name}</h4>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{sensor.type}</p>
                                    </div>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                    {sensor.type === 'rtsp' && sensor.data?.url && (
                                      <span>RTSP: {sensor.data.url}</span>
                                    )}
                                    {sensor.type === 'environmental' && sensor.data?.location && (
                                      <span>Ubicación: {sensor.data.location}</span>
                                    )}
                                    {sensor.type === 'emotibit' && sensor.data?.deviceId && (
                                      <span>Device ID: {sensor.data.deviceId}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => {
                                      const newName = prompt('Nuevo nombre:', sensor.name)
                                      if (newName && newName.trim() && newName !== sensor.name) {
                                        updateSensor(sensor.id, { ...sensor, name: newName.trim() })
                                      }
                                    }}
                                    className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
                                    title="Editar nombre"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`¿Estás seguro de que quieres eliminar el sensor "${sensor.name}"?`)) {
                                        deleteSensor(sensor.id)
                                      }
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                                    title="Eliminar sensor"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Agregar Nuevo Sensor */}
                      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Agregar Nuevo Sensor
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tipo de Sensor</label>
                            <select
                              value={sensorForm.values.type}
                              onChange={(e) => sensorForm.handleChange('type', e.target.value)}
                              onBlur={() => sensorForm.handleBlur('type')}
                              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                                sensorForm.errors.type ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                              disabled={loading}
                            >
                              <option value="">Seleccionar Tipo de Sensor</option>
                              <option value="environmental">Ambiental</option>
                              <option value="emotibit">EmotiBit</option>
                              <option value="rtsp">Cámara RTSP</option>
                            </select>
                            {sensorForm.errors.type && sensorForm.touched.type && (
                              <p className="text-red-500 text-sm mt-1">{sensorForm.errors.type}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre del Sensor</label>
                            <input
                              type="text"
                              placeholder="Ej: Sensor Temperatura Principal"
                              value={sensorForm.values.name}
                              onChange={(e) => sensorForm.handleChange('name', e.target.value)}
                              onBlur={() => sensorForm.handleBlur('name')}
                              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                                sensorForm.errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                              disabled={loading}
                            />
                            {sensorForm.errors.name && sensorForm.touched.name && (
                              <p className="text-red-500 text-sm mt-1">{sensorForm.errors.name}</p>
                            )}
                          </div>

                          {renderDataFields(sensorForm.values.type, sensorForm)}

                          <button
                            onClick={addSensor}
                            disabled={loading || !sensorForm.isValid}
                            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            {loading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Agregando...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Agregar Sensor
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Gestión de Topics MQTT */}
                    <div className="space-y-6">
                      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h3a1 1 0 011 1v2h4a1 1 0 011 1v5a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1h4zM7 10v6a1 1 0 001 1h8a1 1 0 001-1v-6M7 10H4a1 1 0 00-1 1v8a1 1 0 001 1h3m0-10h10m0 0V8a1 1 0 00-1-1H7a1 1 0 00-1 1v2z" />
                          </svg>
                          Topics MQTT ({mqttTopics.length})
                        </h3>

                        {mqttTopics.length === 0 ? (
                          <div className="text-center py-8">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h3a1 1 0 011 1v2h4a1 1 0 011 1v5a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1h4zM7 10v6a1 1 0 001 1h8a1 1 0 001-1v-6M7 10H4a1 1 0 00-1 1v8a1 1 0 001 1h3m0-10h10m0 0V8a1 1 0 00-1-1H7a1 1 0 00-1 1v2z" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay topics configurados</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Agrega topics para recibir mensajes MQTT</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {mqttTopics.map(topic => (
                              <div key={topic.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-3 h-3 rounded-full ${topic.active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                    <div>
                                      <h4 className="font-medium text-gray-900 dark:text-white">{topic.topic}</h4>
                                      {topic.description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{topic.description}</p>
                                      )}
                                      <div className="text-xs text-gray-400 dark:text-gray-500">
                                        QoS: {topic.qos} | Retained: {topic.retained ? 'Sí' : 'No'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => {
                                      if (topic.active) {
                                        unsubscribeFromTopic(topic.id)
                                      } else {
                                        subscribeToTopic(topic.id)
                                      }
                                    }}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                      topic.active
                                        ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800'
                                        : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800'
                                    }`}
                                  >
                                    {topic.active ? 'Desuscribir' : 'Suscribir'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`¿Estás seguro de que quieres eliminar el topic "${topic.topic}"?`)) {
                                        // Implementar deleteTopic si es necesario
                                        toast.error('Función de eliminación no implementada aún')
                                      }
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                                    title="Eliminar topic"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Agregar Nuevo Topic */}
                      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Agregar Nuevo Topic
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Topic MQTT</label>
                            <input
                              type="text"
                              placeholder="Ej: sensors/temperature/room1"
                              value={topicForm.values.topic}
                              onChange={(e) => topicForm.handleChange('topic', e.target.value)}
                              onBlur={() => topicForm.handleBlur('topic')}
                              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                                topicForm.errors.topic ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                              disabled={mqttLoading}
                            />
                            {topicForm.errors.topic && topicForm.touched.topic && (
                              <p className="text-red-500 text-sm mt-1">{topicForm.errors.topic}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción (opcional)</label>
                            <input
                              type="text"
                              placeholder="Descripción del topic"
                              value={topicForm.values.description}
                              onChange={(e) => topicForm.handleChange('description', e.target.value)}
                              onBlur={() => topicForm.handleBlur('description')}
                              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                                topicForm.errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                              disabled={mqttLoading}
                            />
                            {topicForm.errors.description && topicForm.touched.description && (
                              <p className="text-red-500 text-sm mt-1">{topicForm.errors.description}</p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">QoS</label>
                              <select
                                value={topicForm.values.qos}
                                onChange={(e) => topicForm.handleChange('qos', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                disabled={mqttLoading}
                              >
                                <option value={0}>0 - Al menos una vez</option>
                                <option value={1}>1 - Al menos una vez</option>
                                <option value={2}>2 - Exactamente una vez</option>
                              </select>
                            </div>
                            <div className="flex items-center">
                              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={topicForm.values.retained}
                                  onChange={(e) => topicForm.handleChange('retained', e.target.checked)}
                                  className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                  disabled={mqttLoading}
                                />
                                <span>Retained</span>
                              </label>
                            </div>
                          </div>

                          <button
                            onClick={addMqttTopic}
                            disabled={mqttLoading || !topicForm.isValid}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            {mqttLoading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Agregando...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Agregar Topic
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {configTab === 'cameras' && (
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    Configuración de Cámaras RTSP
                  </h3>
                  
                  {/* Nota: El formulario antiguo ha sido deprecado en favor de RTSPManager */}
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-blue-800 dark:text-blue-200 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zM8 7a1 1 0 000 2h6a1 1 0 000-2H8zm0 4a1 1 0 000 2h6a1 1 0 000-2H8z" clipRule="evenodd" />
                      </svg>
                      <strong>ℹ️ Gestión de cámaras:</strong> Dirígete al tab <strong>"Cámaras"</strong> en la barra de navegación para acceder a <strong>RTSPManager</strong> y agregar, eliminar o actualizar cámaras RTSP.
                    </p>
                  </div>

                  {/* Lista de IPs guardadas - DEPRECADA */}
                  {/* La gestión de cámaras ahora se realiza a través de RTSPManager y SensorContext */}

                  {/* Configuración global */}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Configuración Global</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Puerto RTSP Predeterminado</label>
                        <input
                          type="number"
                          value={configurations.cameras.defaultRtspPort}
                          onChange={(e) => updateConfiguration('cameras', 'defaultRtspPort', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Path RTSP Predeterminado</label>
                        <input
                          type="text"
                          value={configurations.cameras.defaultRtspPath}
                          onChange={(e) => updateConfiguration('cameras', 'defaultRtspPath', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tiempo de Espera de Conexión (segundos)</label>
                        <input
                          type="number"
                          value={configurations.cameras.connectionTimeout}
                          onChange={(e) => updateConfiguration('cameras', 'connectionTimeout', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Calidad de Video Predeterminada</label>
                        <select
                          value={configurations.cameras.defaultQuality}
                          onChange={(e) => updateConfiguration('cameras', 'defaultQuality', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option>1080p (Alta)</option>
                          <option>720p (Media)</option>
                          <option>480p (Baja)</option>
                          <option>360p (Muy Baja)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Frame Rate Predeterminado</label>
                        <select
                          value={configurations.cameras.defaultFrameRate}
                          onChange={(e) => updateConfiguration('cameras', 'defaultFrameRate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option>30 FPS</option>
                          <option>25 FPS</option>
                          <option>15 FPS</option>
                          <option>10 FPS</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Reintento Automático de Conexión</span>
                        <button
                          onClick={() => updateConfiguration('cameras', 'autoReconnect', !configurations.cameras.autoReconnect)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                            configurations.cameras.autoReconnect ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              configurations.cameras.autoReconnect ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Buffer de Video</span>
                        <button
                          onClick={() => updateConfiguration('cameras', 'videoBuffer', !configurations.cameras.videoBuffer)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                            configurations.cameras.videoBuffer ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              configurations.cameras.videoBuffer ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tamaño de Buffer (segundos)</label>
                        <input
                          type="number"
                          value={configurations.cameras.bufferSize}
                          onChange={(e) => updateConfiguration('cameras', 'bufferSize', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <button
                        onClick={() => saveAllConfigurations()}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Guardar Configuración de Cámaras
                      </button>
                    </div>
                  </div>
                </div>
              )}



              {configTab === 'recordings' && (
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Configuración de Grabaciones
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Directorio de Grabaciones</label>
                      <input
                        type="text"
                        value={configurations.recordings.directory}
                        onChange={(e) => updateConfiguration('recordings', 'directory', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Formato de Video</label>
                      <select
                        value={configurations.recordings.format}
                        onChange={(e) => updateConfiguration('recordings', 'format', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option>MP4 (H.264)</option>
                        <option>AVI</option>
                        <option>MKV</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Duración Máxima (minutos)</label>
                      <input
                        type="number"
                        value={configurations.recordings.maxDuration}
                        onChange={(e) => updateConfiguration('recordings', 'maxDuration', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Calidad de Compresión</label>
                      <select
                        value={configurations.recordings.quality}
                        onChange={(e) => updateConfiguration('recordings', 'quality', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option>Alta (1080p)</option>
                        <option>Media (720p)</option>
                        <option>Baja (480p)</option>
                      </select>
                    </div>
                    <button
                      onClick={() => saveAllConfigurations()}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Guardar Configuración de Grabaciones
                    </button>
                  </div>
                </div>
              )}

              {configTab === 'mqtt' && (
                <div className="space-y-6">
                  {/* Estado de Conexión MQTT */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Estado de Conexión MQTT
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Estado de Conexión */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full ${
                            mqttStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <div className="text-lg font-medium text-gray-900 dark:text-white">
                              {mqttStatus.connected ? 'Conectado' : 'Desconectado'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {mqttStatus.broker || 'Sin broker configurado'}
                            </div>
                          </div>
                        </div>

                        {mqttStatus.clientId && (
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            <strong>Client ID:</strong> {mqttStatus.clientId}
                          </div>
                        )}

                        {mqttStatus.lastChecked && (
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            <strong>Última verificación:</strong> {new Date(mqttStatus.lastChecked).toLocaleString()}
                          </div>
                        )}

                        <div className="flex space-x-3">
                          <button
                            onClick={async () => {
                              if (mqttStatus.connected) {
                                await disconnectMqtt()
                              } else {
                                // Implementar conexión MQTT
                                setMqttLoading(true)
                                try {
                                  const response = await fetch(`${API_URL}/api/mqtt/connect`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      host: configurations.mqtt.host,
                                      port: configurations.mqtt.port,
                                      username: configurations.mqtt.username,
                                      password: configurations.mqtt.password,
                                      ssl: configurations.mqtt.ssl
                                    })
                                  })

                                  if (response.ok) {
                                    toast.success('Conectado al broker MQTT exitosamente', {
                                      duration: 3000,
                                      icon: '🔗'
                                    })
                                    // Actualizar estado
                                    setMqttStatus(prev => ({ ...prev, connected: true, broker: `${configurations.mqtt.host}:${configurations.mqtt.port}` }))
                                  } else {
                                    const errorData = await response.json()
                                    toast.error(`Error al conectar: ${errorData.error || 'Error desconocido'}`, {
                                      duration: 5000
                                    })
                                  }
                                } catch (error) {
                                  toast.error('Error conectando al broker MQTT', {
                                    duration: 5000
                                  })
                                  console.error('MQTT connect error:', error)
                                } finally {
                                  setMqttLoading(false)
                                }
                              }
                            }}
                            disabled={mqttLoading}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                              mqttStatus.connected
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {mqttLoading ? (
                              <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>{mqttStatus.connected ? 'Desconectando...' : 'Conectando...'}</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mqttStatus.connected ? 'M6 18L18 6M6 6l12 12' : 'M5 12h14'} />
                                </svg>
                                <span>{mqttStatus.connected ? 'Desconectar' : 'Conectar'}</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={async () => {
                              // Verificar estado de conexión
                              try {
                                const response = await fetch(`${API_URL}/api/mqtt/status`)
                                if (response.ok) {
                                  const data = await response.json()
                                  setMqttStatus(prev => ({
                                    ...prev,
                                    connected: data.connected,
                                    broker: data.broker,
                                    clientId: data.clientId,
                                    lastChecked: new Date().toISOString()
                                  }))
                                  toast.success('Estado verificado', { duration: 2000 })
                                }
                              } catch {
                                toast.error('Error verificando estado', { duration: 3000 })
                              }
                            }}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Verificar</span>
                          </button>
                        </div>
                      </div>

                      {/* Estadísticas Rápidas */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-white">Estadísticas</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{mqttTopics.filter(t => t.active).length}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">Topics Activos</div>
                          </div>
                          <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{mqttMessages.length}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">Mensajes Recientes</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Configuración del Broker MQTT */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Configuración del Broker MQTT
                    </h3>

                    {/* Configuraciones Predefinidas */}
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                        <span>Configuraciones Predefinidas</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Broker por defecto: <span className="font-medium text-blue-600 dark:text-blue-400">{configurations.mqtt.defaultBroker}</span>
                        </span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          {
                            name: 'EMQX Remoto',
                            host: '100.107.238.60',
                            port: 1883,
                            username: 'admin',
                            password: 'galgo2526',
                            ssl: false,
                            description: 'Broker EMQX remoto'
                          },
                          {
                            name: 'EMQX Test',
                            host: '100.82.84.24',
                            port: 1883,
                            username: 'admin',
                            password: 'galgo2526',
                            ssl: false,
                            description: 'Broker EMQX de pruebas'
                          },
                          {
                            name: 'Mosquitto Local',
                            host: 'localhost',
                            port: 1883,
                            username: '',
                            password: '',
                            ssl: false,
                            description: 'Mosquitto en localhost'
                          },
                          {
                            name: 'HiveMQ Cloud',
                            host: 'broker.hivemq.com',
                            port: 1883,
                            username: '',
                            password: '',
                            ssl: false,
                            description: 'Broker público HiveMQ'
                          },
                          {
                            name: 'Eclipse Mosquitto',
                            host: 'test.mosquitto.org',
                            port: 1883,
                            username: '',
                            password: '',
                            ssl: false,
                            description: 'Broker público Mosquitto'
                          },
                          {
                            name: 'EMQX Cloud (SSL)',
                            host: 'broker.emqx.io',
                            port: 8883,
                            username: '',
                            password: '',
                            ssl: true,
                            description: 'EMQX Cloud con SSL'
                          },
                          {
                            name: 'AWS IoT Core',
                            host: 'your-endpoint.amazonaws.com',
                            port: 8883,
                            username: '',
                            password: '',
                            ssl: true,
                            description: 'AWS IoT Core (requiere configuración)'
                          }
                        ].map((preset, index) => {
                          const isDefault = configurations.mqtt.defaultBroker.includes(preset.name)
                          return (
                            <div key={index} className="relative">
                              <button
                                onClick={() => applyMQTTPreset(preset)}
                                className={`w-full p-4 bg-white dark:bg-gray-700 rounded-lg border hover:shadow-md transition-all text-left group ${
                                  isDefault 
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-300' 
                                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
                                }`}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    isDefault 
                                      ? 'bg-blue-200 dark:bg-blue-800' 
                                      : 'bg-blue-100 dark:bg-blue-900 group-hover:bg-blue-200 dark:group-hover:bg-blue-800'
                                  }`}>
                                    <svg className={`w-4 h-4 ${isDefault ? 'text-blue-700 dark:text-blue-300' : 'text-blue-600 dark:text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <h5 className={`font-medium text-sm ${isDefault ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                                        {preset.name}
                                      </h5>
                                      {isDefault && (
                                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{preset.description}</p>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                      {preset.host}:{preset.port}
                                      {preset.ssl && <span className="ml-1 text-green-600 dark:text-green-400">🔒 SSL</span>}
                                    </div>
                                  </div>
                                </div>
                              </button>
                              
                              {/* Botón para marcar como por defecto */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateConfiguration('mqtt', 'defaultBroker', preset.name)
                                  toast.success(`"${preset.name}" establecido como broker por defecto`, { duration: 2000 })
                                }}
                                className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                  isDefault 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400'
                                }`}
                                title={isDefault ? 'Broker por defecto actual' : 'Establecer como broker por defecto'}
                              >
                                <svg className="w-3 h-3" fill={isDefault ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* Información sobre broker por defecto */}
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Nota:</strong> El broker por defecto se conectará automáticamente al iniciar la aplicación. 
                            Puedes cambiar la configuración actual haciendo clic en cualquier broker, pero el broker por defecto 
                            permanecerá guardado para futuros inicios.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {/* Selector rápido de broker */}
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Seleccionar Broker Predefinido</label>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                const selectedBroker = [
                                  {
                                    name: 'EMQX Remoto',
                                    host: '100.107.238.60',
                                    port: 1883,
                                    username: 'admin',
                                    password: 'galgo2526',
                                    ssl: false
                                  },
                                  {
                                    name: 'EMQX Test',
                                    host: '100.82.84.24',
                                    port: 1883,
                                    username: 'admin',
                                    password: 'galgo2526',
                                    ssl: false
                                  },
                                  {
                                    name: 'Mosquitto Local',
                                    host: 'localhost',
                                    port: 1883,
                                    username: '',
                                    password: '',
                                    ssl: false
                                  },
                                  {
                                    name: 'HiveMQ Cloud',
                                    host: 'broker.hivemq.com',
                                    port: 1883,
                                    username: '',
                                    password: '',
                                    ssl: false
                                  },
                                  {
                                    name: 'Eclipse Mosquitto',
                                    host: 'test.mosquitto.org',
                                    port: 1883,
                                    username: '',
                                    password: '',
                                    ssl: false
                                  },
                                  {
                                    name: 'EMQX Cloud (SSL)',
                                    host: 'broker.emqx.io',
                                    port: 8883,
                                    username: '',
                                    password: '',
                                    ssl: true
                                  },
                                  {
                                    name: 'AWS IoT Core',
                                    host: 'your-endpoint.amazonaws.com',
                                    port: 8883,
                                    username: '',
                                    password: '',
                                    ssl: true
                                  }
                                ].find(broker => broker.name === e.target.value)

                                if (selectedBroker) {
                                  updateConfiguration('mqtt', 'host', selectedBroker.host)
                                  updateConfiguration('mqtt', 'port', selectedBroker.port)
                                  updateConfiguration('mqtt', 'username', selectedBroker.username)
                                  updateConfiguration('mqtt', 'password', selectedBroker.password)
                                  updateConfiguration('mqtt', 'ssl', selectedBroker.ssl)
                                  toast.success(`Configuración "${selectedBroker.name}" aplicada`, { duration: 2000 })
                                }
                                // Reset select to empty
                                e.target.value = ''
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">Seleccionar broker...</option>
                            <option value="EMQX Remoto">EMQX Remoto (100.107.238.60:1883)</option>
                            <option value="EMQX Test">EMQX Test (100.82.84.24:1883)</option>
                            <option value="Mosquitto Local">Mosquitto Local (localhost:1883)</option>
                            <option value="HiveMQ Cloud">HiveMQ Cloud (broker.hivemq.com:1883)</option>
                            <option value="Eclipse Mosquitto">Eclipse Mosquitto (test.mosquitto.org:1883)</option>
                            <option value="EMQX Cloud (SSL)">EMQX Cloud (SSL) (broker.emqx.io:8883)</option>
                            <option value="AWS IoT Core">AWS IoT Core (your-endpoint.amazonaws.com:8883)</option>
                          </select>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Selecciona un broker para autocompletar los campos
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Host/IP del Broker</label>
                          <input
                            type="text"
                            value={configurations.mqtt.host}
                            onChange={(e) => updateMQTTConfiguration('host', e.target.value)}
                            placeholder="ej: 100.107.238.60"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Dirección IP, hostname o dominio del broker MQTT</p>
                        </div>

                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Puerto</label>
                          <input
                            type="number"
                            value={configurations.mqtt.port}
                            onChange={(e) => updateMQTTConfiguration('port', parseInt(e.target.value))}
                            placeholder="1883"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Puerto MQTT (1883 sin SSL, 8883 con SSL)</p>
                        </div>

                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={configurations.mqtt.ssl}
                            onChange={(e) => updateConfiguration('mqtt', 'ssl', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                          />
                          <label className="text-sm text-gray-700 dark:text-gray-300">Usar SSL/TLS</label>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Usuario (opcional)</label>
                          <input
                            type="text"
                            value={configurations.mqtt.username}
                            onChange={(e) => updateMQTTConfiguration('username', e.target.value)}
                            placeholder="admin"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Máx 100 caracteres</p>
                        </div>

                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Contraseña (opcional)</label>
                          <input
                            type="password"
                            value={configurations.mqtt.password}
                            onChange={(e) => updateMQTTConfiguration('password', e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Máx 256 caracteres</p>
                        </div>

                          <button
                            onClick={handleConnect}
                            disabled={mqttConnecting || mqttStatus.connected}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {mqttConnecting ? 'Conectando...' : 'Conectar'}
                          </button>
                          <button
                            onClick={handleDisconnect}
                            disabled={mqttConnecting || !mqttStatus.connected}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {mqttConnecting ? 'Desconectando...' : 'Desconectar'}
                          </button>

                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Estado: <span className={`font-medium ${
                            mqttConnecting ? 'text-yellow-600' :
                            mqttStatus.connected ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {mqttConnecting ? 'Conectando...' :
                             mqttStatus.connected ? 'Conectado' : 'Desconectado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex space-x-3">
                      <button
                        onClick={() => saveAllConfigurations()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Guardar Configuración MQTT
                      </button>

                      <button
                        onClick={() => {
                          // Reset to defaults
                          updateConfiguration('mqtt', 'host', '100.107.238.60')
                          updateConfiguration('mqtt', 'port', 1883)
                          updateConfiguration('mqtt', 'username', 'admin')
                          updateConfiguration('mqtt', 'password', 'galgo2526')
                          updateConfiguration('mqtt', 'ssl', false)
                          updateConfiguration('mqtt', 'defaultBroker', 'EMQX Remoto (100.107.238.60:1883)')
                          toast.success('Configuración restablecida a valores por defecto', { duration: 3000 })
                        }}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Restablecer Valores
                      </button>
                    </div>
                  </div>

                  {/* Configuración de Polling Automático */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Polling Automático
                    </h3>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-gray-700 dark:text-gray-300 font-medium">Habilitar Polling Automático</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Actualizar automáticamente el estado MQTT y mensajes</p>
                        </div>
                        <button
                          onClick={() => updateConfiguration('mqtt', 'autoPolling', {
                            ...configurations.mqtt.autoPolling,
                            enabled: !configurations.mqtt.autoPolling?.enabled
                          })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                            configurations.mqtt.autoPolling?.enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              configurations.mqtt.autoPolling?.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {configurations.mqtt.autoPolling?.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                              Intervalo de Estado (segundos)
                            </label>
                            <input
                              type="number"
                              min="5"
                              max="300"
                              value={(configurations.mqtt.autoPolling?.statusInterval || 30000) / 1000}
                              onChange={(e) => updateConfiguration('mqtt', 'autoPolling', {
                                ...configurations.mqtt.autoPolling,
                                statusInterval: parseInt(e.target.value) * 1000
                              })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Cada cuánto verificar el estado de conexión MQTT
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                              Intervalo de Mensajes (segundos)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={(configurations.mqtt.autoPolling?.messagesInterval || 10000) / 1000}
                              onChange={(e) => updateConfiguration('mqtt', 'autoPolling', {
                                ...configurations.mqtt.autoPolling,
                                messagesInterval: parseInt(e.target.value) * 1000
                              })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Cada cuánto actualizar la lista de mensajes
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="text-sm text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <strong>Nota:</strong> El polling automático consume recursos del servidor. 
                            Ajusta los intervalos según tus necesidades de actualización en tiempo real.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gestión de Topics MQTT */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h3a1 1 0 011 1v2h4a1 1 0 011 1v5a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1h4zM7 10v6a1 1 0 001 1h8a1 1 0 001-1v-6M7 10H4a1 1 0 00-1 1v8a1 1 0 001 1h3m0-10h10m0 0V8a1 1 0 00-1-1H7a1 1 0 00-1 1v2z" />
                      </svg>
                      Gestión de Topics MQTT
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Lista de Topics */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-white">Topics Configurados ({mqttTopics.length})</h4>

                        {mqttTopics.length === 0 ? (
                          <div className="text-center py-8">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h3a1 1 0 011 1v2h4a1 1 0 011 1v5a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1h4zM7 10v6a1 1 0 001 1h8a1 1 0 001-1v-6M7 10H4a1 1 0 00-1 1v8a1 1 0 001 1h3m0-10h10m0 0V8a1 1 0 00-1-1H7a1 1 0 00-1 1v2z" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay topics configurados</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Agrega topics para recibir mensajes MQTT</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {mqttTopics.map(topic => (
                              <div key={topic.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-3 h-3 rounded-full ${topic.active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                    <div>
                                      <h4 className="font-medium text-gray-900 dark:text-white">{topic.topic}</h4>
                                      {topic.description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{topic.description}</p>
                                      )}
                                      <div className="text-xs text-gray-400 dark:text-gray-500">
                                        QoS: {topic.qos} | Retained: {topic.retained ? 'Sí' : 'No'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => {
                                      if (topic.active) {
                                        unsubscribeFromTopic(topic.id)
                                      } else {
                                        subscribeToTopic(topic.id)
                                      }
                                    }}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                      topic.active
                                        ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800'
                                        : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800'
                                    }`}
                                  >
                                    {topic.active ? 'Desuscribir' : 'Suscribir'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`¿Estás seguro de que quieres eliminar el topic "${topic.topic}"?`)) {
                                        // Implementar deleteTopic si es necesario
                                        toast.error('Función de eliminación no implementada aún')
                                      }
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                                    title="Eliminar topic"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Agregar Nuevo Topic */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-white">Agregar Nuevo Topic</h4>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Topic MQTT</label>
                            <input
                              type="text"
                              placeholder="Ej: sensors/temperature/room1"
                              value={topicForm.values.topic}
                              onChange={(e) => topicForm.handleChange('topic', e.target.value)}
                              onBlur={() => topicForm.handleBlur('topic')}
                              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                                topicForm.errors.topic ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                              disabled={mqttLoading}
                            />
                            {topicForm.errors.topic && topicForm.touched.topic && (
                              <p className="text-red-500 text-sm mt-1">{topicForm.errors.topic}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción (opcional)</label>
                            <input
                              type="text"
                              placeholder="Descripción del topic"
                              value={topicForm.values.description}
                              onChange={(e) => topicForm.handleChange('description', e.target.value)}
                              onBlur={() => topicForm.handleBlur('description')}
                              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                                topicForm.errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                              }`}
                              disabled={mqttLoading}
                            />
                            {topicForm.errors.description && topicForm.touched.description && (
                              <p className="text-red-500 text-sm mt-1">{topicForm.errors.description}</p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">QoS</label>
                              <select
                                value={topicForm.values.qos}
                                onChange={(e) => topicForm.handleChange('qos', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                disabled={mqttLoading}
                              >
                                <option value={0}>0 - Al menos una vez</option>
                                <option value={1}>1 - Al menos una vez</option>
                                <option value={2}>2 - Exactamente una vez</option>
                              </select>
                            </div>
                            <div className="flex items-center">
                              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={topicForm.values.retained}
                                  onChange={(e) => topicForm.handleChange('retained', e.target.checked)}
                                  className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                  disabled={mqttLoading}
                                />
                                <span>Retained</span>
                              </label>
                            </div>
                          </div>

                          <button
                            onClick={addMqttTopic}
                            disabled={mqttLoading || !topicForm.isValid}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            {mqttLoading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Agregando...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Agregar Topic
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Monitoreo de Mensajes MQTT */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Monitoreo de Mensajes MQTT
                    </h3>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={async () => {
                              setMqttLoading(true)
                              try {
                                await fetchMqttMessages()
                                toast.success('Mensajes actualizados', { duration: 2000 })
                              } catch {
                                toast.error('Error actualizando mensajes', { duration: 3000 })
                              } finally {
                                setMqttLoading(false)
                              }
                            }}
                            disabled={mqttLoading}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Actualizar</span>
                          </button>

                          <button
                            onClick={() => setMqttMessages([])}
                            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Limpiar</span>
                          </button>
                        </div>

                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {mqttMessages.length} mensajes mostrados
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 max-h-96 overflow-y-auto">
                        {mqttMessages.length === 0 ? (
                          <div className="text-center py-8">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay mensajes recientes</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Los mensajes MQTT aparecerán aquí cuando se reciban</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-200 dark:divide-gray-600">
                            {mqttMessages.slice(0, 20).map((message, index) => (
                              <div key={`${message.timestamp}-${index}`} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      <span className="font-medium text-gray-900 dark:text-white">{message.topic}</span>
                                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                        QoS {message.qos || 0}
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-2 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                      {typeof message.payload === 'object' ? JSON.stringify(message.payload, null, 2) : message.payload}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {new Date(message.timestamp).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {configTab === 'rtsp' && (
                <div className="p-8">
                  <RTSPManager />
                </div>
              )}

              {configTab === 'camera-streaming' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                      <svg className="w-8 h-8 mr-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Visor de Cámaras en Streaming
                    </h2>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {cameras?.length || 0} cámara(s) configurada(s)
                    </div>
                  </div>

                  {!cameras || cameras.length === 0 ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                      <div className="flex items-start space-x-4">
                        <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">No hay cámaras configuradas</h3>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Dirígete al tab <strong>"Cámaras"</strong> en Configuración para agregar cámaras RTSP. Una vez agregadas, aparecerán aquí.
                          </p>
                          <button
                            onClick={() => setConfigTab('cameras')}
                            className="mt-3 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
                          >
                            Ir a Configuración de Cámaras
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Galería de Cámaras */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                        <RTSPCameraGallery 
                          apiUrl={API_URL}
                        />
                      </div>

                      {/* Información */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>💡 Tip:</strong> Los streams se mostrarán en tiempo real con auto-reconexión automática. El timeout de conexión es de {configurations.cameras.connectionTimeout} segundos.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      <Navbar 
        currentSection={currentSection} 
        setCurrentSection={setCurrentSection} 
        setConfigTab={setConfigTab} 
      />
      {renderSection()}
    </div>
  )
}

export default App
