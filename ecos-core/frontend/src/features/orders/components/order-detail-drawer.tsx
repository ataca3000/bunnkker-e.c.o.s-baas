import {
  Activity,
  ArrowDown,
  ArrowRightCircle,
  BadgeCheck,
  Banknote,
  Box,
  Building,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Edit,
  ExternalLink,
  FileCheck,
  Flag,
  Globe,
  Hash,
  Home,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  Mail,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  Paperclip,
  PenLine,
  Percent,
  Phone,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  StickyNote,
  Trash2,
  Truck,
  User,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { MediaViewer } from '@/components/ui/media-viewer';
import { Separator } from '@/components/ui/separator';
import React from 'react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs } from '@/components/ds/tabs';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { OrderNotesTab } from '@/features/orders/components/notes-tab';
import { OrderDistributionStageBanner } from '@/features/orders/components/order-distribution-stage-banner';
import type { Order, OrderActivity } from '@/features/orders/types/order';
import {
  useOrderActivities,
  useOrderQuery,
  useOrderWorkflowReschedule,
  useOrderWorkflowTransition,
} from '@/features/orders/hooks/use-orders';
import { getMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

// Typed translator — extracted from the hook so sub-components share the exact
// same type as the t returned by useTranslation('orders').  Assigning a looser
// (k: string) => string to this type previously violated strictFunctionTypes.
type OrdersT = ReturnType<typeof useTranslation<'orders'>>['t'];

// i18next strict types reject Parameters<OrdersT>[0] (union includes TemplateStringsArray).
// This cast helper provides a controlled escape for dynamic-key lookups with a defaultValue.
type TDynamic = (key: string, opts?: { defaultValue?: string }) => string;

// ── Helper primitives ─────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function DetailGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <dl className={cn('grid gap-x-4 gap-y-4', cols === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
      {children}
    </dl>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</h3>;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(d));
}

function formatDateTime(d: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
}

/** Raw number → "X,XXX.XX" without currency, for inline use (line items). */
/**
 * Currency formatting bound to the company currency (Settings → Company Settings).
 * Returns "—" for zero/near-zero values unless allowZero=true. Magnitude only (sign stripped),
 * matching the previous ledger-style presentation.
 */
function useOrderMoney() {
  const { money } = useFormatter();
  return (n: number | null | undefined, allowZero = false): string => {
    const v = Object.is(n ?? 0, -0) ? 0 : (n ?? 0);
    if (!allowZero && Math.abs(v) < 0.005) return '—';
    return money(Math.abs(v));
  };
}

// ── Payment method labels ─────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod:           'Cash on Delivery',
  cash:          'Cash',
  visa:          'Visa Card',
  mastercard:    'Mastercard',
  credit_card:   'Credit Card',
  card:          'Credit Card',
  bank:          'Bank Transfer',
  bank_transfer: 'Bank Transfer',
  instalment:    'Instalment',
  installment:   'Instalment',
  wallet:        'Digital Wallet',
  online:        'Online Payment',
  cheque:        'Cheque',
  check:         'Cheque',
};

/** Converts a technical payment code ("cod", "bank_transfer") to a business label. */
function formatPaymentLabel(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[-\s]/g, '_');
  if (PAYMENT_METHOD_LABELS[key]) return PAYMENT_METHOD_LABELS[key];
  for (const [k, label] of Object.entries(PAYMENT_METHOD_LABELS)) {
    if (key.includes(k) || k.includes(key)) return label;
  }
  // Fallback: title-case the raw value
  return raw.split(/[-_\s]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Resolves the best human-readable payment method from an order. */
function resolvePaymentLabel(order: { payment_method_manual?: string | null; payment_method_title?: string | null; payment_method?: string | null }): string | null {
  if (order.payment_method_manual) return formatPaymentLabel(order.payment_method_manual);
  if (order.payment_method_title)  return order.payment_method_title; // WooCommerce title is already readable
  if (order.payment_method)        return formatPaymentLabel(order.payment_method);
  return null;
}

// ── Financial row ─────────────────────────────────────────────────────────────

type FinRowValue = number | 'not_applicable' | 'empty';

function FinancialRow({
  label,
  value,
  pct,
  isDiscount = false,
  bold = false,
  allowZero = false,
}: {
  label: string;
  value: FinRowValue;
  pct?: number | null;
  isDiscount?: boolean;
  bold?: boolean;
  allowZero?: boolean;
}) {
  const fmtCur = useOrderMoney();
  const effectiveLabel = pct != null ? `${label} (${pct}%)` : label;
  let display: React.ReactNode;

  if (value === 'not_applicable') {
    display = <span className="text-muted-foreground italic text-sm">N/A</span>;
  } else if (value === 'empty' || (!allowZero && typeof value === 'number' && Math.abs(value) < 0.005)) {
    display = <span className="text-muted-foreground text-sm">—</span>;
  } else {
    const formatted = fmtCur(value as number, allowZero);
    display = (
      <span className={cn('tabular-nums text-sm', isDiscount && 'text-emerald-600 dark:text-emerald-400', bold && 'font-semibold')}>
        {isDiscount ? `−${formatted}` : formatted}
      </span>
    );
  }

  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={cn('text-sm', bold ? 'font-semibold' : 'text-muted-foreground')}>{effectiveLabel}</span>
      {display}
    </div>
  );
}

function KpiCard({ label, value, variant }: { label: string; value: string; variant?: 'discount' }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums', variant === 'discount' && 'text-emerald-600 dark:text-emerald-400')}>
        {value}
      </div>
    </div>
  );
}

// ── Payment proof preview ─────────────────────────────────────────────────────
// Replaced by MediaViewer — trigger rendered inline at call site.

// ── Tab panels ────────────────────────────────────────────────────────────────

function SummaryTab({ order, t }: { order: Order; t: OrdersT }) {
  const fmtCur = useOrderMoney();
  const paymentLabel = resolvePaymentLabel(order);
  const hasDiscount = order.discount_amount > 0.005;
  const hasDeposit  = order.deposit_paid > 0.005;

  const formulaParts: string[] = [t($ => $.detail.productsTotal)];
  if (order.shipping_amount > 0.005) formulaParts.push(t($ => $.detail.shipping));
  if (order.tax_amount > 0.005)      formulaParts.push(t($ => $.detail.tax));

  return (
    <div className="flex flex-col gap-6 p-4">
      <DetailGrid>
        <DetailRow label={t($ => $.detail.orderNumber)}><span className="font-mono font-medium">{order.order_number}</span></DetailRow>
        <DetailRow label={t($ => $.detail.orderDate)}>{formatDate(order.order_date)}</DetailRow>
        <DetailRow label={t($ => $.detail.status)}><OrderStatusBadge status={order.status} /></DetailRow>
        <DetailRow label={t($ => $.detail.channel)}>{order.channel?.name}</DetailRow>
        <DetailRow label={t($ => $.detail.externalOrderId)}><span className="font-mono text-xs">{order.external_order_id ?? '—'}</span></DetailRow>
        <DetailRow label={t($ => $.detail.paymentMethodTitle)}>{paymentLabel}</DetailRow>
      </DetailGrid>

      <Separator />

      {/* ── Financial Summary ── */}
      <div>
        <SectionTitle>{t($ => $.detail.financialSummary)}</SectionTitle>
        <div className="flex flex-col gap-2">
          <FinancialRow label={t($ => $.detail.productsTotal)} value={order.products_total} />
          <FinancialRow label={t($ => $.detail.shipping)}      value={order.shipping_amount} />
          {hasDiscount && (
            <FinancialRow
              label={t($ => $.detail.discount)}
              pct={order.discount_percentage}
              value={order.discount_amount}
              isDiscount
            />
          )}
          <FinancialRow
            label={t($ => $.detail.tax)}
            value={order.tax_amount > 0 ? order.tax_amount : 'not_applicable'}
          />
          <Separator className="my-1" />
          <FinancialRow label={t($ => $.detail.grandTotal)} value={order.grand_total} bold allowZero />
          {hasDeposit && (
            <>
              <FinancialRow label={t($ => $.detail.deposit)}           value={order.deposit_paid} isDiscount />
              <FinancialRow label={t($ => $.detail.remainingBalance)}  value={order.remaining_balance} bold allowZero />
            </>
          )}
        </div>

        {/* Calculation transparency footer */}
        <div className="mt-4 rounded-md bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium">{t($ => $.detail.formula)}: </span>
          {formulaParts.join(' + ')}
          {hasDiscount ? ' − ' + t($ => $.detail.discount) : ''}
          {' = ' + t($ => $.detail.grandTotal)}
          {hasDeposit ? ' | ' + t($ => $.detail.grandTotal) + ' − ' + t($ => $.detail.deposit) + ' = ' + t($ => $.detail.remainingBalance) : ''}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label={t($ => $.detail.productsTotal)} value={fmtCur(order.products_total, true)} />
        <KpiCard
          label={order.discount_percentage != null ? `${t($ => $.detail.discountTotal)} (${order.discount_percentage}%)` : t($ => $.detail.discountTotal)}
          value={hasDiscount ? fmtCur(order.discount_amount) : '—'}
          variant="discount"
        />
        <KpiCard label={t($ => $.detail.deposit)}           value={hasDeposit ? fmtCur(order.deposit_paid) : '—'} />
        <KpiCard label={t($ => $.detail.remainingBalance)}  value={fmtCur(order.remaining_balance, true)} />
      </div>

      {order.notes ? (
        <>
          <Separator />
          <DetailRow label={t($ => $.detail.notes)}>{order.notes}</DetailRow>
        </>
      ) : null}
    </div>
  );
}

// ── Address field row ─────────────────────────────────────────────────────────

