import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { Order } from '../types/order';

type ReservationCode = 'dash' | 'released' | 'partial' | 'reserved' | 'failed' | 'notReserved';

type ReservationState = {
  code: ReservationCode;
  cls: string;
  detail?: string;
  reservedQty?: number;
  totalQty?: number;
};

function getState(order: Order): ReservationState {
  const isReleased = Boolean(order.inventory_released_at);
  const isReserved = Boolean(order.inventory_reserved_at) && !isReleased;

  if (isReleased) {
    return { code: 'released', cls: 'bg-muted text-muted-foreground ring-border' };
  }

  if (isReserved) {
    const lines       = order.lines ?? [];
    const totalQty    = lines.reduce((s, l) => s + l.quantity, 0);
    const reservedQty = lines.reduce((s, l) => s + (l.reserved_qty ?? 0), 0);
    const isPartial   = reservedQty > 0 && reservedQty < totalQty;

    const detail = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(order.inventory_reserved_at!));

    if (isPartial) {
      return {
        code: 'partial',
        cls: 'bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300',
        detail,
        reservedQty,
        totalQty,
      };
    }

    return {
      code: 'reserved',
      cls: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400',
      detail,
      totalQty: totalQty > 0 ? totalQty : undefined,
    };
  }

  if (order.status === 'cancelled' || order.status === 'delivered' || order.status === 'returned') {
    return { code: 'dash', cls: '' };
  }

  if (order.status === 'awaiting_stock') {
    return {
      code: 'failed',
      cls: 'bg-red-100 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-300',
    };
  }

  return { code: 'notReserved', cls: 'bg-muted text-muted-foreground ring-border' };
}

export function OrderReservationCell({ order }: { order: Order }) {
  const { t } = useTranslation('orders');
  const state = getState(order);
  // Show the human-readable warehouse name from line data, not the raw UUID (W2 FIX-1).
  const warehouseName = (order.lines ?? []).map((l) => l.warehouse_name).find(Boolean) ?? null;

  if (state.code === 'dash') return <span className="text-muted-foreground">—</span>;

  const label =
    state.code === 'partial'
      ? t($ => $.reservationCell.partial)
      : t($ => $.reservationCell[state.code]);

  let qtyStr: string | undefined;
  if (state.code === 'partial' && state.reservedQty != null && state.totalQty != null) {
    qtyStr = t($ => $.reservationCell.unitsPartialReserved, { reserved: state.reservedQty, total: state.totalQty });
  } else if (state.code === 'reserved' && state.totalQty != null) {
    qtyStr = t($ => $.reservationCell.unitsReserved, { count: state.totalQty });
  }

  const badge = (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
        state.cls,
      )}
    >
      {label}
    </span>
  );

  if (!state.detail) return badge;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs space-y-0.5">
          <p className="font-medium">{t($ => $.reservationCell.inventoryReserved)}</p>
          {qtyStr ? <p className="text-muted-foreground">{qtyStr}</p> : null}
          <p className="text-muted-foreground">{state.detail}</p>
          {warehouseName ? (
            <p className="text-[10px] text-muted-foreground">{warehouseName}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
