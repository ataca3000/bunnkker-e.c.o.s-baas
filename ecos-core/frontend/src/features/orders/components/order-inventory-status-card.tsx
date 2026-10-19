import { AlertTriangle, BadgeCheck, Info, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { BrandOrderPolicy } from '@/features/orders/types/order';
import type { Product } from '@/features/products/types/product';
import type { ManualOrderLineFormValues } from '@/features/orders/components/order-form-schema';
import type enOrders from '@/i18n/locales/en/orders.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type OrdersLabel = ($: typeof enOrders) => string;

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveEntryStatuses(policy: BrandOrderPolicy): string[] {
  const mp = policy.source_entry_policies.manual;
  return Array.isArray(mp) ? mp : mp ? [mp] : [];
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Scenario derivation ───────────────────────────────────────────────────────

type InventoryScenario =
  | 'shortage'      // out-of-stock product(s), negative stock not enabled → ⚠ warning
  | 'negative'      // out-of-stock but negative stock allowed → ℹ info
  | 'auto_reserve'  // auto_reserve_inventory = true — trigger states from policy
  | 'manual'        // auto_reserve_inventory = false — manual reservation process
  | 'idle';         // no products selected yet — show policy intent

function deriveScenario(
  orderPolicy: BrandOrderPolicy,
  selectedProducts: Product[],
): InventoryScenario {
  const entryStatuses = resolveEntryStatuses(orderPolicy);

  if (selectedProducts.length === 0) {
    if (!orderPolicy.auto_reserve_inventory) return 'manual';
    return entryStatuses.length > 0 ? 'auto_reserve' : 'manual';
  }

  const outOfStock = selectedProducts.filter((p) => p.stock_status === 'outofstock');
  if (outOfStock.length > 0) {
    const allNegativeAllowed = outOfStock.every((p) => p.allow_negative_stock === true);
    return allNegativeAllowed ? 'negative' : 'shortage';
  }

  if (!orderPolicy.auto_reserve_inventory) return 'manual';
  return entryStatuses.length > 0 ? 'auto_reserve' : 'manual';
}

// ── Scenario config ───────────────────────────────────────────────────────────



type ScenarioConfig = {
  icon: React.ElementType;
  titleKey: OrdersLabel;
  policyKey?: OrdersLabel;
  subKey?: OrdersLabel;
  border: string;
  bg: string;
  iconColor: string;
  titleColor: string;
};

const SCENARIO_CONFIG: Record<InventoryScenario, ScenarioConfig> = {
  auto_reserve: {
    icon: BadgeCheck,
    titleKey: ($) => $.inventoryCard.title,
    policyKey: ($) => $.inventoryCard.autoPolicy,
    border: 'border-emerald-200 dark:border-emerald-800/50',
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    titleColor: 'text-emerald-800 dark:text-emerald-300',
  },
  shortage: {
    icon: AlertTriangle,
    titleKey: ($) => $.inventoryCard.warningTitle,
    subKey: ($) => $.inventoryCard.shortageWarning,
    border: 'border-amber-300 dark:border-amber-700/50',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    titleColor: 'text-amber-900 dark:text-amber-200',
  },
  negative: {
    icon: Info,
    titleKey: ($) => $.inventoryCard.policyTitle,
    border: 'border-sky-200 dark:border-sky-800/50',
    bg: 'bg-sky-50/60 dark:bg-sky-950/20',
    iconColor: 'text-sky-600 dark:text-sky-400',
    titleColor: 'text-sky-800 dark:text-sky-300',
  },
  manual: {
    icon: Info,
    titleKey: ($) => $.inventoryCard.title,
    policyKey: ($) => $.inventoryCard.manualPolicy,
    border: 'border-border',
    bg: 'bg-muted/30',
    iconColor: 'text-muted-foreground',
    titleColor: 'text-foreground',
  },
  idle: {
    icon: Package,
    titleKey: ($) => $.inventoryCard.title,
    border: 'border-border',
    bg: 'bg-muted/20',
    iconColor: 'text-muted-foreground',
    titleColor: 'text-foreground',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

type OrderInventoryStatusCardProps = {
  orderPolicy: BrandOrderPolicy | undefined;
  lines: ManualOrderLineFormValues[];
  allProductMap: Map<string, Product>;
  onViewPolicy: () => void;
};

export function OrderInventoryStatusCard({
  orderPolicy,
  lines,
  allProductMap,
  onViewPolicy,
}: OrderInventoryStatusCardProps) {
  const { t } = useTranslation('orders');
  if (!orderPolicy) return null;

  const selectedProducts = (lines ?? [])
    .filter((l) => Boolean(l.product_id))
    .map((l) => allProductMap.get(l.product_id))
    .filter((p): p is Product => Boolean(p));

  const scenario = deriveScenario(orderPolicy, selectedProducts);
  const cfg = SCENARIO_CONFIG[scenario];
  const Icon = cfg.icon;

  const entryStatuses = resolveEntryStatuses(orderPolicy);

  const shortageItems = scenario === 'shortage'
    ? selectedProducts.filter((p) => p.stock_status === 'outofstock' && !p.allow_negative_stock)
    : [];

  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${cfg.border} ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 shrink-0 ${cfg.iconColor}`} />
          <span className={`font-semibold ${cfg.titleColor}`}>{t(cfg.titleKey)}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={onViewPolicy}
        >
          {t($ => $.inventoryCard.viewPolicy)}
        </Button>
      </div>

      {/* Body */}
      <div className="mt-2 space-y-1.5 text-xs">
        {cfg.policyKey && (
          <div>
            <span className="text-muted-foreground">{t($ => $.inventoryCard.reservationPolicy)}</span>
            <span className="ml-1.5 font-medium">{t(cfg.policyKey)}</span>
          </div>
        )}

        {/* Auto-reserve: dynamic trigger state list from policy */}
        {scenario === 'auto_reserve' && (
          <>
            {entryStatuses.length > 0 ? (
              <div className="space-y-0.5">
                <p className="text-muted-foreground">
                  {t($ => $.inventoryCard.autoReserveOnEnter)}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {entryStatuses.map((s) => (
                    <li
                      key={s}
                      className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"
                    >
                      <span className="text-[10px]">•</span>
                      <span className="font-medium">{formatStatusLabel(s)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-muted-foreground">
                {t($ => $.inventoryCard.autoReserveOnCreate)}
              </p>
            )}
          </>
        )}

        {/* Manual reservation */}
        {scenario === 'manual' && (
          <p className="text-muted-foreground">
            {t($ => $.inventoryCard.manualReserveDesc)}
          </p>
        )}

        {/* Idle */}
        {scenario === 'idle' && (
          <p className="text-muted-foreground">
            {t($ => $.inventoryCard.idleDesc)}
          </p>
        )}

        {/* Negative stock */}
        {scenario === 'negative' && (
          <p className="text-muted-foreground">
            {t($ => $.inventoryCard.negativeDesc)}
          </p>
        )}

        {/* Shortage product list */}
        {shortageItems.length > 0 && (
          <>
            <p className="text-muted-foreground">{t($ => $.inventoryCard.unavailableProducts)}</p>
            <ul className="space-y-0.5">
              {shortageItems.map((p) => (
                <li key={p.id} className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-2.5 shrink-0" />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">— {t($ => $.inventoryCard.outOfStock)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {cfg.subKey && <p className="font-medium text-amber-700 dark:text-amber-400">{t(cfg.subKey)}</p>}
      </div>
    </div>
  );
}
