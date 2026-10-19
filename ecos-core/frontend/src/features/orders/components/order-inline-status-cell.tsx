import { useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useOrderWorkflowTransition } from '@/features/orders/hooks/use-orders';
import type { Order, OrderStatus } from '@/features/orders/types/order';

const STATUS_CLASS: Record<string, string> = {
  scheduled:        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  pending:          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  awaiting_payment: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  processing:       'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  awaiting_stock:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  confirmed:        'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  preparing:        'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  out_for_delivery: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered:        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed:        'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled:        'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  review:           'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  rescheduled:      'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  returned:         'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

type Props = {
  order: Order;
  onSuccess?: () => void;
};

export function OrderInlineStatusCell({ order, onSuccess }: Props) {
  const { t } = useTranslation('orders');
  const [open, setOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const transition = useOrderWorkflowTransition();

  const statusLabel: Record<string, string> = {
    scheduled:        t($ => $.status.scheduled),
    pending:          t($ => $.status.pending),
    awaiting_payment: t($ => $.status.awaiting_payment),
    processing:       t($ => $.status.processing),
    awaiting_stock:   t($ => $.status.awaiting_stock),
    confirmed:        t($ => $.status.confirmed),
    preparing:        t($ => $.status.preparing),
    out_for_delivery: t($ => $.status.out_for_delivery),
    delivered:        t($ => $.status.delivered),
    completed:        t($ => $.status.completed),
    cancelled:        t($ => $.status.cancelled),
    review:           t($ => $.status.review),
    rescheduled:      t($ => $.status.rescheduled),
    returned:         t($ => $.status.returned),
  };

  const transitions = order.allowed_status_transitions ?? [];
  const cls   = STATUS_CLASS[order.status] ?? STATUS_CLASS.pending;
  const label = statusLabel[order.status] ?? order.status_label ?? order.status;

  function handleSelect(targetStatus: string) {
    setOpen(false);
    setSaveState('saving');
    transition.mutate(
      { id: order.id, targetStatus },
      {
        onSuccess: () => {
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2000);
          onSuccess?.();
        },
        onError: () => {
          setSaveState('failed');
          setTimeout(() => setSaveState('idle'), 2000);
        },
      },
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={saveState === 'saving' || transitions.length === 0}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            'ring-1 ring-inset ring-current/20 transition-opacity hover:opacity-80',
            'disabled:cursor-default disabled:opacity-100',
            cls,
          )}
          aria-label={`Status: ${label}. Click to change`}
        >
          {saveState === 'saving' && <Loader2 className="size-2.5 animate-spin" />}
          {saveState === 'saved'  && <Check   className="size-2.5 text-emerald-600" />}
          {saveState === 'failed' && <X       className="size-2.5 text-red-600" />}
          {label}
          {transitions.length > 0 && <ChevronDown className="size-2.5 opacity-60" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 max-h-72 overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t($ => $.statusSelector.moveTo)}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {transitions.length === 0 ? (
          <DropdownMenuItem disabled>{t($ => $.statusSelector.noTransitions)}</DropdownMenuItem>
        ) : (
          transitions.map((tr) => (
            <DropdownMenuItem key={tr.target_status} onClick={() => handleSelect(tr.target_status)}>
              <span
                className={cn(
                  'mr-2 inline-flex size-2 shrink-0 rounded-full',
                  (STATUS_CLASS[tr.target_status as OrderStatus] ?? '').split(' ')[0],
                )}
              />
              {statusLabel[tr.target_status as OrderStatus] ?? tr.label}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
