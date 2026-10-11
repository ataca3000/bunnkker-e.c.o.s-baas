import React from 'react';

/**
 * Script en línea ejecutado en el <head> previo a la hidratación para evitar
 * el parpadeo de color blanco/negro (FOUC).
 * Lee 'bunkker_theme' o 'theme' de localStorage y aplica o remueve la clase 'dark'
 * directamente en document.documentElement.
 */
export function ThemeScript() {
  const scriptContent = `
    (function() {
      try {
        var storageKey = 'bunkker_theme';
        var fallbackKey = 'theme';
        var saved = localStorage.getItem(storageKey) || localStorage.getItem(fallbackKey);
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        var isDark = true; // Por defecto oscuro para BUNKKER E.C.O.S.
        if (saved === 'light') {
          isDark = false;
        } else if (saved === 'dark') {
          isDark = true;
        } else if (saved === 'system') {
          isDark = prefersDark;
        }
        
        var root = document.documentElement;
        if (isDark) {
          root.classList.add('dark');
          root.classList.remove('light');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.classList.add('light');
          root.style.colorScheme = 'light';
        }
      } catch (e) {}
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: scriptContent }}
      suppressHydrationWarning
    />
  );
}
