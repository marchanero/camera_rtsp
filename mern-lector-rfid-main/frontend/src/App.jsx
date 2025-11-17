import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { ThemeProvider, useTheme } from './ThemeContext';

const socket = io('http://localhost:3001');

function AppContent() {
  const [tags, setTags] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 8; // Tarjetas por página (ajustable)
  const [newTagPopup, setNewTagPopup] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    // Conectar Socket.IO
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Cargar tags iniciales
    fetchTags();

    // Escuchar eventos de Socket.IO
    socket.on('rfid-detected', (data) => {
      console.log('Nueva detección RFID:', data);
      // Actualizar o agregar la tarjeta en la lista
      setTags(prevTags => {
        const existingIndex = prevTags.findIndex(tag => tag.tagId === data.tagId);
        if (existingIndex >= 0) {
          // Mover la tarjeta existente al principio con timestamp actualizado
          const existingTag = prevTags[existingIndex];
          const updatedTag = {
            ...existingTag,
            timestamp: data.timestamp,
            user: data.user // Actualizar información del usuario si cambió
          };
          const newTags = [...prevTags];
          newTags.splice(existingIndex, 1); // Remover del lugar actual
          return [updatedTag, ...newTags]; // Agregar al principio
        } else {
          // Agregar nueva tarjeta al principio
          return [{
            id: Date.now(), // ID temporal para el frontend
            tagId: data.tagId,
            timestamp: data.timestamp,
            user: data.user
          }, ...prevTags];
        }
      });
      showNewTagPopup(data);
    });

    // Escuchar cuando se asigna/desasigna una tarjeta a un usuario
    socket.on('tag-assigned', (data) => {
      console.log('Tarjeta asignada/desasignada:', data);
      setTags(prevTags => {
        return prevTags.map(tag => {
          if (tag.tagId === data.tagId) {
            return {
              ...tag,
              user: data.user // Actualizar información del usuario (null si se desasigna)
            };
          }
          return tag;
        });
      });
    });

    socket.on('tag_removed', (data) => {
      console.log('Tag removido:', data.tagId);
    });

    return () => {
      socket.off('rfid-detected');
      socket.off('tag-assigned');
      socket.off('tag_removed');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  const fetchTags = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/tags');
      const data = await response.json();
      setTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const showNewTagPopup = (tag) => {
    setNewTagPopup(tag);
    setTimeout(() => setNewTagPopup(null), 4000);
  };

  const handleTestCard = async () => {
    const tagId = `test-${Date.now()}`;
    try {
      const response = await fetch('http://localhost:3001/api/test-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });
      const data = await response.json();
      if (data.success) {
        console.log('Tarjeta de prueba creada');
      }
    } catch (error) {
      console.error('Error creando tarjeta de prueba:', error);
    }
  };

  // Calcular paginación para las tarjetas (excepto la primera)
  const paginatedTags = tags.length > 1
    ? tags.slice(1, 1 + pageSize * page)
    : [];
  const totalPages = tags.length > 1 ? Math.ceil((tags.length - 1) / pageSize) : 1;

  return (
    <div className="main-layout">
      {/* Contenido Principal */}
      <main className="main-content">
        <div className="space-y-6">
          {/* Barra de acciones */}
          <div className="action-bar">
            <div className="flex gap-3">
              <button
                onClick={handleTestCard}
                className="test-button"
                aria-label="Crear tarjeta de prueba para desarrollo"
              >
                🧪 Crear Tarjeta de Prueba
              </button>
            </div>

            <div className="total-counter">
              Total: <span className="total-number">{tags.length}</span> tarjetas
            </div>
          </div>

          {/* Sección de tags */}
          <section className="space-y-6">
            <h2 className="section-title">Historial de Detecciones</h2>

            {/* Visualización personalizada: primera tarjeta destacada, resto en cuadrícula paginada */}
            {tags.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎯</div>
                <h3 className="empty-title">Esperando detección de tarjetas</h3>
                <p className="empty-description">
                  Conecta tu lector RFID y comienza a detectar tarjetas. Las detecciones aparecerán aquí automáticamente.
                </p>
              </div>
            ) : (
              <>
                {/* Sección: Última detección */}
                <div className="section-header">
                  <h3 className="section-title-small">🕐 Última Detección</h3>
                  <div className="section-divider"></div>
                </div>

                {/* Primera tarjeta destacada en una fila separada */}
                <div className="featured-tag-container">
                  <div
                    key={tags[0].id}
                    className="tag-card-modern animate-bounce-in featured-tag"
                    role="listitem"
                    aria-label={`Tarjeta RFID ${tags[0].tagId} detectada el ${new Date(tags[0].timestamp).toLocaleString()}`}
                  >
                    <div className="tag-icon" aria-hidden="true">
                      🎴
                    </div>
                    <div className="tag-info">
                      <div
                        className="tag-id-modern"
                        aria-label={`ID de la tarjeta: ${tags[0].tagId}`}
                      >
                        {tags[0].tagId}
                      </div>
                      <div
                        className="tag-time-modern"
                        aria-label={`Fecha de detección: ${new Date(tags[0].timestamp).toLocaleString()}`}
                      >
                        {new Date(tags[0].timestamp).toLocaleString()}
                      </div>
                      {tags[0].user && (
                        <div className="user-assignment-badge">
                          <div className="user-assignment-icon">👤</div>
                          <div className="user-assignment-info">
                            <span className="user-assignment-label">Asignada a</span>
                            <span className="user-assignment-name">{tags[0].user.name}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sección: Historial anterior */}
                {tags.length > 1 && (
                  <>
                    <div className="section-header">
                      <h3 className="section-title-small">📚 Historial Anterior</h3>
                      <div className="section-divider"></div>
                    </div>

                    <div className="history-grid-container">
                      <div className="tags-grid" role="list" aria-label="Lista de tarjetas RFID detectadas">
                        {paginatedTags.map((tag, index) => (
                          <div
                            key={tag.id}
                            className="tag-card-modern"
                            role="listitem"
                            aria-label={`Tarjeta RFID ${tag.tagId} detectada el ${new Date(tag.timestamp).toLocaleString()}`}
                          >
                            <div className="tag-icon" aria-hidden="true">
                              🎴
                            </div>
                            <div className="tag-info">
                              <div
                                className="tag-id-modern"
                                aria-label={`ID de la tarjeta: ${tag.tagId}`}
                              >
                                {tag.tagId}
                              </div>
                              <div
                                className="tag-time-modern"
                                aria-label={`Fecha de detección: ${new Date(tag.timestamp).toLocaleString()}`}
                              >
                                {new Date(tag.timestamp).toLocaleString()}
                              </div>
                              {tag.user && (
                                <div className="user-assignment-badge">
                                  <div className="user-assignment-icon">👤</div>
                                  <div className="user-assignment-info">
                                    <span className="user-assignment-label">Asignada a</span>
                                    <span className="user-assignment-name">{tag.user.name}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Controles de paginación */}
                    <div className="flex justify-center items-center gap-4 mt-6">
                      <button
                        className="test-button"
                        onClick={() => setPage(page > 1 ? page - 1 : 1)}
                        disabled={page === 1}
                        aria-label="Página anterior"
                      >
                        ← Anterior
                      </button>
                      <span className="font-semibold text-base">
                        Página {page} de {totalPages}
                      </span>
                      <button
                        className="test-button"
                        onClick={() => setPage(page < totalPages ? page + 1 : totalPages)}
                        disabled={page === totalPages}
                        aria-label="Página siguiente"
                      >
                        Siguiente →
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {/* Popup de nueva tarjeta */}
      {newTagPopup && (
        <div
          className="popup-overlay"
          role="dialog"
          aria-labelledby="new-tag-title"
          aria-describedby="new-tag-description"
          onClick={() => setNewTagPopup(null)}
        >
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <div className="popup-icon" aria-hidden="true">
              🎉
            </div>
            <h2 id="new-tag-title" className="popup-title">
              ¡Nueva Tarjeta Detectada!
            </h2>
            <div
              id="new-tag-description"
              className="popup-tag-id"
              aria-label={`Nueva tarjeta detectada con ID: ${newTagPopup.tagId}`}
            >
              {newTagPopup.tagId}
            </div>
            <div className="popup-time">
              {new Date(newTagPopup.timestamp).toLocaleString()}
            </div>
            {newTagPopup.user && (
              <div className="user-assignment-badge-popup">
                <div className="user-assignment-icon">👤</div>
                <div className="user-assignment-info">
                  <span className="user-assignment-label">Asignada a</span>
                  <span className="user-assignment-name">{newTagPopup.user.name}</span>
                </div>
              </div>
            )}
            <button
              onClick={() => setNewTagPopup(null)}
              className="popup-close-button"
              aria-label="Cerrar notificación"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;