import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pencil, Plus, RefreshCw, SlidersHorizontal, Trash2, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useSyncStock } from '@/features/stock-sync/hooks/use-stock-sync';
import { SyncStockResultDialog } from '@/features/stock-sync/components/sync-stock-result-dialog';
import type { SyncStockResult } from '@/features/stock-sync/types/stock-sync';
import type {
  Channel,
  ChannelPlatform,
  ChannelSortField,
  ChannelStatusFilter,
  ImportResult,
  OrderImportResult,
} from '@/features/channels/types/channel';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 10;

const OPTIONAL_COLS = [
  { key: 'brand',             label: 'Brand' },
  { key: 'company',           label: 'Company' },
  { key: 'platform',          label: 'Platform' },
  { key: 'store_url',         label: 'Store URL' },
  { key: 'connection_status', label: 'Connection' },
  { key: 'last_sync_at',      label: 'Last Sync' },
] as const;

function exportChannelsCsv(items: Channel[]) {
  const headers = ['Name', 'Brand', 'Company', 'Platform', 'Store URL', 'Connection', 'Status', 'Last Sync'];
  const rows = items.map((c) => [
    c.name, c.brand?.name ?? '', c.brand?.company?.name ?? '', c.platform, c.store_url,
    c.connection_status, c.is_active ? 'Active' : 'Inactive',
    c.last_sync_at ? new Date(c.last_sync_at).toLocaleDateString() : '',
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `channels-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PLATFORM_OPTIONS: { value: ChannelPlatform; label: string }[] = [
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'noon', label: 'Noon' },
  { value: 'salla', label: 'Salla' },
  { value: 'zid', label: 'Zid' },
];

export function ChannelsPage() {
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
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
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

  // ── Keyboard nav ──────────────────────────────────────────────────────────────
  const searchRef = useRef<HTMLInputElement>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

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

  // Memoised so the empty-state fallback keeps a stable identity between renders.
  const items = useMemo(() => data?.items ?? [], [data]);
  const meta = data?.meta;

  // Reset row focus when the list changes (page/filter/search)
  useEffect(() => { setFocusedRowIndex(null); }, [data]);

  // stateRef avoids stale closures in the stable keyboard handler
  const stateRef = useRef({ items, drawerOpen, focusedRowIndex });
  useEffect(() => {
    stateRef.current = { items, drawerOpen, focusedRowIndex };
  }, [items, drawerOpen, focusedRowIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const { items: channels, drawerOpen: isOpen, focusedRowIndex: fi } = stateRef.current;

      // Ctrl+K or / → focus search
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !inInput)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      // Ctrl+N → new channel
      if (e.key === 'n' && (e.ctrlKey || e.metaKey) && !inInput) {
        e.preventDefault();
        openCreate();
        return;
      }

      // Esc → close drawer first, else clear focus
      if (e.key === 'Escape' && !inInput) {
        if (isOpen) { setDrawerOpen(false); return; }
        setFocusedRowIndex(null);
        return;
      }

      // Arrow Down → move focus down
      if (e.key === 'ArrowDown' && !inInput && channels.length > 0) {
        e.preventDefault();
        setFocusedRowIndex(fi === null ? 0 : Math.min(fi + 1, channels.length - 1));
        return;
      }

      // Arrow Up → move focus up
      if (e.key === 'ArrowUp' && !inInput && channels.length > 0) {
        e.preventDefault();
        setFocusedRowIndex(fi === null ? 0 : Math.max(fi - 1, 0));
        return;
      }

      // Enter → open edit for focused row
      if (e.key === 'Enter' && !inInput && fi !== null) {
        e.preventDefault();
        const channel = channels[fi];
        if (channel) openEdit(channel);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
     
  }, []);

  function toggleCol(key: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const handleSort = (field: string) => {
    setSort((curr) =>
      curr.field === field
        ? { field: field as ChannelSortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as ChannelSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const openCreate = () => {
    setDrawerChannel(null);
    setDrawerOpen(true);
  };

  const openEdit = (channel: Channel) => {
    setDrawerChannel(channel);
    setDrawerOpen(true);
  };

  const handleTestConnection = (channel: Channel) => {
    setTestingId(channel.id);
    testConnection.mutate(channel.id, {
      onSettled: () => setTestingId(null),
    });
  };

  const handleSyncStock = (channel: Channel) => {
    setSyncingId(channel.id);
    setSyncChannelName(channel.name);
    syncStock.mutate(channel.id, {
      onSuccess: (result) => { setSyncResult(result); },
      onSettled: () => setSyncingId(null),
    });
  };

  const handleImportProducts = (channel: Channel) => {
    setImportingId(channel.id);
    setImportChannelName(channel.name);
    importProducts.mutate(channel.id, {
      onSuccess: (result) => { setImportResult(result); },
      onSettled: () => setImportingId(null),
    });
  };

  const handleImportOrders = (channel: Channel) => {
    setImportingOrdersId(channel.id);
    setOrderImportChannelName(channel.name);
    importOrders.mutate(channel.id, {
      onSuccess: (result) => { setOrderImportResult(result); },
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
        <a
          href={c.store_url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground max-w-[200px] truncate hover:underline"
        >
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

  const focusedRowId = focusedRowIndex !== null ? (items[focusedRowIndex]?.id ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: 'Organization', to: ROUTES.organization },
          { label: t($ => $.title) },
        ]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t($ => $.actions.new)}
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.kpi.total, { defaultValue: 'Total Channels' })}</div>
            <div className="text-2xl font-bold">{isLoading ? '—' : (meta?.total ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.kpi.active, { defaultValue: 'Active' })}</div>
            <div className="text-2xl font-bold text-emerald-600">
              {isLoading ? '—' : items.filter((c) => c.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.kpi.connected, { defaultValue: 'Connected' })}</div>
            <div className="text-2xl font-bold text-blue-600">
              {isLoading ? '—' : items.filter((c) => c.connection_status === 'connected').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.kpi.platforms, { defaultValue: 'Platforms' })}</div>
            <div className="text-2xl font-bold">
              {isLoading ? '—' : new Set(items.map((c) => c.platform)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder={`${t($ => $.search)} · / or Ctrl+K`}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchRef={searchRef}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onExport={() => exportChannelsCsv(items)}
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
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            }
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="size-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {OPTIONAL_COLS.map(({ key, label }) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={!hiddenCols.has(key)}
                    onCheckedChange={() => toggleCol(key)}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </EntityToolbar>

          <EntityTable<Channel>
            columns={columns.filter((c) => !hiddenCols.has(c.key))}
            data={items}
            getRowId={(c) => c.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            focusedRowId={focusedRowId}
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
                  { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => openEdit(channel) },
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
        </CardContent>
      </Card>

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
    </div>
  );
}
