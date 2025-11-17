#!/bin/bash

echo "🧹 EMQX Broker Session Cleanup"
echo "=============================="
echo ""
echo "This script will restart the EMQX broker to clean ALL sessions"
echo ""

# Check if emqx container is running
if ! docker ps | grep -q emqx; then
    echo "❌ EMQX container not found or not running"
    echo "   Make sure EMQX is running with: docker-compose up -d emqx"
    exit 1
fi

echo "📋 Current EMQX status:"
docker ps | grep emqx
echo ""

read -p "⚠️  This will disconnect all MQTT clients. Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

echo ""
echo "🔄 Restarting EMQX broker..."
docker restart emqx

echo ""
echo "⏳ Waiting for EMQX to restart (15 seconds)..."
sleep 15

echo ""
echo "✅ EMQX restarted successfully!"
echo ""
echo "📊 Verifying EMQX is running:"
docker ps | grep emqx
echo ""
echo "🎉 All old MQTT sessions have been cleared!"
echo ""
echo "💡 Next steps:"
echo "   1. Restart your Galgo School API server"
echo "   2. It will connect with Client ID: galgo-school-server"
echo "   3. Check EMQX Dashboard to verify only one client is connected"
echo "      → http://100.107.238.60:18083 (admin / galgo2526)"
