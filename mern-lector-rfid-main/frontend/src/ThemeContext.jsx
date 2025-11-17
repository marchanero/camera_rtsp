import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Leer el tema del localStorage inmediatamente para evitar flash
  const getInitialTheme = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  };

  const [isDarkMode, setIsDarkMode] = useState(getInitialTheme);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  // Aplicar el tema inmediatamente al montar el componente
  useEffect(() => {
    const initialTheme = getInitialTheme();
    setIsDarkMode(initialTheme);

    // Prevenir flash aplicando la clase inmediatamente
    document.documentElement.classList.add('theme-transition-prevent');

    // Aplicar la clase del tema
    if (initialTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Pequeño delay para permitir que se aplique el tema antes de habilitar transiciones
    const timer = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition-prevent');
      document.documentElement.classList.add('theme-loaded');
      setIsThemeLoaded(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // Guardar cambios en localStorage y aplicar clase
  useEffect(() => {
    if (isThemeLoaded) {
      localStorage.setItem('darkMode', JSON.stringify(isDarkMode));

      // Usar requestAnimationFrame para transiciones suaves
      requestAnimationFrame(() => {
        if (isDarkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      });
    }
  }, [isDarkMode, isThemeLoaded]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};;