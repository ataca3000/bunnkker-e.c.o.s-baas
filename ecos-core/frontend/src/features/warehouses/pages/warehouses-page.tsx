import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, SlidersHorizontal, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';
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
import { CompanySelect } from '@/features/branches/components/company-select';
import { WarehouseDetailDrawer } from '@/features/warehouses/components/warehouse-detail-drawer';
import { WarehouseFormDrawer } from '@/features/warehouses/components/warehouse-form-drawer';
import { useWarehousesQuery, useDeleteWarehouse } from '@/features/warehouses/hooks/use-warehouses';
import type {
  Warehouse,
  WarehouseSortField,
  WarehouseStatusFilter,
} from '@/features/warehouses/types/warehouse';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 10;

const OPTIONAL_COLS = [
  { key: 'company', label: 'Company' },
  { key: 'city',    label: 'City' },
] as const;

export function WarehousesPage() {
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

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [drawerWarehouse, setDrawerWarehouse] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

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

  function toggleCol(key: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSort = (field: string) => {
    setSort((current) =>
      current.field === field
        ? { field: field as WarehouseSortField, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as WarehouseSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const openCreate = () => {
    setDrawerWarehouse(null);
    setEditDrawerOpen(true);
  };

  const openView = (warehouse: Warehouse) => {
    setDrawerWarehouse(warehouse);
    setDetailDrawerOpen(true);
  };

  const openEdit = (warehouse: Warehouse) => {
    setDrawerWarehouse(warehouse);
    setEditDrawerOpen(true);
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

  const confirmDelete = () => {
    if (!deleting) return;
    deleteWarehouse.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

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
            <div className="flex items-center gap-2">
              <WarehouseIcon className="text-muted-foreground size-4" />
              <div className="text-muted-foreground text-sm">Total Warehouses</div>
            </div>
            <div className="text-2xl font-bold mt-1">{isLoading ? '—' : (meta?.total ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Active</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {isLoading ? '—' : items.filter((w) => w.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Inactive</div>
            <div className="text-2xl font-bold text-slate-400 mt-1">
              {isLoading ? '—' : items.filter((w) => !w.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Companies</div>
            <div className="text-2xl font-bold text-slate-400 mt-1">
              {isLoading ? '—' : new Set(items.map((w) => w.company_id)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder={t($ => $.search)}
            onSearchChange={handleSearch}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onExport={() => undefined}
            onClearFilters={() => {
              setCompanyFilter(null);
              setStatusFilter('all');
              setPage(1);
            }}
            filterPanel={
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{tCommon($ => $.filters.company)}</span>
                  <CompanySelect
                    value={companyFilter}
                    onChange={(value) => {
                      setCompanyFilter(value);
                      setPage(1);
                    }}
                    placeholder={tCommon($ => $.filters.allCompanies)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{tCommon($ => $.filters.status)}</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as WarehouseStatusFilter);
                      setPage(1);
                    }}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="size-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
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

          <EntityTable<Warehouse>
            columns={columns.filter((c) => !hiddenCols.has(c.key))}
            data={items}
            getRowId={(warehouse) => warehouse.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(warehouse) => (
              <ActionMenu
                label={`Actions for ${warehouse.name}`}
                items={[
                  { key: 'view', label: tCommon($ => $.actions.view), icon: Eye, onSelect: () => openView(warehouse) },
                  { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => openEdit(warehouse) },
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

      <WarehouseDetailDrawer
        open={detailDrawerOpen}
        onOpenChange={(open) => {
          setDetailDrawerOpen(open);
          if (!open) setDrawerWarehouse(null);
        }}
        warehouse={drawerWarehouse}
        onEdit={(warehouse) => {
          setDetailDrawerOpen(false);
          openEdit(warehouse);
        }}
      />

      <WarehouseFormDrawer
        open={editDrawerOpen}
        onOpenChange={(open) => {
          setEditDrawerOpen(open);
          if (!open) setDrawerWarehouse(null);
        }}
        warehouse={drawerWarehouse}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.name ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteWarehouse.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
