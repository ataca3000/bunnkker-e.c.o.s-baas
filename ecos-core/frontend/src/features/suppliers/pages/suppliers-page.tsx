import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  Archive,
  Building2,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Users,
} from 'lucide-react';

import {
  ColumnVisibilityMenu,
  SmartToolbar,
  UniversalDataGrid,
  useColumnVisibility,
  useRowSelection,
} from '@/components/data-grid';
import { ActionMenu } from '@/components/crud';
import { useFormatter } from '@/hooks/use-formatter';
import type { DataGridColumnDef } from '@/components/data-grid';
import {
  PageConfirmDialog,
  PageNoResultsState,
  QuickFilterChips,
  WorkspacePage,
} from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkspaceHeader } from '@/components/workspace';
import type { WorkspaceMetric } from '@/components/workspace';
import { PageEmptyState } from '@/components/page';
import { SupplierFormDrawer } from '@/features/suppliers/components/supplier-form-drawer';
import { SupplierStatusBadge } from '@/features/suppliers/components/supplier-status-badge';
import { Supplier360Drawer } from '@/features/suppliers/components/supplier-360-drawer';
import { SupplierWizard } from '@/features/suppliers/components/supplier-wizard';
import { useDeleteSupplier, useSuppliersQuery, useUpdateSupplier } from '@/features/suppliers/hooks/use-suppliers';
import { useSupplierSummaryStats } from '@/features/suppliers/hooks/use-supplier-analytics';
import type {
  Supplier,
  SupplierPayload,
  SupplierSortField,
  SupplierStatusFilter,
} from '@/features/suppliers/types/supplier';
import { toast } from '@/components/ds/use-toast';

const PER_PAGE = 20;
// v3 — columns rebuilt for TASK-UI-PROCUREMENT-002 Part 6 (keys changed).
const COL_STORAGE_KEY = 'suppliers-col-visibility-v3';

/** Map a Supplier row back into a full update payload (used by Archive). */
function supplierToPayload(s: Supplier, overrides: Partial<SupplierPayload> = {}): SupplierPayload {
  return {
    code: s.code,
    name: s.name,
    contact_person: s.contact_person ?? undefined,
    email: s.email ?? undefined,
    phone: s.phone ?? undefined,
    mobile: s.mobile ?? undefined,
    country: s.country ?? undefined,
    state: s.state ?? undefined,
    city: s.city ?? undefined,
    district: s.district ?? undefined,
    address: s.address ?? undefined,
    google_maps_url: s.google_maps_url ?? undefined,
    opening_balance_amount: s.opening_balance_amount ?? undefined,
    opening_balance_type: s.opening_balance_type ?? undefined,
    notes: s.notes ?? undefined,
    is_active: s.is_active,
    ...overrides,
  };
}

