import { useCallback, useMemo, useState } from 'react';
import { Building2, Eye, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';

import { getMediaUrl } from '@/lib/media';

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
import { BrandDetailDrawer } from '@/features/brands/components/brand-detail-drawer';
import { BrandFormDrawer } from '@/features/brands/components/brand-form-drawer';
import { useBrandsQuery, useDeleteBrand } from '@/features/brands/hooks/use-brands';
import type { Brand, BrandSortField, BrandStatusFilter } from '@/features/brands/types/brand';
import { ROUTES } from '@/router/routes';

// ── Logo cell with getMediaUrl + error fallback ───────────────────────────────

function BrandLogoCell({ path, name }: { path: string | null; name: string }) {
  const [error, setError] = useState(false);
  const url = getMediaUrl(path);
  if (url && !error) {
    return (
      <img
        src={url}
        alt={name}
        className="size-8 rounded object-contain bg-muted/20"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div className="bg-muted flex size-8 items-center justify-center rounded">
      <Building2 className="text-muted-foreground size-4" />
    </div>
  );
}

const PER_PAGE = 15;

const OPTIONAL_COLS = [
  { key: 'logo',     label: 'Logo' },
  { key: 'code',     label: 'Code' },
  { key: 'company',  label: 'Company' },
  { key: 'channels', label: 'Active Channels' },
  { key: 'updated_at', label: 'Updated At' },
] as const;

export function BrandsPage() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BrandStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: BrandSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });

  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);
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

  const { data, isLoading, isError, isFetching, refetch } = useBrandsQuery(params);
  const { data: activeData } = useBrandsQuery({ company_id: companyFilter || undefined, status: 'active', per_page: 1 });
  const { data: inactiveData } = useBrandsQuery({ company_id: companyFilter || undefined, status: 'inactive', per_page: 1 });
  const deleteBrand = useDeleteBrand();

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
    setSort((cur) =>
      cur.field === field
        ? { field: field as BrandSortField, direction: cur.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as BrandSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const openCreate = () => {
    setActiveBrand(null);
    setFormDrawerOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setActiveBrand(brand);
    setFormDrawerOpen(true);
  };

  const openDetail = useCallback((brand: Brand) => {
    setActiveBrand(brand);
    setDetailDrawerOpen(true);
  }, []);

  const columns: ColumnDef<Brand>[] = [
    {
      key: 'logo',
      header: 'Logo',
      cell: (b) => <BrandLogoCell path={b.logo} name={b.name} />,
    },
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      cell: (b) => <span className="font-mono text-xs font-medium">{b.code}</span>,
    },
    {
      key: 'name',
      header: 'Brand Name',
      sortable: true,
      cell: (b) => (
        <button
          className="font-medium hover:underline text-start leading-none"
          onClick={() => openDetail(b)}
        >
          {b.name}
        </button>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      cell: (b) => <span className="text-muted-foreground">{b.company?.name ?? '—'}</span>,
    },
    {
      key: 'channels',
      header: 'Active Channels',
      cell: (b) => (
        <span className="text-muted-foreground">
          {b.active_channels_count > 0
            ? `${b.active_channels_count} / ${b.channels_count}`
            : b.channels_count > 0 ? `0 / ${b.channels_count}` : '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      cell: (b) => <StatusBadge status={b.is_active ? 'active' : 'inactive'} />,
    },
    {
      key: 'updated_at',
      header: 'Updated At',
      sortable: true,
      cell: (b) => (
        <span className="text-muted-foreground text-xs">
          {b.updated_at ? new Date(b.updated_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  const confirmDelete = () => {
    if (!deleting) return;
    deleteBrand.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Brands"
        subtitle="Manage your organization's brands, each linked to a company."
        breadcrumbs={[
          { label: 'Home', to: ROUTES.dashboard },
          { label: 'Organization', to: ROUTES.organization },
          { label: 'Brands' },
        ]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New Brand
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Total Brands</div>
            <div className="text-2xl font-bold">{meta?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Active Brands</div>
            <div className="text-2xl font-bold text-emerald-600">
              {activeData?.meta.total ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Inactive Brands</div>
            <div className="text-2xl font-bold text-slate-400">{inactiveData?.meta.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Connected Channels</div>
            <div className="text-2xl font-bold text-blue-600">
              {data?.summary?.total_active_channels ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder="Search brands…"
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
                  <span className="text-sm font-medium">Company</span>
                  <CompanySelect
                    value={companyFilter}
                    onChange={(value) => {
                      setCompanyFilter(value);
                      setPage(1);
                    }}
                    placeholder="All Companies"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as BrandStatusFilter);
                      setPage(1);
                    }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
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
                <DropdownMenuLabel>Show/Hide Columns</DropdownMenuLabel>
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

          <EntityTable<Brand>
            columns={columns.filter((c) => !hiddenCols.has(c.key))}
            data={items}
            getRowId={(b) => b.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(brand) => (
              <ActionMenu
                label={`Actions for ${brand.name}`}
                items={[
                  { key: 'view', label: 'View', icon: Eye, onSelect: () => openDetail(brand) },
                  { key: 'edit', label: 'Edit', icon: Pencil, onSelect: () => openEdit(brand) },
                  {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    variant: 'destructive',
                    onSelect: () => setDeleting(brand),
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

      <BrandFormDrawer
        open={formDrawerOpen}
        onOpenChange={(open) => {
          setFormDrawerOpen(open);
          if (!open) setActiveBrand(null);
        }}
        brand={activeBrand}
      />

      <BrandDetailDrawer
        open={detailDrawerOpen}
        onOpenChange={(open) => {
          setDetailDrawerOpen(open);
          if (!open) setActiveBrand(null);
        }}
        brand={activeBrand}
        onEdit={openEdit}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete Brand"
        description={`Are you sure you want to delete "${deleting?.name ?? ''}"? This action can be undone.`}
        confirmLabel="Delete Brand"
        variant="destructive"
        loading={deleteBrand.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
