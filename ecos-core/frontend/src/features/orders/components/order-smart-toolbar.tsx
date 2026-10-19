import { ChevronDown } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AdvancedFilterValues } from '@/features/orders/components/order-advanced-filters';
import type { CustomerIntelligenceFilter, Order, OrderStatus } from '@/features/orders/types/order';
import { cn } from '@/lib/utils';

type StatusFilter = OrderStatus | 'all';

type ToolbarCtx = {
  activeStatus: StatusFilter;
  selectedIds: Set<string>;
  orders: Order[];
  advancedFilters: AdvancedFilterValues;
  setAdvancedFilters: (next: AdvancedFilterValues) => void;
  setCustomerFilter: (f: CustomerIntelligenceFilter | null) => void;
  setActiveStatus: (s: StatusFilter) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (v: boolean) => void;
  showCustomerIntelligence: boolean;
  setShowCustomerIntelligence: (v: boolean) => void;
  setHasLocation: (v: boolean | null) => void;
  setMinShippingAttempts: (v: number | null) => void;
};

// ── Op keys — every key must have a real implementation ───────────────────────

type OpKey =
  | 'repeatedCustomers'
  | 'repeatedSameStatus'
  | 'sameProduct'
  | 'sameShippingCompany'
  | 'ordersWithoutLocation'
  | 'multipleAttempts'
  | 'printOrders'
  | 'callCustomer'
  | 'codOrders';

type GroupLabelKey = 'groupCustomer' | 'groupShipping' | 'groupProduct';
type MoreLabelKey  = 'vipCustomers' | 'repeatedSameProduct' | 'repeatedSameShippingCo';

// ── Live count computation — zero extra network requests ──────────────────────

type OpCounts = Partial<Record<OpKey, number>>;

function freq(arr: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const v of arr) m[v] = (m[v] ?? 0) + 1;
  return m;
}

function computeCounts(orders: Order[]): OpCounts {
  const customerIds = orders
    .map((o) => o.customer?.id)
    .filter((v): v is string => Boolean(v));
  const customerFreq = freq(customerIds);

  const productIds = orders
    .flatMap((o) => o.lines.map((l) => l.product_id))
    .filter((v): v is string => Boolean(v));
  const productFreq = freq(productIds);

  const companies = orders
    .map((o) => o.shipping_company_name)
    .filter((v): v is string => Boolean(v));
  const companyFreq = freq(companies);

  return {
    repeatedCustomers:     orders.filter((o) => o.customer?.id && customerFreq[o.customer.id] > 1).length,
    repeatedSameStatus:    orders.filter((o) => o.customer?.id && customerFreq[o.customer.id] > 1).length,
    sameProduct:           orders.filter((o) => o.lines.some((l) => productFreq[l.product_id] > 1)).length,
    sameShippingCompany:   orders.filter((o) => Boolean(o.shipping_company_name && companyFreq[o.shipping_company_name] > 1)).length,
    ordersWithoutLocation: orders.filter((o) => !o.location).length,
    multipleAttempts:      orders.filter((o) => o.shipping_attempts >= 2).length,
    codOrders:             orders.filter((o) => o.payment_method?.toLowerCase() === 'cod').length,
    callCustomer:          orders.filter((o) => Boolean(o.billing_phone)).length,
    printOrders:           orders.length,
  };
}

// ── Context ops per status tab (flat list, counts applied) ────────────────────

const CONTEXT_OPS: Record<string, OpKey[]> = {
  waiting_for_payment: ['repeatedCustomers', 'callCustomer', 'codOrders'],
  shipping:            ['sameShippingCompany', 'ordersWithoutLocation', 'multipleAttempts', 'callCustomer'],
  preparing:           ['sameProduct', 'printOrders'],
};

// ── Default grouped view (All tab + unconfigured status tabs) ─────────────────

type OpGroup = { labelKey: GroupLabelKey; ops: OpKey[] };

