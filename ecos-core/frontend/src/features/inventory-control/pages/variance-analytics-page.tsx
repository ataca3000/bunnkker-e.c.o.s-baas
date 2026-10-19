import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVarianceAnalytics } from '@/features/inventory-control/hooks/use-inventory-control';
import type {
  CategoryVariance,
  FrequentVarianceProduct,
  MonthlyTrend,
  WarehouseVariance,
} from '@/features/inventory-control/types/inventory-control';
import { ROUTES } from '@/router/routes';

function fmtCurrency(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FrequentTable({
  rows,
  title,
}: {
  rows: FrequentVarianceProduct[];
  title: string;
}) {
  const { t } = useTranslation('inventory-control');
  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs">
              <th className="px-4 py-2 text-start font-medium">{t($ => $.variance.table.product)}</th>
              <th className="px-4 py-2 text-center font-medium">{t($ => $.variance.table.count)}</th>
              <th className="px-4 py-2 text-end font-medium">{t($ => $.variance.table.totalQty)}</th>
              <th className="px-4 py-2 text-end font-medium">{t($ => $.variance.table.totalValue)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="text-muted-foreground px-4 py-6 text-center text-xs">—</td></tr>
            ) : rows.map((r) => (
              <tr key={r.product_id} className="hover:bg-muted/50 border-b last:border-0 transition-colors">
                <td className="px-4 py-2">
                  <span className="font-medium">{r.product_name}</span>
                  <span className="text-muted-foreground ml-1.5 text-xs">{r.product_sku}</span>
                </td>
                <td className="px-4 py-2 text-center tabular-nums">{r.variance_count}</td>
                <td className="px-4 py-2 text-end font-mono tabular-nums">{r.total_variance_qty.toFixed(2)}</td>
                <td className="text-muted-foreground px-4 py-2 text-end font-mono tabular-nums text-xs">
                  {fmtCurrency(r.total_variance_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function WarehouseTable({ rows }: { rows: WarehouseVariance[] }) {
  const { t } = useTranslation('inventory-control');
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t($ => $.variance.byWarehouse)}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs">
              <th className="px-4 py-2 text-start font-medium">{t($ => $.variance.table.warehouse)}</th>
              <th className="px-4 py-2 text-end font-medium">{t($ => $.variance.table.adjIn)}</th>
              <th className="px-4 py-2 text-end font-medium">{t($ => $.variance.table.adjOut)}</th>
              <th className="px-4 py-2 text-end font-medium">{t($ => $.variance.table.netVariance)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="text-muted-foreground px-4 py-6 text-center text-xs">—</td></tr>
            ) : rows.map((r) => (
              <tr key={r.warehouse_id} className="hover:bg-muted/50 border-b last:border-0 transition-colors">
                <td className="px-4 py-2 font-medium">{r.warehouse_name}</td>
                <td className="px-4 py-2 text-end font-mono tabular-nums text-green-600">{fmtCurrency(r.adj_in_value)}</td>
                <td className="text-destructive px-4 py-2 text-end font-mono tabular-nums">{fmtCurrency(r.adj_out_value)}</td>
                <td className={`px-4 py-2 text-end font-mono tabular-nums ${r.net_variance_value < 0 ? 'text-destructive' : ''}`}>
                  {fmtCurrency(r.net_variance_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CategoryTable({ rows }: { rows: CategoryVariance[] }) {
  const { t } = useTranslation('inventory-control');
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t($ => $.variance.byCategory)}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs">
              <th className="px-4 py-2 text-start font-medium">{t($ => $.variance.table.category)}</th>
              <th className="px-4 py-2 text-end font-medium">{t($ => $.variance.table.adjIn)}</th>
              <th className="px-4 py-2 text-end font-medium">{t($ => $.variance.table.adjOut)}</th>
              <th className="px-4 py-2 text-end font-medium">{t($ => $.variance.table.netVariance)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="text-muted-foreground px-4 py-6 text-center text-xs">—</td></tr>
            ) : rows.map((r) => (
              <tr key={r.category_id} className="hover:bg-muted/50 border-b last:border-0 transition-colors">
                <td className="px-4 py-2 font-medium">{r.category_name}</td>
                <td className="px-4 py-2 text-end font-mono tabular-nums text-green-600">{fmtCurrency(r.adj_in_value)}</td>
                <td className="text-destructive px-4 py-2 text-end font-mono tabular-nums">{fmtCurrency(r.adj_out_value)}</td>
                <td className={`px-4 py-2 text-end font-mono tabular-nums ${r.net_variance_value < 0 ? 'text-destructive' : ''}`}>
                  {fmtCurrency(r.net_variance_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function TrendTable({ rows }: { rows: MonthlyTrend[] }) {
  const { t } = useTranslation('inventory-control');
  const max = Math.max(...rows.map((r) => Math.max(r.adj_in_value, r.adj_out_value)), 1);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t($ => $.variance.monthlyTrend)}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs">
              <th className="px-4 py-2 text-start font-medium">{t($ => $.variance.table.month)}</th>
              <th className="w-32 px-4 py-2 text-start font-medium">{t($ => $.variance.table.adjIn)}</th>
              <th className="w-32 px-4 py-2 text-start font-medium">{t($ => $.variance.table.adjOut)}</th>
              <th className="px-4 py-2 text-end font-medium">{t($ => $.variance.table.netVariance)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="hover:bg-muted/50 border-b last:border-0 transition-colors">
                <td className="px-4 py-2 font-mono text-xs">{r.month}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.round((r.adj_in_value / max) * 80)}px` }} />
                    <span className="text-xs tabular-nums">{fmtCurrency(r.adj_in_value)}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-destructive h-2 rounded-full" style={{ width: `${Math.round((r.adj_out_value / max) * 80)}px` }} />
                    <span className="text-xs tabular-nums">{fmtCurrency(r.adj_out_value)}</span>
                  </div>
                </td>
                <td className={`px-4 py-2 text-end font-mono tabular-nums text-xs ${r.net_variance < 0 ? 'text-destructive' : ''}`}>
                  {fmtCurrency(r.net_variance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function VarianceAnalyticsPage() {
  const { t } = useTranslation('inventory-control');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError } = useVarianceAnalytics({ limit: 10 });

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.variance.title)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.variance.title) },
        ]}
      />

      <div className="flex flex-col gap-4 md:flex-row">
        <FrequentTable rows={data.frequently_missing} title={t($ => $.variance.frequentlyMissing)} />
        <FrequentTable rows={data.frequently_overcounted} title={t($ => $.variance.frequentlyOvercounted)} />
      </div>

      <WarehouseTable rows={data.by_warehouse} />
      <CategoryTable rows={data.by_category} />
      <TrendTable rows={data.monthly_trend} />
    </div>
  );
}
