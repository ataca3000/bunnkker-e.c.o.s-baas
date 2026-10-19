import type { OrderStatus } from '@/features/orders/types/order';
import { useOrderStatusLabels } from '@/features/orders/hooks/use-order-labels';
import { cn } from '@/lib/utils';

const STATUS_CLASS: Record<OrderStatus, string> = {
  // ── Primary Flow ──────────────────────────────────────────────────────────
  new:               'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress:       'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready_for_dispatch: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  out_for_delivery:  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered:         'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  // ── Exception States ──────────────────────────────────────────────────────
  awaiting_payment:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  awaiting_stock:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  scheduled:         'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  on_hold:           'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  // ── Terminal ──────────────────────────────────────────────────────────────
  cancelled:         'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  returned:          'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

type OrderStatusBadgeProps = {
  status: OrderStatus;
  /** If provided, renders as a clickable button for quick status change (DD-013). */
  onClick?: () => void;
};

export function OrderStatusBadge({ status, onClick }: OrderStatusBadgeProps) {
  const { statusLabel } = useOrderStatusLabels();
  const cls = STATUS_CLASS[status] ?? STATUS_CLASS.new;
  const label = statusLabel[status];

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex cursor-pointer items-center rounded-full px-2 py-0.5 text-xs font-medium',
          'ring-1 ring-inset ring-current/20 transition-opacity hover:opacity-80',
          cls,
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        'ring-1 ring-inset ring-current/20',
        cls,
      )}
    >
      {label}
    </span>
  );
}