const DEFAULT_GROUPS: OpGroup[] = [
  { labelKey: 'groupCustomer', ops: ['repeatedCustomers', 'repeatedSameStatus'] },
  { labelKey: 'groupShipping', ops: ['ordersWithoutLocation', 'multipleAttempts', 'sameShippingCompany'] },
  { labelKey: 'groupProduct',  ops: ['sameProduct'] },
];

// Ops that are always shown regardless of count (they perform actions, not filters)
const ALWAYS_SHOW = new Set<OpKey>(['printOrders']);

// ── Helpers ────────────────────────────────────────────────────────────────────

function selectedOrders(ctx: ToolbarCtx) {
  return ctx.orders.filter((o) => ctx.selectedIds.has(o.id));
}

function applyFilter(ctx: ToolbarCtx, patch: Partial<AdvancedFilterValues>) {
  ctx.setAdvancedFilters({ ...ctx.advancedFilters, ...patch });
  if (!ctx.showAdvancedFilters) ctx.setShowAdvancedFilters(true);
}

function applyCustomer(ctx: ToolbarCtx, f: CustomerIntelligenceFilter) {
  ctx.setCustomerFilter(f);
  if (!ctx.showCustomerIntelligence) ctx.setShowCustomerIntelligence(true);
}

function primaryShippingCompany(ctx: ToolbarCtx): string | null {
  return selectedOrders(ctx).map((o) => o.shipping_company_name).find(Boolean) ?? null;
}

function primaryProduct(ctx: ToolbarCtx): string | null {
  return selectedOrders(ctx).flatMap((o) => o.lines).map((l) => l.product_id).find(Boolean) ?? null;
}

// ── Operation execution ────────────────────────────────────────────────────────

function executeOp(key: OpKey, ctx: ToolbarCtx) {
  switch (key) {
    case 'repeatedCustomers':
      applyCustomer(ctx, 'repeated');
      break;
    case 'repeatedSameStatus':
      applyCustomer(ctx, 'repeated');
      break;
    case 'sameProduct': {
      const pid = primaryProduct(ctx);
      if (pid) applyFilter(ctx, { productId: pid });
      break;
    }
    case 'sameShippingCompany': {
      const co = primaryShippingCompany(ctx);
      if (co) applyFilter(ctx, { shippingCompany: co });
      break;
    }
    case 'callCustomer': {
      const phone = selectedOrders(ctx).map((o) => o.billing_phone).find(Boolean);
      if (phone) window.open(`tel:${phone}`, '_self');
      break;
    }
    case 'codOrders':
      applyFilter(ctx, { paymentMethod: 'cod' });
      break;
    case 'ordersWithoutLocation':
      ctx.setHasLocation(false);
      break;
    case 'multipleAttempts':
      ctx.setMinShippingAttempts(2);
      break;
    case 'printOrders':
      window.print();
      break;
  }
}

// ── OpChip — pill button with optional live count badge ───────────────────────

function OpChip({
  label,
  count,
  onClick,
  disabled,
}: {
  label: string;
  count?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled
          ? 'cursor-not-allowed border-border/50 text-muted-foreground/50'
          : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent',
      )}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
          {count}
        </span>
      ) : null}
    </button>
  );
}

// ── More menu ─────────────────────────────────────────────────────────────────

type MoreItem =
  | { separator: true;   labelKey?: never;      action: (ctx: ToolbarCtx) => void }
  | { separator?: false; labelKey: MoreLabelKey; action: (ctx: ToolbarCtx) => void };

const MORE_ITEMS: MoreItem[] = [
  { labelKey: 'vipCustomers',           action: (ctx) => applyCustomer(ctx, 'more_than_10') },
  { separator: true,                     action: () => {} },
  { labelKey: 'repeatedSameProduct',    action: (ctx) => { applyCustomer(ctx, 'repeated'); const pid = primaryProduct(ctx); if (pid) applyFilter(ctx, { productId: pid }); } },
  { labelKey: 'repeatedSameShippingCo', action: (ctx) => { applyCustomer(ctx, 'repeated'); const co = primaryShippingCompany(ctx); if (co) applyFilter(ctx, { shippingCompany: co }); } },
];

