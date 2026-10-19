import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
};

// Accepts both the ECOS format ({ type, title }) and the legacy shadcn/ui format
// ({ title, variant }) so that existing call sites don't need to be migrated en-masse.
type ToastInput = Omit<Toast, 'id' | 'type'> & {
  type?: ToastType;
  /** @deprecated Use `type: 'error'` instead of `variant: 'destructive'` */
  variant?: 'default' | 'destructive';
};

type ToastStore = {
  toasts: Toast[];
  toast: (t: ToastInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

let counter = 0;
function uid() {
  return `toast-${++counter}-${Date.now()}`;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  toast(t) {
    const id = uid();
    const { variant, type, ...rest } = t;
    const resolvedType: ToastType = type ?? (variant === 'destructive' ? 'error' : 'info');
    set((s) => ({ toasts: [...s.toasts, { ...rest, type: resolvedType, id }] }));
    return id;
  },

  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  dismissAll() {
    set({ toasts: [] });
  },
}));

/** Convenience hook for dispatching toasts anywhere in the tree. */
export function useToast() {
  const { toast, dismiss, dismissAll } = useToastStore();
  return {
    toast,
    dismiss,
    dismissAll,
    success: (title: string, description?: string) =>
      toast({ type: 'success', title, description }),
    error: (title: string, description?: string) =>
      toast({ type: 'error', title, description }),
    warning: (title: string, description?: string) =>
      toast({ type: 'warning', title, description }),
    info: (title: string, description?: string) =>
      toast({ type: 'info', title, description }),
  };
}

/**
 * Imperative toast helper — safe to call from TanStack Query mutation callbacks,
 * async functions, and anywhere outside React's render phase.
 * Uses Zustand's getState() instead of a React hook so it adds no hooks to the chain.
 */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().toast({ type: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().toast({ type: 'error', title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().toast({ type: 'warning', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().toast({ type: 'info', title, description }),
};