function AddrField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm leading-snug">{value || '—'}</p>
      </div>
    </div>
  );
}

// ── Note card ─────────────────────────────────────────────────────────────────

function NoteCard({
  icon,
  title,
  content,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <p className="px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{content}</p>
    </div>
  );
}

// ── Customer Tab ──────────────────────────────────────────────────────────────

function CustomerTab({ order, t }: { order: Order; t: OrdersT }) {
  const fmtCur = useOrderMoney();
  const cust = order.customer;
  const primaryPhone   = order.billing_phone ?? cust?.phone;
  const secondaryPhone = cust?.mobile;
  const email          = cust?.email ?? order.billing_email;
  const stats          = cust?.stats;
  const aov            = stats && stats.total_orders > 0
    ? stats.lifetime_value / stats.total_orders
    : null;

  const hasLegacyBilling  = !!(order.billing_address_1 || order.billing_city || order.billing_first_name);
  const hasLegacyShipping = !!(order.shipping_address_1 || order.shipping_city);
  const hasLocation       = !!order.location;
  const hasMapsData       = !!(order.location || order.google_maps_url);

  const mapsUrl = order.location
    ? `https://www.google.com/maps?q=${order.location.lat},${order.location.lng}`
    : (order.google_maps_url ?? null);

  const fullAddressParts = [
    order.governorate,
    order.city,
    order.delivery_zone,
    order.shipping_address,
    order.building  ? `Bldg. ${order.building}` : null,
    order.floor     ? `Floor ${order.floor}` : null,
    order.apartment ? `Apt. ${order.apartment}` : null,
    order.landmark  ? `Near: ${order.landmark}` : null,
  ].filter(Boolean) as string[];
  const fullAddress = fullAddressParts.join('\n');

  const hasAddrData = !!(
    order.governorate || order.city || order.delivery_zone ||
    order.shipping_address || order.building || order.floor ||
    order.apartment || order.landmark
  );

  const copyAddress  = () => void navigator.clipboard.writeText(fullAddress || '—');
  const copyMapsLink = () => void navigator.clipboard.writeText(mapsUrl ?? fullAddress ?? '—');

  const internalNoteContent = [order.notes, order.internal_notes]
    .filter(Boolean).join('\n\n') || null;

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* ── 1. Customer Information Card ── */}
      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
          <User className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t($ => $.detail.customerInformation)}
          </span>
        </div>
        <div className="p-4">
          <DetailGrid cols={2}>
            <DetailRow label={t($ => $.drawer.customer.name)}>
              <span className="font-medium">{cust?.name ?? '—'}</span>
            </DetailRow>
            <DetailRow label={t($ => $.drawer.customer.code)}>
              <span className="flex items-center gap-1 font-mono text-xs">
                <Hash className="size-3 text-muted-foreground" />
                {cust?.code ?? '—'}
              </span>
            </DetailRow>
            <DetailRow label={t($ => $.drawer.customer.primaryPhone)}>
              {primaryPhone ? (
                <a href={`tel:${primaryPhone}`} className="flex items-center gap-1 text-sm hover:underline">
                  <Phone className="size-3 shrink-0 text-muted-foreground" />
                  {primaryPhone}
                </a>
              ) : <span className="text-muted-foreground">—</span>}
            </DetailRow>
            <DetailRow label={t($ => $.drawer.customer.secondaryPhone)}>
              {secondaryPhone ? (
                <a href={`tel:${secondaryPhone}`} className="flex items-center gap-1 text-sm hover:underline">
                  <Phone className="size-3 shrink-0 text-muted-foreground" />
                  {secondaryPhone}
                </a>
              ) : <span className="text-muted-foreground">—</span>}
            </DetailRow>
            <DetailRow label={t($ => $.drawer.customer.email)}>
              {email ? (
                <a href={`mailto:${email}`} className="flex min-w-0 items-center gap-1 text-sm text-primary hover:underline">
                  <Mail className="size-3 shrink-0" />
                  <span className="truncate">{email}</span>
                </a>
              ) : <span className="text-muted-foreground">—</span>}
            </DetailRow>
            <DetailRow label={t($ => $.drawer.customer.since)}>
              {cust?.created_at
                ? formatDate(cust.created_at)
                : <span className="text-muted-foreground">—</span>}
            </DetailRow>
            <DetailRow label={t($ => $.drawer.customer.status)}>
              {cust?.is_active !== undefined ? (
                <span className={cn(
                  'inline-flex items-center gap-1 text-sm font-medium',
                  cust.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                )}>
                  {cust.is_active
                    ? <CheckCircle2 className="size-3" />
                    : <XCircle className="size-3" />}
                  {cust.is_active ? t($ => $.drawer.customer.active) : t($ => $.drawer.customer.inactive)}
                </span>
              ) : <span className="text-muted-foreground">—</span>}
            </DetailRow>
            <DetailRow label={t($ => $.drawer.customer.lastOrder)}>
              {stats?.last_order_date
                ? formatDate(stats.last_order_date)
                : <span className="text-muted-foreground">—</span>}
            </DetailRow>
          </DetailGrid>
        </div>
      </div>

      {/* ── 2. Customer Summary ── */}
      {stats ? (
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
            <Activity className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t($ => $.drawer.customer.summary)}</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y">
            <div className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t($ => $.drawer.customer.lifetimeValue)}</p>
              <p className="text-sm font-semibold tabular-nums">{fmtCur(stats.lifetime_value, true)}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t($ => $.drawer.customer.avgOrderValue)}</p>
              <p className="text-sm font-semibold tabular-nums">{aov != null ? fmtCur(aov, true) : '—'}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t($ => $.drawer.customer.totalOrders)}</p>
              <p className="text-sm font-semibold">{stats.total_orders.toLocaleString()}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t($ => $.drawer.customer.firstOrder)}</p>
              <p className="text-sm">{stats.first_order_date ? formatDate(stats.first_order_date) : '—'}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 3. Delivery Address ── */}
      <div className="rounded-lg border overflow-hidden">
        {/* Card header: title + verified badge + action buttons */}
        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <MapPin className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t($ => $.drawer.customer.deliveryAddress)}</span>
            {hasLocation && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                <BadgeCheck className="size-2.5" />
                {t($ => $.drawer.customer.gpsPinned)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {mapsUrl ? (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3" />
                  {t($ => $.drawer.customer.map)}
                </a>
              </Button>
            ) : null}
            {(hasAddrData || hasMapsData) ? (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={copyAddress}>
                <Copy className="size-3" />
                {t($ => $.drawer.customer.copy)}
              </Button>
            ) : null}
          </div>
        </div>

        {/* 2×2 grid: Location | Building | Full Address | Map */}
        <div className="grid grid-cols-2 divide-x divide-y">

          {/* Top-left: Location */}
          <div className="p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              📍 {t($ => $.drawer.customer.location)}
            </p>
            <div className="flex flex-col gap-3">
              <AddrField icon={<Globe className="size-3.5" />}      label={t($ => $.drawer.customer.governorate)} value={order.governorate} />
              <AddrField icon={<Building className="size-3.5" />}   label={t($ => $.drawer.customer.city)}        value={order.city} />
              <AddrField icon={<LayoutGrid className="size-3.5" />} label={t($ => $.drawer.customer.district)}    value={order.delivery_zone} />
              <AddrField icon={<Navigation className="size-3.5" />} label={t($ => $.drawer.customer.street)}      value={order.shipping_address} />
            </div>
          </div>

          {/* Top-right: Building Details */}
          <div className="p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              🏢 {t($ => $.drawer.customer.buildingDetails)}
            </p>
            <div className="flex flex-col gap-3">
              <AddrField icon={<Building2 className="size-3.5" />} label={t($ => $.drawer.customer.building)}  value={order.building} />
              <AddrField icon={<Layers className="size-3.5" />}    label={t($ => $.drawer.customer.floor)}     value={order.floor} />
              <AddrField icon={<Home className="size-3.5" />}      label={t($ => $.drawer.customer.apartment)} value={order.apartment} />
              <AddrField icon={<Flag className="size-3.5" />}      label={t($ => $.drawer.customer.landmark)}  value={order.landmark} />
            </div>
          </div>

          {/* Bottom-left: Full Address */}
          <div className="p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              📋 {t($ => $.drawer.customer.fullAddress)}
            </p>
            {fullAddressParts.length > 0 ? (
              <p className="text-sm leading-relaxed whitespace-pre-line">{fullAddress}</p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
            {order.address_notes ? (
              <div className="mt-3 border-t pt-3">
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">{t($ => $.drawer.customer.addressNotes)}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{order.address_notes}</p>
              </div>
            ) : null}
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                {t($ => $.drawer.customer.viewOnGoogleMaps)}
              </a>
            ) : null}
          </div>

          {/* Bottom-right: Map Preview */}
          <div className="p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              🗺 {t($ => $.drawer.customer.mapPreview)}
            </p>
            {order.location ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium tabular-nums">
                      {Number(order.location.lat).toFixed(6)}, {Number(order.location.lng).toFixed(6)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${order.location.lat},${order.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline"
                    >
                      maps.google.com ↗
                    </a>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" asChild>
                    <a href={mapsUrl!} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 size-3" />
                      {t($ => $.drawer.customer.open)}
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={copyMapsLink}>
                    <Copy className="mr-1 size-3" />
                    {t($ => $.drawer.customer.copy)}
                  </Button>
                </div>
              </div>
            ) : hasMapsData ? (
              <div className="flex flex-col gap-2">
                <div className="flex aspect-video items-center justify-center rounded-md border bg-muted/30">
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <MapIcon className="size-5" />
                    <p className="text-[10px]">{t($ => $.drawer.customer.urlOnlyNoGps)}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-7 w-full text-xs" asChild>
                  <a href={mapsUrl!} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 size-3" />
                    {t($ => $.drawer.customer.openMap)}
                  </a>
                </Button>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-md border border-dashed bg-muted/20">
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <MapIcon className="size-5" />
                  <p className="text-[10px]">{t($ => $.drawer.customer.noLocationData)}</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── 4. Notes (3 independent cards) ── */}
      {(cust?.notes || internalNoteContent || order.customer_note) ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t($ => $.drawer.customer.notes)}</h3>
          {cust?.notes ? (
            <NoteCard
              icon={<User className="size-3.5" />}
              title={t($ => $.drawer.customer.customerNotes)}
              content={cust.notes}
            />
          ) : null}
          {internalNoteContent ? (
            <NoteCard
              icon={<Lock className="size-3.5" />}
              title={t($ => $.drawer.customer.internalNotes)}
              content={internalNoteContent}
            />
          ) : null}
          {order.customer_note ? (
            <NoteCard
              icon={<StickyNote className="size-3.5" />}
              title={t($ => $.drawer.customer.woocommerceNotes)}
              content={order.customer_note}
            />
          ) : null}
        </div>
      ) : null}

      {/* ── Legacy billing (WooCommerce orders only) ── */}
      {hasLegacyBilling ? (
        <>
          <Separator />
          <div>
            <SectionTitle>{t($ => $.detail.billingInformation)}</SectionTitle>
            <DetailGrid cols={2}>
              {(order.billing_first_name || order.billing_last_name) ? (
                <DetailRow label={t($ => $.detail.billingName)}>
                  {[order.billing_first_name, order.billing_last_name].filter(Boolean).join(' ')}
                </DetailRow>
              ) : null}
              {order.billing_phone && order.billing_phone !== primaryPhone ? (
                <DetailRow label={t($ => $.detail.billingPhone)}>{order.billing_phone}</DetailRow>
              ) : null}
              {order.billing_email && order.billing_email !== email ? (
                <DetailRow label={t($ => $.detail.billingEmail)}>{order.billing_email}</DetailRow>
              ) : null}
              {order.billing_address_1 ? <DetailRow label={t($ => $.detail.billingAddress1)}>{order.billing_address_1}</DetailRow> : null}
              {order.billing_city      ? <DetailRow label={t($ => $.detail.billingCity)}>{order.billing_city}</DetailRow>           : null}
              {order.billing_country   ? <DetailRow label={t($ => $.detail.billingCountry)}>{order.billing_country}</DetailRow>     : null}
            </DetailGrid>
          </div>
        </>
      ) : null}

      {/* ── Legacy WooCommerce shipping address ── */}
      {hasLegacyShipping ? (
        <>
          <Separator />
          <div>
            <SectionTitle>{t($ => $.detail.shippingInformation)}</SectionTitle>
            <DetailGrid cols={2}>
              {(order.shipping_first_name || order.shipping_last_name) ? (
                <DetailRow label={t($ => $.detail.shippingName)}>
                  {[order.shipping_first_name, order.shipping_last_name].filter(Boolean).join(' ')}
                </DetailRow>
              ) : null}
              {order.shipping_company   ? <DetailRow label={t($ => $.detail.shippingCompany)}>{order.shipping_company}</DetailRow>   : null}
              {order.shipping_address_1 ? <DetailRow label={t($ => $.detail.shippingAddress1)}>{order.shipping_address_1}</DetailRow> : null}
              {order.shipping_city      ? <DetailRow label={t($ => $.detail.shippingCity)}>{order.shipping_city}</DetailRow>          : null}
              {order.shipping_country   ? <DetailRow label={t($ => $.detail.shippingCountry)}>{order.shipping_country}</DetailRow>    : null}
            </DetailGrid>
          </div>
        </>
      ) : null}

    </div>
  );
}

