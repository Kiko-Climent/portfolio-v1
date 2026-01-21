'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext();

export function DarkModeProvider({ children }) {
  // Inicializar el estado desde localStorage o desde la clase existente en el HTML
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      // Primero verificar si hay un valor guardado en localStorage
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        return saved === 'true';
      }
      // Si no, verificar si el HTML ya tiene la clase dark
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    // Aplicar o remover la clase dark del html inmediatamente
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = 'black';
      document.body.style.color = 'white';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = 'white';
      document.body.style.color = 'black';
    }
    // Guardar la preferencia en localStorage
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within DarkModeProvider');
  }
  return context;
}

