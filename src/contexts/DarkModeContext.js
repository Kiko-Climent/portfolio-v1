'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext();

export function DarkModeProvider({ children }) {
  // Estado inicial determinista para evitar hydration mismatch (SSR/cliente).
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  useEffect(() => {
    // Cargar preferencia solo si el usuario ya la cambió explícitamente.
    const saved = localStorage.getItem('darkMode');
    const hasUserPreference = localStorage.getItem('hasUserThemePreference') === 'true';

    if (hasUserPreference && saved !== null) {
      setIsDarkMode(saved === 'true');
    } else {
      // Default estable: siempre arrancar en light mode.
      setIsDarkMode(false);
      localStorage.setItem('darkMode', 'false');
    }
    setIsThemeLoaded(true);
  }, []);

  useEffect(() => {
    if (!isThemeLoaded) return;

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
  }, [isDarkMode, isThemeLoaded]);

  const toggleDarkMode = () => {
    localStorage.setItem('hasUserThemePreference', 'true');
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

