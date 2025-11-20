#!/bin/bash

# Script para ejecutar el monitor de mensajes MQTT con EMQX Granada
echo "🚀 Iniciando Monitor de Mensajes MQTT - EMQX Granada"
echo ""

# Verificar que Docker esté ejecutándose
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker no está ejecutándose. Por favor inicia Docker primero."
    exit 1
fi

# Verificar que el cluster EMQX esté ejecutándose
if ! docker ps | grep -q emqx; then
    echo "❌ El cluster EMQX no está ejecutándose."
    echo "Ejecuta primero: cd emqx_config_state && docker-compose up -d"
    exit 1
fi

echo "✅ Docker y EMQX están ejecutándose"

# Instalar dependencias del monitor si es necesario
echo "📦 Verificando dependencias del monitor..."
cd emqx-monitor
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias..."
    npm install
fi

# Ejecutar el monitor en background
echo "🌐 Iniciando servidor de desarrollo del monitor..."
npm run dev &
MONITOR_PID=$!

# Esperar un poco para que el servidor inicie
sleep 3

echo ""
echo "📡 Monitor iniciado en: http://localhost:5173"
echo ""
echo "Para probar los mensajes, ejecuta en otra terminal:"
echo "cd virtual_sensor_publisher && npm run multi"
echo ""
echo "Presiona Ctrl+C para detener el monitor"

# Función para limpiar procesos al salir
cleanup() {
    echo ""
    echo "🛑 Deteniendo monitor..."
    kill $MONITOR_PID 2>/dev/null
    exit 0
}

# Capturar señal de interrupción
trap cleanup SIGINT

# Mantener el script ejecutándose
wait $MONITOR_PID