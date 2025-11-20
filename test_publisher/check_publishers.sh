#!/bin/bash

# Script específico para verificar que los publicadores MQTT estén funcionando
# Reemplaza con tus credenciales reales
EMQX_API_KEY="334debcfbdc435a8"
EMQX_API_SECRET="hC5Tik9CQUZs39CmDzMSi5uoILanHz4lBLl5I7KseDcKG"
EMQX_BASE_URL="http://localhost:18083/api/v5"

# Función para crear header de autenticación
AUTH_HEADER="Authorization: Basic $(echo -n "${EMQX_API_KEY}:${EMQX_API_SECRET}" | base64)"

echo "=== 🔍 VERIFICACIÓN DE PUBLICADORES MQTT ==="
echo "Base URL: $EMQX_BASE_URL"
echo ""

# Verificar clientes conectados
echo "👥 CLIENTES CONECTADOS:"
echo "Esperados del multi-client-publisher.js:"
echo "- building-01 (Edificio Principal - 3 sensores)"
echo "- building-02 (Edificio Secundario - 3 sensores)"
echo "- warehouse-01 (Almacén Principal - 2 sensores)"
echo "- outdoor-01 (Estación Exterior - 3 sensores)"
echo ""

CLIENTS=$(curl -s -X GET "$EMQX_BASE_URL/clients?page=1&limit=20" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
  echo "Clientes encontrados:"
  echo "$CLIENTS" | jq -r '.data[]?.clientid // empty' 2>/dev/null || echo "  ❌ Error parseando respuesta"
  echo ""
else
  echo "❌ Error obteniendo clientes conectados"
  echo ""
fi

# Verificar tópicos activos
echo "📝 TÓPICOS ACTIVOS:"
echo "Esperados del publisher.js (5 tópicos):"
echo "- building/room1/temperature"
echo "- building/room1/humidity"
echo "- building/outdoor/temperature"
echo "- building/outdoor/pressure"
echo "- building/room2/light"
echo ""

echo "Esperados del multi-client-publisher.js (11 tópicos):"
echo "- building/floor1/room1/temperature"
echo "- building/floor1/room1/humidity"
echo "- building/floor1/room1/co2"
echo "- building/floor2/room1/temperature"
echo "- building/floor2/room1/humidity"
echo "- building/floor2/room1/motion"
echo "- warehouse/main/temperature"
echo "- warehouse/main/humidity"
echo "- outdoor/weather/temperature"
echo "- outdoor/weather/humidity"
echo "- outdoor/weather/pressure"
echo ""

TOPICS=$(curl -s -X GET "$EMQX_BASE_URL/topics?page=1&limit=50" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
  TOPIC_COUNT=$(echo "$TOPICS" | jq '.data | length' 2>/dev/null || echo "0")
  echo "Tópicos encontrados: $TOPIC_COUNT"
  echo "$TOPICS" | jq -r '.data[]?.topic // empty' 2>/dev/null || echo "  ❌ Error parseando respuesta"
  echo ""
else
  echo "❌ Error obteniendo tópicos"
  echo ""
fi

# Verificar estadísticas de mensajes
echo "📊 ESTADÍSTICAS DE MENSAJES:"
STATS=$(curl -s -X GET "$EMQX_BASE_URL/stats" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
  MESSAGES_RECEIVED=$(echo "$STATS" | jq '.messages?.received // 0' 2>/dev/null)
  MESSAGES_SENT=$(echo "$STATS" | jq '.messages?.sent // 0' 2>/dev/null)
  CONNECTIONS_ACTIVE=$(echo "$STATS" | jq '.connections?.active // 0' 2>/dev/null)

  echo "Mensajes recibidos: $MESSAGES_RECEIVED"
  echo "Mensajes enviados: $MESSAGES_SENT"
  echo "Conexiones activas: $CONNECTIONS_ACTIVE"
  echo ""
else
  echo "❌ Error obteniendo estadísticas"
  echo ""
fi

# Verificar un tópico específico como ejemplo
echo "🔍 VERIFICACIÓN DETALLADA DE UN TÓPICO:"
EXAMPLE_TOPIC="building/room1/temperature"
echo "Probando tópico: $EXAMPLE_TOPIC"

TOPIC_INFO=$(curl -s -X GET "$EMQX_BASE_URL/topics/$EXAMPLE_TOPIC" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ] && [ "$TOPIC_INFO" != "null" ] && [ "$TOPIC_INFO" != "" ]; then
  echo "✅ Tópico encontrado!"
  echo "$TOPIC_INFO" | jq '.' 2>/dev/null || echo "  Detalles: $TOPIC_INFO"
else
  echo "❌ Tópico no encontrado o error"
fi

echo ""
echo "=== 💡 RECOMENDACIONES ==="
echo "1. Si no ves los clientes esperados:"
echo "   - Verifica que los publicadores estén ejecutándose"
echo "   - Ejecuta: cd virtual_sensor_publisher && npm run multi"
echo ""
echo "2. Si no ves los tópicos esperados:"
echo "   - Espera unos segundos para que se publiquen los primeros mensajes"
echo "   - Los tópicos aparecen cuando se publican mensajes por primera vez"
echo ""
echo "3. Para debugging detallado:"
echo "   - Ejecuta: ./test_emqx_api.sh"
echo "   - Revisa los logs de los contenedores EMQX"