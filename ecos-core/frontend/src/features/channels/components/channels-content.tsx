import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  EntityToolbar,
  Pagination,
  StatusBadge,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { ChannelFormDrawer } from '@/features/channels/components/channel-form-drawer';
import { ConnectionStatusBadge } from '@/features/channels/components/connection-status-badge';
import { ImportOrdersResultDialog } from '@/features/channels/components/import-orders-result-dialog';
import { ImportResultDialog } from '@/features/channels/components/import-result-dialog';
import { PlatformBadge } from '@/features/channels/components/platform-badge';
import {
  useChannelsQuery,
  useDeleteChannel,
  useImportOrders,
  useImportProducts,
  useTestConnection,
} from '@/features/channels/hooks/use-channels';
import type {
  Channel,
  ChannelPlatform,
  ChannelSortField,
  ChannelStatusFilter,
  ImportResult,
  OrderImportResult,
} from '@/features/channels/types/channel';
import { SyncStockResultDialog } from '@/features/stock-sync/components/sync-stock-result-dialog';
import { useSyncStock } from '@/features/stock-sync/hooks/use-stock-sync';
import type { SyncStockResult } from '@/features/stock-sync/types/stock-sync';

const PER_PAGE = 10;

const PLATFORM_OPTIONS: { value: ChannelPlatform; label: string }[] = [
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'noon', label: 'Noon' },
  { value: 'salla', label: 'Salla' },
  { value: 'zid', label: 'Zid' },
];

