#!/bin/bash

# Comandos curl para probar la API de EMQX Granada
# Reemplaza con tus credenciales reales
EMQX_API_KEY="334debcfbdc435a8"
EMQX_API_SECRET="hC5Tik9CQUZs39CmDzMSi5uoILanHz4lBLl5I7KseDcKG"
EMQX_BASE_URL="http://localhost:18083/api/v5"

# Función para crear header de autenticación
AUTH_HEADER="Authorization: Basic $(echo -n "${EMQX_API_KEY}:${EMQX_API_SECRET}" | base64)"

echo "=== PRUEBAS DE API EMQX GRANADA ==="
echo "Base URL: $EMQX_BASE_URL"
echo "API Key: $EMQX_API_KEY"
echo ""

# 1. Estadísticas del cluster
echo "1. 📊 Estadísticas del cluster:"
curl -X GET "$EMQX_BASE_URL/stats" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n"

# 2. Lista de clientes conectados
echo "2. 👥 Clientes conectados:"
curl -X GET "$EMQX_BASE_URL/clients?page=1&limit=10" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n"

# 3. Lista de suscripciones
echo "3. 📋 Suscripciones activas:"
curl -X GET "$EMQX_BASE_URL/subscriptions?page=1&limit=10" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n"

# 4. Lista de nodos
echo "4. 🖥️ Nodos del cluster:"
curl -X GET "$EMQX_BASE_URL/nodes" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n"

# 5. Tópicos activos
echo "5. 📝 Tópicos activos:"
curl -X GET "$EMQX_BASE_URL/topics?page=1&limit=10" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n"

# 6. Rutas de tópicos
echo "6. 🛣️ Rutas de tópicos:"
curl -X GET "$EMQX_BASE_URL/routes?page=1&limit=10" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.'
echo -e "\n"

# 7. Información detallada de un nodo específico (si existe)
echo "7. 🔍 Información del nodo emqx@node1.emqx.io:"
curl -X GET "$EMQX_BASE_URL/nodes/emqx@node1.emqx.io" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Nodo no encontrado o error"
echo -e "\n"

# 8. Detalles de un cliente específico (si existe)
echo "8. 👤 Detalles de cliente (ejemplo):"
curl -X GET "$EMQX_BASE_URL/clients/sensor_client_1" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Cliente no encontrado o error"
echo -e "\n"

# 9. Métricas específicas de un tópico (sensores del publisher.js)
echo "9. 📊 Métricas del tópico 'building/room1/temperature' (publisher.js):"
curl -X GET "$EMQX_BASE_URL/topic-metrics/building/room1/temperature" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Tópico no encontrado o error"
echo -e "\n"

# 10. Suscriptores de un tópico específico
echo "10. 👥 Suscriptores del tópico 'building/room1/temperature':"
curl -X GET "$EMQX_BASE_URL/topics/building/room1/temperature/subscribers" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Tópico no encontrado o error"
echo -e "\n"

# 11. Detalles de un tópico específico
echo "11. 📋 Detalles del tópico 'building/room1/temperature':"
curl -X GET "$EMQX_BASE_URL/topics/building/room1/temperature" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Tópico no encontrado o error"
echo -e "\n"

# === PRUEBAS ESPECÍFICAS PARA PUBLISHER.JS ===
echo "=== 🏢 PRUEBAS PARA PUBLISHER.JS (5 sensores) ==="

# Sensores del publisher.js
PUBLISHER_TOPICS=(
  "building/room1/temperature"
  "building/room1/humidity"
  "building/outdoor/temperature"
  "building/outdoor/pressure"
  "building/room2/light"
)

for topic in "${PUBLISHER_TOPICS[@]}"; do
  echo "🔍 Probando tópico: $topic"
  curl -X GET "$EMQX_BASE_URL/topics/$topic" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" | jq '.topic // "No encontrado"' 2>/dev/null || echo "  ❌ Error o no encontrado"
  echo ""
done

# === PRUEBAS ESPECÍFICAS PARA MULTI-CLIENT-PUBLISHER.JS ===
echo "=== 🏭 PRUEBAS PARA MULTI-CLIENT-PUBLISHER.JS (4 clientes, 11 sensores) ==="

# Sensores del multi-client-publisher.js
MULTI_TOPICS=(
  "building/floor1/room1/temperature"
  "building/floor1/room1/humidity"
  "building/floor1/room1/co2"
  "building/floor2/room1/temperature"
  "building/floor2/room1/humidity"
  "building/floor2/room1/motion"
  "warehouse/main/temperature"
  "warehouse/main/humidity"
  "outdoor/weather/temperature"
  "outdoor/weather/humidity"
  "outdoor/weather/pressure"
)

for topic in "${MULTI_TOPICS[@]}"; do
  echo "🔍 Probando tópico: $topic"
  curl -X GET "$EMQX_BASE_URL/topics/$topic" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" | jq '.topic // "No encontrado"' 2>/dev/null || echo "  ❌ Error o no encontrado"
  echo ""
done

# === PRUEBA DE CLIENTES CONECTADOS ===
echo "=== 👥 VERIFICACIÓN DE CLIENTES CONECTADOS ==="
echo "Clientes esperados del multi-client-publisher:"
echo "- building-01 (Edificio Principal)"
echo "- building-02 (Edificio Secundario)"
echo "- warehouse-01 (Almacén Principal)"
echo "- outdoor-01 (Estación Exterior)"
echo ""

curl -X GET "$EMQX_BASE_URL/clients?page=1&limit=20" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq '.data[]?.clientid // empty' 2>/dev/null || echo "No se pudieron obtener clientes"
echo -e "\n"

echo "=== FIN DE LAS PRUEBAS ==="
echo "Para ejecutar todas las pruebas: chmod +x test_emqx_api.sh && ./test_emqx_api.sh"