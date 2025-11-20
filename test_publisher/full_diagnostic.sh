#!/bin/bash

# Script automatizado para diagnóstico completo del sistema MQTT
# Uso: bash full_diagnostic.sh

set -e

RESET='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'

echo -e "${BLUE}════════════════════════════════════════════════════════${RESET}"
echo -e "${BLUE}  DIAGNÓSTICO COMPLETO - EMQX MQTT MONITOR${RESET}"
echo -e "${BLUE}════════════════════════════════════════════════════════${RESET}\n"

# Paso 1: Verificar Docker
echo -e "${YELLOW}[1/5] Verificando Docker y EMQX...${RESET}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker no está instalado${RESET}"
    exit 1
fi

if ! docker ps | grep -q emqx; then
    echo -e "${YELLOW}  ⓘ EMQX no está corriendo, iniciando...${RESET}"
    cd /home/robert/Repositorio/emqx-granada/emqx_config_state
    docker-compose up -d
    echo -e "${YELLOW}  ⏳ Esperando que EMQX se inicie (5 segundos)...${RESET}"
    sleep 5
else
    echo -e "${GREEN}✓ EMQX está corriendo${RESET}"
fi

# Paso 2: Verificar conectividad
echo -e "\n${YELLOW}[2/5] Verificando puertos de conexión...${RESET}"

if nc -zv localhost 1883 &> /dev/null; then
    echo -e "${GREEN}✓ Puerto 1883 (MQTT) accesible${RESET}"
else
    echo -e "${RED}✗ Puerto 1883 (MQTT) no accesible${RESET}"
    exit 1
fi

if nc -zv localhost 8083 &> /dev/null; then
    echo -e "${GREEN}✓ Puerto 8083 (WebSocket) accesible${RESET}"
else
    echo -e "${RED}✗ Puerto 8083 (WebSocket) no accesible${RESET}"
    exit 1
fi

# Paso 3: Ejecutar diagnóstico MQTT
echo -e "\n${YELLOW}[3/5] Ejecutando prueba de conexión MQTT...${RESET}"
cd /home/robert/Repositorio/emqx-granada

if [ ! -f "diagnostic_mqtt.js" ]; then
    echo -e "${RED}✗ Archivo diagnostic_mqtt.js no encontrado${RESET}"
    exit 1
fi

node diagnostic_mqtt.js

# Paso 4: Información de la aplicación React
echo -e "\n${YELLOW}[4/5] Estado de la aplicación React...${RESET}"
if [ -d "emqx-monitor" ] && [ -f "emqx-monitor/package.json" ]; then
    echo -e "${GREEN}✓ Aplicación React encontrada${RESET}"
    echo -e "  Directorio: /home/robert/Repositorio/emqx-granada/emqx-monitor"
    
    # Verificar si está compilada
    if [ -d "emqx-monitor/dist" ]; then
        echo -e "${GREEN}✓ Aplicación compilada (dist/)${RESET}"
    else
        echo -e "${YELLOW}⚠ Aplicación no compilada, compilar con: npm run build${RESET}"
    fi
else
    echo -e "${RED}✗ Aplicación React no encontrada${RESET}"
fi

# Paso 5: Información de inicio
echo -e "\n${YELLOW}[5/5] Instrucciones para continuar...${RESET}"
echo -e "${GREEN}════════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "${BLUE}🚀 Para usar la aplicación:${RESET}"
echo ""
echo -e "  1. ${YELLOW}Compilar aplicación:${RESET}"
echo "     cd /home/robert/Repositorio/emqx-granada/emqx-monitor"
echo "     npm run build"
echo ""
echo -e "  2. ${YELLOW}Ejecutar en desarrollo (recomendado):${RESET}"
echo "     npm run dev"
echo ""
echo -e "  3. ${YELLOW}Abrir en navegador:${RESET}"
echo "     http://localhost:5173"
echo ""
echo -e "  4. ${YELLOW}Para publicar mensajes de prueba (otra terminal):${RESET}"
echo "     cd /home/robert/Repositorio/emqx-granada"
echo "     node test_mqtt_messages.js"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "${GREEN}✅ Diagnóstico completado exitosamente${RESET}"
echo ""