/** Headless channels table — no PageHeader or Card wrapper. */
export function ChannelsContent() {
  const { t } = useTranslation('channels');
  const { t: tCommon } = useTranslation('common');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChannelStatusFilter>('all');
  const [platformFilter, setPlatformFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: ChannelSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerChannel, setDrawerChannel] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState<Channel | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncStockResult | null>(null);
  const [syncChannelName, setSyncChannelName] = useState<string | undefined>();
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importChannelName, setImportChannelName] = useState<string | undefined>();
  const [importingOrdersId, setImportingOrdersId] = useState<string | null>(null);
  const [orderImportResult, setOrderImportResult] = useState<OrderImportResult | null>(null);
  const [orderImportChannelName, setOrderImportChannelName] = useState<string | undefined>();

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      platform: platformFilter || undefined,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, statusFilter, platformFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useChannelsQuery(params);
  const deleteChannel = useDeleteChannel();
  const testConnection = useTestConnection();
  const syncStock = useSyncStock();
  const importProducts = useImportProducts();
  const importOrders = useImportOrders();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSort = (field: string) => {
    setSort((curr) =>
      curr.field === field
        ? { field: field as ChannelSortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as ChannelSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const handleTestConnection = (channel: Channel) => {
    setTestingId(channel.id);
    testConnection.mutate(channel.id, { onSettled: () => setTestingId(null) });
  };

  const handleSyncStock = (channel: Channel) => {
    setSyncingId(channel.id);
    setSyncChannelName(channel.name);
    syncStock.mutate(channel.id, {
      onSuccess: (result) => setSyncResult(result),
      onSettled: () => setSyncingId(null),
    });
  };

  const handleImportProducts = (channel: Channel) => {
    setImportingId(channel.id);
    setImportChannelName(channel.name);
    importProducts.mutate(channel.id, {
      onSuccess: (result) => setImportResult(result),
      onSettled: () => setImportingId(null),
    });
  };

  const handleImportOrders = (channel: Channel) => {
    setImportingOrdersId(channel.id);
    setOrderImportChannelName(channel.name);
    importOrders.mutate(channel.id, {
      onSuccess: (result) => setOrderImportResult(result),
      onSettled: () => setImportingOrdersId(null),
    });
  };

  const columns: ColumnDef<Channel>[] = [
    {
      key: 'name',
      header: t($ => $.columns.name),
      sortable: true,
      cell: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      key: 'brand',
      header: t($ => $.columns.brand, { defaultValue: 'Brand' }),
      cell: (c) => <span className="text-muted-foreground">{c.brand?.name ?? '—'}</span>,
    },
    {
      key: 'company',
      header: t($ => $.columns.company),
      cell: (c) => <span className="text-muted-foreground">{c.brand?.company?.name ?? '—'}</span>,
    },
    {
      key: 'platform',
      header: t($ => $.columns.platform),
      sortable: true,
      cell: (c) => <PlatformBadge platform={c.platform} />,
    },
    {
      key: 'store_url',
      header: t($ => $.columns.storeUrl),
      cell: (c) => (
        <a href={c.store_url} target="_blank" rel="noreferrer"
          className="text-muted-foreground max-w-[200px] truncate hover:underline">
          {c.store_url}
        </a>
      ),
    },
    {
      key: 'connection_status',
      header: t($ => $.columns.connection),
      cell: (c) => <ConnectionStatusBadge status={c.connection_status} />,
    },
    {
      key: 'is_active',
      header: t($ => $.columns.status),
      sortable: true,
      cell: (c) => <StatusBadge status={c.is_active ? 'active' : 'inactive'} />,
    },
    {
      key: 'last_sync_at',
      header: t($ => $.columns.lastSync),
      sortable: true,
      cell: (c) => (
        <span className="text-muted-foreground">
          {c.last_sync_at ? new Date(c.last_sync_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <EntityToolbar
        searchPlaceholder={t($ => $.search)}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
        onExport={() => undefined}
        onClearFilters={() => { setStatusFilter('all'); setPlatformFilter(''); setPage(1); }}
        filterPanel={
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{tCommon($ => $.filters.status)}</span>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as ChannelStatusFilter); setPage(1); }}
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="all">{tCommon($ => $.status.all)}</option>
                <option value="active">{tCommon($ => $.status.active)}</option>
                <option value="inactive">{tCommon($ => $.status.inactive)}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t($ => $.filters.platform)}</span>
              <select
                value={platformFilter}
                onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="">{t($ => $.filters.allPlatforms)}</option>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        <Button onClick={() => { setDrawerChannel(null); setDrawerOpen(true); }}>
          <Plus className="size-4" />
          {t($ => $.actions.new)}
        </Button>
      </EntityToolbar>

      <EntityTable<Channel>
        columns={columns}
        data={items}
        getRowId={(c) => c.id}
        isLoading={isLoading}
        isError={isError}
        sort={sort}
        onSortChange={handleSort}
        rowActions={(channel) => (
          <ActionMenu
            label={`Actions for ${channel.name}`}
            items={[
              {
                key: 'import-products',
                label: importingId === channel.id ? t($ => $.actions.importing) : t($ => $.actions.importProducts),
                icon: Download,
                onSelect: () => handleImportProducts(channel),
              },
              {
                key: 'import-orders',
                label: importingOrdersId === channel.id ? t($ => $.actions.importing) : t($ => $.actions.importOrders),
                icon: Download,
                onSelect: () => handleImportOrders(channel),
              },
              {
                key: 'sync-stock',
                label: syncingId === channel.id ? t($ => $.actions.syncing) : t($ => $.actions.syncStock),
                icon: RefreshCw,
                onSelect: () => handleSyncStock(channel),
              },
              {
                key: 'test-connection',
                label: testingId === channel.id ? t($ => $.actions.testing) : t($ => $.actions.testConnection),
                icon: Wifi,
                onSelect: () => handleTestConnection(channel),
              },
              { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => { setDrawerChannel(channel); setDrawerOpen(true); } },
              {
                key: 'delete',
                label: tCommon($ => $.common.delete),
                icon: Trash2,
                variant: 'destructive' as const,
                onSelect: () => setDeleting(channel),
              },
            ]}
          />
        )}
      />

      {meta ? (
        <Pagination
          meta={{ page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page }}
          onPageChange={setPage}
        />
      ) : null}

      <ChannelFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => { setDrawerOpen(open); if (!open) setDrawerChannel(null); }}
        channel={drawerChannel}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.name ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteChannel.isPending}
        onConfirm={() => {
          if (deleting) deleteChannel.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />

      <ImportResultDialog
        open={importResult !== null}
        onOpenChange={(open) => { if (!open) setImportResult(null); }}
        result={importResult}
        channelName={importChannelName}
      />

      <ImportOrdersResultDialog
        open={orderImportResult !== null}
        onOpenChange={(open) => { if (!open) setOrderImportResult(null); }}
        result={orderImportResult}
        channelName={orderImportChannelName}
      />

      <SyncStockResultDialog
        open={syncResult !== null}
        onOpenChange={(open) => { if (!open) setSyncResult(null); }}
        result={syncResult}
        channelName={syncChannelName}
      />
    </>
  );
}
