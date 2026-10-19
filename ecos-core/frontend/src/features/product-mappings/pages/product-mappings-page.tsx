import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProductMappingFormDrawer } from '@/features/product-mappings/components/product-mapping-form-drawer';
import { SyncStatusBadge } from '@/features/product-mappings/components/sync-status-badge';
import {
  useDeleteProductMapping,
  useProductMappingsQuery,
} from '@/features/product-mappings/hooks/use-product-mappings';
import type {
  ProductMapping,
  ProductMappingSortField,
  SyncStatus,
} from '@/features/product-mappings/types/product-mapping';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 10;

export function ProductMappingsPage() {
  const { t } = useTranslation('product-mappings');
  const { t: tCommon } = useTranslation('common');

  const [search, setSearch] = useState('');
  const [syncStatusFilter, setSyncStatusFilter] = useState<SyncStatus | ''>('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: ProductMappingSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMapping, setDrawerMapping] = useState<ProductMapping | null>(null);
  const [deleting, setDeleting] = useState<ProductMapping | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      sync_status: syncStatusFilter || undefined,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, syncStatusFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useProductMappingsQuery(params);
  const deleteMapping = useDeleteProductMapping();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSort = (field: string) => {
    setSort((curr) =>
      curr.field === field
        ? {
            field: field as ProductMappingSortField,
            direction: curr.direction === 'asc' ? 'desc' : 'asc',
          }
        : { field: field as ProductMappingSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const openCreate = () => {
    setDrawerMapping(null);
    setDrawerOpen(true);
  };

  const openEdit = (mapping: ProductMapping) => {
    setDrawerMapping(mapping);
    setDrawerOpen(true);
  };

  const columns: ColumnDef<ProductMapping>[] = [
    {
      key: 'product',
      header: t($ => $.columns.product),
      cell: (m) => (
        <div className="flex flex-col">
          <span className="font-medium">{m.product?.name ?? '—'}</span>
          <span className="text-muted-foreground text-xs">{m.product?.sku ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'channel',
      header: t($ => $.columns.channel),
      cell: (m) => (
        <div className="flex flex-col">
          <span>{m.channel?.name ?? '—'}</span>
          <span className="text-muted-foreground text-xs">{m.channel?.platform_label ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'external_product_id',
      header: t($ => $.columns.externalId),
      sortable: true,
      cell: (m) => <span className="font-mono text-sm">{m.external_product_id}</span>,
    },
    {
      key: 'external_sku',
      header: t($ => $.columns.externalSku),
      sortable: true,
      cell: (m) => (
        <span className="text-muted-foreground font-mono text-sm">{m.external_sku ?? '—'}</span>
      ),
    },
    {
      key: 'sync_status',
      header: t($ => $.columns.syncStatus),
      sortable: true,
      cell: (m) => <SyncStatusBadge status={m.sync_status} />,
    },
    {
      key: 'last_sync_at',
      header: t($ => $.columns.lastSyncedAt),
      sortable: true,
      cell: (m) => (
        <span className="text-muted-foreground">
          {m.last_sync_at ? new Date(m.last_sync_at).toLocaleDateString() : '—'}
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
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t($ => $.actions.new)}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder={t($ => $.search)}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onExport={() => undefined}
            onClearFilters={() => {
              setSyncStatusFilter('');
              setPage(1);
            }}
            filterPanel={
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t($ => $.filters.syncStatus)}</span>
                <select
                  value={syncStatusFilter}
                  onChange={(e) => {
                    setSyncStatusFilter(e.target.value as SyncStatus | '');
                    setPage(1);
                  }}
                  className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="">{t($ => $.filters.allStatuses)}</option>
                  <option value="pending">{t($ => $.syncStatus.pending)}</option>
                  <option value="synced">{t($ => $.syncStatus.synced)}</option>
                  <option value="failed">{t($ => $.syncStatus.failed)}</option>
                </select>
              </div>
            }
          />

          <EntityTable<ProductMapping>
            columns={columns}
            data={items}
            getRowId={(m) => m.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(mapping) => (
              <ActionMenu
                label={`Actions for ${mapping.product?.name ?? mapping.external_product_id}`}
                items={[
                  {
                    key: 'edit',
                    label: tCommon($ => $.common.edit),
                    icon: Pencil,
                    onSelect: () => openEdit(mapping),
                  },
                  {
                    key: 'delete',
                    label: tCommon($ => $.common.delete),
                    icon: Trash2,
                    variant: 'destructive' as const,
                    onSelect: () => setDeleting(mapping),
                  },
                ]}
              />
            )}
          />

          {meta ? (
            <Pagination
              meta={{
                page: meta.current_page,
                perPage: meta.per_page,
                total: meta.total,
                lastPage: meta.last_page,
              }}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>

      <ProductMappingFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerMapping(null);
        }}
        mapping={drawerMapping}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t($ => $.delete.title)}
        description={t($ => $.delete.description, {
          name: deleting?.product?.name ?? deleting?.external_product_id ?? '',
        })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteMapping.isPending}
        onConfirm={() => {
          if (deleting)
            deleteMapping.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
