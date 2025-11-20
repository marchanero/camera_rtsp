#!/bin/bash

# Script de inicio rápido para publishers de sensores
# Camera RTSP Test Publishers

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  📡 Camera RTSP - Test Publishers                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Verificar instalación de mqtt
if ! npm list mqtt &>/dev/null; then
    echo "⚠️  Dependencia mqtt no encontrada"
    echo "📦 Instalando dependencias..."
    npm install
    echo ""
fi

echo "Selecciona el tipo de publicador:"
echo ""
echo "  1️⃣  Normal (Multi-Sensor)    - 4 sensores cada 2s [RECOMENDADO]"
echo "  2️⃣  Stress Test              - 15 sensores alta frecuencia"
echo "  3️⃣  Diagnóstico MQTT         - Verificar conectividad"
echo "  0️⃣  Salir"
echo ""
read -p "Opción [1]: " choice
choice=${choice:-1}

case $choice in
    1)
        echo ""
        echo "🚀 Iniciando publicador multi-sensor..."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        node publish-sensors-multi.js
        ;;
    2)
        echo ""
        echo "⚡ Iniciando stress test..."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        node publish-sensors-stress.js
        ;;
    3)
        echo ""
        echo "🔍 Ejecutando diagnóstico MQTT..."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        node diagnostic_mqtt.js
        ;;
    0)
        echo ""
        echo "👋 Saliendo..."
        echo ""
        exit 0
        ;;
    *)
        echo ""
        echo "❌ Opción inválida"
        exit 1
        ;;
esac
