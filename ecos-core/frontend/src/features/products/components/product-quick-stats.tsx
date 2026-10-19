import { AlertTriangle, CheckCircle2, Clock, Package, ShieldAlert, TrendingDown, WifiOff, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { QuickStatCard } from '@/components/ds/quick-stat-card';
import type { ProductStatusFilter, ProductType } from '@/features/products/types/product';

export type StatFilter =
  | { type: 'status'; value: ProductStatusFilter }
  | { type: 'is_published'; value: boolean }
  | { type: 'low_stock'; value: boolean }
  | { type: 'not_synced'; value: boolean }
  | { type: 'product_type'; value: ProductType }
  | { type: 'manufacturing_ready'; value: boolean }
  | { type: 'missing_recipe'; value: boolean }
  | { type: 'needs_pricing_review'; value: boolean }
  | { type: 'low_margin'; value: boolean }
  | { type: 'mfg_instock'; value: true }
  | { type: 'mfg_outofstock'; value: true }
  | { type: 'mfg_recipe_missing'; value: true };

export type ProductStatsData = {
  total: number;
  published: number;
  lowStock: number;
  notSynced: number;
  inactive: number;
  manufacturingReady: number;
  missingRecipe: number;
  needsPricingReview: number;
  lowMargin: number;
  mfgInStock: number;
  mfgOutOfStock: number;
  mfgRecipeMissing: number;
};

type ProductQuickStatsProps = {
  stats: ProductStatsData;
  activeFilter: StatFilter | null;
  onFilterChange: (filter: StatFilter | null) => void;
};

export function ProductQuickStats({ stats, activeFilter, onFilterChange }: ProductQuickStatsProps) {
  const { t } = useTranslation('products');

  const toggle = (next: StatFilter) => {
    const isActive =
      activeFilter?.type === next.type && activeFilter.value === next.value;
    onFilterChange(isActive ? null : next);
  };

  const isActive = (filter: StatFilter) =>
    activeFilter?.type === filter.type && activeFilter.value === filter.value;

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1 — Operational stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <QuickStatCard
          icon={Package}
          title={t($ => $.quickStats.totalProducts)}
          value={stats.total}
          colorClassName="text-primary bg-primary/10"
          active={activeFilter === null}
          onClick={() => onFilterChange(null)}
        />
        <QuickStatCard
          icon={TrendingDown}
          title={t($ => $.quickStats.published)}
          value={stats.published}
          colorClassName="text-sky-600 bg-sky-100 dark:text-sky-400 dark:bg-sky-900/30"
          active={isActive({ type: 'is_published', value: true })}
          onClick={() => toggle({ type: 'is_published', value: true })}
        />
        <QuickStatCard
          icon={AlertTriangle}
          title={t($ => $.quickStats.lowStock)}
          value={stats.lowStock}
          colorClassName="text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30"
          active={isActive({ type: 'low_stock', value: true })}
          onClick={() => toggle({ type: 'low_stock', value: true })}
        />
        <QuickStatCard
          icon={WifiOff}
          title={t($ => $.quickStats.notSynced)}
          value={stats.notSynced}
          colorClassName="text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
          active={isActive({ type: 'not_synced', value: true })}
          onClick={() => toggle({ type: 'not_synced', value: true })}
        />
        <QuickStatCard
          icon={XCircle}
          title={t($ => $.quickStats.inactive)}
          value={stats.inactive}
          colorClassName="text-muted-foreground bg-muted"
          active={isActive({ type: 'status', value: 'inactive' })}
          onClick={() => toggle({ type: 'status', value: 'inactive' })}
        />
      </div>

      {/* Row 2 — Lifecycle stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickStatCard
          icon={CheckCircle2}
          title={t($ => $.quickStats.mfgReady)}
          value={stats.manufacturingReady}
          colorClassName="text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30"
          active={isActive({ type: 'manufacturing_ready', value: true })}
          onClick={() => toggle({ type: 'manufacturing_ready', value: true })}
        />
        <QuickStatCard
          icon={AlertTriangle}
          title={t($ => $.quickStats.missingRecipe)}
          value={stats.missingRecipe}
          colorClassName="text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30"
          active={isActive({ type: 'missing_recipe', value: true })}
          onClick={() => toggle({ type: 'missing_recipe', value: true })}
        />
        <QuickStatCard
          icon={Clock}
          title={t($ => $.quickStats.pendingReview)}
          value={stats.needsPricingReview}
          colorClassName="text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30"
          active={isActive({ type: 'needs_pricing_review', value: true })}
          onClick={() => toggle({ type: 'needs_pricing_review', value: true })}
        />
        <QuickStatCard
          icon={TrendingDown}
          title={t($ => $.quickStats.lowMargin)}
          value={stats.lowMargin}
          colorClassName="text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30"
          active={isActive({ type: 'low_margin', value: true })}
          onClick={() => toggle({ type: 'low_margin', value: true })}
        />
      </div>

      {/* Row 3 — Manufacturing Availability */}
      <div className="grid grid-cols-3 gap-3">
        <QuickStatCard
          icon={CheckCircle2}
          title={t($ => $.quickStats.mfgInStock)}
          value={stats.mfgInStock}
          colorClassName="text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30"
          active={isActive({ type: 'mfg_instock', value: true })}
          onClick={() => toggle({ type: 'mfg_instock', value: true })}
        />
        <QuickStatCard
          icon={ShieldAlert}
          title={t($ => $.quickStats.mfgOutOfStock)}
          value={stats.mfgOutOfStock}
          colorClassName="text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
          active={isActive({ type: 'mfg_outofstock', value: true })}
          onClick={() => toggle({ type: 'mfg_outofstock', value: true })}
        />
        <QuickStatCard
          icon={AlertTriangle}
          title={t($ => $.quickStats.mfgRecipeMissing)}
          value={stats.mfgRecipeMissing}
          colorClassName="text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800/40"
          active={isActive({ type: 'mfg_recipe_missing', value: true })}
          onClick={() => toggle({ type: 'mfg_recipe_missing', value: true })}
        />
      </div>
    </div>
  );
}
