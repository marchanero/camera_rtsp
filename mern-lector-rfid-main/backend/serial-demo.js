const { SerialPort } = require('serialport');

// Puerto serial (ajustar según el puerto del lector RFID conectado al ESP8266)
const port = new SerialPort({
  path: '/dev/tty.usbserial-FTB6SPL3', // Puerto detectado
  baudRate: 115200, // Baud rate típico para ESP8266
});

// Buffer para acumular datos del puerto serial
let serialBuffer = '';

// Leer datos del puerto serial
port.on('open', () => {
  console.log('Puerto serial abierto');
});

port.on('data', (data) => {
  serialBuffer += data.toString();
  let lines = serialBuffer.split('\n');
  serialBuffer = lines.pop(); // Última línea incompleta queda en buffer

  for (let line of lines) {
    line = line.trim();
    if (line) {
      console.log('Línea recibida:', line);
      try {
        const jsonData = JSON.parse(line);
        console.log('JSON parseado:', jsonData);

        // Procesar según el evento
        if (jsonData.event === 'card_detected' && jsonData.uid) {
          console.log('Tag detectado:', jsonData.uid);
        } else if (jsonData.event === 'card_removed') {
          console.log('Tag removido:', jsonData.uid);
        }
      } catch (error) {
        console.error('Error parseando JSON:', error.message);
      }
    }
  }
});

port.on('error', (err) => {
  console.error('Error en puerto serial:', err.message);
});