// ── Main component ─────────────────────────────────────────────────────────────

type Props = Omit<ToolbarCtx, never>;

/**
 * DD-028/029 Smart Operations Toolbar.
 * DD-031 Every chip shows a live count from the current page orders.
 *        Chips with zero matches are hidden. Groups collapse when all ops are zero.
 */
export function OrderSmartToolbar(ctx: Props) {
  const { t } = useTranslation('orders');

  const opLabel: Record<OpKey, string> = {
    repeatedCustomers:     t($ => $.smartToolbar.repeatedCustomers),
    repeatedSameStatus:    t($ => $.smartToolbar.repeatedSameStatus),
    sameProduct:           t($ => $.smartToolbar.sameProduct),
    sameShippingCompany:   t($ => $.smartToolbar.sameShippingCompany),
    ordersWithoutLocation: t($ => $.smartToolbar.ordersWithoutLocation),
    multipleAttempts:      t($ => $.smartToolbar.multipleAttempts),
    printOrders:           t($ => $.smartToolbar.printOrders),
    callCustomer:          t($ => $.smartToolbar.callCustomer),
    codOrders:             t($ => $.smartToolbar.codOrders),
  };

  const groupLabel: Record<GroupLabelKey, string> = {
    groupCustomer: t($ => $.smartToolbar.groupCustomer),
    groupShipping: t($ => $.smartToolbar.groupShipping),
    groupProduct:  t($ => $.smartToolbar.groupProduct),
  };

  const moreLabel: Record<MoreLabelKey, string> = {
    vipCustomers:           t($ => $.smartToolbar.vipCustomers),
    repeatedSameProduct:    t($ => $.smartToolbar.repeatedSameProduct),
    repeatedSameShippingCo: t($ => $.smartToolbar.repeatedSameShippingCo),
  };

  const counts = useMemo(() => computeCounts(ctx.orders), [ctx.orders]);

  const hasContext = ctx.activeStatus in CONTEXT_OPS;
  const contextOps = hasContext ? CONTEXT_OPS[ctx.activeStatus] : null;

  function shouldShow(op: OpKey): boolean {
    if (ALWAYS_SHOW.has(op)) return true;
    return (counts[op] ?? 0) > 0;
  }

  return (
    <div className="border-b bg-background px-4 py-2">
      <div className="flex items-center gap-3 overflow-x-auto pb-0.5">

        {hasContext && contextOps ? (
          /* ── Context-specific tab: flat list with counts ── */
          <div className="flex items-center gap-1.5">
            {contextOps.filter(shouldShow).map((op) => (
              <OpChip
                key={op}
                label={opLabel[op]}
                count={ALWAYS_SHOW.has(op) ? undefined : counts[op]}
                onClick={() => executeOp(op, ctx)}
              />
            ))}
          </div>
        ) : (
          /* ── Default / All tab: grouped view ── */
          DEFAULT_GROUPS.map((group) => {
            const visible = group.ops.filter(shouldShow);
            if (visible.length === 0) return null;
            return (
              <div key={group.labelKey} className="flex items-center gap-1.5">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupLabel[group.labelKey]}
                </span>
                {visible.map((op) => (
                  <OpChip
                    key={op}
                    label={opLabel[op]}
                    count={counts[op]}
                    onClick={() => executeOp(op, ctx)}
                  />
                ))}
              </div>
            );
          })
        )}

        {/* Separator */}
        <span className="mx-0.5 shrink-0 select-none text-border">|</span>

        {/* More dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 shrink-0 gap-1 px-2.5 text-xs">
              {t($ => $.smartToolbar.more)}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {MORE_ITEMS.map((item, i) =>
              item.separator ? (
                <DropdownMenuSeparator key={i} />
              ) : (
                <DropdownMenuItem key={item.labelKey} onClick={() => item.action(ctx)}>
                  {moreLabel[item.labelKey]}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </div>
  );
}
