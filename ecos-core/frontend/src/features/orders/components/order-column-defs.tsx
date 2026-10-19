// @refresh reset
import type { TFunction } from 'i18next';
import { Clock, ExternalLink, FileCheck, MessageCircle, MoreVertical, Printer, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DataGridColumnDef } from '@/components/data-grid/types';
import { MediaViewer } from '@/components/ui/media-viewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { OrderAddressCell } from './order-address-cell';
import { OrderConfirmationBadge } from './order-confirmation-badge';
import { OrderCustomerBadge } from './order-customer-badge';
import { OrderItemsPreview } from './order-items-preview';
import { OrderLocationCell } from './order-location-cell';
import { OrderPaymentCell } from './order-payment-cell';
import { OrderPhoneCell } from './order-phone-cell';
import { OrderInventoryExecutionCell } from './order-inventory-execution-cell';
import { OrderZoneEditor } from './order-zone-editor';
import { SmartStatusSelector } from './smart-status-selector';
import type { Order } from '../types/order';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | null): string {
  if (!d) return '–';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(d));
}

// ── Payment Proof cell ───────────────────────────────────────────────────────

function PaymentProofCell({ rawPath }: { rawPath: string }) {
  const { t } = useTranslation('orders');
  return (
    <MediaViewer
      path={rawPath}
      title="Payment Proof"
      trigger={
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium
            text-emerald-700 dark:text-emerald-400
            bg-emerald-50 dark:bg-emerald-900/30
            ring-1 ring-inset ring-emerald-600/20
            hover:ring-emerald-500/40 transition-colors"
        >
          <FileCheck className="size-3" />
          {t($ => $.columns.proofReceived)}
        </button>
      }
    />
  );
}

// ── Customer Intelligence badge ──────────────────────────────────────────────

type IntelligenceBadge = { label: string; cls: string };

function getIntelligenceBadge(totalOrders: number): IntelligenceBadge {
  if (totalOrders >= 10) return { label: '🔵 VIP',    cls: 'text-blue-700 dark:text-blue-400' };
  if (totalOrders >= 2)  return { label: '🟢 Repeat', cls: 'text-emerald-700 dark:text-emerald-400' };
  return                        { label: '🟠 New',     cls: 'text-orange-600 dark:text-orange-400' };
}

// ── Callbacks ─────────────────────────────────────────────────────────────────

export type OrderColumnCallbacks = {
  onView: (order: Order) => void;
  onEdit?: (order: Order) => void;
  onDelete?: (order: Order) => void;
  onStatusUpdated?: () => void;
  onEditLocation?: (order: Order) => void;
  onDeleteLocation?: (order: Order) => void;
  onNotes?: (order: Order) => void;
  onConfirmCustomer?: (order: Order) => void;
  onTimeline?: (order: Order) => void;
  onVerifyPayment?: (order: Order) => void;
  onPrint?: (order: Order) => void;
};

// ── Enterprise Actions Dropdown ───────────────────────────────────────────────

