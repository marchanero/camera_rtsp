// Script de diagnóstico avanzado para Chrome DevTools
// Ejecutar en la consola del navegador para analizar el estado del temporizador

console.log('🔍 DIAGNÓSTICO AVANZADO DEL TEMPORIZADOR DE GRABACIÓN');
console.log('===================================================');

// Función para obtener el componente React (si está disponible)
function getRecordingControlComponent() {
  try {
    // Buscar en el DOM de React
    const reactFiber = Object.keys(window).find(key =>
      key.startsWith('__reactInternalInstance$') ||
      key.startsWith('__reactFiber$')
    );

    if (reactFiber) {
      console.log('🔍 React DevTools detectado');
      return 'React DevTools disponible - usa las herramientas para inspeccionar el componente';
    }
  } catch (error) {
    // No hay React DevTools
  }

  return 'Componente no accesible directamente - usar logs del componente';
}

// 1. Verificar estado guardado en localStorage
console.log('📦 1. ESTADO EN LOCALSTORAGE:');
try {
  const saved = localStorage.getItem('recordingControlState');
  if (saved) {
    const parsed = JSON.parse(saved);
    console.log('✅ Estado encontrado:');
    console.table(parsed);

    // Verificar si los timestamps son válidos
    if (parsed.recordingStartTime) {
      const startTime = new Date(parsed.recordingStartTime);
      const now = new Date();
      const elapsed = Math.floor((now - startTime) / 1000);
      console.log(`⏱️ Tiempo transcurrido calculado: ${elapsed} segundos`);
      console.log(`📅 Hora de inicio: ${startTime.toLocaleString()}`);
    }

    if (parsed.pauseStartTime) {
      const pauseTime = new Date(parsed.pauseStartTime);
      console.log(`⏸️ Última pausa: ${pauseTime.toLocaleString()}`);
    }
  } else {
    console.log('❌ No hay estado guardado en localStorage');
  }
} catch (error) {
  console.error('❌ Error leyendo localStorage:', error);
}

// 2. Verificar llamadas de red al backend
console.log('\n🌐 2. LLAMADAS DE RED RECIENTES:');
try {
  if (window.performance && window.performance.getEntriesByType) {
    const networkEntries = window.performance.getEntriesByType('resource')
      .filter(entry => entry.name.includes('/api/recordings/sync/status'))
      .slice(-3); // Últimas 3 llamadas

    if (networkEntries.length > 0) {
      console.log('📡 Últimas llamadas al endpoint de sincronización:');
      networkEntries.forEach((entry, index) => {
        const status = entry.responseEnd - entry.responseStart > 0 ? '✅ OK' : '❌ Error';
        console.log(`   ${index + 1}. ${status} - ${entry.duration.toFixed(0)}ms - ${new Date(entry.startTime).toLocaleTimeString()}`);
      });
    } else {
      console.log('❌ No se encontraron llamadas recientes al endpoint de sincronización');
      console.log('💡 Esto podría indicar que el polling se detuvo o hay un error de red');
    }
  }
} catch (error) {
  console.error('❌ Error verificando red:', error);
}

// 3. Verificar errores de JavaScript
console.log('\n🐛 3. ERRORES DE JAVASCRIPT RECIENTES:');
try {
  // Acceder a las últimas entradas de la consola (limitado por Chrome)
  console.log('💡 Revisa la pestaña Console para errores relacionados con:');
  console.log('   - "calculateElapsedTime"');
  console.log('   - "RecordingControlGlobal"');
  console.log('   - "useEffect"');
  console.log('   - "localStorage"');
} catch (error) {
  console.error('❌ Error verificando errores:', error);
}

// 4. Función de monitoreo en tiempo real
console.log('\n📊 4. MONITOREO EN TIEMPO REAL:');
console.log('Ejecuta este código para monitorear cambios cada segundo:');

const monitorScript = `
// Monitoreo avanzado del temporizador
let monitorInterval = setInterval(() => {
  try {
    const saved = localStorage.getItem('recordingControlState');
    if (saved) {
      const parsed = JSON.parse(saved);
      const now = new Date();

      console.log(\`📊 \${now.toLocaleTimeString()} - Estado: \${parsed.recordingState} - Tiempo: \${parsed.elapsedTime}s\`);

      // Verificar si el tiempo está aumentando
      if (parsed.recordingState === 'recording' && window.lastElapsed !== undefined) {
        if (parsed.elapsedTime === window.lastElapsed) {
          console.warn('⚠️ ALERTA: El tiempo no está aumentando!');
        }
      }
      window.lastElapsed = parsed.elapsedTime;

    } else {
      console.log('📊 No hay estado guardado');
    }
  } catch (error) {
    console.error('Error en monitoreo:', error);
  }
}, 1000);

console.log('✅ Monitoreo iniciado. Ejecuta clearInterval(monitorInterval) para detener.');
`;

console.log('%c' + monitorScript, 'background: #f0f0f0; padding: 10px; border-radius: 5px;');

// 5. Diagnóstico del componente React
console.log('\n⚛️ 5. DIAGNÓSTICO DEL COMPONENTE REACT:');
const componentStatus = getRecordingControlComponent();
console.log(componentStatus);

// 6. Verificación de memoria y rendimiento
console.log('\n💾 6. VERIFICACIÓN DE MEMORIA:');
try {
  if (window.performance && window.performance.getEntriesByType) {
    const mem = window.performance.memory;
    console.log(\`📈 Memoria usada: \${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB\`);
    console.log(\`📈 Memoria total: \${(mem.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB\`);
    console.log(\`📈 Límite de memoria: \${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB\`);
  }
} catch (error) {
  console.log('💡 Información de memoria no disponible');
}

// 7. Instrucciones para resolver problemas comunes
console.log('\n🔧 7. POSIBLES SOLUCIONES:');
console.log('Si el temporizador está parado:');
console.log('   1. ✅ Verifica que hay grabaciones activas en el backend');
console.log('   2. ✅ Limpia localStorage: localStorage.removeItem("recordingControlState")');
console.log('   3. ✅ Recarga la página');
console.log('   4. ✅ Verifica que stateLoaded sea true en el componente');
console.log('   5. ✅ Revisa logs de error en la consola');

console.log('\n✅ Diagnóstico completado. Copia y pega el script de monitoreo para análisis en tiempo real.');