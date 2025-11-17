const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

const initializeDatabase = () => {
  if (db) {
    return db;
  }

  const dbPath = path.join(__dirname, '../../sensors.db');
  
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      throw err;
    } else {
      console.log('Connected to SQLite database.');
      createTables();
    }
  });

  return db;
};

const createTables = () => {
  // Sensors table
  db.run(`CREATE TABLE IF NOT EXISTS sensors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    topic TEXT NOT NULL,
    description TEXT,
    unit TEXT,
    min_value REAL,
    max_value REAL,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // MQTT topics table
  db.run(`CREATE TABLE IF NOT EXISTS mqtt_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL UNIQUE,
    description TEXT,
    qos INTEGER DEFAULT 0,
    retained BOOLEAN DEFAULT 0,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // MQTT messages table for history
  db.run(`CREATE TABLE IF NOT EXISTS mqtt_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    message TEXT,
    qos INTEGER,
    retain BOOLEAN,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Configurations table - with category support
  db.run(`CREATE TABLE IF NOT EXISTS configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, key)
  )`);

  // RTSP Cameras table
  db.run(`CREATE TABLE IF NOT EXISTS rtsp_cameras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    ip TEXT NOT NULL,
    port INTEGER DEFAULT 554,
    username TEXT,
    password TEXT,
    path TEXT DEFAULT '/',
    protocol TEXT DEFAULT 'rtsp',
    enabled BOOLEAN DEFAULT 1,
    last_connection_status TEXT DEFAULT 'unknown',
    last_connection_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating rtsp_cameras table:', err);
    } else {
      console.log('Database tables initialized successfully.');
    }
  });
};

const getDatabase = () => {
  if (!db) {
    return initializeDatabase();
  }
  return db;
};

const closeDatabase = () => {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
    });
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
};
