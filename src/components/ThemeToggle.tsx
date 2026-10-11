"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme, type Theme } from '@/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'compact' | 'segmented' | 'menu';
}

export function ThemeToggle({
  className = '',
  showLabel = false,
  variant = 'compact'
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme, isMounted } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer click afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Si no está montado aún en cliente, mostrar un placeholder visual estable
  if (!isMounted) {
    return (
      <div className={`inline-flex items-center justify-center p-2 rounded-xl border border-white/10 bg-white/5 opacity-70 w-9 h-9 ${className}`}>
        <Moon className="w-4 h-4 text-zinc-400" />
      </div>
    );
  }

  // Variante Segmentada (Píldoras para configuración o paneles)
  if (variant === 'segmented') {
    return (
      <div className={`inline-flex items-center p-1 rounded-xl bg-black/20 dark:bg-black/40 border border-black/10 dark:border-white/10 backdrop-blur-md ${className}`}>
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            theme === 'light'
              ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
          title="Modo Claro"
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Claro</span>
        </button>

        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            theme === 'dark'
              ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
          title="Modo Oscuro"
        >
          <Moon className="w-3.5 h-3.5 text-cyan-400" />
          <span>Oscuro</span>
        </button>

        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            theme === 'system'
              ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-black/5 dark:border-white/10'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
          title="Automático del Sistema"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Auto</span>
        </button>
      </div>
    );
  }

  // Variante Menú desplegable
  if (variant === 'menu') {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 text-zinc-800 dark:text-zinc-200 transition-colors shadow-sm"
          title="Seleccionar tema"
          aria-expanded={isOpen}
        >
          {resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-cyan-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
          <span>{theme === 'system' ? 'Tema: Auto' : theme === 'dark' ? 'Tema: Oscuro' : 'Tema: Claro'}</span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-44 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-1.5 z-50 backdrop-blur-xl"
            >
              <button
                onClick={() => { setTheme('light'); setIsOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  theme === 'light'
                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Modo Claro</span>
                </div>
                {theme === 'light' && <Check className="w-3.5 h-3.5 text-amber-500" />}
              </button>

              <button
                onClick={() => { setTheme('dark'); setIsOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  theme === 'dark'
                    ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-cyan-400" />
                  <span>Modo Oscuro</span>
                </div>
                {theme === 'dark' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>

              <button
                onClick={() => { setTheme('system'); setIsOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  theme === 'system'
                    ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-zinc-400" />
                  <span>Automático</span>
                </div>
                {theme === 'system' && <Check className="w-3.5 h-3.5 text-blue-500" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Variante Compacta (Botón rápido con animación fluida de rotación y brillo)
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all duration-300 border focus:outline-none focus:ring-2 focus:ring-cyan-500/40 active:scale-95 group ${
        isDark
          ? 'bg-zinc-900/80 hover:bg-zinc-800 text-cyan-400 border-zinc-700/60 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:border-cyan-500/40'
          : 'bg-white hover:bg-amber-50/50 text-amber-600 border-zinc-300 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:border-amber-400'
      } ${className}`}
      title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
      aria-label={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
    >
      <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
        <motion.div
          key={isDark ? 'moon' : 'sun'}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 20 }}
          className="flex items-center justify-center"
        >
          {isDark ? (
            <Moon className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          )}
        </motion.div>
      </div>

      {showLabel && (
        <span className="ml-2 text-xs font-bold tracking-wide">
          {isDark ? 'Modo Oscuro' : 'Modo Claro'}
        </span>
      )}
    </button>
  );
}

export default ThemeToggle;
