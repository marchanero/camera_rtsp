# 📡 MERN RFID Reader con Gestión de Usuarios

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-4+-purple.svg)](https://vitejs.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5+-orange.svg)](https://prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3+-blue.svg)](https://sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3+-38B2AC.svg)](https://tailwindcss.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4+-010101.svg)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Sistema completo de lectura RFID con gestión de usuarios, asignación de tarjetas y visualización en tiempo real. Incluye interfaz moderna con temas claro/oscuro y notificaciones en tiempo real.

## ✨ Características Principales

### 🔄 **Sistema RFID Avanzado**
- � **Lectura en tiempo real** de tarjetas RFID vía puerto serial (ESP8266)
- 💾 **Almacenamiento inteligente** con SQLite y Prisma ORM
- 🔄 **Sincronización en tiempo real** con Socket.IO
- 🎯 **Detección de duplicados** y actualización automática de timestamps

### 👥 **Gestión Completa de Usuarios**
- ➕ **Registro de usuarios** con nombre y email
- 🎴 **Asignación de tarjetas** RFID a usuarios específicos
- � **Reasignación en tiempo real** con actualizaciones automáticas
- 📊 **Dashboard de usuarios** con estado de asignación

### 🎨 **Interfaz Moderna y Responsive**
- 🌙 **Modo oscuro/claro** con persistencia automática
- 📱 **Diseño responsive** para todos los dispositivos
- 🎯 **Badges visuales** para usuarios asignados
- 📋 **Historial organizado** con separación de última detección
- 🔔 **Notificaciones popup** para nuevas detecciones
- 📄 **Paginación inteligente** del historial

### ⚡ **Características Técnicas**
- 🚀 **Desarrollo optimizado** con Vite y HMR
- 🔧 **API REST completa** para usuarios y tarjetas
- 📊 **Base de datos relacional** con integridad referencial
- 🔒 **Validación de datos** y manejo de errores
- 📈 **Rendimiento optimizado** con lazy loading

## 🛠️ Tecnologías Utilizadas

### Backend
- **Node.js 18+** - Runtime de JavaScript
- **Express.js** - Framework web RESTful
- **Prisma ORM** - Mapeo objeto-relacional con SQLite
- **Socket.IO** - Comunicación en tiempo real bidireccional
- **SerialPort** - Comunicación con hardware RFID
- **CORS** - Manejo de cross-origin requests

### Frontend
- **React 18** - Biblioteca UI con hooks modernos
- **Vite 4+** - Build tool ultrarrápido con HMR
- **Tailwind CSS 3+** - Framework CSS utility-first
- **Axios** - Cliente HTTP con interceptores
- **Socket.IO Client** - Cliente para comunicación en tiempo real

### Base de Datos
- **SQLite 3** - Base de datos local embebida
- **Prisma Migrate** - Control de versiones de esquema
- **Relaciones bidireccionales** User ↔ RFIDTag

### Hardware
- **ESP8266/NodeMCU** - Microcontrolador WiFi
- **Lector RFID MFRC522** - Compatible con MIFARE 1KB/4KB
- **Conexión USB Serial** - Comunicación full-duplex

## 📦 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ y npm
- ESP8266 con firmware compatible
- Lector RFID conectado al ESP8266
- Puerto USB disponible

### 🚀 Instalación Rápida

```bash
# Clona el repositorio
git clone https://github.com/marchanero/mern-lector-rfid.git
cd mern-lector-rfid

# Instala todas las dependencias
npm run install:all

# Configura la base de datos
cd backend
npx prisma migrate dev --name init
npx prisma generate
cd ..

# Inicia el desarrollo
npm run dev
```

### ⚙️ Configuración Manual

1. **Dependencias del Backend**
   ```bash
   cd backend && npm install
   ```

2. **Dependencias del Frontend**
   ```bash
   cd frontend && npm install
   ```

3. **Base de Datos**
   ```bash
   cd backend
   npx prisma migrate dev --name add_user_system
   npx prisma generate
   ```

4. **Configuración del Puerto Serial**
   - Conecta el ESP8266 con RFID
   - Verifica puertos: `npx serialport-list`
   - Actualiza `TARGET_PORT` en `backend/src/index.js`

## 🎮 Uso de la Aplicación

### Modo Desarrollo
```bash
# Backend + Frontend concurrentemente
npm run dev

# Solo backend (puerto 3001)
npm run dev:backend

# Solo frontend (puerto 5173)
npm run dev:frontend
```

### Modo Producción
```bash
# Construir frontend optimizado
npm run build

# Ejecutar backend
npm start
```

### � Funcionalidades Principales

#### 1. **Lectura RFID en Tiempo Real**
- Conecta el ESP8266 y comienza a detectar tarjetas
- Visualización automática en la interfaz
- Notificaciones popup para nuevas detecciones

#### 2. **Gestión de Usuarios**
- **Registro**: Agrega usuarios con nombre y email
- **Asignación**: Vincula tarjetas RFID a usuarios específicos
- **Reasignación**: Cambia asignaciones en tiempo real
- **Dashboard**: Visualiza estado de todas las asignaciones

#### 3. **Historial Inteligente**
- **Última Detección**: Destacada con efectos visuales
- **Historial Anterior**: Organizado en cuadrícula paginada
- **Búsqueda**: Información de usuario asignado visible
- **Paginación**: Navegación eficiente en grandes volúmenes

## 📁 Arquitectura del Proyecto

```
mern-lector-rfid/
├── backend/                    # 🖥️ Servidor Express + Socket.IO
│   ├── prisma/
│   │   ├── schema.prisma       # 📋 Esquema DB con relaciones
│   │   ├── dev.db             # 💾 Base de datos SQLite
│   │   └── migrations/        # 🔄 Control de versiones DB
│   └── src/
│       └── index.js           # 🚀 Servidor principal + APIs
├── frontend/                  # 🎨 Cliente React + Vite
│   ├── public/                # 📁 Assets estáticos
│   ├── src/
│   │   ├── App.jsx           # 📊 Dashboard RFID
│   │   ├── MainApp.jsx       # 🧭 Navegación principal
│   │   ├── UserManagement.jsx # 👥 Gestión de usuarios
│   │   ├── ThemeContext.jsx  # 🌙 Sistema de temas
│   │   ├── index.css         # 🎨 Estilos Tailwind
│   │   └── main.jsx          # ⚡ Punto de entrada
│   ├── tailwind.config.js    # ⚙️ Configuración Tailwind
│   └── vite.config.js        # 🔧 Configuración Vite
├── package.json              # 📦 Scripts del monorepo
└── README.md                 # 📖 Esta documentación
```

## 🔌 API Endpoints

### Usuarios
```http
GET    /api/users           # Lista todos los usuarios
POST   /api/users           # Crear nuevo usuario
POST   /api/users/:id/assign-tag    # Asignar tarjeta
POST   /api/users/:id/unassign-tag  # Desasignar tarjeta
```

### Tarjetas RFID
```http
GET    /api/tags            # Historial de detecciones
POST   /api/test-card       # Simular detección (dev)
```

### Socket.IO Events
```javascript
// Cliente → Servidor
'connect'                    // Conexión establecida
'disconnect'                 // Conexión perdida

// Servidor → Cliente
'rfid-detected'             // Nueva tarjeta detectada
'tag-assigned'              // Tarjeta asignada/desasignada
'tag_removed'               // Tarjeta removida del lector
```

## 🎨 Interfaz de Usuario

### 🌓 Sistema de Temas
- **Modo Claro/Oscuro** automático
- **Transiciones suaves** entre temas
- **Persistencia** de preferencias

### 📊 Dashboard Interactivo
- **Indicadores en tiempo real** de conexión
- **Animaciones modernas** con CSS avanzado
- **Responsive design** para móvil/tablet/desktop
- **Accesibilidad** con ARIA labels

### 👤 Gestión Visual de Usuarios
- **Badges distintivos** para asignaciones
- **Estados visuales** claros (asignado/disponible)
- **Feedback inmediato** en operaciones
- **Interfaz intuitiva** con iconografía clara

## 🔧 Desarrollo y Contribución

### Scripts Disponibles
```bash
npm run install:all        # Instalar dependencias completas
npm run dev                # Desarrollo concurrente
npm run build              # Build de producción
npm run start              # Ejecutar en producción
npm run lint               # Linting del código
```

### 🤝 Guía de Contribución
1. Fork el proyecto
2. Crea rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -m 'feat: descripción clara'`
4. Push a rama: `git push origin feature/nueva-funcionalidad`
5. Abre Pull Request con descripción detallada

### 🐛 Reporte de Issues
- Usa templates de issue para bugs/features
- Incluye logs del backend y configuración
- Describe pasos para reproducir
- Adjunta screenshots si es UI-related

## 📄 Licencia

Este proyecto está bajo la **Licencia MIT** - ver [LICENSE](LICENSE) para detalles completos.

## 👨‍💻 Autor

**Roberto Sánchez**
- GitHub: [@marchanero](https://github.com/marchanero)
- LinkedIn: [Tu perfil]

---

⭐ **¡Si te gusta este proyecto, dale una estrella!**

## 📞 Soporte y Comunidad

- 🐛 [Issues](https://github.com/marchanero/mern-lector-rfid/issues) - Reporta bugs
- 💡 [Discussions](https://github.com/marchanero/mern-lector-rfid/discussions) - Ideas y preguntas
- 📧 Contacto: [tu-email@ejemplo.com]

---

**Desarrollado con ❤️ para la comunidad maker y IoT**