function ProductsTab({ order, t }: { order: Order; t: OrdersT }) {
  const fmtCur = useOrderMoney();
  return (
    <div className="flex flex-col gap-0 p-4">
      {/* Price protection banner — prices are frozen at order creation */}
      <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 px-3 py-2 flex items-start gap-2">
        <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
          <span className="font-semibold">{t($ => $.drawer.products_tab.priceLockTitle)} —</span>{' '}
          {t($ => $.drawer.products_tab.priceLockDesc)}
        </p>
      </div>

      {(order.lines ?? []).length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">{t($ => $.table.empty)}</p>
      ) : (
        <div className="flex flex-col divide-y">
          {(order.lines ?? []).map((line) => (
            <div key={line.id} className="flex items-center gap-3 py-3">
              {getMediaUrl(line.product?.image_url) ? (
                <img src={getMediaUrl(line.product!.image_url)!} alt={line.product!.name ?? ''} className="size-10 rounded-md object-cover ring-1 ring-border shrink-0" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-md bg-muted ring-1 ring-border shrink-0">
                  <Package className="size-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{line.product?.name ?? '—'}</p>
                <p className="text-xs text-muted-foreground font-mono">{line.product?.sku}</p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-sm font-medium tabular-nums">{fmtCur(line.line_total, true)}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <p className="text-xs text-muted-foreground">{line.quantity} × {fmtCur(line.unit_price, true)}</p>
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <Lock className="h-2.5 w-2.5" />
                    {t($ => $.drawer.products_tab.locked)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {(order.fees ?? []).length > 0 ? (
        <>
          <Separator />
          <div className="py-3">
            <SectionTitle>{t($ => $.detail.fees)}</SectionTitle>
            {(order.fees ?? []).map((f) => (
              <div key={f.id} className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">{f.name}</span>
                <span className="tabular-nums">{fmtCur(f.total, true)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {(order.coupons ?? []).length > 0 ? (
        <>
          <Separator />
          <div className="py-3">
            <SectionTitle>{t($ => $.detail.coupons)}</SectionTitle>
            {(order.coupons ?? []).map((c) => (
              <div key={c.id} className="flex justify-between text-sm py-1">
                <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                <span className="tabular-nums text-emerald-600">−{fmtCur(c.discount, true)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PaymentTab({ order, t }: { order: Order; t: OrdersT }) {
  const fmtCur = useOrderMoney();
  const paymentLabel = resolvePaymentLabel(order);

  // Derive payment status
  const isPaid     = Boolean(order.date_paid);
  const hasDeposit = order.deposit_paid > 0;
  const hasRemaining = order.remaining_balance > 0;
  const isPartial  = !isPaid && hasDeposit;

  const paymentStatusLabel = isPaid ? t($ => $.drawer.payment.paid) : isPartial ? t($ => $.drawer.payment.partiallyPaid) : t($ => $.drawer.payment.unpaid);
  const paymentStatusCls   = isPaid
    ? 'text-emerald-600 dark:text-emerald-400'
    : isPartial
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-muted-foreground';

  const hasAnyPayment = Boolean(
    paymentLabel || order.date_paid || hasDeposit || hasRemaining ||
    order.discount_amount > 0 || order.transaction_id || order.payment_proof_path,
  );

  if (!hasAnyPayment) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center p-4">
        <p className="text-sm text-muted-foreground">{t($ => $.drawer.payment.noInfo)}</p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-6">

      {/* ── Payment Status ── */}
      <div>
        <SectionTitle>{t($ => $.drawer.payment.statusSection)}</SectionTitle>
        <div className="rounded-md border bg-muted/20 px-4 py-3 flex items-center gap-3">
          {isPaid
            ? <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
            : <div className="size-4 rounded-full border-2 border-muted-foreground shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-semibold', paymentStatusCls)}>{paymentStatusLabel}</p>
            {isPaid && order.date_paid ? (
              <p className="text-xs text-muted-foreground">{t($ => $.drawer.payment.verifiedAt, { date: formatDateTime(order.date_paid) })}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Payment Details ── */}
      <div>
        <SectionTitle>{t($ => $.drawer.payment.detailsSection)}</SectionTitle>
        <DetailGrid cols={1}>
          {paymentLabel ? (
            <DetailRow label={t($ => $.drawer.payment.method)}>
              <span className="font-medium">{paymentLabel}</span>
            </DetailRow>
          ) : null}
          {order.transaction_id ? (
            <DetailRow label={t($ => $.drawer.payment.transactionId)}>
              <span className="font-mono text-xs">{order.transaction_id}</span>
            </DetailRow>
          ) : null}
          <DetailRow label={t($ => $.drawer.payment.verificationStatus)}>
            <span className={cn('font-medium', isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
              {isPaid ? t($ => $.drawer.payment.verified) : t($ => $.drawer.payment.awaitingVerification)}
            </span>
          </DetailRow>
          {order.date_paid ? (
            <DetailRow label={t($ => $.drawer.payment.verificationDate)}>{formatDateTime(order.date_paid)}</DetailRow>
          ) : null}
        </DetailGrid>
      </div>

      <Separator />

      {/* ── Financial Details — canonical fields only, no legacy calculations ── */}
      <div>
        <SectionTitle>{t($ => $.detail.financialSummary)}</SectionTitle>
        <div className="flex flex-col gap-2">
          <FinancialRow label={t($ => $.detail.productsTotal)} value={order.products_total} allowZero />
          <FinancialRow label={t($ => $.detail.shipping)}      value={order.shipping_amount} />
          {order.discount_amount > 0.005 && (
            <FinancialRow
              label={order.discount_percentage != null ? `${t($ => $.detail.discount)} (${order.discount_percentage}%)` : t($ => $.detail.discount)}
              value={order.discount_amount}
              isDiscount
            />
          )}
          <FinancialRow
            label={t($ => $.detail.tax)}
            value={order.tax_amount > 0.005 ? order.tax_amount : 'not_applicable'}
          />
          <Separator />
          <FinancialRow label={t($ => $.detail.grandTotal)} value={order.grand_total} allowZero bold />
          {hasDeposit && (
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-muted-foreground">{t($ => $.detail.deposit)}</span>
              <span className="text-sm font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                {fmtCur(order.deposit_paid)}
              </span>
            </div>
          )}
          {order.remaining_balance > 0.005 && (
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-muted-foreground">{t($ => $.detail.remainingBalance)}</span>
              <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {fmtCur(order.remaining_balance)}
              </span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Payment Proof ── */}
      <div>
        <SectionTitle>{t($ => $.drawer.payment.proofSection)}</SectionTitle>
        {order.payment_proof_path ? (
          <MediaViewer
            path={order.payment_proof_path}
            title={t($ => $.drawer.payment.proofSection)}
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Paperclip className="size-3.5" />
                {t($ => $.drawer.payment.proofSection)}
              </button>
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t($ => $.drawer.payment.noProof)}</p>
        )}
      </div>

      {/* ── Legacy reference (WooCommerce orders) ── */}
      {order.payment_method && order.payment_method !== order.payment_method_manual ? (
        <>
          <Separator />
          <div>
            <SectionTitle>{t($ => $.drawer.payment.woocommerceRef)}</SectionTitle>
            <DetailGrid>
              <DetailRow label={t($ => $.drawer.payment.gatewayCode)}>
                <span className="font-mono text-xs text-muted-foreground">{order.payment_method}</span>
              </DetailRow>
              {order.payment_method_title ? (
                <DetailRow label={t($ => $.drawer.payment.gatewayName)}>{order.payment_method_title}</DetailRow>
              ) : null}
            </DetailGrid>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Shipping Tab helpers ──────────────────────────────────────────────────────

function buildFullAddress(order: Order): string {
  const parts = [
    order.governorate,
    order.city,
    order.delivery_zone,
    order.shipping_address,
    order.building   ? `Bldg. ${order.building}` : null,
    order.floor      ? `Floor ${order.floor}`    : null,
    order.apartment  ? `Apt. ${order.apartment}` : null,
    order.landmark,
  ].filter((v): v is string => Boolean(v));
  return parts.join(', ');
}

function VerificationBadge({
  label,
  verified,
  detail,
  icon: Icon,
  statusText,
  statusColor,
}: {
  label: string;
  verified: boolean;
  detail?: string | null;
  icon?: React.ComponentType<{ className?: string }>;
  statusText?: string;
  statusColor?: string;
}) {
  const resolvedStatus = statusText ?? (verified ? 'Confirmed' : 'Unconfirmed');
  const resolvedColor  = statusColor ?? (verified
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-muted-foreground');

  return (
    <div className="flex items-center gap-2.5 rounded-md border px-3 py-2.5">
      {verified ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
      ) : (
        Icon ? <Icon className="size-4 shrink-0 text-muted-foreground/50" /> : (
          <div className="size-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
        )
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-tight">{label}</p>
        {detail ? (
          <p className="text-[10px] text-muted-foreground truncate">{detail}</p>
        ) : null}
        <p className={cn('text-[10px] font-semibold mt-0.5', resolvedColor)}>
          {resolvedStatus}
        </p>
      </div>
    </div>
  );
}

function ShippingTab({ order, t }: { order: Order; t: OrdersT }) {
  const fullAddress  = buildFullAddress(order);
  const loc          = order.location;
  const hasMapsData  = !!(loc || order.google_maps_url);
  const mapsUrl      = loc
    ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}`
    : (order.google_maps_url ?? '');
  const coordsStr    = loc ? `${loc.lat},${loc.lng}` : '';

  const attemptsLabel = (order.shipping_attempts ?? 0) > 0
    ? String(order.shipping_attempts)
    : null;

  return (
    <div className="flex flex-col gap-6 p-4">

      {/* ── 1. Delivery Address ── */}
      <div>
        <SectionTitle>{t($ => $.drawer.shipping.deliveryAddress)}</SectionTitle>

        {/* 2-column grid: Location | Building Details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-0">

          {/* Column 1 — Location */}
          <div className="flex flex-col gap-1 mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1">
              <MapPin className="size-3" />{t($ => $.drawer.shipping.location)}
            </p>
            <DetailRow label={t($ => $.drawer.shipping.governorate)}>{order.governorate}</DetailRow>
            <DetailRow label={t($ => $.drawer.shipping.city)}>{order.city}</DetailRow>
            <DetailRow label={t($ => $.drawer.shipping.district)}>{order.delivery_zone}</DetailRow>
            <DetailRow label={t($ => $.drawer.shipping.street)}>{order.shipping_address}</DetailRow>
          </div>

          {/* Column 2 — Building Details */}
          <div className="flex flex-col gap-1 mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1">
              <Building2 className="size-3" />{t($ => $.drawer.shipping.buildingDetails)}
            </p>
            <DetailRow label={t($ => $.drawer.shipping.building)}>{order.building}</DetailRow>
            <DetailRow label={t($ => $.drawer.shipping.floor)}>{order.floor}</DetailRow>
            <DetailRow label={t($ => $.drawer.shipping.apartment)}>{order.apartment}</DetailRow>
            <DetailRow label={t($ => $.drawer.shipping.landmark)}>{order.landmark}</DetailRow>
          </div>
        </div>

        {/* Column 3 — Address Summary */}
        <div className="mt-4 rounded-md border bg-muted/20 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t($ => $.drawer.shipping.addressSummary)}</p>
          <dl className="flex flex-col gap-2">
            <DetailRow label={t($ => $.drawer.shipping.fullAddress)}>
              {fullAddress || null}
            </DetailRow>
            <DetailRow label={t($ => $.drawer.shipping.addressNotes)}>
              {order.address_notes}
            </DetailRow>
            <DetailRow label={t($ => $.drawer.shipping.googleMapsLink)}>
              {order.google_maps_url ? (
                <a
                  href={order.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs break-all"
                >
                  {order.google_maps_url}
                </a>
              ) : null}
            </DetailRow>
          </dl>
        </div>

        {/* Column 4 — Map Card */}
        {loc?.lat && loc?.lng ? (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="flex items-start gap-2 bg-muted/20 px-3 py-2.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-mono text-xs font-medium tabular-nums">
                  {Number(loc.lat).toFixed(6)}, {Number(loc.lng).toFixed(6)}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline"
                >
                  maps.google.com ↗
                </a>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 p-2 border-t bg-muted/10">
              <Button variant="outline" size="sm" asChild>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <MapPin className="size-3.5" />
                  {t($ => $.drawer.shipping.openMap)}
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://www.waze.com/ul?ll=${loc.lat}%2C${loc.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                  <Navigation className="size-3.5" />
                  {t($ => $.drawer.shipping.waze)}
                </a>
              </Button>
              {loc.set_by ? (
                <span className="ms-auto self-center text-[10px] text-muted-foreground">
                  {t($ => $.drawer.shipping.addedBy, { name: loc.set_by })}
                </span>
              ) : null}
            </div>
          </div>
        ) : hasMapsData ? (
          <div className="mt-4 rounded-lg border border-dashed bg-muted/10 flex items-center justify-center gap-2 py-6 text-muted-foreground">
            <MapIcon className="size-5" />
            <span className="text-xs">{t($ => $.drawer.shipping.noGpsMapLinkOnly)}</span>
          </div>
        ) : null}
      </div>

      <Separator />

      {/* ── 2. Delivery Schedule ── */}
      <div>
        <SectionTitle>{t($ => $.drawer.shipping.schedule)}</SectionTitle>
        <DetailGrid>
          <DetailRow label={t($ => $.drawer.shipping.requestedDelivery)}>{formatDate(order.requested_delivery_date)}</DetailRow>
          <DetailRow label={t($ => $.drawer.shipping.deliveryWindow)}>{order.delivery_window}</DetailRow>
          <DetailRow label={t($ => $.drawer.shipping.preferredTime)}>{order.preferred_delivery_time}</DetailRow>
        </DetailGrid>
      </div>

      <Separator />

      {/* ── 3. Shipping Assignment ── */}
      <div>
        <SectionTitle>{t($ => $.drawer.shipping.assignment)}</SectionTitle>
        <DetailGrid>
          <DetailRow label={t($ => $.drawer.shipping.shippingCompany)}>{order.shipping_company_name}</DetailRow>
          <DetailRow label={t($ => $.drawer.shipping.carrier)}>{order.shipping_method}</DetailRow>
        </DetailGrid>
      </div>

      <Separator />

      {/* ── 4. Tracking ── */}
      <div>
        <SectionTitle>{t($ => $.drawer.shipping.tracking)}</SectionTitle>
        <DetailGrid>
          <DetailRow label={t($ => $.drawer.shipping.trackingNumber)}>
            {order.tracking_number
              ? <span className="font-mono text-xs">{order.tracking_number}</span>
              : null}
          </DetailRow>
          <DetailRow label={t($ => $.drawer.shipping.shipmentStatus)}>
            {attemptsLabel}
          </DetailRow>
        </DetailGrid>
      </div>

      <Separator />

      {/* ── 5. Delivery Verification ── */}
      <div>
        <SectionTitle>{t($ => $.drawer.shipping.verification)}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <VerificationBadge
            label={t($ => $.drawer.shipping.locationPinned)}
            icon={MapPin}
            verified={hasMapsData}
          />
          <VerificationBadge
            label={t($ => $.drawer.shipping.addressComplete)}
            icon={Building2}
            verified={!!(order.governorate && order.city)}
          />
          <VerificationBadge
            label={t($ => $.drawer.shipping.phoneRegistered)}
            icon={Phone}
            verified={!!order.billing_phone}
            detail={order.billing_phone}
          />
          <VerificationBadge
            label={t($ => $.drawer.shipping.customerConfirmation)}
            icon={UserCheck}
            verified={order.confirmation_result === 'confirmed'}
            detail={
              order.confirmation_result === 'confirmed' && order.customer_confirmed_at
                ? formatDate(order.customer_confirmed_at)
                : order.confirmation_result && order.confirmation_result !== 'confirmed'
                ? (order.customer_confirmed_by ? `${t($ => $.drawer.customer.copy)}: ${order.customer_confirmed_by}` : null)
                : null
            }
            statusText={
              order.confirmation_result === 'confirmed'   ? t($ => $.drawer.shipping.confirmed) :
              order.confirmation_result === 'not_answered'? t($ => $.drawer.shipping.noAnswer) :
              order.confirmation_result === 'rejected'    ? t($ => $.drawer.shipping.rejected)  :
              order.confirmation_result === 'postponed'   ? t($ => $.drawer.shipping.postponed) :
              t($ => $.drawer.shipping.pending)
            }
            statusColor={
              order.confirmation_result === 'confirmed'   ? 'text-emerald-600 dark:text-emerald-400' :
              order.confirmation_result === 'rejected'    ? 'text-red-600 dark:text-red-400'         :
              order.confirmation_result === 'not_answered'? 'text-amber-600 dark:text-amber-400'     :
              order.confirmation_result === 'postponed'   ? 'text-blue-600 dark:text-blue-400'       :
              'text-muted-foreground'
            }
          />
        </div>
      </div>

      <Separator />

      {/* ── 6. Shipping Actions ── */}
      <div>
        <SectionTitle>{t($ => $.drawer.shipping.shippingActions)}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {hasMapsData && (
            <Button variant="outline" size="sm" asChild>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <MapPin className="size-3.5" />
                {t($ => $.drawer.shipping.openMap)}
              </a>
            </Button>
          )}
          {fullAddress && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(fullAddress)}
            >
              <Copy className="size-3.5" />
              {t($ => $.drawer.shipping.copyAddress)}
            </Button>
          )}
          {coordsStr && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(coordsStr)}
            >
              <Navigation className="size-3.5" />
              {t($ => $.drawer.shipping.copyCoordinates)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


/**
 * DD-016 — Single location tab. Shows an interactive map frame when coordinates exist.
 */
function LocationTab({ order, t }: { order: Order; t: OrdersT }) {
  const loc = order.location;

  return (
    <div className="flex flex-col gap-4 p-4">
      {loc?.lat && loc?.lng ? (
        <>
          {/* GPS coordinates card */}
          <div className="flex items-start gap-3 overflow-hidden rounded-lg border bg-muted/20 px-4 py-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">GPS Location</p>
              <p className="font-mono text-sm font-medium tabular-nums">
                {Number(loc.lat).toFixed(6)}, {Number(loc.lng).toFixed(6)}
              </p>
              <a
                href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary hover:underline"
              >
                maps.google.com ↗
              </a>
            </div>
          </div>
          {/* Location actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation className="size-3.5" />
                {t($ => $.address.openMaps)}
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://www.waze.com/ul?ll=${loc.lat}%2C${loc.lng}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation className="size-3.5" />
                Waze
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(`https://www.google.com/maps?q=${loc.lat},${loc.lng}`)}
            >
              <MapPin className="size-3.5" />
              {t($ => $.address.copyLink)}
            </Button>
          </div>
          {loc.set_by ? (
            <p className="text-xs text-muted-foreground">
              {t($ => $.drawer.locationSetBy, { by: loc.set_by })}
            </p>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <MapPin className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t($ => $.drawer.noLocation)}</p>
        </div>
      )}
    </div>
  );
}

// ── Workflow Tab ──────────────────────────────────────────────────────────────

const WORKFLOW_TARGET_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pending:          RotateCcw,
  processing:       ArrowRightCircle,
  confirmed:        CheckCircle2,
  awaiting_payment: Banknote,
  preparing:        ArrowRightCircle,
  out_for_delivery: Truck,
  delivered:        CheckCircle2,
  completed:        CheckCircle2,
  cancelled:        XCircle,
  awaiting_stock:   Box,
  rescheduled:      Clock,
  review:           Activity,
  returned:         RotateCcw,
};

function WorkflowTab({ order, onClose }: { order: Order; onClose: () => void }) {
  const { t } = useTranslation('orders');
  const transition = useOrderWorkflowTransition();
  const reschedule = useOrderWorkflowReschedule();

  const today = new Date().toISOString().slice(0, 10);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleDate, setRescheduleDate]         = useState(today);
  const [activeReason, setActiveReason]             = useState<string | null>(null);
  const [reasonText, setReasonText]                 = useState('');

  const transitions = order.allowed_status_transitions ?? [];
  const isPending   = transition.isPending || reschedule.isPending;

  function handleAction(targetStatus: string) {
    if (targetStatus === 'scheduled') {
      setShowRescheduleForm(true);
      return;
    }
    const tr = transitions.find((tr) => tr.target_status === targetStatus);
    if (tr?.requires_reason && activeReason !== targetStatus) {
      setActiveReason(targetStatus);
      setReasonText('');
      return;
    }
    const reason = reasonText.trim() || undefined;
    const done   = () => { setActiveReason(null); setReasonText(''); onClose(); };
    transition.mutate({ id: order.id, targetStatus, reason }, { onSuccess: done });
  }

  function handleRescheduleConfirm() {
    if (!rescheduleDate) return;
    reschedule.mutate(
      { id: order.id, nextDeliveryDate: rescheduleDate },
      { onSuccess: () => { setShowRescheduleForm(false); onClose(); } },
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <SectionTitle>{t($ => $.drawer.workflow.currentStatus)}</SectionTitle>
        <OrderStatusBadge status={order.status} />
      </div>
      {transitions.length > 0 ? (
        <div>
          <SectionTitle>{t($ => $.drawer.workflow.availableActions)}</SectionTitle>
          <div className="flex flex-col gap-2">
            {showRescheduleForm ? (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <label className="text-xs font-medium text-muted-foreground">{t($ => $.drawer.workflow.newDeliveryDate)}</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={today}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleRescheduleConfirm}
                    disabled={reschedule.isPending || !rescheduleDate}
                    className="gap-1.5"
                  >
                    {reschedule.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
                    {t($ => $.drawer.workflow.confirmReschedule)}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowRescheduleForm(false)}>
                    {t($ => $.drawer.workflow.cancel)}
                  </Button>
                </div>
              </div>
            ) : (
              transitions.map((tr, idx) => {
                const Icon    = WORKFLOW_TARGET_ICON[tr.target_status] ?? ArrowRightCircle;
                const variant = tr.target_status === 'cancelled' ? 'destructive'
                              : idx === 0                        ? 'default'
                              : 'outline';
                const isActive = activeReason === tr.target_status;
                return (
                  <div key={tr.target_status}>
                    <Button
                      variant={variant as 'default' | 'outline' | 'destructive'}
                      size="sm"
                      onClick={() => {
                        if (isActive) { setActiveReason(null); setReasonText(''); }
                        else { handleAction(tr.target_status); }
                      }}
                      disabled={isPending}
                      className="w-full justify-start gap-2"
                    >
                      {isPending && activeReason === tr.target_status
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Icon className="size-4" />
                      }
                      {tr.label}
                    </Button>

                    {isActive && tr.requires_reason && (
                      <div className="mt-1.5 flex flex-col gap-1.5 rounded-md border bg-muted/30 p-2">
                        <input
                          autoFocus
                          placeholder="Enter reason…"
                          value={reasonText}
                          onChange={(e) => setReasonText(e.target.value)}
                          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAction(tr.target_status);
                            if (e.key === 'Escape') { setActiveReason(null); setReasonText(''); }
                          }}
                        />
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant={variant as 'default' | 'outline' | 'destructive'}
                            className="h-6 flex-1 text-xs"
                            disabled={isPending}
                            onClick={() => handleAction(tr.target_status)}
                          >
                            {isPending ? <Loader2 className="size-3 animate-spin" /> : t($ => $.drawer.workflow.confirmReschedule)}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            onClick={() => { setActiveReason(null); setReasonText(''); }}
                          >
                            {t($ => $.drawer.workflow.cancel)}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t($ => $.drawer.workflow.noActions)}</p>
      )}
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────

function InventoryTab({ order }: { order: Order }) {
  const { t } = useTranslation('orders');
  const inv = order as Order & {
    inventory_reserved_at?: string | null;
    inventory_shipped_at?: string | null;
  };
  const lines = order.lines ?? [];
  // Resolve the assigned warehouse from the line data the backend already supplies,
  // rather than exposing the raw assigned_warehouse_id UUID (W2-A).
  const warehouseName = lines.map((l) => l.warehouse_name).find(Boolean) ?? null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <SectionTitle>{t($ => $.drawer.inventory_tab.reservationStatus)}</SectionTitle>
        <DetailGrid>
          <DetailRow label={t($ => $.drawer.inventory_tab.reservedAt)}>
            {inv.inventory_reserved_at ? formatDate(inv.inventory_reserved_at) : (
              <span className="text-amber-600 text-sm font-medium">{t($ => $.drawer.inventory_tab.notReserved)}</span>
            )}
          </DetailRow>
          <DetailRow label={t($ => $.drawer.inventory_tab.shippedAt)}>
            {inv.inventory_shipped_at ? formatDate(inv.inventory_shipped_at) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </DetailRow>
        </DetailGrid>
      </div>
      <Separator />
      <div>
        <SectionTitle>{t($ => $.drawer.inventory_tab.fulfillment)}</SectionTitle>
        <DetailGrid>
          <DetailRow label={t($ => $.drawer.inventory_tab.assignedWarehouse)}>
            {warehouseName ?? <span className="text-muted-foreground text-sm">—</span>}
          </DetailRow>
          <DetailRow label={t($ => $.drawer.inventory_tab.lineItems)}>
            {t($ => $.drawer.inventory_tab.itemCount, { count: lines.length })}
          </DetailRow>
        </DetailGrid>
      </div>
      <Separator />
      <div>
        <SectionTitle>{t($ => $.drawer.inventory_tab.inventoryItems)}</SectionTitle>
        <div className="flex flex-col gap-2">
          {lines.map((line) => {
            const steps: Array<{ label: string; value: number }> = [
              { label: t($ => $.drawer.inventory_tab.qty.reserved),  value: line.reserved_qty },
              { label: t($ => $.drawer.inventory_tab.qty.prepared),  value: line.prepared_qty },
              { label: t($ => $.drawer.inventory_tab.qty.packed),    value: line.packed_qty },
              { label: t($ => $.drawer.inventory_tab.qty.loaded),    value: line.loaded_qty },
              { label: t($ => $.drawer.inventory_tab.qty.delivered), value: line.delivered_qty },
              { label: t($ => $.drawer.inventory_tab.qty.returned),  value: line.returned_qty },
              { label: t($ => $.drawer.inventory_tab.qty.cancelled), value: line.cancelled_qty },
            ].filter((s) => s.value > 0);
            return (
              <div key={line.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <Box className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{line.product?.name ?? '—'}</p>
                    <p className="font-mono text-xs text-muted-foreground">{line.product?.sku}</p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium">×{line.quantity}</span>
                </div>
                {(steps.length > 0 || line.warehouse_name || line.batch_number) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
                    {steps.map((s) => (
                      <span key={s.label} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {s.label} <span className="font-medium text-foreground tabular-nums">{s.value}</span>
                      </span>
                    ))}
                    {line.warehouse_name && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {line.warehouse_name}
                      </span>
                    )}
                    {line.batch_number && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                        {t($ => $.drawer.inventory_tab.qty.batch)} {line.batch_number}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────

type TColor = 'primary' | 'green' | 'amber' | 'blue' | 'cyan' | 'muted' | 'red';

const ADDRESS_FIELD_KEYS = new Set([
  'governorate','city','shipping_address','building','floor','apartment',
  'landmark','area','address_notes','billing_phone','customer_secondary_phone','customer_name',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRelative(d: Date, t: OrdersT): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return t($ => $.drawer.timeline_tab.justNow);
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return '';
}

function fmtDayLabel(d: Date, t: OrdersT): string {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return t($ => $.drawer.timeline_tab.today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return t($ => $.drawer.timeline_tab.yesterday);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

type DayGroup = { label: string; events: OrderActivity[] };

function groupByDay(events: OrderActivity[], t: OrdersT): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const ev of events) {
    const d = new Date(ev.created_at);
    const key = d.toDateString();
    if (!map.has(key)) map.set(key, { label: fmtDayLabel(d, t), events: [] });
    map.get(key)!.events.push(ev);
  }
  return Array.from(map.values());
}

// ── Event classification ──────────────────────────────────────────────────────

function resolveEventMeta(ev: OrderActivity, t: OrdersT): { title: string; color: TColor; icon: React.ReactNode } {
  const p     = (ev.payload  ?? {}) as Record<string, unknown>;
  const field = (p.field as string | undefined)
    ?? (ev.previous_value ? Object.keys(ev.previous_value)[0] : undefined);

  const ev_ = (k: string): string => (t as unknown as TDynamic)(`drawer.timeline_tab.events.${k}`);

  switch (ev.event_type) {
    case 'order_created':     return { title: ev_('order_created'),    color: 'primary', icon: <ShoppingBag className="size-3.5" /> };
    case 'order_updated':     return { title: ev_('order_updated'),    color: 'blue',    icon: <Edit className="size-3.5" /> };
    case 'customer_confirmed':return { title: ev_('customer_confirmed'),color:'green',   icon: <UserCheck className="size-3.5" /> };
    case 'customer_created':  return { title: ev_('customer_created'), color: 'cyan',   icon: <UserPlus className="size-3.5" /> };
    case 'customer_reused':   return { title: ev_('customer_reused'),  color: 'cyan',   icon: <User className="size-3.5" /> };
    case 'discount_applied':  return { title: ev_('discount_applied'), color: 'amber',  icon: <Percent className="size-3.5" /> };
    case 'discount_updated':  return { title: ev_('discount_updated'), color: 'amber',  icon: <Percent className="size-3.5" /> };
    case 'deposit_recorded':  return { title: ev_('deposit_recorded'), color: 'cyan',   icon: <Banknote className="size-3.5" /> };
    case 'deposit_updated':   return { title: ev_('deposit_updated'),  color: 'cyan',   icon: <Banknote className="size-3.5" /> };
    case 'note_added':        return { title: ev_('note_added'),       color: 'primary',icon: <MessageSquare className="size-3.5" /> };
    case 'note_updated':      return { title: ev_('note_updated'),     color: 'primary',icon: <PenLine className="size-3.5" /> };
    case 'note_deleted':      return { title: ev_('note_deleted'),     color: 'muted',  icon: <Trash2 className="size-3.5" /> };
    case 'proof_uploaded':    return { title: ev_('proof_uploaded'),   color: 'green',  icon: <FileCheck className="size-3.5" /> };
    case 'awaiting_payment':  return { title: ev_('awaiting_payment'), color: 'amber',  icon: <Clock className="size-3.5" /> };
    case 'delivery_date_set': return { title: ev_('delivery_date_set'),color: 'blue',   icon: <CalendarClock className="size-3.5" /> };
    case 'shipping_override': return { title: ev_('shipping_override'),color: 'amber',  icon: <Truck className="size-3.5" /> };
    case 'order_zone_updated':return { title: ev_('order_zone_updated'),color:'blue',   icon: <MapIcon className="size-3.5" /> };
    case 'location_set':      return { title: ev_('location_set'),     color: 'blue',   icon: <Navigation className="size-3.5" /> };
    case 'status_changed':    return { title: ev_('status_changed'),   color: 'blue',   icon: <Activity className="size-3.5" /> };
    case 'field_updated': {
      if (field === 'status')
        return { title: ev_('status_changed'), color: 'blue', icon: <Activity className="size-3.5" /> };
      if (field && ADDRESS_FIELD_KEYS.has(field) && !['billing_phone','customer_secondary_phone'].includes(field))
        return { title: ev_('address_updated'), color: 'blue', icon: <MapPin className="size-3.5" /> };
      if (field && ['billing_phone','customer_secondary_phone'].includes(field))
        return { title: ev_('phone_updated'), color: 'blue', icon: <Phone className="size-3.5" /> };
      return { title: ev_('data_updated'), color: 'muted', icon: <Edit className="size-3.5" /> };
    }
    default:
      if (ev.event_type.includes('cancel') || ev.event_type.includes('return'))
        return { title: ev.description, color: 'amber', icon: <XCircle className="size-3.5" /> };
      if (ev.event_type.includes('complet') || ev.event_type.includes('confirm'))
        return { title: ev.description, color: 'green', icon: <CheckCircle2 className="size-3.5" /> };
      return { title: ev.description, color: 'muted', icon: <Activity className="size-3.5" /> };
  }
}

// ── Primitive display components ──────────────────────────────────────────────


/** Vertical card diff — per-field card matching spec layout. */
function FieldChange({ label, oldVal, newVal, t }: { label: string; oldVal: string; newVal: string; t: OrdersT }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{t($ => $.drawer.timeline_tab.before)}</p>
          <p className={cn('font-mono break-all', oldVal ? 'line-through text-rose-600 dark:text-rose-400' : 'text-muted-foreground italic')}>{oldVal || '—'}</p>
        </div>
        <div className="flex justify-center">
          <ArrowDown className="size-3 text-muted-foreground" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{t($ => $.drawer.timeline_tab.after)}</p>
          <p className={cn('font-mono break-all font-medium', newVal ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground italic')}>{newVal || '—'}</p>
        </div>
      </div>
    </div>
  );
}

/** Status transition card — for workflow/status events. */
function StatusTransitionCard({
  oldStatus, newStatus, byName, reason, t,
}: {
  oldStatus: string; newStatus: string; byName?: string | null; reason?: string | null; t: OrdersT;
}) {
  const STATUS_COLOR: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    awaiting_payment: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    awaiting_stock: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    confirmed: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    preparing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    out_for_delivery: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    rescheduled: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    returned: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  };

  const badgeCls = (s: string) => cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
    STATUS_COLOR[s] ?? 'bg-muted text-muted-foreground',
  );

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-2.5">
      <div className="space-y-1.5">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t($ => $.drawer.timeline_tab.previousStatus)}</p>
          <span className={badgeCls(oldStatus)}>{(t as unknown as TDynamic)(`status.${oldStatus}`, { defaultValue: oldStatus })}</span>
        </div>
        <div className="flex justify-center">
          <ArrowDown className="size-3 text-muted-foreground" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t($ => $.drawer.timeline_tab.newStatus)}</p>
          <span className={badgeCls(newStatus)}>{(t as unknown as TDynamic)(`status.${newStatus}`, { defaultValue: newStatus })}</span>
        </div>
      </div>
      {(byName || reason) ? (
        <div className="border-t border-border pt-2 space-y-1">
          {byName  ? <p className="text-muted-foreground">{t($ => $.drawer.timeline_tab.by)} <span className="font-medium text-foreground">{byName}</span></p> : null}
          {reason  ? <p className="text-muted-foreground">{t($ => $.drawer.timeline_tab.reason)} <span className="font-medium text-foreground">{reason}</span></p> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Per-event structured details ──────────────────────────────────────────────

function EventDetails({ ev, t }: { ev: OrderActivity; t: OrdersT }) {
  const fmtCur = useOrderMoney();
  const meta = (ev.metadata      ?? {}) as Record<string, unknown>;
  const pl   = (ev.payload       ?? {}) as Record<string, unknown>;
  const prev = ev.previous_value as Record<string, unknown> | null;
  const next = ev.new_value      as Record<string, unknown> | null;

  switch (ev.event_type) {
    case 'order_created':
      return (
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {meta.channel       ? <span>{t($ => $.drawer.timeline_tab.channel)}: <span className="font-medium text-foreground">{String(meta.channel)}</span></span> : null}
          {meta.customer_name ? <span>{t($ => $.drawer.timeline_tab.customer)}: <span className="font-medium text-foreground">{String(meta.customer_name)}</span></span> : null}
          {meta.order_total != null ? <span>{t($ => $.drawer.timeline_tab.total)}: <span className="font-medium text-foreground">{fmtCur(Number(meta.order_total))}</span></span> : null}
        </div>
      );

    case 'customer_confirmed': {
      const method = String(meta.method ?? pl.communication_method ?? '');
      const result = String(meta.result ?? pl.result ?? '');
      const notes  = String(meta.notes  ?? pl.notes  ?? '');
      return (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs space-y-1">
          {method ? <p className="text-muted-foreground">{t($ => $.drawer.timeline_tab.method)} <span className="font-medium text-foreground capitalize">{method}</span></p> : null}
          {result ? (
            <p className="text-muted-foreground">{t($ => $.drawer.timeline_tab.result)}{' '}
              <span className={cn('font-semibold', result === 'confirmed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                {result}
              </span>
            </p>
          ) : null}
          {notes ? <p className="text-muted-foreground italic border-t border-border pt-1 mt-1">{notes}</p> : null}
        </div>
      );
    }

    case 'discount_applied':
    case 'discount_updated': {
      const type_  = String(meta.type ?? pl.type ?? next?.discount_type ?? '');
      const amount = meta.amount ?? pl.amount ?? next?.discount_amount;
      const calcVal = meta.calculated_value ?? pl.calculated_value;

      if (prev?.discount_amount !== undefined && next?.discount_amount !== undefined) {
        const fmt_ = (a: unknown, ty: unknown) => String(ty) === 'percentage' ? `${a}%` : fmtCur(Number(a ?? 0));
        return (
          <div className="space-y-2">
            <FieldChange
              t={t}
              label={t($ => $.drawer.timeline_tab.discount)}
              oldVal={fmt_(prev.discount_amount, prev.discount_type)}
              newVal={fmt_(next.discount_amount, next.discount_type)}
            />
          </div>
        );
      }

      return (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs space-y-1">
          {type_  ? <p className="text-muted-foreground">{t($ => $.drawer.timeline_tab.type)} <span className="font-medium text-foreground capitalize">{type_}</span></p> : null}
          {amount != null ? (
            <p className="text-muted-foreground">
              {t($ => $.drawer.timeline_tab.value)} <span className="font-medium text-foreground">{type_ === 'percentage' ? `${amount}%` : fmtCur(Number(amount))}</span>
            </p>
          ) : null}
          {calcVal != null ? (
            <p className="text-muted-foreground border-t border-border pt-1 mt-1">
              {t($ => $.drawer.timeline_tab.calculated)} <span className="font-semibold text-amber-600 dark:text-amber-400">{fmtCur(Number(calcVal))}</span>
            </p>
          ) : null}
        </div>
      );
    }

    case 'deposit_recorded':
    case 'deposit_updated': {
      const prevDep = prev?.deposit_amount;
      const nextDep = next?.deposit_amount;
      const prevRem = prev?.remaining_balance;
      const nextRem = next?.remaining_balance;
      const grandTotal = meta.grand_total ?? pl.grand_total;

      if (prevDep !== undefined && nextDep !== undefined) {
        return (
          <div className="space-y-2">
            <FieldChange t={t} label={t($ => $.drawer.timeline_tab.deposit)} oldVal={fmtCur(Number(prevDep))} newVal={fmtCur(Number(nextDep))} />
            {prevRem !== undefined && nextRem !== undefined
              ? <FieldChange t={t} label={t($ => $.drawer.timeline_tab.remainingBalance)} oldVal={fmtCur(Number(prevRem))} newVal={fmtCur(Number(nextRem))} />
              : null}
          </div>
        );
      }

      const amount = pl.amount ?? meta.amount;
      return (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs space-y-1">
          {amount != null ? <p className="text-muted-foreground">{t($ => $.drawer.timeline_tab.deposit)} <span className="font-medium text-foreground">{fmtCur(Number(amount))}</span></p> : null}
          {grandTotal != null ? <p className="text-muted-foreground">{t($ => $.drawer.timeline_tab.grandTotal)} <span className="font-medium text-foreground">{fmtCur(Number(grandTotal))}</span></p> : null}
        </div>
      );
    }

    case 'note_added': {
      const content = String(meta.content ?? pl.preview ?? '');
      return content ? (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t($ => $.drawer.timeline_tab.content)}</p>
          <p className="text-foreground whitespace-pre-wrap line-clamp-4">{content}</p>
        </div>
      ) : null;
    }

    case 'note_updated': {
      const oldContent = String(prev?.content ?? '');
      const newContent = String(next?.content ?? '');
      if (oldContent || newContent) {
        return (
          <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs space-y-2">
            {oldContent ? (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t($ => $.drawer.timeline_tab.previous)}</p>
                <p className="text-muted-foreground line-through whitespace-pre-wrap line-clamp-3">{oldContent}</p>
              </div>
            ) : null}
            <div className="flex justify-center">
              <ArrowDown className="size-3 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t($ => $.drawer.timeline_tab.current)}</p>
              <p className="text-foreground whitespace-pre-wrap line-clamp-3">{newContent || '—'}</p>
            </div>
          </div>
        );
      }
      return null;
    }

    case 'note_deleted': {
      const preview = String(meta.content_preview ?? '');
      return preview ? (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t($ => $.drawer.timeline_tab.deletedContent)}</p>
          <p className="text-muted-foreground line-through whitespace-pre-wrap line-clamp-3">{preview}</p>
        </div>
      ) : null;
    }

    case 'status_changed': {
      const oldVal = String(prev?.status ?? pl.old_value ?? '');
      const newVal = String(next?.status ?? pl.new_value ?? '');
      return (
        <StatusTransitionCard
          t={t}
          oldStatus={oldVal}
          newStatus={newVal}
          byName={ev.actor_name}
          reason={ev.reason}
        />
      );
    }

    case 'field_updated': {
      const f      = String(pl.field ?? (prev ? Object.keys(prev)[0] : ''));
      const oldVal = String(prev?.[f] ?? pl.old_value ?? '');
      const newVal = String(next?.[f] ?? pl.new_value ?? '');
      if (f === 'status') {
        return (
          <StatusTransitionCard
            t={t}
            oldStatus={oldVal}
            newStatus={newVal}
            byName={ev.actor_name}
            reason={ev.reason}
          />
        );
      }
      const fieldLabel = ADDRESS_FIELD_KEYS.has(f)
        ? (t as unknown as TDynamic)(`drawer.timeline_tab.addressFields.${f}`, { defaultValue: f.replace(/_/g, ' ') })
        : f.replace(/_/g, ' ');
      return <FieldChange t={t} label={fieldLabel} oldVal={oldVal} newVal={newVal} />;
    }

    case 'order_updated':
      if (prev && next && Object.keys(next).length > 0) {
        return (
          <div className="flex flex-col gap-2">
            {Object.keys(next).map((f) => {
              const fieldLabel = ADDRESS_FIELD_KEYS.has(f)
                ? (t as unknown as TDynamic)(`drawer.timeline_tab.addressFields.${f}`, { defaultValue: f.replace(/_/g, ' ') })
                : f.replace(/_/g, ' ');
              return (
                <FieldChange
                  key={f}
                  t={t}
                  label={fieldLabel}
                  oldVal={String(prev[f] ?? '')}
                  newVal={String(next[f] ?? '')}
                />
              );
            })}
          </div>
        );
      }
      return ev.changed_fields?.length ? (
        <p className="text-xs text-muted-foreground">{t($ => $.drawer.timeline_tab.modified)} {ev.changed_fields.join(', ')}</p>
      ) : null;

    case 'order_zone_updated': {
      const prev_ = String(pl.previous_zone ?? '');
      const next_ = String(pl.new_zone ?? '');
      return prev_ || next_ ? <FieldChange t={t} label={t($ => $.drawer.timeline_tab.deliveryZone)} oldVal={prev_} newVal={next_} /> : null;
    }

    case 'shipping_override':
      return pl.cost != null ? (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs">
          <p className="text-muted-foreground">{t($ => $.drawer.timeline_tab.customCost)} <span className="font-semibold text-foreground">{fmtCur(Number(pl.cost))}</span></p>
        </div>
      ) : null;

    default:
      return null;
  }
}

// ── Actor + Timestamp block ───────────────────────────────────────────────────

function ActorBlock({ ev }: { ev: OrderActivity }) {
  const { t } = useTranslation('orders');
  const d     = new Date(ev.created_at);
  const date  = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  const time  = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(d);
  const rel   = fmtRelative(d, t);

  const name   = ev.actor_name;
  const email  = ev.actor_email;
  const role   = ev.actor_role ?? (ev.metadata as Record<string, unknown> | null)?.actor_role as string | undefined;
  const branch = (ev.metadata as Record<string, unknown> | null)?.actor_branch as string | undefined;

  // Email local part as "username"
  const username = email ? email.split('@')[0] : null;

  return (
    <div className="mt-1.5 space-y-1 text-xs">
      {/* Identity */}
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {name     ? <><span className="text-muted-foreground">{t($ => $.drawer.actor.by)}</span><span className="font-medium text-foreground">{name}</span></> : null}
        {username ? <><span className="text-muted-foreground">{t($ => $.drawer.actor.user)}</span><span className="font-mono text-foreground">{username}</span></> : null}
        {role     ? <><span className="text-muted-foreground">{t($ => $.drawer.actor.role)}</span><span className="text-foreground">{role}</span></> : null}
        {branch   ? <><span className="text-muted-foreground">{t($ => $.drawer.actor.branch)}</span><span className="text-foreground">{branch}</span></> : null}
      </div>
      {/* Exact timestamp */}
      <div className="flex items-baseline gap-2 text-muted-foreground">
        <span className="tabular-nums">{date}</span>
        <span className="font-mono tabular-nums">{time}</span>
        {rel ? <span className="text-[10px] opacity-70">· {rel}</span> : null}
      </div>
    </div>
  );
}

// ── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({ order }: { order: Order }) {
  const { t }                           = useTranslation('orders');
  const { data: activities, isLoading } = useOrderActivities(order.id);

  const DOT_CLS: Record<TColor, string> = {
    primary: 'border-primary bg-primary/10',
    green:   'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
    amber:   'border-amber-500 bg-amber-50 dark:bg-amber-950/40',
    blue:    'border-blue-500 bg-blue-50 dark:bg-blue-950/40',
    cyan:    'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40',
    muted:   'border-border bg-background',
    red:     'border-rose-500 bg-rose-50 dark:bg-rose-950/40',
  };
  const ICON_CLS: Record<TColor, string> = {
    primary: 'text-primary',
    green:   'text-emerald-600 dark:text-emerald-400',
    amber:   'text-amber-600 dark:text-amber-400',
    blue:    'text-blue-600 dark:text-blue-400',
    cyan:    'text-cyan-600 dark:text-cyan-400',
    muted:   'text-muted-foreground',
    red:     'text-rose-600 dark:text-rose-400',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const events: OrderActivity[] = activities ?? [];

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center p-4">
        <Activity className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t($ => $.drawer.timeline_tab.noEvents)}</p>
      </div>
    );
  }

  const groups = groupByDay(events, t);

  return (
    <div className="p-4 space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          {/* Day separator */}
          <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background/90 backdrop-blur-sm py-1 z-10">
            <span className="text-xs font-semibold text-muted-foreground">{group.label}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Events in this day */}
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            <div className="flex flex-col gap-0">
              {group.events.map((ev) => {
                const { title, color, icon } = resolveEventMeta(ev, t);
                return (
                  <div key={ev.id} className="flex items-start gap-3 py-3 relative">
                    {/* Icon dot — event ID surfaced as tooltip for debug/support */}
                    <div
                      title={`Event ID: ${ev.id}`}
                      className={cn(
                        'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border cursor-help',
                        DOT_CLS[color],
                      )}
                    >
                      <span className={ICON_CLS[color]}>{icon}</span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm font-semibold leading-tight">{title}</p>
                      <ActorBlock ev={ev} />
                      <div className="mt-2">
                        <EventDetails ev={ev} t={t} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Workflow History Tab ──────────────────────────────────────────────────────

function WorkflowHistoryTab({ order }: { order: Order }) {
  const { t } = useTranslation('orders');
  const typedOrder = order as Order & {
    status_entered_at?: string | null;
    status_entered_by?: string | null;
    previous_status?: string | null;
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Current status */}
      <div>
        <SectionTitle>{t($ => $.drawer.history_tab.currentStatus)}</SectionTitle>
        <div className="rounded-md border bg-muted/20 px-4 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <OrderStatusBadge status={order.status} />
            </div>
            {typedOrder.status_entered_at ? (
              <p className="text-xs text-muted-foreground">
                {t($ => $.drawer.history_tab.enteredAt)}{' '}
                {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
                  new Date(typedOrder.status_entered_at),
                )}
              </p>
            ) : null}
            {typedOrder.status_entered_by ? (
              <p className="text-xs text-muted-foreground">{t($ => $.drawer.history_tab.by)} {typedOrder.status_entered_by}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Previous status */}
      {typedOrder.previous_status ? (
        <div>
          <SectionTitle>{t($ => $.drawer.history_tab.previousStatus)}</SectionTitle>
          <div className="rounded-md border px-4 py-3">
            <p className="text-sm font-medium capitalize text-muted-foreground">
              {(t as unknown as TDynamic)(`status.${String(typedOrder.previous_status)}`, { defaultValue: String(typedOrder.previous_status).replace(/_/g, ' ') })}
            </p>
          </div>
        </div>
      ) : null}

      {/* Key dates */}
      <div>
        <SectionTitle>{t($ => $.drawer.history_tab.keyDates)}</SectionTitle>
        <DetailGrid>
          <DetailRow label={t($ => $.drawer.history_tab.createdAt)}>
            {formatDate(order.created_at)}
          </DetailRow>
          {order.date_paid ? (
            <DetailRow label={t($ => $.drawer.history_tab.paymentConfirmed)}>
              {formatDate(order.date_paid)}
            </DetailRow>
          ) : null}
          {order.inventory_reserved_at ? (
            <DetailRow label={t($ => $.drawer.history_tab.reserved)}>
              {formatDate(order.inventory_reserved_at)}
            </DetailRow>
          ) : null}
          {order.inventory_shipped_at ? (
            <DetailRow label={t($ => $.drawer.history_tab.shipped)}>
              {formatDate(order.inventory_shipped_at)}
            </DetailRow>
          ) : null}
          {order.requested_delivery_date ? (
            <DetailRow label={t($ => $.drawer.history_tab.requestedDelivery)}>
              {formatDate(order.requested_delivery_date)}
            </DetailRow>
          ) : null}
        </DetailGrid>
      </div>

      {/* Order source */}
      <div>
        <SectionTitle>{t($ => $.drawer.history_tab.orderSource)}</SectionTitle>
        <p className="text-sm capitalize">{order.source ?? t($ => $.drawer.history_tab.manual)}</p>
      </div>

      <p className="text-xs text-muted-foreground border-t pt-3">
        {t($ => $.drawer.history_tab.auditLogNote)}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type OrderDetailDrawerProps = {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (order: Order) => void;
};

export function OrderDetailDrawer({ order, open, onOpenChange, onEdit }: OrderDetailDrawerProps) {
  const { t } = useTranslation('orders');
  const [activeTab, setActiveTab] = useState('summary');

  // Fetch fresh detail data so canonical financial fields and full customer profile are always current.
  // Falls back to grid row data (order) until the request completes.
  const { data: detailOrder, isLoading: detailLoading } = useOrderQuery(order?.id ?? '');
  const displayOrder = detailOrder ?? order;

  if (!displayOrder) return null;

  const isEnriching = detailLoading && !detailOrder;

  const tabs = [
    { key: 'summary',   label: t($ => $.drawer.tabs.summary),   content: <SummaryTab order={displayOrder} t={t} /> },
    { key: 'workflow',  label: t($ => $.drawer.tabs.workflow),   content: <WorkflowTab order={displayOrder} onClose={() => onOpenChange(false)} /> },
    { key: 'history',   label: t($ => $.drawer.tabs.history),   content: <WorkflowHistoryTab order={displayOrder} /> },
    { key: 'customer',  label: t($ => $.drawer.tabs.customer),   content: <CustomerTab order={displayOrder} t={t} /> },
    { key: 'products',  label: t($ => $.drawer.tabs.products),   content: <ProductsTab order={displayOrder} t={t} />, badge: (displayOrder.lines ?? []).length },
    { key: 'inventory', label: t($ => $.drawer.tabs.inventory),  content: <InventoryTab order={displayOrder} /> },
    { key: 'timeline',  label: t($ => $.drawer.tabs.timeline),   content: <TimelineTab order={displayOrder} /> },
    { key: 'payment',   label: t($ => $.drawer.tabs.payment),    content: <PaymentTab order={displayOrder} t={t} /> },
    { key: 'shipping',  label: t($ => $.drawer.tabs.shipping),   content: <ShippingTab order={displayOrder} t={t} /> },
    { key: 'notes',     label: t($ => $.drawer.tabs.notes),      content: <OrderNotesTab order={displayOrder} /> },
    { key: 'location',  label: t($ => $.drawer.tabs.location),   content: <LocationTab order={displayOrder} t={t} /> },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:w-[48vw] sm:min-w-[480px] sm:max-w-[820px]"
      >
        {/* ── Header ── */}
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="flex items-center gap-2 font-mono text-base">
                {displayOrder.order_number}
                <OrderStatusBadge status={displayOrder.status} />
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {displayOrder.customer?.name ?? '—'} · {displayOrder.channel?.name ?? '—'}
              </p>
            </div>
            {onEdit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onEdit(displayOrder); onOpenChange(false); }}
              >
                <Edit className="size-3.5" />
                {t($ => $.actions.edit)}
              </Button>
            ) : null}
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0">
                <X className="size-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Loading indicator — shown only on first fetch before detail data arrives */}
        {isEnriching ? (
          <div className="h-0.5 w-full animate-pulse bg-primary/40" />
        ) : null}

        {/* Distribution OS stage — shown when order is assigned to an active trip */}
        <OrderDistributionStageBanner orderId={displayOrder.id} />

        {/* ── Tabs + content ── */}
        <div className="flex-1 overflow-y-auto">
          <Tabs
            tabs={tabs}
            activeKey={activeTab}
            onTabChange={setActiveTab}
            className="h-full"
            contentClassName="overflow-y-auto"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
