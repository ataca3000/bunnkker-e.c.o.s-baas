import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightCircle,
  Banknote,
  Box,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useOrderWorkflowReschedule,
  useOrderWorkflowTransition,
} from '@/features/orders/hooks/use-orders';
import type { Order, OrderLine } from '@/features/orders/types/order';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new:               'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  ready_for_dispatch: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  out_for_delivery:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
  delivered:         'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  awaiting_payment:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  awaiting_stock:    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  scheduled:         'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
  on_hold:           'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  cancelled:         'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  returned:          'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
};

// ── Icon map per target status ─────────────────────────────────────────────────

const TARGET_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  new:               RotateCcw,
  in_progress:       ArrowRightCircle,
  ready_for_dispatch: CheckCircle2,
  out_for_delivery:  Truck,
  delivered:         CheckCircle2,
  awaiting_payment:  Banknote,
  awaiting_stock:    Box,
  scheduled:         Clock,
  on_hold:           Activity,
  cancelled:         XCircle,
  returned:          RotateCcw,
};

// ── Helper: is preparation started? ──────────────────────────────────────────

function prepStarted(lines: OrderLine[] | undefined): boolean {
  if (!lines || lines.length === 0) return false;
  return lines.some((l) => (l.prepared_qty ?? 0) > 0);
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  order: Order;
  onSuccess?: () => void;
};

export function OrderWorkflowActionsPanel({ order, onSuccess }: Props) {
  const transition = useOrderWorkflowTransition();
  const reschedule = useOrderWorkflowReschedule();

  const today = new Date().toISOString().slice(0, 10);
  const [activeReason, setActiveReason]     = useState<string | null>(null);
  const [reasonText, setReasonText]         = useState('');
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(today);

  const transitions = order.allowed_status_transitions ?? [];
  const isPending   = transition.isPending || reschedule.isPending;
  const isTerminal  = ['delivered', 'cancelled', 'returned'].includes(order.status);

  function handleAction(targetStatus: string) {
    if (targetStatus === 'scheduled') {
      setShowReschedule(true);
      return;
    }
    const tr = transitions.find((t) => t.target_status === targetStatus);
    if (tr?.requires_reason && activeReason !== targetStatus) {
      setActiveReason(targetStatus);
      setReasonText('');
      return;
    }
    const reason = reasonText.trim() || undefined;
    const done   = () => { setActiveReason(null); setReasonText(''); onSuccess?.(); };
    transition.mutate({ id: order.id, targetStatus, reason }, { onSuccess: done });
  }

  function handleRescheduleConfirm() {
    if (!rescheduleDate) return;
    reschedule.mutate(
      { id: order.id, nextDeliveryDate: rescheduleDate },
      { onSuccess: () => { setShowReschedule(false); onSuccess?.(); } },
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Order Status
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? 'bg-muted text-muted-foreground'}`}
        >
          {order.status_label ?? order.status}
        </span>
      </div>

      {/* Actions */}
      <div className="p-3">
        {isTerminal ? (
          <p className="text-xs text-muted-foreground">
            This order is financially closed and cannot be modified.
          </p>
        ) : transitions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No workflow actions available. Use the Order Drawer for advanced actions.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {order.status === 'in_progress' && prepStarted(order.lines) && (
              <div className="mb-1 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-400">
                <AlertTriangle className="size-3 shrink-0" />
                Preparation in progress — cannot move back to New
              </div>
            )}

            {/* Reschedule date form */}
            {showReschedule && (
              <div className="flex flex-col gap-1.5 rounded-md border bg-muted/30 p-2">
                <label className="text-xs font-medium text-muted-foreground">New delivery date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={today}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 flex-1 text-xs"
                    disabled={!rescheduleDate || isPending}
                    onClick={handleRescheduleConfirm}
                  >
                    {isPending ? <Loader2 className="size-3 animate-spin" /> : 'Confirm'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => setShowReschedule(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {transitions.map((tr, idx) => {
              const Icon    = TARGET_ICON[tr.target_status] ?? ArrowRightCircle;
              const variant = tr.target_status === 'cancelled' ? 'destructive'
                            : idx === 0                        ? 'default'
                            : 'outline';
              const isActive = activeReason === tr.target_status;
              return (
                <div key={tr.target_status}>
                  <Button
                    type="button"
                    variant={variant as 'default' | 'outline' | 'destructive'}
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    disabled={isPending || showReschedule}
                    onClick={() => {
                      if (isActive) { setActiveReason(null); setReasonText(''); }
                      else { handleAction(tr.target_status); }
                    }}
                  >
                    {isPending && activeReason === tr.target_status
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Icon className="size-3.5" />
                    }
                    {tr.label}
                  </Button>

                  {/* Inline reason input */}
                  {isActive && tr.requires_reason && (
                    <div className="mt-1.5 flex flex-col gap-1.5 rounded-md border bg-muted/30 p-2">
                      <Input
                        autoFocus
                        placeholder="Enter reason…"
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAction(tr.target_status);
                          if (e.key === 'Escape') { setActiveReason(null); setReasonText(''); }
                        }}
                      />
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={variant as 'default' | 'outline' | 'destructive'}
                          className="h-6 flex-1 text-xs"
                          disabled={isPending}
                          onClick={() => handleAction(tr.target_status)}
                        >
                          {isPending ? <Loader2 className="size-3 animate-spin" /> : 'Confirm'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => { setActiveReason(null); setReasonText(''); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
