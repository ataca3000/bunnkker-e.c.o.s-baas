"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isMounted: boolean;
}

const STORAGE_KEY = 'bunkker_theme';
const FALLBACK_KEY = 'theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [isMounted, setIsMounted] = useState(false);

  // Determinar si el sistema prefiere modo oscuro
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Aplicar la clase 'dark' a nivel de raíz (document.documentElement)
  const applyThemeToDOM = useCallback((newResolved: 'light' | 'dark') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (newResolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }
  }, []);

  // Inicialización al montar en cliente
  useEffect(() => {
    setIsMounted(true);
    let initialTheme: Theme = 'dark';
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(FALLBACK_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        initialTheme = stored as Theme;
      }
    } catch (e) {
      console.warn('No se pudo acceder a localStorage para el tema:', e);
    }

    setThemeState(initialTheme);
    const resolved = initialTheme === 'system' ? getSystemTheme() : initialTheme;
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);
  }, [getSystemTheme, applyThemeToDOM]);

  // Actualizar tema explícitamente y persistir en localStorage
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
      localStorage.setItem(FALLBACK_KEY, newTheme);
    } catch (e) {
      console.warn('Error al guardar tema en localStorage:', e);
    }

    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);

    // Disparar evento personalizado para sincronizar otras instancias
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bunkker-theme-change', { detail: { theme: newTheme, resolved } }));
    }
  }, [getSystemTheme, applyThemeToDOM]);

  // Alternar rápidamente entre claro y oscuro
  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  // Escuchar cambios de preferencia del sistema si el modo es 'system'
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const nextResolved = e.matches ? 'dark' : 'light';
        setResolvedTheme(nextResolved);
        applyThemeToDOM(nextResolved);
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, [theme, applyThemeToDOM]);

  // Escuchar eventos de storage (cambio en otras pestañas)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === FALLBACK_KEY) {
        const newTheme = (e.newValue as Theme) || 'dark';
        if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
          setThemeState(newTheme);
          const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
          setResolvedTheme(resolved);
          applyThemeToDOM(resolved);
        }
      }
    };

    const handleCustomEvent = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.theme) {
        setThemeState(custom.detail.theme);
        setResolvedTheme(custom.detail.resolved);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('bunkker-theme-change', handleCustomEvent);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bunkker-theme-change', handleCustomEvent);
    };
  }, [getSystemTheme, applyThemeToDOM]);

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isMounted
  }), [theme, resolvedTheme, setTheme, toggleTheme, isMounted]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser utilizado dentro de un ThemeProvider');
  }
  return context;
}
