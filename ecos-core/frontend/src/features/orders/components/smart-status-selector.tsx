/**
 * SmartStatusSelector — fully decoupled from workflow implementation details.
 *
 * Architecture (TASK-ORDER-WORKFLOW-STATUS-API-REFINEMENT-001):
 *   - Displays current status from order.current_status_label (API field)
 *   - Allowed transitions come exclusively from order.allowed_status_transitions (API field)
 *   - Uses target_status as the Select item value (business state, not workflow key)
 *   - Calls a single generic /transition endpoint — never hardcodes workflow names
 *   - The backend (FulfillmentEngine) is the sole authority for state transitions
 */

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useOrderWorkflowTransition } from '@/features/orders/hooks/use-orders';
import { useOrderStatusLabels } from '@/features/orders/hooks/use-order-labels';
import type { Order } from '@/features/orders/types/order';

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusTransition = Order['allowed_status_transitions'][number];

// ── Status colour map (display-only; never drives business logic) ─────────────

const STATUS_COLOR: Record<string, string> = {
  pending:          'text-slate-600 dark:text-slate-400',
  awaiting_payment: 'text-yellow-600 dark:text-yellow-400',
  processing:       'text-blue-600 dark:text-blue-400',
  awaiting_stock:   'text-orange-600 dark:text-orange-400',
  confirmed:        'text-emerald-600 dark:text-emerald-400',
  preparing:        'text-violet-600 dark:text-violet-400',
  out_for_delivery: 'text-cyan-600 dark:text-cyan-400',
  delivered:        'text-teal-600 dark:text-teal-400',
  completed:        'text-green-600 dark:text-green-400',
  cancelled:        'text-red-600 dark:text-red-400',
  review:           'text-amber-600 dark:text-amber-400',
  rescheduled:      'text-indigo-600 dark:text-indigo-400',
  returned:         'text-rose-600 dark:text-rose-400',
};

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  order: Order;
  onSuccess?: () => void;
};

export function SmartStatusSelector({ order, onSuccess }: Props) {
  const { t } = useTranslation('orders');
  const { statusLabel } = useOrderStatusLabels();
  const transition = useOrderWorkflowTransition();
  const [pending, setPending] = useState<StatusTransition | null>(null);
  const [reason, setReason] = useState('');

  // Defensive: field absent on legacy API responses before this task
  const transitions: StatusTransition[] = order.allowed_status_transitions ?? [];
  const hasTransitions = transitions.length > 0;

  const currentStatus      = order.current_status ?? order.status;
  const currentStatusLabel = statusLabel[currentStatus as keyof typeof statusLabel] ?? order.current_status_label ?? order.status;
  const currentColor       = STATUS_COLOR[currentStatus] ?? 'text-foreground';

  function handleSelect(targetStatus: string) {
    const t = transitions.find((tr) => tr.target_status === targetStatus);
    if (t) { setPending(t); setReason(''); }
  }

  function handleConfirm() {
    if (!pending || transition.isPending) return;
    transition.mutate(
      { id: order.id, targetStatus: pending.target_status, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setPending(null);
          setReason('');
          onSuccess?.();
        },
      },
    );
  }

  function handleCancel() {
    setPending(null);
    setReason('');
  }

  // ── Select ─────────────────────────────────────────────────────────────────
  // value={currentStatus} so the disabled current-status SelectItem is matched by Radix
  // and receives the checkmark. Transition items use target_status as value.
  // We render the status label directly as a child of SelectTrigger — bypassing
  // SelectValue's "nothing matches empty string" blank-trigger behaviour.

  const selectEl = (
    <Select
      value={currentStatus}
      onValueChange={handleSelect}
      disabled={!hasTransitions || transition.isPending}
    >
      <SelectTrigger className="h-9 text-sm">
        <span className={cn('flex-1 truncate font-medium', currentColor)}>
          {currentStatusLabel}
        </span>
      </SelectTrigger>

      <SelectContent>
        {/* ── Current Status group ─────────────────────────────────────────── */}
        <SelectGroup>
          <SelectLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t($ => $.statusSelector.currentStatus)}
          </SelectLabel>
          <SelectItem
            value={currentStatus}
            disabled
            className={cn('font-semibold', currentColor)}
          >
            {currentStatusLabel}
          </SelectItem>
        </SelectGroup>

        <SelectSeparator />

        {/* ── Available transitions group ──────────────────────────────────── */}
        {hasTransitions ? (
          <SelectGroup>
            <SelectLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t($ => $.statusSelector.moveTo)}
            </SelectLabel>
            {transitions.map((tr) => (
              <SelectItem key={tr.target_status} value={tr.target_status}>
                <span className={STATUS_COLOR[tr.target_status] ?? 'text-foreground'}>
                  {statusLabel[tr.target_status as keyof typeof statusLabel] ?? tr.label}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ) : (
          <SelectItem value="__no_transitions__" disabled className="text-muted-foreground italic text-xs">
            {t($ => $.statusSelector.noTransitions)}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );

  // ── Terminal tooltip ────────────────────────────────────────────────────────

  return (
    <>
      {!hasTransitions ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">{selectEl}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-48 text-center text-xs">
              {t($ => $.statusSelector.finalState)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        selectEl
      )}

      {/* ── Confirmation dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!pending} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t($ => $.statusSelector.dialogTitle)}</DialogTitle>
            <DialogDescription>
              {t($ => $.statusSelector.dialogDesc)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* From → To */}
            <div className="flex items-center justify-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t($ => $.statusSelector.from)}</span>
                <span className={cn('text-sm font-semibold', currentColor)}>
                  {currentStatusLabel}
                </span>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t($ => $.statusSelector.to)}</span>
                <span className={cn('text-sm font-semibold', STATUS_COLOR[pending?.target_status ?? ''] ?? 'text-foreground')}>
                  {statusLabel[pending?.target_status as keyof typeof statusLabel] ?? pending?.label}
                </span>
              </div>
            </div>

            {/* Reason input — only when the workflow requires it */}
            {pending?.requires_reason && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">
                  {t($ => $.statusSelector.reason)} <span className="text-muted-foreground">{t($ => $.statusSelector.reasonOptional)}</span>
                </label>
                <Input
                  autoFocus
                  placeholder={t($ => $.statusSelector.reasonPlaceholder)}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
              </div>
            )}
          </div>

          {transition.isError && (
            <p className="text-center text-xs text-destructive">
              {t($ => $.statusSelector.transitionFailed)}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              disabled={transition.isPending}
            >
              {t($ => $.statusSelector.cancel)}
            </Button>
            <Button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
              disabled={transition.isPending}
            >
              {transition.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t($ => $.statusSelector.confirm)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
