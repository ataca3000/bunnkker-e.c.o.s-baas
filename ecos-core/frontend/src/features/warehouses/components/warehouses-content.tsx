import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { CompanySelect } from '@/features/branches/components/company-select';
import { WarehouseFormDrawer } from '@/features/warehouses/components/warehouse-form-drawer';
import { useWarehousesQuery, useDeleteWarehouse } from '@/features/warehouses/hooks/use-warehouses';
import type {
  Warehouse,
  WarehouseSortField,
  WarehouseStatusFilter,
} from '@/features/warehouses/types/warehouse';

const PER_PAGE = 10;

/** Headless warehouses table — no PageHeader or Card wrapper. */
export function WarehousesContent() {
  const { t } = useTranslation('warehouses');
  const { t: tCommon } = useTranslation('common');

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WarehouseStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: WarehouseSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerWarehouse, setDrawerWarehouse] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      company_id: companyFilter || undefined,
      status: statusFilter,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, companyFilter, statusFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useWarehousesQuery(params);
  const deleteWarehouse = useDeleteWarehouse();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSort = (field: string) => {
    setSort((curr) =>
      curr.field === field
        ? { field: field as WarehouseSortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as WarehouseSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const columns: ColumnDef<Warehouse>[] = [
    { key: 'company', header: t($ => $.columns.company), cell: (w) => w.company?.name ?? '—' },
    {
      key: 'code',
      header: t($ => $.columns.code),
      sortable: true,
      cell: (w) => <span className="font-medium">{w.code}</span>,
    },
    { key: 'name', header: t($ => $.columns.name), sortable: true, cell: (w) => w.name },
    { key: 'city', header: t($ => $.columns.city), sortable: true, cell: (w) => w.city ?? '—' },
    {
      key: 'is_active',
      header: t($ => $.columns.status),
      sortable: true,
      cell: (w) => <StatusBadge status={w.is_active ? 'active' : 'inactive'} />,
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
        onClearFilters={() => { setCompanyFilter(null); setStatusFilter('all'); setPage(1); }}
        filterPanel={
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{tCommon($ => $.filters.company)}</span>
              <CompanySelect
                value={companyFilter}
                onChange={(v) => { setCompanyFilter(v); setPage(1); }}
                placeholder={tCommon($ => $.filters.allCompanies)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{tCommon($ => $.filters.status)}</span>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as WarehouseStatusFilter); setPage(1); }}
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="all">{tCommon($ => $.status.all)}</option>
                <option value="active">{tCommon($ => $.status.active)}</option>
                <option value="inactive">{tCommon($ => $.status.inactive)}</option>
              </select>
            </div>
          </>
        }
      >
        <Button onClick={() => { setDrawerWarehouse(null); setDrawerOpen(true); }}>
          <Plus className="size-4" />
          {t($ => $.actions.new)}
        </Button>
      </EntityToolbar>

      <EntityTable<Warehouse>
        columns={columns}
        data={items}
        getRowId={(w) => w.id}
        isLoading={isLoading}
        isError={isError}
        sort={sort}
        onSortChange={handleSort}
        rowActions={(warehouse) => (
          <ActionMenu
            label={`Actions for ${warehouse.name}`}
            items={[
              { key: 'view', label: tCommon($ => $.actions.view), icon: Eye, onSelect: () => { setDrawerWarehouse(warehouse); setDrawerOpen(true); } },
              { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => { setDrawerWarehouse(warehouse); setDrawerOpen(true); } },
              {
                key: 'delete',
                label: tCommon($ => $.common.delete),
                icon: Trash2,
                variant: 'destructive',
                onSelect: () => setDeleting(warehouse),
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

      <WarehouseFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => { setDrawerOpen(open); if (!open) setDrawerWarehouse(null); }}
        warehouse={drawerWarehouse}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.name ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteWarehouse.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteWarehouse.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </>
  );
}
