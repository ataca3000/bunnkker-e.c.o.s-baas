import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Fuel } from 'lucide-react';

import { Pagination } from '@/components/crud';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { FuelTransactionDrawer } from '../components/fuel-transaction-drawer';
import { useFuelTransactions } from '../hooks/use-fleet';
import type { FuelTransaction } from '../types/fleet';

/**
 * Fuel review.
 *
 * The fuel transaction endpoints existed with no screen behind them: the list,
 * the detail, and four review outcomes were all reachable only from code. This
 * is that screen.
 *
 * The anomaly filter is the point of the workspace. `has_anomaly` and
 * `anomaly_flags` are computed by the backend when a transaction is recorded —
 * an implausible price, a litre count the tank cannot hold, an odometer that
 * went backwards. Reviewing everything is not the job; reviewing what the
 * engine flagged is.
 */
export function FuelReviewPage() {
  const { t, i18n } = useTranslation('logistics');

  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isFetching, refetch } = useFuelTransactions({
    anomalies_only: anomaliesOnly || undefined,
    page,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const num = (value: number | null) =>
    value === null || value === undefined
      ? '—'
      : new Intl.NumberFormat(i18n.language).format(value);

  const columns: DataGridColumnDef<FuelTransaction>[] = useMemo(
    () => [
      {
        key: 'transacted_at',
        label: t(($) => $.fleet.review.transactedAt),
        cell: (row) =>
          row.transacted_at ? new Date(row.transacted_at).toLocaleDateString(i18n.language) : '—',
      },
      {
        key: 'station',
        label: t(($) => $.fleet.review.station),
        cell: (row) => row.station ?? '—',
      },
      {
        key: 'litres',
        label: t(($) => $.fleet.review.litres),
        align: 'end',
        cell: (row) => num(row.litres),
      },
      {
        key: 'cost',
        label: t(($) => $.fleet.review.cost),
        align: 'end',
        cell: (row) => `${num(row.cost)} ${row.currency}`,
      },
      {
        key: 'odometer_km',
        label: t(($) => $.fleet.review.odometer),
        align: 'end',
        cell: (row) => num(row.odometer_km),
      },
      {
        key: 'status',
        label: t(($) => $.fleet.review.status),
        cell: (row) => (
          <span className="flex items-center gap-2">
            <Badge variant="secondary">{row.status_label}</Badge>
            {row.has_anomaly && (
              <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="me-1 h-3 w-3" />
                {row.anomaly_flags.length}
              </Badge>
            )}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  function openRow(row: FuelTransaction) {
    setSelectedId(row.id);
    setDrawerOpen(true);
  }

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.title) }, { label: t(($) => $.fleet.review.title) }]}
        title={t(($) => $.fleet.review.title)}
        description={t(($) => $.fleet.review.subtitle)}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar
              onRefresh={() => void refetch()}
              isFetching={isFetching}
              refreshLabel={t(($) => $.fleet.review.refresh)}
            />
          </div>
        }
        quickFilters={
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
            <Button
              size="sm"
              variant={anomaliesOnly ? 'secondary' : 'ghost'}
              className="h-8 text-xs"
              onClick={() => {
                setAnomaliesOnly((v) => !v);
                setPage(1);
              }}
            >
              <AlertTriangle className="me-1 h-3 w-3" />
              {t(($) => $.fleet.review.anomaliesOnly)}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {t(($) => $.fleet.review.anomalyNote)}
            </span>
          </div>
        }
        pagination={
          meta && meta.last_page > 1 ? (
            <div className="px-4 pb-4 sm:px-6">
              <Pagination
                meta={{
                  page: meta.current_page,
                  perPage: meta.per_page,
                  total: meta.total,
                  lastPage: meta.last_page,
                }}
                onPageChange={setPage}
              />
            </div>
          ) : undefined
        }
      >
        <div className="px-4 sm:px-6">
          <UniversalDataGrid<FuelTransaction>
            data={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={isFetching && rows.length === 0}
            onRowClick={openRow}
            emptyState={
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Fuel className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {anomaliesOnly
                    ? t(($) => $.fleet.review.emptyAnomalies)
                    : t(($) => $.fleet.review.empty)}
                </p>
              </div>
            }
          />
        </div>
      </WorkspacePage>

      <FuelTransactionDrawer
        key={`${selectedId ?? 'none'}-${String(drawerOpen)}`}
        transactionId={selectedId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}

export default FuelReviewPage;
