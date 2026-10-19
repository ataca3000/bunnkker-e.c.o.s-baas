import {
  Copy,
  FileText,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState, useMemo} from 'react';
import { useTranslation } from 'react-i18next';

import {
  ActionMenu,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
} from '@/components/crud';
import { QuickStatCard } from '@/components/ds/quick-stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomerDrawer } from '@/features/customers/components/customer-drawer';
import { CustomerFormDrawer } from '@/features/customers/components/customer-form-drawer';
import { CustomerQuickActionCard } from '@/features/customers/components/customer-quick-action-card';
import { useCustomersQuery, useDeleteCustomer } from '@/features/customers/hooks/use-customers';
import type { Customer, CustomerSortField, CustomerStatusFilter } from '@/features/customers/types/customer';
import { ROUTES } from '@/router/routes';
import { cn } from '@/lib/utils';

const PER_PAGE = 20;

// ── Stat queries ──────────────────────────────────────────────────────────────

function useCustomerCounts() {
  const total    = useCustomersQuery({ per_page: 1 });
  const active   = useCustomersQuery({ per_page: 1, status: 'active' });
  const inactive = useCustomersQuery({ per_page: 1, status: 'inactive' });
  return {
    total:    total.data?.meta.total,
    active:   active.data?.meta.total,
    inactive: inactive.data?.meta.total,
  };
}

// ── Sort header ───────────────────────────────────────────────────────────────

