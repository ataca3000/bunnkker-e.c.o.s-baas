import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState, PageHeader, Pagination } from '@/components/crud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCycleCountPlans } from '@/features/inventory-control/hooks/use-inventory-control';
import type { AbcClass } from '@/features/inventory-control/types/inventory-control';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 50;

export function CycleCountPlannerPage() {
  const { t } = useTranslation('inventory-control');
  const { t: tCommon } = useTranslation('common');

  const freqLabel: Partial<Record<number, string>> = {
    30:  t($ => $.cyclePlanner.frequencies["30"]),
    90:  t($ => $.cyclePlanner.frequencies["90"]),
    180: t($ => $.cyclePlanner.frequencies["180"]),
  };

  const [overdueOnly, setOverdueOnly] = useState(false);
  const [classFilter, setClassFilter] = useState<AbcClass | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useCycleCountPlans({
    overdue: overdueOnly || undefined,
    class: classFilter,
    page,
    per_page: PER_PAGE,
  });

  const items   = data?.data ?? [];
  const meta    = data?.meta;
  const overdue = items.filter((p) => p.is_overdue).length;

  const classFilters: { label: string; value: AbcClass | undefined }[] = [
    { label: t($ => $.abc.filterAll), value: undefined },
    { label: 'A', value: 'A' },
    { label: 'B', value: 'B' },
    { label: 'C', value: 'C' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.cyclePlanner.title)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.cyclePlanner.title) },
        ]}
      />

      {overdue > 0 && (
        <Alert variant="destructive">
          <AlertDescription>{t($ => $.cyclePlanner.overdueAlert, { count: overdue })}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!overdueOnly ? 'default' : 'outline'}
              onClick={() => { setOverdueOnly(false); setPage(1); }}
            >
              {t($ => $.cyclePlanner.filterAll)}
            </Button>
            <Button
              size="sm"
              variant={overdueOnly ? 'destructive' : 'outline'}
              onClick={() => { setOverdueOnly(true); setPage(1); }}
            >
              {t($ => $.cyclePlanner.filterOverdue)}
            </Button>
            {classFilters.map((f) => (
              <Button
                key={String(f.value ?? 'all-class')}
                size="sm"
                variant={classFilter === f.value ? 'secondary' : 'outline'}
                onClick={() => { setClassFilter(f.value); setPage(1); }}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-xs">
                  <th className="px-4 py-2 text-start font-medium">{t($ => $.cyclePlanner.table.product)}</th>
                  <th className="px-4 py-2 text-start font-medium">{t($ => $.cyclePlanner.table.sku)}</th>
                  <th className="px-4 py-2 text-center font-medium">{t($ => $.cyclePlanner.table.class)}</th>
                  <th className="px-4 py-2 text-center font-medium">{t($ => $.cyclePlanner.table.frequency)}</th>
                  <th className="px-4 py-2 text-start font-medium">{t($ => $.cyclePlanner.table.lastCounted)}</th>
                  <th className="px-4 py-2 text-start font-medium">{t($ => $.cyclePlanner.table.nextDue)}</th>
                  <th className="px-4 py-2 text-center font-medium">{t($ => $.cyclePlanner.table.status)}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">—</td>
                  </tr>
                ) : items.map((plan) => (
                  <tr key={plan.id} className="hover:bg-muted/50 border-b last:border-0 transition-colors">
                    <td className="px-4 py-2 font-medium">{plan.product?.name ?? plan.product_id}</td>
                    <td className="text-muted-foreground px-4 py-2 font-mono text-xs">{plan.product?.sku ?? '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <Badge variant={plan.abc_class === 'A' ? 'default' : plan.abc_class === 'B' ? 'secondary' : 'outline'}>
                        {plan.abc_class}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-center text-xs">
                      {freqLabel[plan.frequency_days] ?? `${plan.frequency_days}d`}
                    </td>
                    <td className="text-muted-foreground px-4 py-2 text-xs">
                      {plan.last_counted_at ?? t($ => $.cyclePlanner.neverCounted)}
                    </td>
                    <td className={`px-4 py-2 text-xs ${plan.is_overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {plan.next_due_at ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Badge variant={plan.is_overdue ? 'destructive' : 'secondary'}>
                        {plan.is_overdue ? t($ => $.cyclePlanner.status.overdue) : t($ => $.cyclePlanner.status.upcoming)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {meta && (
            <Pagination
              meta={{ page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page }}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
