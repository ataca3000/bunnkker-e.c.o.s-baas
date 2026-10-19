import { useCallback, useMemo, useState } from 'react';
import {
  Building2,
  Download,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';

import { getMediaUrl } from '@/lib/media';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CompanyDetailDrawer } from '@/features/companies/components/company-detail-drawer';
import { CompanyFormDrawer } from '@/features/companies/components/company-form-drawer';
import { useCompaniesQuery, useDeleteCompany } from '@/features/companies/hooks/use-companies';
import { useBrandsQuery } from '@/features/brands/hooks/use-brands';
import { useWarehousesQuery } from '@/features/warehouses/hooks/use-warehouses';
import type { Company, CompanySortField, CompanyStatusFilter } from '@/features/companies/types/company';
import { COMPANY_CURRENCIES } from '@/features/companies/types/company';
import { ROUTES } from '@/router/routes';

// ── Logo cell with getMediaUrl + error fallback ───────────────────────────────

function CompanyLogoCell({ path, name }: { path: string | null; name: string }) {
  const [error, setError] = useState(false);
  const url = getMediaUrl(path);
  if (url && !error) {
    return (
      <img
        src={url}
        alt={name}
        className="size-7 rounded object-contain border bg-muted/20"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div className="size-7 rounded border bg-muted/50 flex items-center justify-center">
      <Building2 className="size-3.5 text-muted-foreground/50" />
    </div>
  );
}

// ─── Column visibility ────────────────────────────────────────────────────────

const STORAGE_KEY = 'ecos_companies_cols_v1';

type ColKey = 'logo' | 'code' | 'currency' | 'timezone' | 'country' | 'email' | 'updated_at';

const ALL_OPTIONAL_COLS: { key: ColKey; label: string }[] = [
  { key: 'logo',       label: 'Logo' },
  { key: 'code',       label: 'Code' },
  { key: 'currency',   label: 'Currency' },
  { key: 'timezone',   label: 'Timezone' },
  { key: 'country',    label: 'Country' },
  { key: 'email',      label: 'Email' },
  { key: 'updated_at', label: 'Updated' },
];

const DEFAULT_VISIBLE: ColKey[] = ['logo', 'code', 'currency', 'timezone', 'updated_at'];

function loadVisibleCols(): ColKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ColKey[];
  } catch { /* ignore */ }
  return DEFAULT_VISIBLE;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 20;

