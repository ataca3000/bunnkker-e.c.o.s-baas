import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState, PageHeader, Pagination } from '@/components/crud';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAbcClassifications,
  useRecalculateAbc,
} from '@/features/inventory-control/hooks/use-inventory-control';
import type { AbcClass } from '@/features/inventory-control/types/inventory-control';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 50;

function abcVariant(cls: AbcClass): 'default' | 'secondary' | 'outline' {
  return cls === 'A' ? 'default' : cls === 'B' ? 'secondary' : 'outline';
}

export function AbcClassificationPage() {
  const { t } = useTranslation('inventory-control');
  const { t: tCommon } = useTranslation('common');
  const [classFilter, setClassFilter] = useState<AbcClass | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useAbcClassifications({
    class: classFilter,
    page,
    per_page: PER_PAGE,
  });
  const recalculate = useRecalculateAbc();

  const items = data?.data ?? [];
  const meta  = data?.meta;

  const filters: { label: string; value: AbcClass | undefined }[] = [
    { label: t($ => $.abc.filterAll), value: undefined },
    { label: t($ => $.abc.filterA),   value: 'A' },
    { label: t($ => $.abc.filterB),   value: 'B' },
    { label: t($ => $.abc.filterC),   value: 'C' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.abc.title)}
        subtitle={t($ => $.abc.description)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.abc.title) },
        ]}
        actions={
          <Button
            size="sm"
            onClick={() => void recalculate.mutateAsync()}
            disabled={recalculate.isPending}
          >
            {recalculate.isPending ? t($ => $.abc.recalculating) : t($ => $.abc.recalculate)}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          {/* Class filter tabs */}
          <div className="flex gap-2">
            {filters.map((f) => (
              <Button
                key={String(f.value)}
                size="sm"
                variant={classFilter === f.value ? 'default' : 'outline'}
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
                  <th className="px-4 py-2 text-start font-medium">{t($ => $.abc.table.product)}</th>
                  <th className="px-4 py-2 text-start font-medium">{t($ => $.abc.table.sku)}</th>
                  <th className="px-4 py-2 text-center font-medium">{t($ => $.abc.table.class)}</th>
                  <th className="px-4 py-2 text-end font-medium">{t($ => $.abc.table.annualValue)}</th>
                  <th className="px-4 py-2 text-end font-medium">{t($ => $.abc.table.cumulativePct)}</th>
                  <th className="px-4 py-2 text-start font-medium">{t($ => $.abc.table.calculatedAt)}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center">—</td>
                  </tr>
                ) : items.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/50 border-b last:border-0 transition-colors">
                    <td className="px-4 py-2 font-medium">{row.product?.name ?? row.product_id}</td>
                    <td className="text-muted-foreground px-4 py-2 font-mono text-xs">{row.product?.sku ?? '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <Badge variant={abcVariant(row.classification)}>
                        {t($ => $.abc.classLabels[row.classification])}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-end font-mono tabular-nums">
                      {Number(row.annual_consumption_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-end font-mono tabular-nums">
                      {Number(row.cumulative_percentage).toFixed(2)}%
                    </td>
                    <td className="text-muted-foreground px-4 py-2 text-xs">{row.calculated_at?.slice(0, 10)}</td>
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
