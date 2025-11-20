#!/bin/bash

# Script de inicio seguro que limpia procesos antes de iniciar
echo "🧹 Limpiando procesos FFmpeg huérfanos..."
pkill -f "ffmpeg.*recordings/camera" 2>/dev/null || true

echo "🚀 Iniciando servidor backend..."
node src/index.js
