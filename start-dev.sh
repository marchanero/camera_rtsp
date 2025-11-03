#!/bin/bash

echo "🎥 Iniciando Visor de Cámaras RTSP..."
echo ""

# Verificar que ambas carpetas existan
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Las carpetas 'backend' y 'frontend' no existen"
    exit 1
fi

# Iniciar backend
echo "▶️  Iniciando backend (Puerto 3000)..."
cd backend
npm run dev &
BACKEND_PID=$!

sleep 2

# Iniciar frontend
echo "▶️  Iniciando frontend (Puerto 5173)..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Aplicación iniciada!"
echo ""
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend: http://localhost:3000"
echo "📍 API: http://localhost:3000/cameras"
echo ""
echo "Presiona Ctrl+C para detener la aplicación"
echo ""

# Esperar a que se presione Ctrl+C
wait
