
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883', { username: 'admin', password: 'galgo2526', clientId: 'debugger' });

client.on('connect', () => {
    console.log('Connected');
    
    // 1. Message WITH type (Should work)
    const payloadGood = JSON.stringify({
        type: "debug_test_good",
        value: 123
    });
    client.publish("ETSIIAB/debug/good", payloadGood);
    console.log('Sent GOOD message (has type)');

    // 2. Message WITHOUT type (Likely fails)
    const payloadBad = JSON.stringify({
        value: 456,
        sensorId: "test_sensor"
    });
    client.publish("ETSIIAB/debug/bad", payloadBad);
    console.log('Sent BAD message (no type)');

    setTimeout(() => {
        client.end();
        process.exit(0);
    }, 1000);
});