function OrderActionsMenu({ order, callbacks }: { order: Order; callbacks: OrderColumnCallbacks }) {
  const { t } = useTranslation('orders');
  const [copied, setCopied] = useState(false);
  const phone  = order.billing_phone ?? order.customer?.phone ?? order.customer?.mobile;
  const digits = phone?.replace(/\D/g, '') ?? '';

  function copyOrder() {
    void navigator.clipboard.writeText(`${window.location.origin}/app/orders/${order.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors outline-none"
          aria-label={t($ => $.actions.orderActions)}
        >
          <MoreVertical className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => callbacks.onView(order)}>
          <ExternalLink className="size-3.5" />
          {t($ => $.actions.viewOrder)}
        </DropdownMenuItem>
        {callbacks.onEdit ? (
          <DropdownMenuItem onClick={() => callbacks.onEdit!(order)}>
            <User className="size-3.5" />
            {t($ => $.actions.editOrder)}
          </DropdownMenuItem>
        ) : null}
        {order.customer?.id ? (
          <DropdownMenuItem asChild>
            <a href={`/app/customers/${order.customer.id}`} onClick={(e) => e.stopPropagation()}>
              <User className="size-3.5" />
              {t($ => $.actions.customerProfile)}
            </a>
          </DropdownMenuItem>
        ) : null}
        {callbacks.onTimeline ? (
          <DropdownMenuItem onClick={() => callbacks.onTimeline!(order)}>
            <Clock className="size-3.5" />
            {t($ => $.actions.timeline)}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {callbacks.onPrint ? (
          <DropdownMenuItem onClick={() => callbacks.onPrint!(order)}>
            <Printer className="size-3.5" />
            {t($ => $.actions.invoicePrint)}
          </DropdownMenuItem>
        ) : null}
        {phone ? (
          <DropdownMenuItem asChild>
            <a
              href={`https://wa.me/${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <MessageCircle className="size-3.5" />
              WhatsApp
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={copyOrder}>
          <ExternalLink className="size-3.5" />
          {copied ? t($ => $.actions.linkCopied) : t($ => $.actions.copyLink)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {callbacks.onDelete ? (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => callbacks.onDelete!(order)}
          >
            <MoreVertical className="size-3.5" />
            {t($ => $.actions.cancelOrder)}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Factory ───────────────────────────────────────────────────────────────────
// Enterprise column order (ORDER_COLUMN_META is authoritative for display order):
// ☐ Order | Customer | Status | Address | Zone | Location |
// Confirmation | Items | Payment | Payment Proof | Total | Customer Notes |
// Created | Sales Rep | Driver | Store | Attempts | Updated | Actions |
// [hidden: Delivery Window]

export function createOrderColumns(
  callbacks: OrderColumnCallbacks,
  t: TFunction<'orders'>,
): DataGridColumnDef<Order>[] {
  const { onView, onEditLocation, onDeleteLocation, onConfirmCustomer, onStatusUpdated } = callbacks;

  return [
    // ── Order # ───────────────────────────────────────────────────────────────
    {
      key: 'order_number',
      label: t($ => $.columns.number),
      alwaysVisible: true,
      pin: 'left',
      width: 148,
      sortable: true,
      skeletonClassName: 'h-4 w-20',
      cell: (order) => (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onView(order); }}
            onAuxClick={(e) => { if (e.button === 1) window.open(`/orders/${order.id}`, '_blank'); }}
            className="font-mono text-xs font-medium transition-colors hover:text-primary text-start"
          >
            {order.order_number}
          </button>
          {order.external_order_id ? (
            <span className="font-mono text-[10px] text-muted-foreground leading-none">
              {order.external_order_id}
            </span>
          ) : order.channel?.type?.toLowerCase() === 'manual' ? (
            <span className="text-[10px] text-muted-foreground/70 leading-none italic">
              {t($ => $.columns.manualOrder)}
            </span>
          ) : null}
        </div>
      ),
    },

    // ── Customer ──────────────────────────────────────────────────────────────
    {
      key: 'customer',
      label: t($ => $.columns.customer),
      defaultVisible: true,
      width: 280,
      skeletonClassName: 'h-4 w-28',
      cell: (order) => {
        const phone       = order.billing_phone ?? order.customer?.phone ?? order.customer?.mobile;
        const totalOrders = order.customer?.stats?.total_orders;
        const badge       = totalOrders !== undefined ? getIntelligenceBadge(totalOrders) : null;
        const name        = order.customer?.name ?? '–';

        return (
          <div className="flex items-start gap-2">
            {/* Avatar column — fixed width, aligned to first line of name */}
            {order.customer ? (
              <div
                className="shrink-0 pt-px"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <OrderCustomerBadge order={order} />
              </div>
            ) : null}
            {/* Text column — name, phone, badge all left-aligned with each other */}
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-medium leading-none">{name}</span>
              {phone ? (
                <div
                  className="mt-1"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <OrderPhoneCell phone={phone} />
                </div>
              ) : null}
              {badge ? (
                <span className={cn('mt-1.5 text-[10px] font-medium leading-none', badge.cls)}>
                  {badge.label}
                </span>
              ) : null}
            </div>
          </div>
        );
      },
    },

    // ── Status ────────────────────────────────────────────────────────────────
    {
      key: 'status',
      label: t($ => $.columns.status),
      defaultVisible: true,
      sortable: true,
      skeletonClassName: 'h-8 w-32 rounded-md',
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()}>
          <SmartStatusSelector order={order} onSuccess={onStatusUpdated} />
        </div>
      ),
    },

    // ── Delivery Address — full multi-line, no truncation ─────────────────────
    {
      key: 'address',
      label: t($ => $.columns.address),
      defaultVisible: true,
      skeletonClassName: 'h-4 w-40',
      cellClassName: 'min-w-48',
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <OrderAddressCell order={order} />
        </div>
      ),
    },

    // ── Zone — inline editable governorate/city ───────────────────────────────
    {
      key: 'zone',
      label: t($ => $.columns.zone),
      defaultVisible: true,
      skeletonClassName: 'h-4 w-20',
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <OrderZoneEditor order={order} />
        </div>
      ),
    },

    // ── Location — GPS pin + map / Waze / copy actions ────────────────────────
    {
      key: 'location',
      label: t($ => $.columns.location),
      defaultVisible: true,
      skeletonClassName: 'h-5 w-28',
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <OrderLocationCell
            order={order}
            onEdit={onEditLocation}
            onDelete={onDeleteLocation}
          />
        </div>
      ),
    },

    // ── Inventory Execution ───────────────────────────────────────────────────
    {
      key: 'inventory_execution',
      label: t($ => $.columns.inventoryExecution),
      defaultVisible: true,
      skeletonClassName: 'h-5 w-20 rounded-full',
      cell: (order) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <OrderConfirmationBadge order={order} />
            {onConfirmCustomer ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onConfirmCustomer(order); }}
                className="ml-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-muted hover:bg-muted hover:text-foreground transition-colors"
                title={order.confirmation_result ? 'Update confirmation' : 'Record confirmation'}
              >
                {order.confirmation_result ? '↻' : '+'}
              </button>
            ) : null}
          </div>
          <OrderInventoryExecutionCell
            reservationStatus={order.reservation_status}
            failureReason={order.reservation_failure_reason}
          />
        </div>
      ),
    },

    // ── Items — product count with popover preview ────────────────────────────
    {
      key: 'products_count',
      label: t($ => $.columns.productsCount),
      defaultVisible: true,
      align: 'center',
      skeletonClassName: 'h-4 w-6',
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <OrderItemsPreview lines={order.lines} />
        </div>
      ),
    },

    // ── Payment ───────────────────────────────────────────────────────────────
    {
      key: 'payment_method',
      label: t($ => $.columns.paymentMethod),
      defaultVisible: true,
      skeletonClassName: 'h-5 w-16 rounded',
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <OrderPaymentCell order={order} />
        </div>
      ),
    },

    // ── Payment Proof ─────────────────────────────────────────────────────────
    {
      key: 'payment_proof',
      label: t($ => $.columns.paymentProof),
      defaultVisible: true,
      skeletonClassName: 'h-5 w-24',
      cell: (order) => order.payment_proof_path
        ? <PaymentProofCell rawPath={order.payment_proof_path} />
        : <span className="text-xs text-muted-foreground">{t($ => $.columns.noProof)}</span>,
    },

    // ── Total (Remaining Balance = Grand Total − Deposit) ─────────────────────
    {
      key: 'total',
      label: t($ => $.columns.total),
      defaultVisible: true,
      sortable: true,
      align: 'end',
      skeletonClassName: 'h-4 w-14',
      cellClassName: 'tabular-nums font-medium',
      cell: (order) => {
        const remaining = order.remaining_balance ?? (order.grand_total - (order.deposit_paid ?? 0));
        return (
          <span className={remaining < order.grand_total ? 'text-amber-600 dark:text-amber-400' : ''}>
            {formatMoney(remaining)}
          </span>
        );
      },
    },

    // ── Customer Notes ────────────────────────────────────────────────────────
    {
      key: 'customer_note',
      label: t($ => $.columns.customerNote),
      defaultVisible: true,
      skeletonClassName: 'h-4 w-32',
      cell: (order) => {
        // Prefer the manual-order snapshot (customer_notes → customer.notes).
        // Fall back to the WooCommerce customer_note for imported orders.
        const note = order.customer?.notes ?? order.customer_note;
        if (!note) return <span className="text-muted-foreground">—</span>;
        return (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block max-w-[180px] truncate text-xs text-foreground cursor-default">
                  {note}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs whitespace-pre-wrap break-words">
                {note}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },

    // ── Created ───────────────────────────────────────────────────────────────
    {
      key: 'created_at',
      label: t($ => $.columns.createdAt),
      defaultVisible: true,
      sortable: true,
      skeletonClassName: 'h-4 w-20',
      cell: (order) => (
        <span className="text-xs text-muted-foreground tabular-nums">{formatDate(order.created_at)}</span>
      ),
    },

    // ── Sales Rep — channel-type-aware ───────────────────────────────────────
    // Manual → creator name | POS → cashier name + chip | WC/API → —
    {
      key: 'sales_rep',
      label: t($ => $.columns.salesRep),
      defaultVisible: true,
      skeletonClassName: 'h-4 w-24',
      cell: (order) => {
        const type = order.channel?.type?.toLowerCase() ?? null;

        // Imported orders: no sales rep unless explicitly stamped
        if (type === 'woocommerce' || type === 'public_api') {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        if (!order.created_by_name) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium leading-none">{order.created_by_name}</span>
            {type === 'pos' ? (
              <span className="text-[10px] font-medium leading-none text-amber-600 dark:text-amber-400">
                POS
              </span>
            ) : null}
          </div>
        );
      },
    },

    // ── Delivery Driver ───────────────────────────────────────────────────────
    {
      key: 'delivery_driver',
      label: t($ => $.columns.driver),
      defaultVisible: true,
      skeletonClassName: 'h-4 w-20',
      cell: () => (
        <span className="text-xs text-muted-foreground">—</span>
      ),
    },

    // ── Store ─────────────────────────────────────────────────────────────────
    {
      key: 'store',
      label: t($ => $.columns.store),
      defaultVisible: true,
      skeletonClassName: 'h-4 w-20',
      cell: (order) => {
        const typeMap: Record<string, string> = {
          woocommerce: 'WooCommerce', pos: 'POS', manual: 'Manual', public_api: 'API',
        };
        const src = order.channel?.type
          ? (typeMap[order.channel.type.toLowerCase()] ?? order.channel.type)
          : null;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs">{order.channel?.name ?? '–'}</span>
            {src ? (
              <span className="text-[10px] text-muted-foreground leading-none">{src}</span>
            ) : null}
          </div>
        );
      },
    },

    // ── Delivery Attempts ─────────────────────────────────────────────────────
    {
      key: 'shipping_attempts',
      label: t($ => $.columns.shippingAttempts),
      defaultVisible: true, // restored
      align: 'center',
      skeletonClassName: 'h-4 w-6',
      cell: (order) => {
        const count = order.shipping_attempts ?? 0;
        const cls =
          count === 0 ? 'text-muted-foreground'
          : count === 1 ? 'text-blue-600 dark:text-blue-400 font-medium'
          : count === 2 ? 'text-orange-500 dark:text-orange-400 font-medium'
          : 'text-red-500 dark:text-red-400 font-semibold';
        return <span className={cn('tabular-nums', cls)}>{count}</span>;
      },
    },

    // ── Updated ───────────────────────────────────────────────────────────────
    {
      key: 'updated_at',
      label: t($ => $.columns.updatedAt),
      defaultVisible: true, // restored
      skeletonClassName: 'h-4 w-20',
      cell: (order) => (
        <span className="text-xs text-muted-foreground tabular-nums">{formatDate(order.updated_at)}</span>
      ),
    },

    // ── Delivery Window (hidden) ──────────────────────────────────────────────
    {
      key: 'delivery_window',
      label: t($ => $.columns.deliveryWindow),
      defaultVisible: false,
      skeletonClassName: 'h-4 w-28',
      cell: (order) => {
        const date   = order.requested_delivery_date;
        const window = order.delivery_window ?? order.preferred_delivery_time;
        if (!date && !window) return <span className="text-muted-foreground">–</span>;
        return (
          <div className="flex flex-col gap-0.5">
            {date ? <span className="text-xs font-medium">{formatDate(date)}</span> : null}
            {window ? (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground leading-none">
                <Clock className="size-2.5" />
                {window}
              </span>
            ) : null}
          </div>
        );
      },
    },

    // ── Enterprise Actions ⋮ ──────────────────────────────────────────────────
    {
      key: 'actions',
      label: '',
      alwaysVisible: true,
      pin: 'right' as const,
      width: 40,
      skeletonClassName: 'h-5 w-5',
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <OrderActionsMenu order={order} callbacks={callbacks} />
        </div>
      ),
    },
  ];
}
