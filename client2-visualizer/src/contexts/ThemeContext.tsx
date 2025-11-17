// contexts/themeContext.ts
import React, { createContext, useEffect, useState } from 'react';
import type { ThemeContextType } from '../types';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Always start with light theme for debugging
    return 'light';
  });

  // Apply theme immediately when component mounts
  useEffect(() => {
    console.log('🎨 ThemeProvider mounted - applying initial theme:', theme);
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]); // Include theme dependency

  useEffect(() => {
    console.log('🎨 ThemeContext useEffect ejecutándose - tema actual:', theme);
    const root = window.document.documentElement;

    console.log('📋 Clases ANTES:', root.className);

    // Remove both classes first
    root.classList.remove('light', 'dark');

    // Add the current theme class
    root.classList.add(theme);

    console.log('📋 Clases DESPUÉS:', root.className);

    // Save to localStorage
    localStorage.setItem('theme', theme);
    console.log('💾 Guardado en localStorage:', theme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#1f2937' : '#ffffff');
    }
  }, [theme]);

  // Listen for system theme changes
  // Commented out for debugging
  /*
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if no manual preference is saved
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  */

  const toggleTheme = () => {
    console.log('🔄 toggleTheme llamado - tema actual:', theme);
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      console.log('➡️ Cambiando tema de', prevTheme, 'a', newTheme);
      return newTheme;
    });
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};