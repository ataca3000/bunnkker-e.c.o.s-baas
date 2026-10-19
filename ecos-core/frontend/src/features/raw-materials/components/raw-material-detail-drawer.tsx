import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  BarChart2,
  Box,
  Calendar,
  DollarSign,
  Factory,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  RotateCcw,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tabs } from '@/components/ds/tabs';
import type { TabItem } from '@/components/ds/tabs';
import {
  useRawMaterialCostHistory,
  useRawMaterialStockMovements,
  useRawMaterialPurchaseHistory,
  useRawMaterialWarehouseDistribution,
} from '@/features/raw-materials/hooks/use-raw-materials';
import type { RawMaterial, PurchaseLayer, SupplierHistoryRow } from '@/features/raw-materials/types';
import type { MaterialCostHistoryEntry } from '@/features/cost-management/types/pricing-review';
import type { MovementType } from '@/features/stock-ledger/types/stock-movement';
import { PagePagination } from '@/components/page/pagination/page-pagination';
import { useCompany } from '@/features/organization/context/company-context';
import { formatMoney } from '@/lib/format';
import { AddStockWizard } from './add-stock-wizard';
import { getMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { resolveMaterialStockStatus } from '@/features/raw-materials/utils/material-stock-status';

// ─── Types ────────────────────────────────────────────────────────────────────

type RawMaterialDetailDrawerProps = {
  material:      RawMaterial | null;
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  onEdit?:       (material: RawMaterial) => void;
  initialTab?:   string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stockStatusConfig(availableQty: number | null | undefined, allowNegativeStock: boolean | null | undefined) {
  const status = resolveMaterialStockStatus(availableQty, allowNegativeStock);
  if (status === 'in_stock') {
    return {
      status: 'in_stock' as const,
      dot:    'bg-emerald-500',
      text:   'text-emerald-700 dark:text-emerald-400',
      badge:  'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    };
  }
  return {
    status: 'out_of_stock' as const,
    dot:    'bg-red-500',
    text:   'text-red-700 dark:text-red-400',
    badge:  'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
  };
}

function formatCost(cost: number | null | undefined, unit: string | undefined, currency: string, locale = 'en-US'): string {
  if (cost == null) return '—';
  const formatted = formatMoney(cost, currency, locale);
  return unit ? `${formatted} / ${unit}` : formatted;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month:  'short',
      day:    'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Canonical "current cost" resolver — the single source of truth for the
 * material's current cost across every tab. Prefers the latest recorded cost
 * event (material_cost_history) and falls back to the stored official cost.
 * Never reads the write-only `manual_cost` field (RAW-004).
 */
function resolveCurrentCost(
  material: RawMaterial,
  latestCostEntry?: MaterialCostHistoryEntry | null,
): number | null {
  return latestCostEntry?.new_cost ?? material.material_cost ?? null;
}

function movementTypeColor(type: MovementType): string {
  switch (type) {
    case 'purchase_receipt': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'transfer_in':      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    case 'transfer_out':     return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    case 'adjustment_in':    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    case 'adjustment_out':   return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
    case 'sales_issue':      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    default:                 return 'bg-muted text-muted-foreground';
  }
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
}: {
  label:      string;
  value:      ReactNode;
  sub?:       ReactNode;
  icon:       LucideIcon;
  iconClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide whitespace-nowrap">
        <Icon className={cn('size-3.5 flex-none', iconClass)} />
        <span className="truncate">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground truncate">{value}</span>
      {sub && <span className="text-xs text-muted-foreground truncate">{sub}</span>}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground mb-3">{children}</h3>;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">
        {value ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon:         LucideIcon;
  title:        string;
  description:  string;
  action?:      ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
      </div>
      {action}
    </div>
  );
}

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-5 text-muted-foreground animate-spin" />
    </div>
  );
}

// ─── Smart Status Panel ───────────────────────────────────────────────────────

function SmartStatusPanel({
  material,
  latestCostEntry,
}: {
  material:         RawMaterial;
  latestCostEntry?: MaterialCostHistoryEntry | null;
}) {
  const { t } = useTranslation('raw-materials');
  const { currency, locale } = useCompany();
  const cost      = resolveCurrentCost(material, latestCostEntry);
  const changePct = latestCostEntry?.change_pct;
  const updatedAt = latestCostEntry?.occurred_at;
  const source    = latestCostEntry?.source;

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:flex lg:items-center lg:gap-10">
      {/* Material Cost — smart card */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
          <DollarSign className="size-3.5 flex-none text-blue-500" />
          <span>{t($ => $.detail.smartPanel.materialCost)}</span>
          {source && (
            <span
              className={cn(
                'ml-1 rounded-full px-1.5 py-0 text-[10px] font-semibold uppercase',
                source === 'purchase_invoice'
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {source === 'purchase_invoice'
                ? t($ => $.detail.smartPanel.sourcePO)
                : t($ => $.detail.smartPanel.sourceManual)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground truncate">
            {formatCost(cost, material.unit?.name, currency, locale)}
          </span>
          {changePct != null && changePct !== 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                changePct > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {changePct > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {Math.abs(changePct).toFixed(1)}%
            </span>
          )}
        </div>
        {updatedAt && (
          <span className="text-xs text-muted-foreground">{formatDateTime(updatedAt)}</span>
        )}
      </div>

      <StatTile
        label={t($ => $.detail.smartPanel.unit)}
        value={material.unit?.name ?? '—'}
        icon={Box}
        iconClass="text-amber-500"
      />
      <StatTile
        label={t($ => $.detail.smartPanel.category)}
        value={material.category?.name ?? '—'}
        icon={Tag}
        iconClass="text-cyan-500"
      />
      <StatTile
        label={t($ => $.detail.smartPanel.lastUpdated)}
        value={formatDate(material.updated_at)}
        icon={Calendar}
        iconClass="text-slate-400"
      />
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  material,
  latestCostEntry,
}: {
  material:         RawMaterial;
  latestCostEntry?: MaterialCostHistoryEntry | null;
}) {
  const { t } = useTranslation('raw-materials');
  const { currency, locale } = useCompany();
  const hasDescription = Boolean(
    material.description || material.short_description || material.long_description,
  );

  function costSourceLabel(source: string | null | undefined): string {
    if (source === 'manual')   return t($ => $.detail.overview.costManual);
    if (source === 'purchase') return t($ => $.detail.overview.costPurchase);
    return '—';
  }

  return (
    <div className="space-y-7">
      <div>
        <SectionTitle>{t($ => $.detail.overview.generalInfo)}</SectionTitle>
        <DetailGrid>
          <DetailRow label={t($ => $.detail.overview.fullName)} value={material.name} />
          <DetailRow
            label={t($ => $.detail.overview.sku)}
            value={
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                {material.sku}
              </code>
            }
          />
          <DetailRow label={t($ => $.detail.overview.category)}       value={material.category?.name} />
          <DetailRow label={t($ => $.detail.overview.unitOfMeasure)}  value={material.unit?.name} />
          <DetailRow label={t($ => $.detail.overview.materialType)}   value={t($ => $.detail.overview.materialTypeValue)} />
          <DetailRow label={t($ => $.detail.overview.createdAt)}      value={formatDate(material.created_at)} />
          <DetailRow label={t($ => $.detail.overview.lastUpdated)}    value={formatDate(material.updated_at)} />
        </DetailGrid>
      </div>

      {hasDescription && (
        <>
          <Separator />
          <div>
            <SectionTitle>{t($ => $.detail.overview.description)}</SectionTitle>
            {(material.short_description ?? material.description) && (
              <p className="text-sm text-foreground mb-2">
                {material.short_description ?? material.description}
              </p>
            )}
            {material.long_description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {material.long_description}
              </p>
            )}
          </div>
        </>
      )}

      <Separator />

      <div>
        <SectionTitle>{t($ => $.detail.overview.cost)}</SectionTitle>
        <DetailGrid>
          <DetailRow
            label={t($ => $.detail.overview.currentCost)}
            value={formatCost(resolveCurrentCost(material, latestCostEntry), material.unit?.name, currency, locale)}
          />
          <DetailRow
            label={t($ => $.detail.overview.lastUpdated)}
            value={formatDate(latestCostEntry?.occurred_at ?? null)}
          />
          <DetailRow
            label={t($ => $.detail.overview.source)}
            value={costSourceLabel(material.cost_source)}
          />
        </DetailGrid>
      </div>
    </div>
  );
}

// ─── Tab: Inventory ───────────────────────────────────────────────────────────

function fmtQtyStr(n: number | null | undefined, unit?: string): string {
  if (n == null) return '—';
  const fmt = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  return unit ? `${fmt} ${unit}` : fmt;
}

function fmtCostStr(n: number | null | undefined, currency: string, locale = 'en-US'): string {
  if (n == null) return '—';
  return formatMoney(n, currency, locale);
}

function InventoryTab({ material }: { material: RawMaterial }) {
  const { t } = useTranslation('raw-materials');
  const { currency, locale } = useCompany();
  const { data: distribution } = useRawMaterialWarehouseDistribution(material.id);
  const avail    = stockStatusConfig(material.available_qty, material.allow_negative_stock);
  const statusLabel = avail.status === 'in_stock'
    ? t($ => $.detail.status.inStock)
    : t($ => $.detail.status.outOfStock);
  const unit     = material.unit?.name;
  const onHand   = material.on_hand_qty   ?? null;
  const reserved = material.reserved_qty  ?? null;
  const available = material.available_qty ?? null;
  const invValue = material.inventory_value ?? null;

  const metrics = [
    {
      label: t($ => $.detail.inventory.available),
      value: fmtQtyStr(available, unit),
      sub:   t($ => $.detail.inventory.availableSub),
      highlight: available != null && available <= 0 ? 'border-red-200 dark:border-red-800' : undefined,
    },
    {
      label: t($ => $.detail.inventory.reserved),
      value: fmtQtyStr(reserved, unit),
      sub:   t($ => $.detail.inventory.reservedSub),
    },
    {
      label: t($ => $.detail.inventory.onHand),
      value: fmtQtyStr(onHand, unit),
      sub:   t($ => $.detail.inventory.onHandSub),
    },
    {
      label: t($ => $.detail.inventory.inventoryValue),
      value: fmtCostStr(invValue, currency, locale),
      sub:   t($ => $.detail.inventory.inventoryValueSub),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', avail.badge)}>
        <span className={cn('size-2.5 rounded-full flex-none', avail.dot)} />
        <div>
          <p className={cn('text-sm font-semibold', avail.text)}>{statusLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t($ => $.detail.inventory.aggregatedNote)}
          </p>
        </div>
      </div>

      {/* Inventory snapshot */}
      <div>
        <SectionTitle>{t($ => $.detail.inventory.snapshotTitle)}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((card) => (
            <div
              key={card.label}
              className={cn('rounded-lg border bg-card p-3', card.highlight)}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Warehouse distribution — per-warehouse breakdown from the canonical inventory service */}
      <div>
        <SectionTitle>{t($ => $.detail.inventory.distributionTitle)}</SectionTitle>
        {(distribution?.warehouses.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t($ => $.detail.inventory.distributionEmpty)}</p>
        ) : (
          <div className="rounded-md border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {[
                    t($ => $.detail.inventory.colWarehouse),
                    t($ => $.detail.inventory.onHand),
                    t($ => $.detail.inventory.reserved),
                    t($ => $.detail.inventory.available),
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-start text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {distribution!.warehouses.map((w) => (
                  <tr key={w.warehouse_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 text-sm font-medium">{w.warehouse_name ?? w.warehouse_code ?? '—'}</td>
                    <td className="px-3 py-2.5 text-sm tabular-nums">{fmtQtyStr(w.on_hand_qty, unit)}</td>
                    <td className="px-3 py-2.5 text-sm tabular-nums">{fmtQtyStr(w.reserved_qty, unit)}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold tabular-nums">{fmtQtyStr(w.available_qty, unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inventory rules — canonical location, real fields only */}
      <div>
        <SectionTitle>{t($ => $.detail.inventory.rulesTitle)}</SectionTitle>
        <DetailGrid>
          <DetailRow
            label={t($ => $.detail.inventory.negativeStock)}
            value={material.allow_negative_stock
              ? t($ => $.detail.inventory.negAllowed)
              : t($ => $.detail.inventory.negBlocked)}
          />
        </DetailGrid>
      </div>
    </div>
  );
}

// ─── Tab: Suppliers ───────────────────────────────────────────────────────────

/**
 * Derive a per-supplier history from receipt layers: most-recent purchase date,
 * that purchase's unit cost, total received, and receipt count. Sorted newest
 * first, so the top row is the "Last Supplier". (RAW-003 — real data only.)
 */
function deriveSupplierHistory(layers: PurchaseLayer[]): SupplierHistoryRow[] {
  const bySupplier = new Map<string, SupplierHistoryRow>();
  for (const layer of layers) {
    if (!layer.supplier) continue;
    const key = layer.supplier.id;
    const existing = bySupplier.get(key);
    const isNewer =
      !existing ||
      (layer.receipt_date ?? '') > (existing.last_purchase_date ?? '');
    if (!existing) {
      bySupplier.set(key, {
        supplier_id:        key,
        supplier_name:      layer.supplier.name,
        last_purchase_date: layer.receipt_date,
        last_purchase_cost: layer.unit_cost,
        total_received:     layer.received_qty,
        receipts:           1,
      });
    } else {
      existing.total_received += layer.received_qty;
      existing.receipts += 1;
      if (isNewer) {
        existing.last_purchase_date = layer.receipt_date;
        existing.last_purchase_cost = layer.unit_cost;
      }
    }
  }
  return Array.from(bySupplier.values()).sort(
    (a, b) => (b.last_purchase_date ?? '').localeCompare(a.last_purchase_date ?? ''),
  );
}

function SuppliersTab({ materialId, unit }: { materialId: string; unit?: string }) {
  const { t } = useTranslation('raw-materials');
  const { currency, locale } = useCompany();
  const { data, isLoading } = useRawMaterialPurchaseHistory(materialId);

  if (isLoading) return <TabLoading />;

  const rows = deriveSupplierHistory(data?.receipt_layers ?? []);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title={t($ => $.detail.suppliers.emptyTitle)}
        description={t($ => $.detail.suppliers.emptyDesc)}
      />
    );
  }

  return (
    <div className="rounded-md border overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {[
              t($ => $.detail.suppliers.colSupplier),
              t($ => $.detail.suppliers.colLastPurchase),
              t($ => $.detail.suppliers.colLastCost),
              t($ => $.detail.suppliers.colTotalReceived),
            ].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-start text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((s, i) => (
            <tr key={s.supplier_id} className="hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2.5 text-sm font-medium">
                <span className="flex items-center gap-2">
                  {s.supplier_name}
                  {i === 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {t($ => $.detail.suppliers.lastSupplier)}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatDate(s.last_purchase_date)}</td>
              <td className="px-3 py-2.5 text-sm">
                {s.last_purchase_cost != null ? formatMoney(s.last_purchase_cost, currency, locale) : '—'}
              </td>
              <td className="px-3 py-2.5 text-sm tabular-nums">
                {fmtQtyStr(s.total_received, unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab: Price History ───────────────────────────────────────────────────────

function PriceHistoryTab({ materialId }: { materialId: string }) {
  const { t } = useTranslation('raw-materials');
  const { currency, locale } = useCompany();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useRawMaterialCostHistory(materialId, { page, per_page: 15 });

  const entries    = data?.data ?? [];
  const pagination = data?.pagination;

  // Current cost = latest recorded cost event (first entry). Highest/Lowest were
  // page-scoped (per_page:15) and misrepresented all-time extremes — removed (RAW-004).
  const currentCost = entries[0]?.new_cost ?? null;

  if (isLoading) return <TabLoading />;

  return (
    <div className="space-y-4">
      {/* Summary — single unified current cost (canonical source) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t($ => $.detail.priceHistory.currentCost)}
          </p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {formatCost(currentCost, undefined, currency, locale)}
          </p>
        </div>
      </div>

      {/* History table */}
      {entries.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={t($ => $.detail.priceHistory.emptyTitle)}
          description={t($ => $.detail.priceHistory.emptyDesc)}
        />
      ) : (
        <>
          <div className="rounded-md border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {[
                    t($ => $.detail.priceHistory.colDate),
                    t($ => $.detail.priceHistory.colPrevCost),
                    t($ => $.detail.priceHistory.colNewCost),
                    t($ => $.detail.priceHistory.colChange),
                    t($ => $.detail.priceHistory.colSource),
                    t($ => $.detail.priceHistory.colBy),
                    t($ => $.detail.priceHistory.colRecipes),
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-start text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => {
                  const isIncrease = (entry.change_pct ?? 0) > 0;
                  return (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(entry.occurred_at)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {formatCost(entry.previous_cost, undefined, currency, locale)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                        {formatCost(entry.new_cost, undefined, currency, locale)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {entry.change_pct != null ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-0.5 text-xs font-semibold',
                              isIncrease
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-emerald-600 dark:text-emerald-400',
                            )}
                          >
                            {isIncrease ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                            {Math.abs(entry.change_pct).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            entry.source === 'purchase_invoice'
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                          )}
                        >
                          {entry.source === 'purchase_invoice'
                            ? t($ => $.detail.priceHistory.sourcePurchase)
                            : t($ => $.detail.priceHistory.sourceManual)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                        {entry.updated_by ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {entry.affected_recipe_count > 0 ? (
                          <span className="font-medium">
                            {t($ => $.detail.priceHistory.recipesCount, { count: entry.affected_recipe_count })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination && pagination.last_page > 1 && (
            <PagePagination
              page={pagination.current_page}
              perPage={pagination.per_page}
              total={pagination.total}
              lastPage={pagination.last_page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: Stock History ───────────────────────────────────────────────────────

function StockHistoryTab({
  material,
  onAddStock,
}: {
  material:   RawMaterial;
  onAddStock: () => void;
}) {
  const { t } = useTranslation('raw-materials');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const [page, setPage] = useState(1);
  const { data, isLoading } = useRawMaterialStockMovements(material.id, {
    page,
    per_page: 15,
    sort_by:  'created_at',
    sort_dir: 'desc',
  });

  const movements  = data?.items ?? [];
  const pagination = data?.meta;

  if (isLoading) return <TabLoading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pagination ? t($ => $.detail.stockHistory.movementsTotal, { count: pagination.total }) : ''}
        </p>
        <Button size="sm" className="gap-1.5" onClick={onAddStock}>
          <PackagePlus className="size-4" />
          {t($ => $.detail.stockHistory.addStock)}
        </Button>
      </div>

      {movements.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title={t($ => $.detail.stockHistory.emptyTitle)}
          description={t($ => $.detail.stockHistory.emptyDesc)}
          action={
            <Button size="sm" onClick={onAddStock} className="gap-1.5 mt-1">
              <PackagePlus className="size-4" />
              {t($ => $.detail.stockHistory.addFirstEntry)}
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-md border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {[
                    t($ => $.detail.stockHistory.colDate),
                    t($ => $.detail.stockHistory.colWarehouse),
                    t($ => $.detail.stockHistory.colType),
                    t($ => $.detail.stockHistory.colQty),
                    t($ => $.detail.stockHistory.colBalanceAfter),
                    t($ => $.detail.stockHistory.colNotes),
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-start text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((m) => {
                  const typeLabel = tAny(`detail.movementTypes.${m.movement_type}`);
                  const typeColor = movementTypeColor(m.movement_type);
                  const isPositive = ['purchase_receipt', 'adjustment_in', 'transfer_in'].includes(m.movement_type);
                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(m.created_at ?? m.movement_date)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {m.warehouse?.name ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', typeColor)}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'font-semibold text-xs',
                            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                          )}
                        >
                          {isPositive ? '+' : '−'}{m.quantity}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs font-medium">
                        {m.balance_after}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                        {m.notes ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination && pagination.last_page > 1 && (
            <PagePagination
              page={pagination.current_page}
              perPage={pagination.per_page}
              total={pagination.total}
              lastPage={pagination.last_page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: Purchase History ────────────────────────────────────────────────────

function PurchaseHistoryTab() {
  const { t } = useTranslation('raw-materials');
  return (
    <EmptyState
      icon={ShoppingCart}
      title={t($ => $.detail.purchaseHistory.emptyTitle)}
      description={t($ => $.detail.purchaseHistory.emptyDesc)}
    />
  );
}

// ─── Tab: Manufacturing ───────────────────────────────────────────────────────

function ManufacturingTab() {
  const { t } = useTranslation('raw-materials');
  return (
    <EmptyState
      icon={Factory}
      title={t($ => $.detail.manufacturing.emptyTitle)}
      description={t($ => $.detail.manufacturing.emptyDesc)}
    />
  );
}

// ─── Tab: Analytics ───────────────────────────────────────────────────────────

function AnalyticsTab({ material }: { material: RawMaterial }) {
  const { t } = useTranslation('raw-materials');
  const { currency, locale } = useCompany();

  const kpis: Array<{
    label:     string;
    value:     string;
    sub:       string;
    icon:      LucideIcon;
    iconClass: string;
  }> = [
    { label: t($ => $.detail.analytics.avgPurchaseCost),    value: '—', sub: t($ => $.detail.analytics.avgPurchaseSub),        icon: DollarSign,  iconClass: 'text-blue-500'   },
    { label: t($ => $.detail.analytics.monthlyConsumption), value: '—', sub: t($ => $.detail.analytics.monthlyConsumptionSub), icon: TrendingDown, iconClass: 'text-purple-500' },
    { label: t($ => $.detail.analytics.stockCoverage),      value: '—', sub: t($ => $.detail.analytics.stockCoverageSub),      icon: Calendar,    iconClass: 'text-green-500'  },
    {
      label: t($ => $.detail.analytics.unitCost),
      value: formatCost(material.material_cost, undefined, currency, locale),
      sub:   t($ => $.detail.analytics.unitCostSub),
      icon:  BarChart2,
      iconClass: 'text-amber-500',
    },
    { label: t($ => $.detail.analytics.linkedSuppliers), value: '0', sub: t($ => $.detail.analytics.linkedSuppliersSub), icon: Truck,       iconClass: 'text-cyan-500'   },
    { label: t($ => $.detail.analytics.usedInRecipes),   value: '0', sub: t($ => $.detail.analytics.usedInRecipesSub),  icon: Factory,     iconClass: 'text-red-500'    },
    { label: t($ => $.detail.analytics.stockoutEvents),  value: '—', sub: t($ => $.detail.analytics.stockoutEventsSub), icon: TrendingDown, iconClass: 'text-orange-500' },
    { label: t($ => $.detail.analytics.costChanges),     value: '—', sub: t($ => $.detail.analytics.costChangesSub),    icon: TrendingUp,  iconClass: 'text-indigo-500' },
    { label: t($ => $.detail.analytics.avgLeadTime),     value: '—', sub: t($ => $.detail.analytics.avgLeadTimeSub),    icon: Calendar,    iconClass: 'text-teal-500'   },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {kpis.map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <card.icon className={cn('size-4', card.iconClass)} />
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-6 text-center">
        <BarChart2 className="mx-auto size-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-muted-foreground">{t($ => $.detail.analytics.comingSoon)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t($ => $.detail.analytics.comingSoonDesc)}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RawMaterialDetailDrawer({
  material,
  open,
  onOpenChange,
  onEdit,
  initialTab = 'overview',
}: RawMaterialDetailDrawerProps) {
  const { t } = useTranslation('raw-materials');
  const [activeTab,      setActiveTab]      = useState(initialTab);
  const [addStockOpen,   setAddStockOpen]   = useState(false);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  // Fetch the latest cost entry for the Smart Status Panel
  const { data: latestCostData } = useRawMaterialCostHistory(
    material?.id,
    { per_page: 1 },
  );
  const latestCostEntry = latestCostData?.data?.[0] ?? null;

  if (!material) return null;

  const avail = stockStatusConfig(material.available_qty, material.allow_negative_stock);
  const statusLabel = avail.status === 'in_stock'
    ? t($ => $.detail.status.inStock)
    : t($ => $.detail.status.outOfStock);

  function openAddStock() {
    setAddStockOpen(true);
  }

  const tabs: TabItem[] = [
    {
      key:     'overview',
      label:   t($ => $.detail.tabs.overview),
      content: <OverviewTab material={material} latestCostEntry={latestCostEntry} />,
    },
    {
      key:     'inventory',
      label:   t($ => $.detail.tabs.inventory),
      content: <InventoryTab material={material} />,
    },
    {
      key:     'suppliers',
      label:   t($ => $.detail.tabs.suppliers),
      content: <SuppliersTab materialId={material.id} unit={material.unit?.name} />,
    },
    {
      key:     'price-history',
      label:   t($ => $.detail.tabs.priceHistory),
      content: <PriceHistoryTab materialId={material.id} />,
    },
    {
      key:     'stock-history',
      label:   t($ => $.detail.tabs.stockHistory),
      content: <StockHistoryTab material={material} onAddStock={openAddStock} />,
    },
    {
      key:     'purchase-history',
      label:   t($ => $.detail.tabs.purchaseHistory),
      content: <PurchaseHistoryTab />,
    },
    {
      key:     'manufacturing',
      label:   t($ => $.detail.tabs.manufacturing),
      content: <ManufacturingTab />,
    },
    {
      key:     'analytics',
      label:   t($ => $.detail.tabs.analytics),
      content: <AnalyticsTab material={material} />,
    },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 overflow-hidden p-0 sm:w-[90vw] lg:w-[70vw]"
          style={{ maxWidth: 1400 }}
        >
          <SheetTitle className="sr-only">
            {t($ => $.detail.titleSr, { name: material.name })}
          </SheetTitle>

          {/* ── Drawer Header ── */}
          <div className="flex items-start gap-4 border-b px-6 py-5 flex-none pr-14">
            {/* Thumbnail */}
            <div className="size-16 shrink-0 rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
              {getMediaUrl(material.image_url) ? (
                <img src={getMediaUrl(material.image_url)!} alt={material.name} className="size-full object-cover" />
              ) : (
                <Package className="size-8 text-muted-foreground" />
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    avail.badge,
                    avail.text,
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', avail.dot)} />
                  {statusLabel}
                </span>

                {material.category && (
                  <Badge variant="outline" className="text-xs">
                    {material.category.name}
                  </Badge>
                )}
              </div>

              <h2 className="text-lg font-semibold text-foreground leading-tight">{material.name}</h2>

              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{material.sku}</code>
                {material.unit && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{material.unit.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 pt-0.5 flex items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={openAddStock}
              >
                <Zap className="size-3.5" />
                {t($ => $.detail.addStock)}
              </Button>
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(material);
                  }}
                >
                  <Pencil className="size-3.5" />
                  {t($ => $.detail.edit)}
                </Button>
              )}
            </div>
          </div>

          {/* ── Smart Status Panel ── */}
          <div className="border-b bg-muted/20 px-6 py-3 flex-none">
            <SmartStatusPanel material={material} latestCostEntry={latestCostEntry} />
          </div>

          {/* ── Tabs ── */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <Tabs
              tabs={tabs}
              activeKey={activeTab}
              onTabChange={setActiveTab}
              className="h-full"
              contentClassName="overflow-y-auto py-6 px-6 min-h-0"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Stock wizard — rendered outside Sheet to avoid stacking context issues */}
      <AddStockWizard
        material={material}
        open={addStockOpen}
        onOpenChange={setAddStockOpen}
        onSuccess={() => {
          setActiveTab('stock-history');
        }}
      />
    </>
  );
}
