import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, TrendingDown, TrendingUp } from 'lucide-react';

import { Tabs } from '@/components/ds/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useProductCostDetail } from '@/features/cost-management/hooks/use-pricing-reviews';
import type { PricingReview } from '@/features/cost-management/types/pricing-review';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function DiffBadge({ value }: { value: number }) {
  const positive = value > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        positive ? 'text-red-600' : value < 0 ? 'text-emerald-600' : 'text-muted-foreground',
      )}
    >
      {positive ? <TrendingUp className="size-3" /> : value < 0 ? <TrendingDown className="size-3" /> : null}
      {fmtPct(value)}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  );
}

// ── Tab components ────────────────────────────────────────────────────────────

function CostBreakdownTab({ review }: { review: PricingReview; detailLoading: boolean }) {
  const { t } = useTranslation('cost-management');
  const totalCurrent = review.product_cost;
  const totalPrevious = review.previous_product_cost;

  const rows = [
    { label: t($ => $.drawer.costBreakdown.rows.rawMaterials),  current: totalCurrent * 0.72, previous: totalPrevious * 0.72, category: 'raw_material' as const },
    { label: t($ => $.drawer.costBreakdown.rows.packaging),      current: totalCurrent * 0.18, previous: totalPrevious * 0.18, category: 'packaging' as const },
    { label: t($ => $.drawer.costBreakdown.rows.otherCosts),     current: totalCurrent * 0.10, previous: totalPrevious * 0.10, category: 'other' as const },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionLabel>{t($ => $.drawer.costBreakdown.title)}</SectionLabel>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-start text-muted-foreground">
              <th className="pb-2 pe-4 font-medium">{t($ => $.drawer.costBreakdown.columns.component)}</th>
              <th className="pb-2 pe-4 text-end font-medium">{t($ => $.drawer.costBreakdown.columns.previous)}</th>
              <th className="pb-2 pe-4 text-end font-medium">{t($ => $.drawer.costBreakdown.columns.current)}</th>
              <th className="pb-2 pe-4 text-end font-medium">{t($ => $.drawer.costBreakdown.columns.change)}</th>
              <th className="pb-2 text-end font-medium">{t($ => $.drawer.costBreakdown.columns.pctOfTotal)}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const diff = row.current - row.previous;
              const diffPct = row.previous > 0 ? (diff / row.previous) * 100 : 0;
              const pctOfTotal = totalCurrent > 0 ? (row.current / totalCurrent) * 100 : 0;
              return (
                <tr key={row.label}>
                  <td className="py-2.5 pe-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'size-2 rounded-full flex-shrink-0',
                        row.category === 'raw_material' ? 'bg-blue-500'
                          : row.category === 'packaging' ? 'bg-purple-500'
                          : 'bg-slate-400',
                      )} />
                      {row.label}
                    </div>
                  </td>
                  <td className="py-2.5 pe-4 text-end tabular-nums text-muted-foreground">{fmt(row.previous)}</td>
                  <td className="py-2.5 pe-4 text-end tabular-nums font-medium">{fmt(row.current)}</td>
                  <td className="py-2.5 pe-4 text-end">
                    <DiffBadge value={diffPct} />
                  </td>
                  <td className="py-2.5 text-end text-muted-foreground tabular-nums">{pctOfTotal.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="py-2.5 pe-4">{t($ => $.drawer.costBreakdown.footer.recipeTotal)}</td>
              <td className="py-2.5 pe-4 text-end tabular-nums text-muted-foreground">{fmt(totalPrevious)}</td>
              <td className="py-2.5 pe-4 text-end tabular-nums">{fmt(totalCurrent)}</td>
              <td className="py-2.5 pe-4 text-end">
                <DiffBadge value={totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : 0} />
              </td>
              <td className="py-2.5 text-end">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t($ => $.drawer.costBreakdown.cards.previousProductCost), value: fmt(totalPrevious), muted: true },
          { label: t($ => $.drawer.costBreakdown.cards.productCost), value: fmt(totalCurrent) },
          {
            label: t($ => $.drawer.costBreakdown.cards.netChange),
            value: `${totalCurrent >= totalPrevious ? '+' : ''}${fmt(totalCurrent - totalPrevious)}`,
            red: totalCurrent > totalPrevious,
            green: totalCurrent < totalPrevious,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn(
              'mt-1 text-lg font-semibold tabular-nums',
              card.red ? 'text-red-600' : card.green ? 'text-emerald-600' : '',
            )}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecipeChangesTab({ review }: { review: PricingReview }) {
  const { t } = useTranslation('cost-management');
  const hasChanges = review.impacts.includes('recipe_changed') || review.impacts.includes('cost_increased') || review.impacts.includes('cost_decreased');

  if (!hasChanges) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="size-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{t($ => $.drawer.recipeChanges.empty)}</p>
      </div>
    );
  }

  const mockChanges = [
    { material_name: 'Green Coffee Beans', sku: 'RM-GCB-001', old_price: 12.00, new_price: 14.50, quantity: 0.280 },
    { material_name: 'Arabica Blend A', sku: 'RM-ARB-002', old_price: 18.00, new_price: 19.50, quantity: 0.120 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>{t($ => $.drawer.recipeChanges.title)}</SectionLabel>
      <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
        {mockChanges.map((change) => {
          const diff = change.new_price - change.old_price;
          const diffPct = (diff / change.old_price) * 100;
          return (
            <div key={change.sku} className="flex items-center justify-between p-3 gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{change.material_name}</p>
                <p className="text-xs text-muted-foreground">{change.sku} · Qty {change.quantity}</p>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0 text-sm">
                <div className="text-end">
                  <p className="text-xs text-muted-foreground">{t($ => $.drawer.recipeChanges.previous)}</p>
                  <p className="tabular-nums">{fmt(change.old_price)}</p>
                </div>
                <div className="text-muted-foreground">→</div>
                <div className="text-end">
                  <p className="text-xs text-muted-foreground">{t($ => $.drawer.recipeChanges.new)}</p>
                  <p className="tabular-nums font-medium">{fmt(change.new_price)}</p>
                </div>
                <div className="w-16 text-end">
                  <DiffBadge value={diffPct} />
                  <p className="text-xs text-muted-foreground tabular-nums">+{fmt(Math.abs(diff))}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriceHistoryTab({ review }: { review: PricingReview }) {
  const { t } = useTranslation('cost-management');
  const mockHistory = [
    { date: '2026-06-01', selling_price: 40.00, cost: 19.00, margin: 52.5, changed_by: 'Ahmed Hassan' },
    { date: '2026-04-15', selling_price: 42.00, cost: 20.50, margin: 51.2, changed_by: 'Sara Ali' },
    { date: '2026-01-10', selling_price: review.selling_price, cost: review.previous_product_cost, margin: review.current_margin, changed_by: 'Ahmed Hassan' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>{t($ => $.drawer.priceHistory.title)}</SectionLabel>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-start text-muted-foreground">
            <th className="pb-2 pe-4 font-medium">{t($ => $.drawer.priceHistory.columns.date)}</th>
            <th className="pb-2 pe-4 text-end font-medium">{t($ => $.drawer.priceHistory.columns.sellingPrice)}</th>
            <th className="pb-2 pe-4 text-end font-medium">{t($ => $.drawer.priceHistory.columns.cost)}</th>
            <th className="pb-2 pe-4 text-end font-medium">{t($ => $.drawer.priceHistory.columns.margin)}</th>
            <th className="pb-2 font-medium">{t($ => $.drawer.priceHistory.columns.by)}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {mockHistory.map((entry) => (
            <tr key={entry.date}>
              <td className="py-2.5 pe-4 text-muted-foreground">{entry.date}</td>
              <td className="py-2.5 pe-4 text-end tabular-nums font-medium">{fmt(entry.selling_price)}</td>
              <td className="py-2.5 pe-4 text-end tabular-nums text-muted-foreground">{fmt(entry.cost)}</td>
              <td className="py-2.5 pe-4 text-end">
                <span className={cn(
                  'font-medium tabular-nums',
                  entry.margin >= review.target_margin ? 'text-emerald-600' : 'text-red-600',
                )}>
                  {entry.margin.toFixed(1)}%
                </span>
              </td>
              <td className="py-2.5 text-muted-foreground">{entry.changed_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarginSimulationTab({ review }: { review: PricingReview }) {
  const { t } = useTranslation('cost-management');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const [simPrice, setSimPrice] = useState(review.suggested_selling_price.toFixed(2));

  const price = parseFloat(simPrice) || 0;
  const cost = review.product_cost;
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
  const profit = price - cost;
  const currentMargin = review.current_margin;
  const marginDelta = margin - currentMargin;
  const targetDelta = margin - review.target_margin;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionLabel>{t($ => $.drawer.marginSimulation.title)}</SectionLabel>
        <p className="text-xs text-muted-foreground mb-4">
          {t($ => $.drawer.marginSimulation.description)}
        </p>

        <div className="max-w-xs">
          <Label className="text-sm mb-1.5 block">{t($ => $.drawer.marginSimulation.label)}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={simPrice}
            onChange={(e) => setSimPrice(e.target.value)}
            className="text-right text-base tabular-nums font-semibold"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          {
            label: t($ => $.drawer.marginSimulation.cards.expectedMargin),
            value: `${margin.toFixed(2)}%`,
            sub: tAny('drawer.marginSimulation.cards.expectedMarginSub', { delta: `${marginDelta >= 0 ? '+' : ''}${marginDelta.toFixed(2)}%` }),
            good: margin >= review.target_margin,
          },
          {
            label: t($ => $.drawer.marginSimulation.cards.profitPerUnit),
            value: fmt(profit),
            sub: tAny('drawer.marginSimulation.cards.profitPerUnitSub', { cost: fmt(cost) }),
            good: profit > 0,
          },
          {
            label: t($ => $.drawer.marginSimulation.cards.vsTargetMargin),
            value: `${targetDelta >= 0 ? '+' : ''}${targetDelta.toFixed(2)}%`,
            sub: tAny('drawer.marginSimulation.cards.vsTargetMarginSub', { target: review.target_margin.toFixed(1) }),
            good: margin >= review.target_margin,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={cn(
              'rounded-lg border p-3',
              card.good ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
            )}
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn('mt-1 text-lg font-semibold tabular-nums', card.good ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
              {card.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <Separator />

      <div>
        <SectionLabel>{t($ => $.drawer.marginSimulation.refPoints.title)}</SectionLabel>
        <div className="flex flex-col gap-2 text-sm">
          {[
            {
              label: t($ => $.drawer.marginSimulation.refPoints.currentSellingPrice),
              value: review.selling_price,
              note: tAny('drawer.marginSimulation.refPoints.currentSellingPriceSub', { margin: currentMargin.toFixed(1) }),
            },
            {
              label: t($ => $.drawer.marginSimulation.refPoints.suggestedPrice),
              value: review.suggested_selling_price,
              note: t($ => $.drawer.marginSimulation.refPoints.suggestedPriceSub),
            },
            {
              label: t($ => $.drawer.marginSimulation.refPoints.breakEven),
              value: cost,
              note: t($ => $.drawer.marginSimulation.refPoints.breakEvenSub),
            },
          ].map((ref) => (
            <button
              key={ref.label}
              type="button"
              onClick={() => setSimPrice(ref.value.toFixed(2))}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-start hover:bg-accent transition-colors"
            >
              <div>
                <span className="font-medium">{ref.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{ref.note}</span>
              </div>
              <span className="tabular-nums font-mono">{fmt(ref.value)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ApprovalHistoryTab({ review }: { review: PricingReview }) {
  const { t } = useTranslation('cost-management');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const ACTION_LABELS: Record<string, string> = {
    approved:     t($ => $.drawer.approvalHistory.actions.approved),
    kept:         t($ => $.drawer.approvalHistory.actions.kept),
    custom_price: t($ => $.drawer.approvalHistory.actions.customPrice),
    snoozed:      t($ => $.drawer.approvalHistory.actions.snoozed),
    assigned:     t($ => $.drawer.approvalHistory.actions.assigned),
  };

  const ACTION_COLORS: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    kept: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    custom_price: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    snoozed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    assigned: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  if (review.status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="size-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{t($ => $.drawer.approvalHistory.empty)}</p>
      </div>
    );
  }

  const mockHistory = [
    {
      id: '1',
      action: review.status === 'snoozed' ? 'snoozed' : review.status,
      old_price: review.previous_product_cost + 10,
      new_price: review.selling_price,
      reason: review.status === 'kept' ? 'Competitive pricing pressure — will be reviewed next quarter' : null,
      actor: { id: 'u1', name: 'Ahmed Hassan' },
      created_at: review.updated_at,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>{t($ => $.drawer.approvalHistory.title)}</SectionLabel>
      {mockHistory.map((entry) => (
        <div key={entry.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', ACTION_COLORS[entry.action])}>
              {ACTION_LABELS[entry.action] ?? entry.action}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {entry.created_at.slice(0, 10)}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium">{entry.actor.name}</p>
          {entry.old_price && entry.new_price && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {tAny('drawer.approvalHistory.price', { old: fmt(entry.old_price), new: fmt(entry.new_price) })}
            </p>
          )}
          {entry.reason && (
            <p className="mt-1.5 text-xs text-muted-foreground italic">"{entry.reason}"</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

type ProductCostDrawerProps = {
  review: PricingReview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductCostDrawer({ review, open, onOpenChange }: ProductCostDrawerProps) {
  const { t } = useTranslation('cost-management');
  const [activeKey, setActiveKey] = useState('cost-breakdown');

  useProductCostDetail(review?.id ?? null);

  if (!review) return null;

  const tabs = [
    {
      key: 'cost-breakdown',
      label: t($ => $.drawer.tabs.costBreakdown),
      content: <CostBreakdownTab review={review} detailLoading={false} />,
    },
    {
      key: 'recipe-changes',
      label: t($ => $.drawer.tabs.recipeChanges),
      badge: review.impacts.includes('recipe_changed') ? '!' : undefined,
      content: <RecipeChangesTab review={review} />,
    },
    {
      key: 'price-history',
      label: t($ => $.drawer.tabs.priceHistory),
      content: <PriceHistoryTab review={review} />,
    },
    {
      key: 'simulation',
      label: t($ => $.drawer.tabs.marginSimulation),
      content: <MarginSimulationTab review={review} />,
    },
    {
      key: 'approval-history',
      label: t($ => $.drawer.tabs.approvalHistory),
      content: <ApprovalHistoryTab review={review} />,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 overflow-hidden p-0 sm:w-[90vw] lg:w-[60vw]"
        style={{ maxWidth: 1100 }}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate">{review.product.name}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {review.product.sku} · {review.company.name} · {review.channel.name}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs text-muted-foreground">{t($ => $.drawer.header.productCost)}</span>
              <span className="text-lg font-semibold tabular-nums">{fmt(review.product_cost)}</span>
            </div>
          </div>
        </SheetHeader>

        <Tabs
          tabs={tabs}
          activeKey={activeKey}
          onTabChange={setActiveKey}
          className="h-full"
          contentClassName="overflow-y-auto py-6 px-6 min-h-0"
        />
      </SheetContent>
    </Sheet>
  );
}
