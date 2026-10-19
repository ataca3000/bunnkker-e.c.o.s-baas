import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, MapPin, MessageCircle, Phone, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useCustomerOrderStats } from '@/features/orders/hooks/use-orders';
import type { Order } from '@/features/orders/types/order';
import { cn } from '@/lib/utils';

type Props = { order: Order };

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Enterprise Customer 360 Card — badge that opens a Portal popover with
 * full stats (AOV, first/last order, preferred zone), contact quick-actions.
 */
export function OrderCustomerBadge({ order }: Props) {
  const { t } = useTranslation('orders');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const customer = order.customer;
  const { data, isLoading } = useCustomerOrderStats(open && customer ? customer.id : null);

  const isVip      = (data?.total ?? 0) >= 10;
  const isFreq     = !isVip && (data?.total ?? 0) >= 5;
  const isRejected = !isVip && !isFreq && (data?.cancelled ?? 0) > 0 && (data?.completed ?? 0) === 0;

  function openCard() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelW = 268;
    let left = rect.left + window.scrollX;
    if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
    setPos({ top: rect.bottom + window.scrollY + 6, left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        !document.getElementById('customer-card-portal')?.contains(target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);

  if (!customer) return null;

  const primaryPhone = order.billing_phone ?? customer.phone ?? customer.mobile;
  const digits = primaryPhone?.replace(/\D/g, '') ?? '';
  const email = order.billing_email;
  const shortAddress = [order.shipping_address_1, order.shipping_city].filter(Boolean).join(', ');
  const preferredZone = data?.preferredGovernorate ?? order.governorate ?? order.delivery_zone;

  const panel = open ? (
    <div
      id="customer-card-portal"
      role="dialog"
      aria-label={`${customer.name} — ${t($ => $.customerBadge.viewStats)}`}
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: 268, zIndex: 9999 }}
      className="rounded-lg border bg-popover text-popover-foreground shadow-xl"
    >
      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <div className="border-b px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight">{customer.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{customer.code}</p>
          </div>
          {(isVip || isFreq || isRejected) ? (
            <span className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              isVip
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : isRejected
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            )}>
              {isVip
                ? `⭐ ${t($ => $.customerBadge.vip)}`
                : isRejected
                  ? `⚠ ${t($ => $.customerBadge.rejected, { defaultValue: 'Rejected' })}`
                  : `🔁 ${t($ => $.customerBadge.returning)}`}
            </span>
          ) : null}
        </div>
        {/* Contact */}
        {primaryPhone ? (
          <p className="mt-1 text-[10px] text-muted-foreground font-mono">{primaryPhone}</p>
        ) : null}
        {customer.mobile && customer.mobile !== primaryPhone ? (
          <p className="text-[10px] text-muted-foreground font-mono">{customer.mobile}</p>
        ) : null}
        {email ? (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{email}</p>
        ) : null}
        {preferredZone ? (
          <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <MapPin className="size-2.5 shrink-0" />{preferredZone}
          </p>
        ) : null}
        {shortAddress && !preferredZone ? (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{shortAddress}</p>
        ) : null}
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="p-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">{t($ => $.customerBadge.loading)}</p>
        ) : data ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">{t($ => $.customerBadge.totalOrders)}</dt>
              <dd className="font-semibold tabular-nums">{data.total}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t($ => $.customerBadge.completedOrders)}</dt>
              <dd className="font-semibold tabular-nums text-green-600 dark:text-green-400">{data.completed}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t($ => $.customerBadge.cancelledOrders)}</dt>
              <dd className="font-semibold tabular-nums text-red-500 dark:text-red-400">{data.cancelled}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t($ => $.customerBadge.totalSpend)}</dt>
              <dd className="font-semibold tabular-nums">{fmt(data.totalSpend)}</dd>
            </div>
            {data.aov !== null ? (
              <div>
                <dt className="text-muted-foreground">{t($ => $.customerBadge.aov)}</dt>
                <dd className="font-semibold tabular-nums">{fmt(data.aov)}</dd>
              </div>
            ) : null}
            {data.firstOrderDate ? (
              <div>
                <dt className="text-muted-foreground">{t($ => $.customerBadge.firstOrder)}</dt>
                <dd className="font-medium">{fmtDate(data.firstOrderDate)}</dd>
              </div>
            ) : null}
            {data.lastOrderDate ? (
              <div className={data.aov !== null && !data.firstOrderDate ? 'col-span-2' : ''}>
                <dt className="text-muted-foreground">{t($ => $.customerBadge.lastOrder)}</dt>
                <dd className="font-medium">{fmtDate(data.lastOrderDate)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      {/* ── Footer: quick actions ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-t px-3 py-2">
        {primaryPhone ? (
          <>
            <a
              href={`tel:${digits}`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-foreground hover:bg-accent"
              aria-label={t($ => $.quickActions.call)}
            >
              <Phone className="size-3" />
              {t($ => $.quickActions.call)}
            </a>
            <a
              href={`https://wa.me/${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-green-600 hover:bg-accent dark:text-green-400"
              aria-label={t($ => $.quickActions.whatsapp)}
            >
              <MessageCircle className="size-3" />
              WA
            </a>
          </>
        ) : null}
        <a
          href={`/orders?customer_id=${customer.id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {t($ => $.customerBadge.openOrders, { defaultValue: 'Orders' })}
        </a>
        <a
          href={`/app/customers/${customer.id}`}
          className="ms-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="size-3" />
          {t($ => $.customerBadge.openProfile)}
        </a>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); openCard(); }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={`${customer.name} — ${t($ => $.customerBadge.viewStats)}`}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
          open
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-accent hover:text-foreground',
        )}
      >
        <User className="size-2.5" />
      </button>
      {open && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
