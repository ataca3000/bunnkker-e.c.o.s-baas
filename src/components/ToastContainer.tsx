"use client";

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { TOAST_EVENT_KEY, type ToastPayload } from '@/lib/toast';

const ICONS = {
  success: <CheckCircle2 size={20} className="shrink-0" />,
  error:   <AlertCircle  size={20} className="shrink-0" />,
  warning: <AlertTriangle size={20} className="shrink-0" />,
  info:    <Info          size={20} className="shrink-0" />,
};

const STYLES = {
  success: {
    bg:     'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
    icon:   '#10b981',
    title:  '#6ee7b7',
  },
  error: {
    bg:     'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.35)',
    icon:   '#ef4444',
    title:  '#fca5a5',
  },
  warning: {
    bg:     'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
    icon:   '#f59e0b',
    title:  '#fcd34d',
  },
  info: {
    bg:     'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.35)',
    icon:   '#38bdf8',
    title:  '#7dd3fc',
  },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<ToastPayload>).detail;
      setToasts(prev => [...prev.slice(-4), payload]); // máximo 5 toasts visibles
      const duration = payload.duration ?? 4000;
      setTimeout(() => remove(payload.id), duration);
    };

    window.addEventListener(TOAST_EVENT_KEY, handler);
    return () => window.removeEventListener(TOAST_EVENT_KEY, handler);
  }, [remove]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '420px',
        width: 'calc(100vw - 48px)',
        pointerEvents: 'none',
      }}
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => {
          const s = STYLES[toast.type];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={{   opacity: 0, y: 16,  scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderRadius: '16px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${s.border}`,
                pointerEvents: 'all',
                cursor: 'default',
              }}
              role="alert"
            >
              {/* Icono */}
              <span style={{ color: s.icon, marginTop: '1px' }}>
                {ICONS[toast.type]}
              </span>

              {/* Texto */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {toast.title && (
                  <p style={{
                    color: s.title,
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '3px',
                  }}>
                    {toast.title}
                  </p>
                )}
                <p style={{
                  color: 'rgba(248,250,252,0.92)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-line', // respeta \n
                }}>
                  {toast.message}
                </p>
              </div>

              {/* Botón cerrar */}
              <button
                onClick={() => remove(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(148,163,184,0.7)',
                  cursor: 'pointer',
                  padding: '2px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  marginTop: '1px',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(248,250,252,0.9)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,163,184,0.7)')}
                aria-label="Cerrar notificación"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
