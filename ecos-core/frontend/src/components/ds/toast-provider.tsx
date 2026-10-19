import { useEffect } from 'react';
import { CheckCircle, Info, TriangleAlert, XCircle, X } from 'lucide-react';

import { useToastStore, type Toast } from '@/components/ds/use-toast';
import { cn } from '@/lib/utils';

const DEFAULT_DURATION = 4500;

const ICON_MAP = {
  success: CheckCircle,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
} as const;

const COLOR_MAP = {
  success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60',
  error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/60',
  warning: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/60',
  info: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/60',
} as const;

const ICON_COLOR_MAP = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-600 dark:text-blue-400',
} as const;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = ICON_MAP[toast.type];

  useEffect(() => {
    const timer = setTimeout(
      () => dismiss(toast.id),
      toast.durationMs ?? DEFAULT_DURATION,
    );
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex w-80 items-start gap-3 rounded-lg border p-3.5 shadow-lg',
        'animate-in slide-in-from-bottom-2 fade-in duration-200',
        COLOR_MAP[toast.type],
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', ICON_COLOR_MAP[toast.type])} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
        ) : null}
      </div>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
        className="shrink-0 rounded-sm p-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** Drop this once inside AppProviders — renders toasts in the bottom-end corner. */
export function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 end-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
