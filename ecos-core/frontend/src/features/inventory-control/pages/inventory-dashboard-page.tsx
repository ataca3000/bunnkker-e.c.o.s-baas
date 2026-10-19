import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFormatter } from '@/hooks/use-formatter';
import {
  Archive,
  BarChart3,
  ClipboardList,
  FlaskConical,
  Package,
  PackageX,
  ShoppingBag,
  TrendingDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { productsService } from '@/features/products/services/products-service';
import { useInventoryDashboard } from '@/features/inventory-control/hooks/use-inventory-control';
import type { HealthLabel, VarianceProductRow } from '@/features/inventory-control/types/inventory-control';
import { ROUTES } from '@/router/routes';

function fmtCurrency(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(val: number) {
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtPct(val: number | null) {
  if (val === null) return '—';
  return `${val.toFixed(1)}%`;
}

function healthVariant(h: HealthLabel): 'default' | 'secondary' | 'destructive' | 'outline' {
  // UAT BUG-12 — 'unknown' previously fell through to `destructive`, painting an
  // absence of data red. Red is an error colour; "no data" is not an error.
  // Only `critical` is genuinely bad; `unknown` renders neutral.
  if (h === 'excellent' || h === 'good') return 'default';
  if (h === 'warning') return 'secondary';
  if (h === 'critical') return 'destructive';
  return 'outline';
}

type ValueKpiProps = {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  iconColor?: string;
  onClick?: () => void;
  loading?: boolean;
};

function ValueKpiCard({ title, value, sub, icon: Icon, iconColor = 'text-muted-foreground', onClick, loading }: ValueKpiProps) {
  return (
    <Card
      className={onClick ? 'cursor-pointer hover:border-primary/40 transition-colors' : ''}
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-3 pt-5 pb-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className={`size-4 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs truncate">{title}</p>
          {loading ? (
            <div className="mt-1 h-6 w-20 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-0.5 text-2xl font-semibold tabular-nums leading-none">{value}</p>
          )}
          {sub && <p className="text-muted-foreground mt-1 text-[10px]">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

type VarianceTableProps = {
  rows: VarianceProductRow[];
  title: string;
  productLabel: string;
  qtyLabel: string;
  valueLabel: string;
  noDataLabel: string;
};

function VarianceTable({ rows, title, productLabel, qtyLabel, valueLabel, noDataLabel }: VarianceTableProps) {
  return (
    <Card className="flex-1 min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs">
              <th className="px-4 py-2 text-start font-medium">{productLabel}</th>
              <th className="px-4 py-2 text-end font-medium">{qtyLabel}</th>
              <th className="px-4 py-2 text-end font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="text-muted-foreground px-4 py-6 text-center text-xs">{noDataLabel}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.product_id} className="hover:bg-muted/50 border-b last:border-0 transition-colors">
                <td className="px-4 py-2">
                  <span className="font-medium">{r.product_name}</span>
                  <span className="text-muted-foreground ml-1.5 text-xs">{r.product_sku}</span>
                </td>
                <td className={`px-4 py-2 text-end font-mono tabular-nums ${r.variance_qty < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  {r.variance_qty > 0 ? '+' : ''}{r.variance_qty.toFixed(2)}
                </td>
                <td className="text-muted-foreground px-4 py-2 text-end font-mono tabular-nums text-xs">
                  {fmtCurrency(r.variance_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function InventoryDashboardPage() {
  const { money } = useFormatter();
  const navigate = useNavigate();
  const { t } = useTranslation('inventory-control');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const allStats = useQuery({
    queryKey: ['product-stats', 'all'],
    queryFn: () => productsService.stats({ product_types: 'raw_material,finished_good,packaging_material' }),
  });
  const rmStats = useQuery({
    queryKey: ['product-stats', 'raw_material'],
    queryFn: () => productsService.stats({ product_type: 'raw_material' }),
  });
  const fgStats = useQuery({
    queryKey: ['product-stats', 'finished_good'],
    queryFn: () => productsService.stats({ product_type: 'finished_good' }),
  });
  const pkgStats = useQuery({
    queryKey: ['product-stats', 'packaging_material'],
    queryFn: () => productsService.stats({ product_type: 'packaging_material' }),
  });

  const { data: countData, isLoading: countLoading, isError: countError } = useInventoryDashboard();

  const statsLoading = allStats.isLoading || rmStats.isLoading || fgStats.isLoading || pkgStats.isLoading;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t($ => $.dashboard.title)}
        subtitle={t($ => $.dashboard.subtitle)}
        breadcrumbs={[{ label: t($ => $.dashboard.breadcrumb.home), to: ROUTES.dashboard }, { label: t($ => $.dashboard.breadcrumb.page) }]}
      />

      {/* ── Section 1: Inventory Value ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <SectionLabel>{t($ => $.dashboard.sections.inventoryValue)}</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <ValueKpiCard
            title={t($ => $.dashboard.kpis.totalValue)}
            value={allStats.data ? money(allStats.data.total_inventory_value) : '—'}
            sub={allStats.data ? `${fmtQty(allStats.data.total_on_hand)} ${t($ => $.dashboard.kpis.unitsOnHand)}` : undefined}
            icon={BarChart3}
            iconColor="text-primary"
            loading={statsLoading}
          />
          <ValueKpiCard
            title={t($ => $.dashboard.kpis.rawMaterials)}
            value={rmStats.data ? money(rmStats.data.total_inventory_value) : '—'}
            sub={rmStats.data ? `${rmStats.data.total_count} ${t($ => $.dashboard.kpis.sku)}` : undefined}
            icon={FlaskConical}
            iconColor="text-blue-500"
            loading={statsLoading}
            onClick={() => navigate(ROUTES.rawMaterials)}
          />
          <ValueKpiCard
            title={t($ => $.dashboard.kpis.finishedGoods)}
            value={fgStats.data ? money(fgStats.data.total_inventory_value) : '—'}
            sub={fgStats.data ? `${fgStats.data.total_count} ${t($ => $.dashboard.kpis.sku)}` : undefined}
            icon={Package}
            iconColor="text-emerald-500"
            loading={statsLoading}
            onClick={() => navigate(ROUTES.products)}
          />
          <ValueKpiCard
            title={t($ => $.dashboard.kpis.packagingMaterials)}
            value={pkgStats.data ? money(pkgStats.data.total_inventory_value) : '—'}
            sub={pkgStats.data ? `${pkgStats.data.total_count} ${t($ => $.dashboard.kpis.sku)}` : undefined}
            icon={Archive}
            iconColor="text-amber-500"
            loading={statsLoading}
          />
          <ValueKpiCard
            title={t($ => $.dashboard.kpis.availableUnits)}
            value={allStats.data ? fmtQty(allStats.data.total_available) : '—'}
            sub={allStats.data ? `${fmtQty(allStats.data.total_reserved)} ${t($ => $.dashboard.kpis.reserved)}` : undefined}
            icon={ShoppingBag}
            iconColor="text-purple-500"
            loading={statsLoading}
          />
        </div>
      </div>

      {/* ── Section 2: Count Health KPIs ───────────────────────────────────── */}
      {countLoading ? (
        <LoadingState />
      ) : countError || !countData ? (
        <ErrorState />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionLabel>{t($ => $.dashboard.sections.countHealth)}</SectionLabel>
              <Badge variant={healthVariant(countData.kpis.health)} className="text-xs">
                {tAny(`dashboard.health.${countData.kpis.health}`)}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <ValueKpiCard
                title={t($ => $.dashboard.kpis.accuracy)}
                value={fmtPct(countData.kpis.accuracy_pct)}
                sub={`${countData.kpis.matched_products}/${countData.kpis.total_counted_products} ${t($ => $.dashboard.kpis.matched)}`}
                icon={BarChart3}
                iconColor="text-emerald-500"
              />
              <ValueKpiCard
                title={t($ => $.dashboard.kpis.openSessions)}
                value={String(countData.kpis.open_sessions)}
                icon={ClipboardList}
                iconColor="text-blue-500"
                onClick={() => navigate(ROUTES.inventoryCount)}
              />
              <ValueKpiCard
                title={t($ => $.dashboard.kpis.productsWithVariance)}
                value={String(countData.kpis.products_with_variance)}
                icon={TrendingDown}
                iconColor="text-amber-500"
              />
              <ValueKpiCard
                title={t($ => $.dashboard.kpis.adjustmentValue)}
                value={money(countData.kpis.adjustment_value_month)}
                icon={Package}
              />
              <ValueKpiCard
                title={t($ => $.dashboard.kpis.shrinkage)}
                value={money(countData.kpis.shrinkage_value_month)}
                icon={PackageX}
                iconColor="text-destructive"
              />
            </div>
          </div>

          {/* Variance tables */}
          <div className="flex flex-col gap-3">
            <SectionLabel>{t($ => $.dashboard.sections.variances)}</SectionLabel>
            <div className="flex flex-col gap-4 md:flex-row">
              <VarianceTable
                rows={countData.top_negative}
                title={t($ => $.dashboard.topVariances.negativeTitle)}
                productLabel={t($ => $.dashboard.topVariances.product)}
                qtyLabel={t($ => $.dashboard.topVariances.varianceQty)}
                valueLabel={t($ => $.dashboard.topVariances.varianceValue)}
                noDataLabel={t($ => $.dashboard.noData)}
              />
              <VarianceTable
                rows={countData.top_positive}
                title={t($ => $.dashboard.topVariances.positiveTitle)}
                productLabel={t($ => $.dashboard.topVariances.product)}
                qtyLabel={t($ => $.dashboard.topVariances.varianceQty)}
                valueLabel={t($ => $.dashboard.topVariances.varianceValue)}
                noDataLabel={t($ => $.dashboard.noData)}
              />
            </div>
          </div>

          {/* Recent sessions */}
          <div className="flex flex-col gap-3">
            <SectionLabel>{t($ => $.dashboard.recentSessions.title)}</SectionLabel>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-xs">
                      <th className="px-4 py-2 text-start font-medium">{t($ => $.dashboard.recentSessions.session)}</th>
                      <th className="px-4 py-2 text-start font-medium">{t($ => $.dashboard.recentSessions.warehouse)}</th>
                      <th className="px-4 py-2 text-start font-medium">{t($ => $.dashboard.recentSessions.completionDate)}</th>
                      <th className="px-4 py-2 text-end font-medium">{t($ => $.dashboard.recentSessions.accuracy)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countData.recent_sessions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center text-xs">
                          {t($ => $.dashboard.recentSessions.noSessions)}{' '}
                          <button
                            onClick={() => navigate(ROUTES.inventoryCount)}
                            className="text-primary underline underline-offset-2"
                          >
                            {t($ => $.dashboard.recentSessions.createSession)}
                          </button>
                        </td>
                      </tr>
                    ) : countData.recent_sessions.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-muted/50 border-b last:border-0 transition-colors cursor-pointer"
                        onClick={() => navigate(ROUTES.inventoryCount)}
                      >
                        <td className="px-4 py-2 font-mono text-xs">{s.count_number}</td>
                        <td className="px-4 py-2">{s.warehouse_name}</td>
                        <td className="text-muted-foreground px-4 py-2 text-xs">{s.completed_at?.slice(0, 10) ?? '—'}</td>
                        <td className="px-4 py-2 text-end font-mono tabular-nums">
                          {s.accuracy_pct !== null ? `${s.accuracy_pct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
