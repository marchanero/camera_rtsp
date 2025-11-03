import { useEffect, useRef, useState } from 'react'

function useWebSocket(url) {
  const [isConnected, setIsConnected] = useState(false)
  const [data, setData] = useState(null)
  const ws = useRef(null)
  const reconnectTimeout = useRef(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//localhost:3000/ws`

      try {
        ws.current = new WebSocket(wsUrl)

        ws.current.onopen = () => {
          console.log('✅ WebSocket conectado')
          setIsConnected(true)
          reconnectAttempts.current = 0
        }

        ws.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            setData(message)
          } catch (error) {
            console.error('Error al procesar mensaje:', error)
          }
        }

        ws.current.onclose = () => {
          console.log('❌ WebSocket desconectado')
          setIsConnected(false)
          
          // Intentar reconectar
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)
            console.log(`🔄 Reconectando en ${delay}ms (intento ${reconnectAttempts.current})...`)
            reconnectTimeout.current = setTimeout(connect, delay)
          }
        }

        ws.current.onerror = (error) => {
          console.error('Error WebSocket:', error)
          setIsConnected(false)
        }
      } catch (error) {
        console.error('Error al conectar WebSocket:', error)
        setIsConnected(false)
      }
    }

    connect()

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
      }
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])

  const send = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket no está conectado')
    }
  }

  return { isConnected, data, send }
}

export default useWebSocket