function SortTh({
  field,
  label,
  sort,
  onSort,
}: {
  field: CustomerSortField;
  label: string;
  sort: { field: CustomerSortField; direction: 'asc' | 'desc' };
  onSort: (f: CustomerSortField) => void;
}) {
  const isActive = sort.field === field;
  return (
    <th className="px-4 py-3 text-start">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <span className="text-[10px]">
          {isActive ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

// ── Row skeleton ──────────────────────────────────────────────────────────────

function CustomerRowSkeleton() {
  return (
    <tr className="border-b">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CustomersPage() {
  const { t } = useTranslation('customers');
  const { t: tCommon } = useTranslation('common');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebounced]   = useState('');
  const [statusFilter, setStatusFilter]   = useState<CustomerStatusFilter>('all');
  const [sort, setSort]                   = useState<{ field: CustomerSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [page, setPage]                   = useState(1);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());

  // ── Drawer / dialog state ──────────────────────────────────────────────────
  const [viewCustomer, setViewCustomer]     = useState<Customer | null>(null);
  const [viewDefaultTab, setViewDefaultTab] = useState('summary');
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null);
  const [initialPhone, setInitialPhone]     = useState('');
  const [deleting, setDeleting]             = useState<Customer | null>(null);

  // ── DD-055: Auto-focus search on mount ────────────────────────────────────
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // ── Debounce search (300ms) ───────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
      setFocusedRowIndex(null);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const counts = useCustomerCounts();

  const { data, isLoading, isError, isFetching, refetch } = useCustomersQuery({
    search: debouncedSearch || undefined,
    status: statusFilter,
    page,
    per_page: PER_PAGE,
    sort_by: sort.field,
    sort_dir: sort.direction,
  });

  const deleteCustomer = useDeleteCustomer();

  // Memoised so the empty-state fallback keeps a stable identity between renders.
  const items = useMemo(() => data?.items ?? [], [data]);
  const meta  = data?.meta;

  // Reset selection when page data changes
  useEffect(() => {
    setFocusedRowIndex(null);
  }, [data]);

  // ── DD-056: Smart search behavior ─────────────────────────────────────────
  const isSearching = debouncedSearch.length > 0;
  const singleResult = isSearching && !isLoading && items.length === 1;
  const noResults    = isSearching && !isLoading && items.length === 0;
  const multiResults = isSearching && !isLoading && items.length > 1;
  const showTable    = !isSearching || multiResults;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = (phone?: string) => {
    setDrawerCustomer(null);
    setInitialPhone(phone ?? '');
    setDrawerOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setViewCustomer(null);
    setDrawerCustomer(customer);
    setInitialPhone('');
    setDrawerOpen(true);
  };

  const openView = (customer: Customer, tab = 'summary') => {
    setViewDefaultTab(tab);
    setViewCustomer(customer);
  };

  const openViewOrders = (customer: Customer) => openView(customer, 'orders');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function handleSortChange(field: CustomerSortField) {
    setSort((curr) =>
      curr.field === field
        ? { field, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    );
    setPage(1);
    setFocusedRowIndex(null);
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const stateRef = useRef({
    items,
    viewCustomer,
    drawerOpen,
    focusedRowIndex,
    selectedIds,
  });
  useEffect(() => {
    stateRef.current = { items, viewCustomer, drawerOpen, focusedRowIndex, selectedIds };
  }, [items, viewCustomer, drawerOpen, focusedRowIndex, selectedIds]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const {
        items: rows,
        viewCustomer: vc,
        drawerOpen: fo,
        focusedRowIndex: fi,
        selectedIds: sel,
      } = stateRef.current;

      // Ctrl+K or / → focus search
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !inInput)) {
        e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return;
      }
      // Ctrl+N → new customer
      if (e.key === 'n' && (e.ctrlKey || e.metaKey) && !inInput) {
        e.preventDefault(); openCreate(); return;
      }
      // Escape → close drawer / clear search
      if (e.key === 'Escape' && !inInput) {
        if (vc !== null) { setViewCustomer(null); return; }
        if (fo) return;
        setSearch(''); setFocusedRowIndex(null); return;
      }
      // Arrow Down
      if (e.key === 'ArrowDown' && !inInput && rows.length > 0) {
        e.preventDefault(); setFocusedRowIndex(fi === null ? 0 : Math.min(fi + 1, rows.length - 1)); return;
      }
      // Arrow Up
      if (e.key === 'ArrowUp' && !inInput && rows.length > 0) {
        e.preventDefault(); setFocusedRowIndex(fi === null ? 0 : Math.max(fi - 1, 0)); return;
      }
      // Enter → open focused row
      if (e.key === 'Enter' && !inInput && fi !== null) {
        e.preventDefault(); const c = rows[fi]; if (c) openView(c); return;
      }
      // Space → toggle row selection
      if (e.key === ' ' && !inInput && fi !== null) {
        e.preventDefault();
        const c = rows[fi];
        if (c) {
          const next = new Set(sel);
          if (next.has(c.id)) next.delete(c.id);
          else next.add(c.id);
          setSelectedIds(next);
        }
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
     
  }, []);

  const allSelected = items.length > 0 && items.every((c) => selectedIds.has(c.id));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title) },
        ]}
        actions={
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="size-4" />
            {t($ => $.actions.new)}
          </Button>
        }
      />

      {/* ── Quick Stats ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickStatCard
          title={t($ => $.quickStats.total)}
          value={counts.total ?? '—'}
          icon={Users}
          onClick={() => { setStatusFilter('all'); setSearch(''); }}
        />
        <QuickStatCard
          title={t($ => $.quickStats.active)}
          value={counts.active ?? '—'}
          icon={Users}
          colorClassName="text-emerald-600 bg-emerald-100"
          onClick={() => { setStatusFilter('active'); setPage(1); }}
        />
        <QuickStatCard
          title={t($ => $.quickStats.inactive)}
          value={counts.inactive ?? '—'}
          icon={Users}
          colorClassName="text-amber-600 bg-amber-100"
          onClick={() => { setStatusFilter('inactive'); setPage(1); }}
        />
      </div>

      {/* ── Smart Search (DD-055/056) ────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t($ => $.search)} · / or Ctrl+K`}
            className="max-w-lg"
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur(); }
            }}
          />
          {isFetching && isSearching ? (
            <span className="text-xs text-muted-foreground">{tCommon($ => $.loading) ?? 'Loading…'}</span>
          ) : null}
        </div>

        {/* DD-056: Single result → Quick Action Card */}
        {singleResult ? (
          <CustomerQuickActionCard
            customer={items[0]}
            onOpen={(c) => openView(c, 'summary')}
            onOpenOrders={openViewOrders}
            onEdit={openEdit}
            onCreateOrder={() => undefined}
            onClose={() => setSearch('')}
            className="max-w-md"
          />
        ) : null}

        {/* DD-056: No result → "Customer not found" + Create CTA */}
        {noResults ? (
          <div className="flex max-w-md flex-col items-start gap-3 rounded-xl border border-dashed p-5">
            <div>
              <p className="text-sm font-medium">{t($ => $.noResults.title)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t($ => $.noResults.description)}</p>
            </div>
            <Button size="sm" onClick={() => openCreate(debouncedSearch)}>
              <Plus className="size-3.5" />
              {t($ => $.noResults.createWithPhone)}
            </Button>
          </div>
        ) : null}
      </div>

      {/* ── Data Table ───────────────────────────────────────────────────── */}
      {showTable ? (
        <div className="overflow-hidden rounded-xl border bg-background">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-muted/60 backdrop-blur-sm">
              <tr>
                {/* Checkbox */}
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer rounded border-input"
                    checked={allSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(items.map((c) => c.id)));
                      else setSelectedIds(new Set());
                    }}
                    aria-label={t($ => $.table.selectAll)}
                  />
                </th>
                <SortTh field="name" label={t($ => $.columns.customer)} sort={sort} onSort={handleSortChange} />
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                  {t($ => $.columns.phones)}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                  {t($ => $.columns.defaultAddress)}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                  {t($ => $.columns.previousOrders)}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                  {t($ => $.columns.intelligence)}
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <CustomerRowSkeleton key={i} />)
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <ErrorState
                      description={t($ => $.table.error)}
                      onRetry={() => void refetch()}
                    />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <EmptyState title={t($ => $.table.empty)} />
                  </td>
                </tr>
              ) : (
                items.map((customer, idx) => (
                  <CustomerRow
                    key={customer.id}
                    customer={customer}
                    isFocused={focusedRowIndex === idx}
                    isSelected={selectedIds.has(customer.id)}
                    onToggleSelect={toggleSelect}
                    onView={openView}
                    onViewOrders={openViewOrders}
                    onEdit={openEdit}
                    onDelete={setDeleting}
                  />
                ))
              )}
            </tbody>
          </table>

          {meta && meta.last_page > 1 ? (
            <div className="border-t px-4 py-3">
              <Pagination
                meta={{
                  page: meta.current_page,
                  perPage: meta.per_page,
                  total: meta.total,
                  lastPage: meta.last_page,
                }}
                onPageChange={(p) => { setPage(p); setFocusedRowIndex(null); }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Customer Profile Drawer ────────────────────────────────────── */}
      <CustomerDrawer
        customer={viewCustomer}
        open={viewCustomer !== null}
        onOpenChange={(open) => { if (!open) setViewCustomer(null); }}
        onEdit={openEdit}
        defaultTab={viewDefaultTab}
      />

      {/* ── Create / Edit Form Drawer ─────────────────────────────────── */}
      <CustomerFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) { setDrawerCustomer(null); setInitialPhone(''); }
        }}
        customer={drawerCustomer}
        initialPhone={initialPhone}
        onFoundExisting={openView}
      />

      {/* ── Delete Confirm ────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.name ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteCustomer.isPending}
        onConfirm={() => {
          if (deleting) deleteCustomer.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}

// ── Customer Row ──────────────────────────────────────────────────────────────

type RowProps = {
  customer: Customer;
  isFocused: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onView: (c: Customer, tab?: string) => void;
  onViewOrders: (c: Customer) => void;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
};

function CustomerRow({
  customer,
  isFocused,
  isSelected,
  onToggleSelect,
  onView,
  onViewOrders,
  onEdit,
  onDelete,
}: RowProps) {
  const { t } = useTranslation('customers');
  const { t: tCommon } = useTranslation('common');

  const primaryPhone   = customer.phone;
  const secondaryPhone = customer.mobile;
  const cityCountry    = [customer.city, customer.country].filter(Boolean).join(', ');
  const hasAddress     = Boolean(customer.address || cityCountry);

  return (
    <tr
      className={cn(
        'group border-b transition-colors hover:bg-accent/30 cursor-pointer',
        isSelected && 'bg-primary/5',
        isFocused && 'outline outline-1 outline-primary/50 bg-accent/30',
      )}
      onClick={() => onView(customer)}
    >
      {/* Checkbox */}
      <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="size-4 cursor-pointer rounded border-input"
          checked={isSelected}
          onChange={() => onToggleSelect(customer.id)}
          aria-label={customer.name}
        />
      </td>

      {/* Customer */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {customer.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{customer.name}</p>
            <p className="text-xs text-muted-foreground">{customer.code}</p>
          </div>
        </div>
      </td>

      {/* Phones */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-0.5">
          {primaryPhone ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs">{primaryPhone}</span>
              <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                {t($ => $.phone.primary)}
              </Badge>
              <Button size="icon" variant="ghost" className="size-5" asChild title={t($ => $.phone.call)}>
                <a href={`tel:${primaryPhone.replace(/\D/g, '')}`}>
                  <Phone className="size-3" />
                </a>
              </Button>
              <Button size="icon" variant="ghost" className="size-5" asChild title={t($ => $.phone.whatsapp)}>
                <a
                  href={`https://wa.me/${primaryPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-3" />
                </a>
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          {secondaryPhone ? (
            <span className="font-mono text-xs text-muted-foreground">{secondaryPhone}</span>
          ) : null}
        </div>
      </td>

      {/* Default Address */}
      <td className="px-4 py-3">
        {hasAddress ? (
          <div className="flex flex-col gap-0.5 max-w-[180px]">
            {customer.address ? (
              <p className="truncate text-xs">{customer.address}</p>
            ) : null}
            {cityCountry ? (
              <p className="text-xs text-muted-foreground">{cityCountry}</p>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Previous Orders */}
      <td
        className="px-4 py-3"
        onClick={(e) => { e.stopPropagation(); onViewOrders(customer); }}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ShoppingBag className="size-3.5" />
          {t($ => $.table.viewOrders)}
        </Button>
      </td>

      {/* Customer Intelligence */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {customer.notes ? (
            <Badge
              variant="secondary"
              className="h-5 gap-1 px-1.5 text-[10px] text-amber-700 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800"
            >
              <FileText className="size-3" />
              {t($ => $.intelligence.hasNotes)}
            </Badge>
          ) : null}
          {!customer.is_active ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {t($ => $.tags.inactive)}
            </Badge>
          ) : null}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <ActionMenu
            label={`Actions for ${customer.name}`}
            items={[
              {
                key: 'edit',
                label: tCommon($ => $.common.edit),
                icon: Pencil,
                onSelect: () => onEdit(customer),
              },
              {
                key: 'copyPhone',
                label: t($ => $.quickCard.copyPhone),
                icon: Copy,
                onSelect: () => {
                  if (primaryPhone) void navigator.clipboard.writeText(primaryPhone);
                },
                disabled: !primaryPhone,
              },
              {
                key: 'delete',
                label: tCommon($ => $.common.delete),
                icon: Trash2,
                variant: 'destructive' as const,
                onSelect: () => onDelete(customer),
              },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}
