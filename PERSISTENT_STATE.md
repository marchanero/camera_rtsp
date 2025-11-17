# 🔄 Estado Persistente - Mejoras de UX

## Cambios Implementados

### 1. **Persistencia de Cámara Seleccionada**
- La cámara seleccionada se guarda en `localStorage`
- Al cambiar de sección (Dashboard → Sensores → Reglas), la cámara mantiene su conexión
- Al recargar la página, se restaura la última cámara seleccionada
- El visualizador WebRTC mantiene su estado y conexión

### 2. **Persistencia de Tab Activo**
- El tab activo se guarda en `localStorage`
- Al recargar la página, se restaura la última sección visitada
- Mejora la experiencia al volver después de cerrar el navegador

### 3. **Componentes Siempre Montados**
Los siguientes componentes permanecen montados pero ocultos:
- **Dashboard**: Mantiene el estado de grabación y estadísticas MQTT
- **Cámaras**: Mantiene la conexión del visor y la lista de cámaras

Los siguientes se montan dinámicamente:
- **Sensores**: Solo cuando se visita (optimización de recursos)
- **Reglas**: Solo cuando se visita (optimización de recursos)

### 4. **Indicador de Grabación Global**
- Visible en el header en TODAS las secciones
- Muestra el número de cámaras grabando activamente
- Indicador pulsante rojo cuando hay grabación activa

## Beneficios

✅ **Continuidad de Grabación**: Las grabaciones no se interrumpen al cambiar de sección
✅ **Mejor UX**: No se pierde el contexto al navegar
✅ **Persistencia de Sesión**: Recupera el estado después de recargar
✅ **Optimización**: Solo mantiene montado lo necesario

## Uso

```javascript
// La cámara seleccionada se mantiene automáticamente
// Navega entre secciones sin perder la conexión

1. Selecciona una cámara en "Cámaras"
2. Inicia grabación en "Dashboard"
3. Ve a "Sensores" → La grabación continúa
4. Regresa a "Cámaras" → El visor sigue conectado
5. Recarga la página → Todo se restaura
```

## Implementación Técnica

### localStorage Keys
- `selectedCamera`: JSON de la cámara seleccionada
- `activeTab`: String con el tab activo ('dashboard' | 'cameras' | 'sensors' | 'rules')

### Componentes
```jsx
// Inicialización con localStorage
const [selectedCamera, setSelectedCamera] = useState(() => {
  const saved = localStorage.getItem('selectedCamera')
  return saved ? JSON.parse(saved) : null
})

const [activeTab, setActiveTab] = useState(() => {
  return localStorage.getItem('activeTab') || 'dashboard'
})

// Persistencia automática
useEffect(() => {
  if (selectedCamera) {
    localStorage.setItem('selectedCamera', JSON.stringify(selectedCamera))
  } else {
    localStorage.removeItem('selectedCamera')
  }
}, [selectedCamera])

useEffect(() => {
  localStorage.setItem('activeTab', activeTab)
}, [activeTab])
```

### Renderizado Condicional
```jsx
{/* Siempre montado, visible/oculto con CSS */}
<div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
  <DashboardSummary />
</div>

{/* Montado dinámicamente */}
{activeTab === 'sensors' && (
  <SensorsDashboard />
)}
```

## Testing

Para verificar la persistencia:

1. **Test de Grabación**:
   - Inicia grabación en Dashboard
   - Cambia a Sensores
   - Verifica que el indicador "🔴 X Grabando" permanece en el header
   - Regresa a Dashboard → la grabación debe seguir activa

2. **Test de Visor**:
   - Selecciona una cámara en la sección Cámaras
   - Cambia a Dashboard
   - Regresa a Cámaras → el visor debe mantener la conexión

3. **Test de Recarga**:
   - Selecciona una cámara
   - Cambia a la pestaña Sensores
   - Recarga la página (F5)
   - Debe abrir en Sensores con la cámara seleccionada en memoria

## Próximas Mejoras

- [ ] Persistir estado de filtros y búsquedas
- [ ] Guardar preferencias de visualización (grid/list)
- [ ] Mantener histórico de últimas N cámaras visitadas
- [ ] Sincronización entre múltiples pestañas del navegador
