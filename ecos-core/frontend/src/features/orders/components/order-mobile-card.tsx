import { Eye, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { OrderStatusBadge } from './order-status-badge';
import type { Order } from '../types/order';

type OrderMobileCardProps = {
  order: Order;
  isSelected?: boolean;
  isFocused?: boolean;
  onView: (order: Order) => void;
  onSelect?: (id: string, checked: boolean) => void;
  onStatusChange?: (order: Order) => void;
};

function formatTotal(total: number): string {
  return total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Mobile-optimised card for a single order.
 * Shows Order # / Customer / Status / Total / Item count + Call and View actions.
 */
export function OrderMobileCard({
  order,
  isSelected = false,
  isFocused = false,
  onView,
  onSelect,
  onStatusChange,
}: OrderMobileCardProps) {
  const { t } = useTranslation('orders');
  const phone = order.billing_phone;

  return (
    <div
      role="listitem"
      aria-selected={isSelected}
      data-focused={isFocused || undefined}
      className={cn(
        'relative border-b last:border-0 p-3.5 transition-colors',
        isSelected ? 'bg-primary/5' : 'bg-card',
        isFocused && 'outline outline-1 -outline-offset-1 outline-primary/50',
      )}
    >
      {/* Checkbox */}
      {onSelect ? (
        <div className="absolute left-3.5 top-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(order.id, e.target.checked)}
            className="size-4 cursor-pointer rounded accent-primary"
            aria-label={`Select ${order.order_number}`}
          />
        </div>
      ) : null}

      {/* Content — shifted right when checkbox present */}
      <button
        type="button"
        className={cn('w-full text-start', onSelect && 'pl-7')}
        onClick={() => onView(order)}
        aria-label={`View order ${order.order_number}`}
      >
        {/* Row 1: Order # + Total */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-sm font-semibold">{order.order_number}</span>
            {order.channel?.name ? (
              <span className="truncate text-xs text-muted-foreground">· {order.channel.name}</span>
            ) : null}
          </div>
          <span className="text-sm font-semibold tabular-nums shrink-0">
            {formatTotal(order.grand_total)}
          </span>
        </div>

        {/* Row 2: Customer name */}
        <p className="text-sm text-foreground/80 truncate mb-2">
          {order.customer?.name ?? '—'}
        </p>
      </button>

      {/* Row 3: Status + Items + Actions */}
      <div className={cn('flex items-center justify-between gap-2', onSelect && 'pl-7')}>
        <div className="flex items-center gap-2">
          {/* Status badge — tap to change status */}
          <div onClick={(e) => { e.stopPropagation(); onStatusChange?.(order); }}>
            <OrderStatusBadge
              status={order.status}
              onClick={onStatusChange ? () => onStatusChange(order) : undefined}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {order.lines.length} {order.lines.length === 1 ? t($ => $.mobileCard.item) : t($ => $.mobileCard.items)}
          </span>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-0.5">
          {phone ? (
            <Button variant="ghost" size="icon" className="size-7" asChild>
              <a
                href={`tel:${phone}`}
                aria-label={t($ => $.phone.call)}
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="size-3.5" />
              </a>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={(e) => { e.stopPropagation(); onView(order); }}
            aria-label={t($ => $.actions.view)}
          >
            <Eye className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
