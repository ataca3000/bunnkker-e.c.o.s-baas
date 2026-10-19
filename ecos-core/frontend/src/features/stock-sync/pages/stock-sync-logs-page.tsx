import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Card, CardContent } from '@/components/ui/card';
import { useChannelOptions } from '@/features/channels/hooks/use-channel-options';
import { StockSyncStatusBadge } from '@/features/stock-sync/components/stock-sync-status-badge';
import { useStockSyncLogsQuery } from '@/features/stock-sync/hooks/use-stock-sync';
import type { StockSyncLog, StockSyncStatus } from '@/features/stock-sync/types/stock-sync';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 15;

const STATUS_VALUES: (StockSyncStatus | 'all')[] = ['all', 'success', 'error', 'pending'];

export function StockSyncLogsPage() {
  const { t } = useTranslation('stock-sync');
  const { t: tCommon } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockSyncStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'synced_at',
    direction: 'desc',
  });

  const { data: channelOptions = [] } = useChannelOptions();

  const params = useMemo(
    () => ({
      search: search || undefined,
      channel_id: channelFilter || undefined,
      status: statusFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, channelFilter, statusFilter, dateFrom, dateTo, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useStockSyncLogsQuery(params);

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSort = (field: string) => {
    setSort((curr) =>
      curr.field === field
        ? { field, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    );
    setPage(1);
  };

  const columns: ColumnDef<StockSyncLog>[] = [
    {
      key: 'synced_at',
      header: t($ => $.columns.date),
      sortable: true,
      cell: (log) =>
        log.synced_at ? new Date(log.synced_at).toLocaleString() : '—',
    },
    {
      key: 'channel',
      header: t($ => $.columns.channel),
      cell: (log) => <span className="font-medium">{log.channel?.name ?? '—'}</span>,
    },
    {
      key: 'product',
      header: t($ => $.columns.product),
      cell: (log) => (
        <div>
          <span className="font-medium">{log.product?.name ?? '—'}</span>
          {log.product?.sku && (
            <span className="text-muted-foreground ml-1.5 text-xs">{log.product.sku}</span>
          )}
        </div>
      ),
    },
    {
      key: 'stock_quantity',
      header: t($ => $.columns.quantity),
      sortable: true,
      cell: (log) => (
        <span className="font-mono tabular-nums">{log.stock_quantity}</span>
      ),
    },
    {
      key: 'sync_status',
      header: t($ => $.columns.status),
      cell: (log) => <StockSyncStatusBadge status={log.sync_status} />,
    },
    {
      key: 'response_message',
      header: t($ => $.columns.message),
      cell: (log) => (
        <span className="text-muted-foreground max-w-xs truncate text-xs">
          {log.response_message ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title) },
        ]}
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder={t($ => $.search)}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onClearFilters={() => {
              setChannelFilter('');
              setStatusFilter('all');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
            filterPanel={
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.channel)}</span>
                  <select
                    value={channelFilter}
                    onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="">{t($ => $.filters.allChannels)}</option>
                    {channelOptions.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.status)}</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as StockSyncStatus | 'all'); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    {STATUS_VALUES.map((val) => (
                      <option key={val} value={val}>
                        {t($ => $.status[val])}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.dateFrom)}</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.dateTo)}</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  />
                </div>
              </div>
            }
          />

          <EntityTable<StockSyncLog>
            columns={columns}
            data={items}
            getRowId={(log) => log.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
          />

          {meta ? (
            <Pagination
              meta={{ page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page }}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