function currencyCode(c: Company): string {
  if (!c.currency) return '—';
  const found = COMPANY_CURRENCIES.find((cur) => cur.value === c.currency);
  return found ? c.currency : c.currency;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCsv(items: Company[]) {
  const headers = ['Code', 'Name', 'Legal Name', 'Currency', 'Timezone', 'Country', 'City', 'Email', 'Phone', 'Status'];
  const rows = items.map((c) => [
    c.code,
    c.name,
    c.legal_name ?? '',
    c.currency ?? '',
    c.timezone ?? '',
    c.country ?? '',
    c.city ?? '',
    c.email ?? '',
    c.phone ?? '',
    c.is_active ? 'Active' : 'Inactive',
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `companies-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page Component ───────────────────────────────────────────────────────────

export function CompaniesPage() {
  // State
  const [search, setSearch]               = useState('');
  const [searchInput, setSearchInput]     = useState('');
  const [statusFilter, setStatusFilter]   = useState<CompanyStatusFilter>('all');
  const [page, setPage]                   = useState(1);
  const [sort, setSort]                   = useState<{ field: CompanySortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });

  // Drawer state — view vs form
  const [viewOpen, setViewOpen]           = useState(false);
  const [viewCompany, setViewCompany]     = useState<Company | null>(null);
  const [formOpen, setFormOpen]           = useState(false);
  const [formCompany, setFormCompany]     = useState<Company | null>(null);
  const [deleting, setDeleting]           = useState<Company | null>(null);

  // Column visibility
  const [visibleCols, setVisibleCols]     = useState<ColKey[]>(loadVisibleCols);

  // Queries
  const params = useMemo(
    () => ({
      search:   search || undefined,
      status:   statusFilter,
      page,
      per_page: PER_PAGE,
      sort_by:  sort.field,
      sort_dir: sort.direction,
    }),
    [search, statusFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useCompaniesQuery(params);
  const { data: activeData }   = useCompaniesQuery({ status: 'active', per_page: 1 });
  const { data: brandsData }   = useBrandsQuery({ per_page: 1 });
  const { data: warehouseData } = useWarehousesQuery({ per_page: 1 });

  const deleteCompany = useDeleteCompany();

  const items = data?.items ?? [];
  const meta  = data?.meta;

  // Handlers
  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  }, []);

  const handleSort = useCallback((field: string) => {
    setSort((curr) =>
      curr.field === field
        ? { field: field as CompanySortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as CompanySortField, direction: 'asc' },
    );
    setPage(1);
  }, []);

  const openView = useCallback((c: Company) => {
    setViewCompany(c);
    setViewOpen(true);
  }, []);

  const openEdit = useCallback((c: Company) => {
    setFormCompany(c);
    setFormOpen(true);
  }, []);

  const openCreate = useCallback(() => {
    setFormCompany(null);
    setFormOpen(true);
  }, []);

  const toggleCol = useCallback((key: ColKey) => {
    setVisibleCols((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const col = (key: ColKey) => visibleCols.includes(key);

  // Column definitions
  const columns = useMemo<ColumnDef<Company>[]>(() => {
    const defs: ColumnDef<Company>[] = [];

    if (col('logo')) {
      defs.push({
        key: 'logo',
        header: '',
        cell: (c) => <CompanyLogoCell path={c.logo} name={c.name} />,
      });
    }

    defs.push({
      key: 'name',
      header: 'Company',
      sortable: true,
      cell: (c) => (
        <div>
          <button
            className="font-medium hover:underline text-start leading-none"
            onClick={() => openView(c)}
          >
            {c.name}
          </button>
          {c.legal_name && <p className="text-xs text-muted-foreground mt-0.5">{c.legal_name}</p>}
        </div>
      ),
    });

    if (col('code')) {
      defs.push({
        key: 'code',
        header: 'Code',
        sortable: true,
        cell: (c) => <span className="font-mono text-xs font-medium">{c.code}</span>,
      });
    }

    defs.push({
      key: 'brands',
      header: 'Brands',
      cell: (c) => <span className="text-sm font-medium tabular-nums">{c.brands_count ?? 0}</span>,
    });

    defs.push({
      key: 'warehouses',
      header: 'Warehouses',
      cell: (c) => <span className="text-sm font-medium tabular-nums">{c.warehouses_count ?? 0}</span>,
    });

    if (col('currency')) {
      defs.push({
        key: 'currency',
        header: 'Currency',
        sortable: true,
        cell: (c) => <span className="text-xs">{currencyCode(c)}</span>,
      });
    }

    if (col('timezone')) {
      defs.push({
        key: 'timezone',
        header: 'Timezone',
        cell: (c) => <span className="text-xs text-muted-foreground">{c.timezone ?? '—'}</span>,
      });
    }

    if (col('country')) {
      defs.push({
        key: 'country',
        header: 'Country',
        sortable: true,
        cell: (c) => c.country ?? '—',
      });
    }

    if (col('email')) {
      defs.push({
        key: 'email',
        header: 'Email',
        cell: (c) => <span className="text-xs text-muted-foreground">{c.email ?? '—'}</span>,
      });
    }

    defs.push({
      key: 'is_active',
      header: 'Status',
      sortable: true,
      cell: (c) => <StatusBadge status={c.is_active ? 'active' : 'inactive'} />,
    });

    if (col('updated_at')) {
      defs.push({
        key: 'updated_at',
        header: 'Updated',
        sortable: true,
        cell: (c) => (
          <span className="text-xs text-muted-foreground">
            {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : '—'}
          </span>
        ),
      });
    }

    return defs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCols]);

  const confirmDelete = () => {
    if (!deleting) return;
    deleteCompany.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Companies"
        subtitle="Manage the root entities of your ECOS organization."
        breadcrumbs={[
          { label: 'Home', to: ROUTES.dashboard },
          { label: 'Organization', to: ROUTES.organization },
          { label: 'Companies' },
        ]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New Company
          </Button>
        }
      />

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="size-4" />
              <span className="text-sm">Total Companies</span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {meta?.total ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Active Companies</div>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {activeData?.meta.total ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Brands</div>
            <p className="mt-1 text-2xl font-bold">
              {brandsData?.meta.total ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Warehouses</div>
            <p className="mt-1 text-2xl font-bold">
              {warehouseData?.meta.total ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main table card ── */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          {/* Smart Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search companies…"
                className="pl-8 pr-8 h-9"
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Status filter chips */}
            <div className="flex gap-1">
              {(['all', 'active', 'inactive'] as CompanyStatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    statusFilter === s
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            <div className="ms-auto flex items-center gap-2">
              {/* Columns Manager */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5">
                    <SlidersHorizontal className="size-3.5" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_OPTIONAL_COLS.map(({ key, label }) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={visibleCols.includes(key)}
                      onCheckedChange={() => toggleCol(key)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={['size-3.5', isFetching ? 'animate-spin' : ''].join(' ')} />
              </Button>

              {/* Export */}
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => exportToCsv(items)}
              >
                <Download className="size-3.5" />
                Export
              </Button>

              {/* Clear Filters */}
              {(search || statusFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground"
                  onClick={() => { clearSearch(); setStatusFilter('all'); setPage(1); }}
                >
                  <X className="size-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* DataGrid */}
          <EntityTable<Company>
            columns={columns}
            data={items}
            getRowId={(c) => c.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(company) => (
              <ActionMenu
                label={`Actions for ${company.name}`}
                items={[
                  {
                    key: 'view',
                    label: 'View Details',
                    icon: Eye,
                    onSelect: () => openView(company),
                  },
                  {
                    key: 'edit',
                    label: 'Edit',
                    icon: Pencil,
                    onSelect: () => openEdit(company),
                  },
                  {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    variant: 'destructive',
                    onSelect: () => setDeleting(company),
                  },
                ]}
              />
            )}
          />

          {/* Pagination */}
          {meta ? (
            <Pagination
              meta={{
                page:     meta.current_page,
                perPage:  meta.per_page,
                total:    meta.total,
                lastPage: meta.last_page,
              }}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <CompanyDetailDrawer
        company={viewCompany}
        open={viewOpen}
        onOpenChange={(open) => { setViewOpen(open); if (!open) setViewCompany(null); }}
        onEdit={(c) => { setViewOpen(false); openEdit(c); }}
      />

      {/* Form Drawer */}
      <CompanyFormDrawer
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setFormCompany(null); }}
        company={formCompany}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete Company"
        description={`Are you sure you want to delete "${deleting?.name ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteCompany.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
