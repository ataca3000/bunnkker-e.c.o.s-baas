'use client';

import { useEffect } from 'react';

/**
 * AntiDevTools — Bloqueo activo de F12, combinaciones de Inspector y clic derecho
 * para terminales de mostrador, catálogo y pantallas operativas.
 */
export default function AntiDevTools() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toUpperCase();
      const isF12 = e.key === 'F12' || e.keyCode === 123;
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isDevShortcut =
        isCtrlOrMeta &&
        e.shiftKey &&
        (key === 'I' || key === 'J' || key === 'C' || key === 'K');
      const isViewSource = isCtrlOrMeta && key === 'U';

      if (isF12 || isDevShortcut || isViewSource) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      // Permitir copiar/pegar básico solo dentro de inputs de texto si es necesario, o bloquear menú de inspección
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, []);

  return null;
}
