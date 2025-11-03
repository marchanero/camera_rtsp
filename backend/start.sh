#!/bin/bash

echo "🚀 Iniciando sistema de grabación RTSP..."
echo ""
echo "📋 Verificando dependencias..."

# Verificar FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg no encontrado"
    echo "Instala con: brew install ffmpeg"
    exit 1
fi

echo "✅ FFmpeg: $(ffmpeg -version | head -n1)"

# Verificar Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no encontrado"
    exit 1
fi

echo "✅ Node: $(node -v)"

# Crear directorios necesarios
echo ""
echo "📁 Creando directorios..."
mkdir -p recordings
mkdir -p media

echo "✅ Directorios creados"
echo ""
echo "🎬 Iniciando servidor..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Iniciar servidor
node --watch src/index.js
