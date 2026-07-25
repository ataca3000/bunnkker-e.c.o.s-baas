/**
 * toast.ts — Sistema de notificaciones global
 * Funciona desde contextos, componentes, y funciones utilitarias.
 * Usa window.dispatchEvent para no requerir hooks ni providers.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastPayload {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // ms — default: 4000
  title?: string;
}

const TOAST_EVENT = 'erp:toast';

function emit(payload: Omit<ToastPayload, 'id'>) {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent<ToastPayload>(TOAST_EVENT, {
    detail: { ...payload, id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
  });
  window.dispatchEvent(event);
}

export const toast = {
  success: (message: string, title?: string, duration?: number) =>
    emit({ type: 'success', message, title, duration }),
  error: (message: string, title?: string, duration?: number) =>
    emit({ type: 'error', message, title, duration: duration ?? 6000 }),
  warning: (message: string, title?: string, duration?: number) =>
    emit({ type: 'warning', message, title, duration }),
  info: (message: string, title?: string, duration?: number) =>
    emit({ type: 'info', message, title, duration }),
};

export const TOAST_EVENT_KEY = TOAST_EVENT;
