import {
  Calendar,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { useOrdersQuery } from '@/features/orders/hooks/use-orders';

import type { Customer } from '@/features/customers/types/customer';
import { cn } from '@/lib/utils';

// Statuses that mean an order is in-flight (not terminal). Aligned to the
// canonical V3 OrderStatus union — the legacy values (processing/review/
// confirmed/preparing/rescheduled) are no longer emitted by the backend.
const ACTIVE_ORDER_STATUSES = new Set<string>([
  'new',
  'in_progress',
  'awaiting_payment',
  'awaiting_stock',
  'scheduled',
  'ready_for_dispatch',
  'out_for_delivery',
  'on_hold',
]);

type Props = {
  customer: Customer;
  onOpen: (customer: Customer) => void;
  onOpenOrders?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onCreateOrder?: (customer: Customer) => void;
  onClose?: () => void;
  className?: string;
};

/**
 * Customer Quick Action Card — shown when smart search returns exactly one result.
 * Operational hub: every common CS action available without opening the full profile.
 */
export function CustomerQuickActionCard({
  customer,
  onOpen,
  onOpenOrders,
  onEdit,
  onCreateOrder,
  onClose,
  className,
}: Props) {
  const { t } = useTranslation('customers');

  const primaryPhone = customer.phone;
  const secondaryPhone = customer.mobile;
  const addressCity = [customer.city, customer.country].filter(Boolean).join(', ');
  const fullAddress = [customer.address, addressCity].filter(Boolean).join(' — ');

  // Fetch most recent 5 orders to derive stats and detect active order
  const { data: ordersData, isLoading: ordersLoading } = useOrdersQuery({
    customer_id: customer.id,
    per_page: 5,
    sort_by: 'order_date',
    sort_dir: 'desc',
  });

  const totalOrders   = ordersData?.meta.total ?? null;
  const lastOrderDate = ordersData?.items[0]?.order_date ?? null;
  const activeOrder   = ordersData?.items.find((o) => ACTIVE_ORDER_STATUSES.has(o.status)) ?? null;
  const isReturning   = totalOrders !== null && totalOrders > 1;

  const handleCopyPhone = () => {
    if (primaryPhone) void navigator.clipboard.writeText(primaryPhone);
  };

  const handleCopyAddress = () => {
    if (fullAddress) void navigator.clipboard.writeText(fullAddress);
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-background shadow-md',
        'animate-in fade-in slide-in-from-top-1 duration-150',
        className,
      )}
    >
      {/* Close */}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      ) : null}

      <div className="p-4 pb-3">
        {/* ── Identity ─────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 pr-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {customer.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{customer.name}</span>
              {isReturning ? (
                <Badge
                  variant="secondary"
                  className="h-4 shrink-0 gap-0.5 px-1.5 text-[9px] text-blue-700 bg-blue-100 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-800"
                >
                  <RefreshCw className="size-2.5" />
                  {t($ => $.quickCard.returning)}
                </Badge>
              ) : null}
              {!customer.is_active ? (
                <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[9px]">
                  {t($ => $.tags.inactive)}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{customer.code}</p>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <div className="mt-3 flex items-center gap-4 rounded-lg bg-muted/40 px-3 py-2 text-xs">
          {ordersLoading ? (
            <>
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ShoppingBag className="size-3.5" />
                <span className="font-medium text-foreground">{totalOrders ?? '—'}</span>
                <span>{t($ => $.quickCard.totalOrders)}</span>
              </div>
              {lastOrderDate ? (
                <>
                  <div className="h-3 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-3.5" />
                    <span className="font-medium text-foreground">
                      {new Date(lastOrderDate).toLocaleDateString()}
                    </span>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>

        {/* ── Active order callout ───────────────────────────────────────────── */}
        {activeOrder ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  {t($ => $.quickCard.activeOrder)}
                </span>
                <span className="font-mono text-xs text-amber-700 dark:text-amber-400">
                  {activeOrder.order_number}
                </span>
              </div>
              <div className="mt-0.5">
                <OrderStatusBadge status={activeOrder.status} />
              </div>
            </div>
            {onOpenOrders ? (
              <Button
                size="sm"
                variant="outline"
                className="h-6 shrink-0 gap-1 border-amber-300 px-2 text-[10px] hover:bg-amber-100 dark:border-amber-700"
                onClick={() => onOpenOrders(customer)}
              >
                {t($ => $.quickCard.openActiveOrder)}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* ── Phone ─────────────────────────────────────────────────────────── */}
        {primaryPhone ? (
          <div className="mt-2.5 flex items-center gap-2">
            <Phone className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="font-mono text-sm">{primaryPhone}</span>
            {secondaryPhone ? (
              <span className="text-xs text-muted-foreground">
                {t($ => $.phone.more, { count: 1 })}
              </span>
            ) : null}
            <div className="ms-auto flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="size-6" asChild title={t($ => $.phone.call)}>
                <a href={`tel:${primaryPhone.replace(/\D/g, '')}`}>
                  <Phone className="size-3" />
                </a>
              </Button>
              <Button size="icon" variant="ghost" className="size-6" asChild title={t($ => $.phone.whatsapp)}>
                <a
                  href={`https://wa.me/${primaryPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-3" />
                </a>
              </Button>
              <Button size="icon" variant="ghost" className="size-6" onClick={handleCopyPhone} title={t($ => $.phone.copy)}>
                <Copy className="size-3" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* ── Address ───────────────────────────────────────────────────────── */}
        {fullAddress ? (
          <div className="mt-1.5 flex items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="line-clamp-2 min-w-0 flex-1 text-xs text-muted-foreground">
              {fullAddress}
            </p>
          </div>
        ) : null}

        {/* ── Customer Memory preview ─────────────────────────────────────── */}
        {customer.notes ? (
          <div className="mt-1.5 flex items-start gap-2">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            <p className="line-clamp-2 min-w-0 flex-1 text-xs text-muted-foreground">
              {customer.notes}
            </p>
          </div>
        ) : null}
      </div>

      <Separator />

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="p-3">
        {/* Primary actions */}
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            className="h-7 gap-1.5 px-3 text-xs"
            onClick={() => onOpen(customer)}
          >
            <ExternalLink className="size-3" />
            {t($ => $.quickCard.openCustomer)}
          </Button>

          {onCreateOrder ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-3 text-xs"
              onClick={() => onCreateOrder(customer)}
            >
              <Plus className="size-3" />
              {t($ => $.quickCard.createOrder)}
            </Button>
          ) : null}

          {onEdit ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-3 text-xs"
              onClick={() => onEdit(customer)}
            >
              <Pencil className="size-3" />
              {t($ => $.quickCard.editCustomer)}
            </Button>
          ) : null}
        </div>

        {/* Secondary actions */}
        {(primaryPhone || fullAddress) ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {primaryPhone ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={() => window.open(`tel:${primaryPhone.replace(/\D/g, '')}`, '_self')}
                >
                  <Phone className="size-3" />
                  {t($ => $.quickCard.call)}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" asChild>
                  <a
                    href={`https://wa.me/${primaryPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="size-3" />
                    {t($ => $.quickCard.whatsapp)}
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={handleCopyPhone}
                >
                  <Copy className="size-3" />
                  {t($ => $.quickCard.copyPhone)}
                </Button>
              </>
            ) : null}
            {fullAddress ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={handleCopyAddress}
                >
                  <Copy className="size-3" />
                  {t($ => $.quickCard.copyAddress)}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" asChild>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="size-3" />
                    {t($ => $.quickCard.openMap)}
                  </a>
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
