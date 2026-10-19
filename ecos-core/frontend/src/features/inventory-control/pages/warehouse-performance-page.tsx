import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Card, CardContent } from '@/components/ui/card';
import { useWarehousePerformance } from '@/features/inventory-control/hooks/use-inventory-control';
import { ROUTES } from '@/router/routes';

function fmtPct(val: number | null) {
  if (val === null) return '—';
  return `${val.toFixed(1)}%`;
}

function fmtCurrency(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function WarehousePerformancePage() {
  const { t } = useTranslation('inventory-control');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError } = useWarehousePerformance({ months: 12 });

  const rows = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.warehousePerformance.title)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.warehousePerformance.title) },
        ]}
      />

      <Card>
        <CardContent className="p-0 pt-0">
          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-xs">
                  <th className="px-4 py-3 text-start font-medium">{t($ => $.warehousePerformance.table.warehouse)}</th>
                  <th className="px-4 py-3 text-end font-medium">{t($ => $.warehousePerformance.table.accuracy)}</th>
                  <th className="px-4 py-3 text-end font-medium">{t($ => $.warehousePerformance.table.avgVariance)}</th>
                  <th className="px-4 py-3 text-end font-medium">{t($ => $.warehousePerformance.table.adjIn)}</th>
                  <th className="px-4 py-3 text-end font-medium">{t($ => $.warehousePerformance.table.adjOut)}</th>
                  <th className="px-4 py-3 text-end font-medium">{t($ => $.warehousePerformance.table.completionRate)}</th>
                  <th className="px-4 py-3 text-end font-medium">{t($ => $.warehousePerformance.table.openCounts)}</th>
                  <th className="px-4 py-3 text-end font-medium">{t($ => $.warehousePerformance.table.totalSessions)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-muted-foreground px-4 py-8 text-center">—</td>
                  </tr>
                ) : rows.map((row) => (
                  <tr key={row.warehouse_id} className="hover:bg-muted/50 border-b last:border-0 transition-colors">
                    <td className="px-4 py-3 font-medium">{row.warehouse_name}</td>
                    <td className="px-4 py-3 text-end font-mono tabular-nums">{fmtPct(row.accuracy_pct)}</td>
                    <td className="text-muted-foreground px-4 py-3 text-end font-mono tabular-nums">{fmtPct(row.avg_variance_pct)}</td>
                    <td className="px-4 py-3 text-end font-mono tabular-nums text-green-600">{fmtCurrency(row.adj_in_value)}</td>
                    <td className="text-destructive px-4 py-3 text-end font-mono tabular-nums">{fmtCurrency(row.adj_out_value)}</td>
                    <td className="px-4 py-3 text-end font-mono tabular-nums">{fmtPct(row.count_completion_rate)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{row.open_counts}</td>
                    <td className="text-muted-foreground px-4 py-3 text-end tabular-nums">{row.total_sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
