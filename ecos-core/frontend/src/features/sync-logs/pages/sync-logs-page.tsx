import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useChannelOptions } from '@/features/channels/hooks/use-channel-options';
import { useRetrySyncLog, useSyncLogsQuery } from '@/features/sync-logs/hooks/use-sync-logs';
import type {
  SyncDirection,
  SyncEntityType,
  SyncLog,
  SyncStatus,
} from '@/features/sync-logs/types/sync-log';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 15;

const ENTITY_TYPES: (SyncEntityType | 'all')[] = ['all', 'product', 'inventory', 'order', 'customer', 'price'];
const DIRECTIONS: (SyncDirection | 'all')[] = ['all', 'inbound', 'outbound'];
const STATUSES: (SyncStatus | 'all')[] = ['all', 'pending', 'processing', 'success', 'failed', 'skipped'];

function StatusBadge({ status }: { status: SyncStatus }) {
  const { t } = useTranslation('sync-logs');
  const variantMap: Record<SyncStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    success: 'default',
    failed: 'destructive',
    processing: 'secondary',
    pending: 'outline',
    skipped: 'outline',
  };
  return <Badge variant={variantMap[status]}>{t($ => $.status[status])}</Badge>;
}

function DirectionBadge({ direction }: { direction: SyncDirection }) {
  const { t } = useTranslation('sync-logs');
  return (
    <Badge variant={direction === 'inbound' ? 'secondary' : 'outline'}>
      {t($ => $.direction[direction])}
    </Badge>
  );
}

export function SyncLogsPage() {
  const { t } = useTranslation('sync-logs');
  const { t: tCommon } = useTranslation('common');

  const [channelFilter, setChannelFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<SyncEntityType | 'all'>('all');
  const [directionFilter, setDirectionFilter] = useState<SyncDirection | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SyncStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'synced_at',
    direction: 'desc',
  });

  const { data: channelOptions = [] } = useChannelOptions();
  const retrySyncLog = useRetrySyncLog();

  const params = useMemo(
    () => ({
      channel_id: channelFilter || undefined,
      entity_type: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
      direction: directionFilter !== 'all' ? directionFilter : undefined,
      status: statusFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [channelFilter, entityTypeFilter, directionFilter, statusFilter, dateFrom, dateTo, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useSyncLogsQuery(params);

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

  const columns: ColumnDef<SyncLog>[] = [
    {
      key: 'synced_at',
      header: t($ => $.columns.date),
      sortable: true,
      cell: (log) => (log.synced_at ? new Date(log.synced_at).toLocaleString() : '—'),
    },
    {
      key: 'channel',
      header: t($ => $.columns.channel),
      cell: (log) => <span className="font-medium">{log.channel?.name ?? '—'}</span>,
    },
    {
      key: 'entity_type',
      header: t($ => $.columns.entityType),
      cell: (log) => t($ => $.entityType[log.entity_type]),
    },
    {
      key: 'direction',
      header: t($ => $.columns.direction),
      cell: (log) => <DirectionBadge direction={log.direction} />,
    },
    {
      key: 'action',
      header: t($ => $.columns.action),
      cell: (log) => (
        <span className="font-mono text-xs">{log.action ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: t($ => $.columns.status),
      cell: (log) => <StatusBadge status={log.status} />,
    },
    {
      key: 'error_message',
      header: t($ => $.columns.error),
      cell: (log) => (
        <span className="text-muted-foreground max-w-xs truncate text-xs">
          {log.error_message ?? '—'}
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
            onSearchChange={() => undefined}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onClearFilters={() => {
              setChannelFilter('');
              setEntityTypeFilter('all');
              setDirectionFilter('all');
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
                  <span className="text-sm font-medium">{t($ => $.filters.entityType)}</span>
                  <select
                    value={entityTypeFilter}
                    onChange={(e) => { setEntityTypeFilter(e.target.value as SyncEntityType | 'all'); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    {ENTITY_TYPES.map((val) => (
                      <option key={val} value={val}>
                        {val === 'all' ? t($ => $.filters.allEntityTypes) : t($ => $.entityType[val])}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.direction)}</span>
                  <select
                    value={directionFilter}
                    onChange={(e) => { setDirectionFilter(e.target.value as SyncDirection | 'all'); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    {DIRECTIONS.map((val) => (
                      <option key={val} value={val}>
                        {val === 'all' ? t($ => $.filters.allDirections) : t($ => $.direction[val])}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.status)}</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as SyncStatus | 'all'); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    {STATUSES.map((val) => (
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

          <EntityTable<SyncLog>
            columns={columns}
            data={items}
            getRowId={(log) => log.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(log) =>
              log.status === 'failed' && log.direction === 'outbound' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retrySyncLog.isPending}
                  onClick={() => retrySyncLog.mutate(log.id)}
                >
                  <RefreshCw className="size-3.5" />
                  {retrySyncLog.isPending ? t($ => $.actions.retrying) : t($ => $.actions.retry)}
                </Button>
              ) : null
            }
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