function exportCsv(items: Supplier[]) {
  const headers = ['Code', 'Name', 'Contact Person', 'Phone', 'Email', 'City', 'Country',
    'Total Invoiced', 'Outstanding Balance', 'Last Purchase', 'Status', 'Created'];
  const rows = items.map((s) => [
    s.code, s.name, s.contact_person ?? '', s.phone ?? '',
    s.email ?? '', s.city ?? '', s.country ?? '',
    s.total_invoiced != null ? s.total_invoiced.toFixed(2) : '',
    s.outstanding_balance != null ? s.outstanding_balance.toFixed(2) : '',
    s.last_purchase_date ?? '',
    s.is_active ? 'Active' : 'Inactive',
    s.created_at?.slice(0, 10) ?? '',
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `suppliers-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

export function SuppliersPage() {
  const { t } = useTranslation('suppliers');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const { money } = useFormatter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>('all');
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: SupplierSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });

  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);
  const [viewTab, setViewTab] = useState<'overview' | 'timeline'>('overview');
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const columnMeta = useMemo(() => [
    { key: 'name',                     label: t($ => $.columnsExtra.name),                  alwaysVisible: true },
    { key: 'phone',                    label: t($ => $.columns.phone),                      defaultVisible: true },
    { key: 'opening_balance',          label: t($ => $.columnsExtra.openingBalance),        defaultVisible: true },
    { key: 'purchase_balance',         label: t($ => $.columnsExtra.purchaseBalance),       defaultVisible: true },
    { key: 'current_supplier_balance', label: t($ => $.columnsExtra.currentSupplierBalance), defaultVisible: true },
    { key: 'total_paid',               label: t($ => $.columnsExtra.totalPaid),             defaultVisible: true },
    { key: 'total_outstanding',        label: t($ => $.columnsExtra.totalOutstanding),      defaultVisible: true },
    { key: 'total_purchased_value',    label: t($ => $.columnsExtra.totalPurchasedValue),   defaultVisible: true },
    { key: 'status',                   label: t($ => $.columns.status),                     alwaysVisible: true },
    { key: 'last_purchase',            label: t($ => $.columnsExtra.lastPurchase),          defaultVisible: true },
    { key: 'actions',                  label: t($ => $.columnsExtra.actions),               alwaysVisible: true },
  ], [t]);

  const { visibility, toggle, reset } = useColumnVisibility(COL_STORAGE_KEY, columnMeta);

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, statusFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useSuppliersQuery(params);
  const { data: stats, isLoading: statsLoading } = useSupplierSummaryStats();

  const deleteSupplier = useDeleteSupplier();
  const updateSupplier = useUpdateSupplier();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const selection = useRowSelection({ items, getId: (s) => s.id });

  // ── KPI metrics ───────────────────────────────────────────────────────────
  const metrics: WorkspaceMetric[] = [
    {
      id: 'total',
      icon: Building2,
      label: t($ => $.kpis.totalSuppliers),
      value: stats?.total_suppliers ?? '—',
      colorClass: 'bg-primary/10 text-primary',
      isLoading: statsLoading,
      active: activeMetric === 'total',
      onClick: () => { setActiveMetric(activeMetric === 'total' ? null : 'total'); setStatusFilter('all'); setPage(1); },
    },
    {
      id: 'active',
      icon: CheckCircle,
      label: t($ => $.kpis.active),
      value: stats?.active_suppliers ?? '—',
      colorClass: 'bg-emerald-500/10 text-emerald-600',
      isLoading: statsLoading,
      active: activeMetric === 'active',
      onClick: () => { setActiveMetric(activeMetric === 'active' ? null : 'active'); setStatusFilter(activeMetric === 'active' ? 'all' : 'active'); setPage(1); },
    },
    {
      id: 'new',
      icon: Users,
      label: t($ => $.kpis.newThisMonth),
      value: stats?.new_this_month ?? '—',
      colorClass: 'bg-blue-500/10 text-blue-600',
      isLoading: statsLoading,
    },
    {
      id: 'open_pos',
      icon: ShoppingCart,
      label: t($ => $.kpis.openPOs),
      value: stats?.open_pos_total ?? '—',
      colorClass: 'bg-amber-500/10 text-amber-600',
      isLoading: statsLoading,
    },
    {
      id: 'outstanding',
      icon: CreditCard,
      label: t($ => $.kpis.outstandingBalance),
      value: stats ? money(stats.total_outstanding) : '—',
      colorClass: 'bg-red-500/10 text-red-600',
      isLoading: statsLoading,
    },
    {
      id: 'inventory_value',
      icon: Package,
      label: t($ => $.kpis.inventoryValue),
      value: stats ? money(stats.total_inventory_value) : '—',
      colorClass: 'bg-purple-500/10 text-purple-600',
      isLoading: statsLoading,
    },
    {
      id: 'delayed',
      icon: Clock,
      label: t($ => $.kpis.delayedOrders),
      value: stats?.delayed_pos ?? '—',
      colorClass: 'bg-orange-500/10 text-orange-600',
      isLoading: statsLoading,
    },
    {
      id: 'review',
      icon: AlertCircle,
      label: t($ => $.kpis.needsReview),
      value: stats?.needs_review_count ?? '—',
      colorClass: 'bg-rose-500/10 text-rose-600',
      isLoading: statsLoading,
    },
  ];

  // ── Column definitions ────────────────────────────────────────────────────
  const columns = useMemo<DataGridColumnDef<Supplier>[]>(
    () => [
      // 1 — Supplier Name (code folded in as subtitle so the spec's 11-column set stays exact)
      {
        key: 'name',
        label: t($ => $.columnsExtra.name),
        alwaysVisible: true,
        pin: 'left',
        width: 220,
        sortable: true,
        skeletonClassName: 'w-40 h-4',
        cell: (s) => (
          <button
            className="flex flex-col items-start text-start transition-colors hover:text-primary"
            onClick={() => openView(s)}
          >
            <span className="font-medium underline-offset-2 hover:underline">{s.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{s.code}</span>
          </button>
        ),
      },
      // 2 — Phone
      {
        key: 'phone',
        label: t($ => $.columns.phone),
        skeletonClassName: 'w-28 h-4',
        // A phone number in an operations grid exists to be dialled. `dir="ltr"`
        // keeps the number itself left-to-right inside an RTL layout, where a
        // bare number would otherwise render with its punctuation reordered.
        // stopPropagation so dialling does not also open the row drawer.
        cell: (s) =>
          s.phone ? (
            <a
              href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}
              dir="ltr"
              className="text-sm tabular-nums text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {s.phone}
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      // 3 — Opening Balance (onboarding balance)
      {
        key: 'opening_balance',
        label: t($ => $.columnsExtra.openingBalance),
        align: 'end',
        skeletonClassName: 'w-20 h-4 ms-auto',
        cell: (s) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {money(s.opening_balance ?? 0)}
          </span>
        ),
      },
      // 4 — Purchase Balance (accumulated purchases)
      {
        key: 'purchase_balance',
        label: t($ => $.columnsExtra.purchaseBalance),
        align: 'end',
        skeletonClassName: 'w-20 h-4 ms-auto',
        cell: (s) => (
          <span className="text-sm tabular-nums">
            {s.purchase_balance != null ? money(s.purchase_balance) : '—'}
          </span>
        ),
      },
      // 5 — Current Supplier Balance (payable incl. opening balance)
      {
        key: 'current_supplier_balance',
        label: t($ => $.columnsExtra.currentSupplierBalance),
        align: 'end',
        skeletonClassName: 'w-20 h-4 ms-auto',
        cell: (s) => (
          s.current_supplier_balance != null
            ? <span className={`text-sm tabular-nums font-medium ${s.current_supplier_balance > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {money(s.current_supplier_balance)}
              </span>
            : <span className="text-xs text-muted-foreground">—</span>
        ),
      },
      // 6 — Total Paid
      {
        key: 'total_paid',
        label: t($ => $.columnsExtra.totalPaid),
        align: 'end',
        skeletonClassName: 'w-20 h-4 ms-auto',
        cell: (s) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {s.total_paid != null ? money(s.total_paid) : '—'}
          </span>
        ),
      },
      // 7 — Total Outstanding
      {
        key: 'total_outstanding',
        label: t($ => $.columnsExtra.totalOutstanding),
        align: 'end',
        skeletonClassName: 'w-20 h-4 ms-auto',
        cell: (s) => (
          s.total_outstanding != null
            ? <span className={`text-sm tabular-nums font-medium ${s.total_outstanding > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {s.total_outstanding > 0 ? money(s.total_outstanding) : '—'}
              </span>
            : <span className="text-xs text-muted-foreground">—</span>
        ),
      },
      // 8 — Total Purchased Value
      {
        key: 'total_purchased_value',
        label: t($ => $.columnsExtra.totalPurchasedValue),
        align: 'end',
        skeletonClassName: 'w-20 h-4 ms-auto',
        cell: (s) => (
          <span className="text-sm tabular-nums">
            {s.total_purchased_value != null ? money(s.total_purchased_value) : '—'}
          </span>
        ),
      },
      // 9 — Status
      {
        key: 'status',
        label: t($ => $.columns.status),
        alwaysVisible: true,
        sortable: true,
        skeletonClassName: 'w-14 h-5 rounded-full',
        cell: (s) => <SupplierStatusBadge isActive={s.is_active} />,
      },
      // 10 — Last Purchase Date
      {
        key: 'last_purchase',
        label: t($ => $.columnsExtra.lastPurchase),
        skeletonClassName: 'w-24 h-4',
        cell: (s) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {s.last_purchase_date ? s.last_purchase_date.slice(0, 10) : '—'}
          </span>
        ),
      },
      // 11 — Actions (standard Enterprise Action Menu — Part 5)
      {
        key: 'actions',
        label: t($ => $.columnsExtra.actions),
        alwaysVisible: true,
        pin: 'right',
        width: 64,
        align: 'end',
        cell: (s) => (
          <ActionMenu
            label={t($ => $.columnsExtra.actions)}
            items={[
              { key: 'view',     label: t($ => $.actionMenu.view),     icon: Eye,      onSelect: () => openView(s) },
              { key: 'edit',     label: t($ => $.actionMenu.edit),     icon: Pencil,   onSelect: () => openEdit(s) },
              { key: 'activity', label: t($ => $.actionMenu.activity), icon: Activity, onSelect: () => openActivity(s) },
              { key: 'notes',    label: t($ => $.actionMenu.notes),    icon: FileText, onSelect: () => openView(s) },
              { key: 'archive',  label: t($ => $.actionMenu.archive),  icon: Archive,  onSelect: () => handleArchive(s), disabled: !s.is_active },
              { key: 'delete',   label: t($ => $.actionMenu.delete),   icon: Trash2,   onSelect: () => setDeleting(s), variant: 'destructive' },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, money],
  );

  const hasActiveFilters = search !== '' || statusFilter !== 'all';

  function openView(supplier: Supplier) {
    setViewTab('overview');
    setViewSupplier(supplier);
  }

  function openActivity(supplier: Supplier) {
    setViewTab('timeline');
    setViewSupplier(supplier);
  }

  function openEdit(supplier: Supplier) {
    setEditSupplier(supplier);
    setEditDrawerOpen(true);
  }

  function handleArchive(supplier: Supplier) {
    if (!supplier.is_active) return;
    updateSupplier.mutate(
      { id: supplier.id, payload: supplierToPayload(supplier, { is_active: false }) },
      {
        onSuccess: () => toast.success(t($ => $.toast.archived)),
        onError: () => toast.error(t($ => $.toast.archiveFailed)),
      },
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteSupplier.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success(t($ => $.toast.deleted));
        selection.clearSelection();
      },
    });
  }

  const statusChips = [
    { key: 'all',      label: t($ => $.filters.all),      active: statusFilter === 'all',      onClick: () => { setStatusFilter('all');      setPage(1); } },
    { key: 'active',   label: t($ => $.filters.active),   active: statusFilter === 'active',   onClick: () => { setStatusFilter('active');   setPage(1); } },
    { key: 'inactive', label: t($ => $.filters.inactive), active: statusFilter === 'inactive', onClick: () => { setStatusFilter('inactive'); setPage(1); } },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t($ => $.page.breadcrumbs.procurement) }, { label: t($ => $.page.breadcrumbs.suppliers) }]}
        title={t($ => $.title)}
        description={t($ => $.page.description)}
        primaryAction={{ key: 'new', label: t($ => $.actions.new), icon: Plus, onClick: () => setWizardOpen(true) }}
        metrics={metrics}
        savedViews={{
          views: [
            { id: 'default',   label: t($ => $.page.savedViews.all), isDefault: true },
            { id: 'active',    label: t($ => $.page.savedViews.active) },
            { id: 'preferred', label: t($ => $.page.savedViews.preferred) },
          ],
          activeId: statusFilter === 'active' ? 'active' : 'default',
          onViewChange: (id) => {
            if (id === 'active') { setStatusFilter('active'); setPage(1); }
            else { setStatusFilter('all'); setPage(1); }
          },
        }}
      />

      <WorkspacePage
        toolbar={
          <SmartToolbar
            primaryAction={{ label: t($ => $.actions.new), icon: Plus, onClick: () => setWizardOpen(true) }}
            secondaryActions={[
              { key: 'export', label: t($ => $.exportCsv), icon: Download, onClick: () => exportCsv(items), hideOnMobile: true },
            ]}
            bulkActions={
              selection.selectedCount > 0
                ? [{ key: 'delete-bulk', label: tAny('deleteSelected', { count: selection.selectedCount }), onClick: () => {}, destructive: true }]
                : undefined
            }
            selectedCount={selection.selectedCount}
            onRefresh={() => void refetch()}
            isFetching={isFetching}
            viewControls={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    placeholder={t($ => $.search)}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="h-8 w-[200px] pl-8 sm:w-[240px] text-sm"
                  />
                </div>
                <ColumnVisibilityMenu columns={columnMeta} visibility={visibility} onToggle={toggle} onReset={reset} />
              </div>
            }
          />
        }
        quickFilters={<QuickFilterChips chips={statusChips} className="px-4 sm:px-6" />}
        pagination={
          meta ? (
            <div className="flex items-center justify-between px-4 pb-2 sm:px-6 text-xs text-muted-foreground">
              <span>
                {tAny('pagination.totalSuppliers', { total: meta.total })}
                {selection.selectedCount > 0 && ` · ${tAny('pagination.selected', { count: selection.selectedCount })}`}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                  disabled={meta.current_page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>
                  {t($ => $.pagination.previous)}
                </Button>
                <span>{tAny('pagination.page', { current: meta.current_page, last: meta.last_page })}</span>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                  disabled={meta.current_page >= meta.last_page || isFetching} onClick={() => setPage((p) => p + 1)}>
                  {t($ => $.pagination.next)}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {items.length === 0 && hasActiveFilters && !isLoading ? (
          <PageNoResultsState query={search} onClear={() => { setSearch(''); setStatusFilter('all'); setPage(1); }} />
        ) : items.length === 0 && !isLoading && !isError ? (
          <PageEmptyState
            icon={Building2}
            title={t($ => $.emptyState.title)}
            description={t($ => $.emptyState.description)}
            action={{ label: t($ => $.actions.new), icon: Plus, onClick: () => setWizardOpen(true) }}
          />
        ) : (
          <UniversalDataGrid
            data={items}
            columns={columns}
            rowId={(s) => s.id}
            loading={isLoading}
            error={isError}
            sort={{ field: sort.field, direction: sort.direction }}
            onSortChange={(field) => {
              setSort((prev) => ({
                field: field as SupplierSortField,
                direction: prev.field === field ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc',
              }));
              setPage(1);
            }}
            selection={selection}
            columnVisibility={visibility}
            skeletonRows={PER_PAGE}
          />
        )}
      </WorkspacePage>

      <Supplier360Drawer
        supplier={viewSupplier}
        open={viewSupplier !== null}
        initialTab={viewTab}
        onOpenChange={(open) => { if (!open) setViewSupplier(null); }}
        onEdit={(s) => { setViewSupplier(null); openEdit(s); }}
      />

      <SupplierFormDrawer
        open={editDrawerOpen}
        onOpenChange={(open) => { setEditDrawerOpen(open); if (!open) setEditSupplier(null); }}
        supplier={editSupplier}
      />

      <SupplierWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={() => void refetch()}
      />

      <PageConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.confirmDelete.title)}
        description={tAny('confirmDelete.description', { name: deleting?.name ?? '' })}
        confirmLabel={t($ => $.confirmDelete.confirm)}
        variant="destructive"
        loading={deleteSupplier.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
