import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/crud';
import { PageHeader } from '@/components/crud';
import { useColumnVisibility } from '@/components/data-grid/use-column-visibility';
import { useRowSelection } from '@/components/data-grid/use-row-selection';
import type { GridPaginationConfig } from '@/components/data-grid/types';
import { useChannelOptions } from '@/features/channels/hooks/use-channel-options';
import type { AdvancedFilterValues } from '@/features/orders/components/order-advanced-filters';
import { OrderAdvancedFilters } from '@/features/orders/components/order-advanced-filters';
import { OrderCustomerIntelligence } from '@/features/orders/components/order-customer-intelligence';
import { OrderDetailDrawer } from '@/features/orders/components/order-detail-drawer';
import type { BulkActionKey } from '@/features/orders/components/order-list-toolbar';
import {
  OrderListToolbar,
  IRREVERSIBLE_BULK_ACTIONS,
  BULK_ACTION_TARGET_LABEL,
} from '@/features/orders/components/order-list-toolbar';
import { OrderSmartToolbar } from '@/features/orders/components/order-smart-toolbar';
import { OrderStatusTabs } from '@/features/orders/components/order-status-tabs';
import { createOrderColumnMeta } from '@/features/orders/components/order-column-meta';
import { useOrderStatusLabels, useOrderBulkLabels } from '@/features/orders/hooks/use-order-labels';
import { OrderTable } from '@/features/orders/components/order-table';
import { OrderConfirmCustomerDialog } from '@/features/orders/components/order-confirm-customer-dialog';
import { EmptyState } from '@/components/crud';
import {
  useDeleteOrder,
  useOrderStatusKpis,
  useOrdersQuery,
  useBulkConfirm,
  useBulkCancel,
  useBulkMoveToPreparation,
  useBulkCompleteDelivery,
  useBulkComplete,
  useBulkDispatch,
  useBulkMarkAwaitingStock,
  useBulkResume,
  useBulkMoveToReview,
  useBulkReschedule,
  useBulkReturn,
  useBulkReturnToConfirmed,
  useBulkResumeToConfirmed,
} from '@/features/orders/hooks/use-orders';
import type {
  CustomerIntelligenceFilter,
  Order,
  OrderSortField,
  OrderStatus,
} from '@/features/orders/types/order';
import { STATUS_TAB_ORDER } from '@/features/orders/types/order';
import { ROUTES } from '@/router/routes';
import { cn } from '@/lib/utils';

const PER_PAGE = 20;

type StatusFilter = OrderStatus | 'all';

const EMPTY_ADVANCED: AdvancedFilterValues = {
  productId: null,
  paymentMethod: null,
  paymentStatus: null,
  hasPaymentProof: null,
  reservationStatus: null,
  shippingCompany: null,
  dateFrom: null,
  dateTo: null,
  datePreset: null,
  governorate: null,
  city: null,
  zone: null,
  minAmount: null,
  maxAmount: null,
};

// ── Workspace state persistence ───────────────────────────────────────────────
// Saves active tab, sort, and filter state per user/browser via localStorage.

const WORKSPACE_KEY = 'ecos-orders-workspace-v1';

type PersistedWorkspace = {
  activeStatus?: StatusFilter;
  sort?: { field: OrderSortField; direction: 'asc' | 'desc' };
  channelId?: string | null;
  advancedFilters?: AdvancedFilterValues;
};

function loadWorkspace(): PersistedWorkspace {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    return raw ? (JSON.parse(raw) as PersistedWorkspace) : {};
  } catch {
    return {};
  }
}

function saveWorkspace(state: PersistedWorkspace): void {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
  } catch {}
}

export function OrdersPage() {
  const { t } = useTranslation('orders');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();

  const { statusLabel, statusTabLabel } = useOrderStatusLabels();
  const { bulkLabel } = useOrderBulkLabels();
  const columnMeta = useMemo(() => createOrderColumnMeta(t), [t]);

  // Load once on mount — initialises state from persisted workspace
  const [savedWorkspace] = useState(loadWorkspace);

  // ── Status tab ────────────────────────────────────────────────────────────────
  const [activeStatus, setActiveStatus] = useState<StatusFilter>(savedWorkspace.activeStatus ?? 'all');

  // ── Pagination + sort ─────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: OrderSortField; direction: 'asc' | 'desc' }>(
    savedWorkspace.sort ?? { field: 'created_at', direction: 'desc' },
  );

  // ── Search ────────────────────────────────────────────────────────────────────
  const [searchKey, setSearchKey] = useState(0);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── DD-023 Channel filter ─────────────────────────────────────────────────────
  const [channelId, setChannelId] = useState<string | null>(savedWorkspace.channelId ?? null);
  const { data: channelOptions = [] } = useChannelOptions();

  // ── DD-026 Advanced filters ───────────────────────────────────────────────────
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterValues>(
    savedWorkspace.advancedFilters ?? EMPTY_ADVANCED,
  );

  // ── DD-025 Customer Intelligence — multi-select array ────────────────────────
  const [showCustomerIntelligence, setShowCustomerIntelligence] = useState(false);
  const [customerFilters, setCustomerFilters] = useState<CustomerIntelligenceFilter[]>([]);

  // ── DD-031 Toolbar ops — direct query param toggles ───────────────────────────
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const [minShippingAttempts, setMinShippingAttempts] = useState<number | null>(null);

  // ── Bulk reschedule dialog ────────────────────────────────────────────────────
  const [bulkRescheduleOpen, setBulkRescheduleOpen] = useState(false);
  const [bulkRescheduleDate, setBulkRescheduleDate] = useState('');
  const [pendingRescheduleIds, setPendingRescheduleIds] = useState<string[]>([]);

  // ── Bulk confirmation dialog ──────────────────────────────────────────────────
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkActionKey | null>(null);

  // ── Drawer state ──────────────────────────────────────────────────────────────
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);

  // ── UI-005: Keyboard navigation ───────────────────────────────────────────────
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

  // ── Column visibility — persisted in localStorage ─────────────────────────────
  const { visibility: columnVisibility, toggle: toggleColumn, reset: resetColumns } =
    useColumnVisibility('ecos-orders-cols', columnMeta);

  // ── Query ─────────────────────────────────────────────────────────────────────
  const params = useMemo(
    () => ({
      search: search || undefined,
      status: activeStatus === 'all' ? undefined : activeStatus,
      channel_id: channelId ?? undefined,
      product_id: advancedFilters.productId ?? undefined,
      payment_method: advancedFilters.paymentMethod ?? undefined,
      payment_status: advancedFilters.paymentStatus ?? undefined,
      has_payment_proof: advancedFilters.hasPaymentProof ?? undefined,
      reservation_status: advancedFilters.reservationStatus === 'not_reserved' ? undefined : advancedFilters.reservationStatus ?? undefined,
      shipping_company: advancedFilters.shippingCompany ?? undefined,
      date_from: advancedFilters.dateFrom ?? undefined,
      date_to: advancedFilters.dateTo ?? undefined,
      governorate: advancedFilters.governorate ?? undefined,
      city: advancedFilters.city ?? undefined,
      zone: advancedFilters.zone ?? undefined,
      min_amount: advancedFilters.minAmount ? Number(advancedFilters.minAmount) : undefined,
      max_amount: advancedFilters.maxAmount ? Number(advancedFilters.maxAmount) : undefined,
      customer_filter: customerFilters.length > 0 ? customerFilters.join(',') : undefined,
      has_location: hasLocation ?? undefined,
      min_shipping_attempts: minShippingAttempts ?? undefined,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, activeStatus, channelId, advancedFilters, customerFilters, hasLocation, minShippingAttempts, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useOrdersQuery(params);

  // ── KPI params: same filters as the main query but without status/pagination/sort ──
  const kpiParams = useMemo(
    () => ({
      search: search || undefined,
      channel_id: channelId ?? undefined,
      product_id: advancedFilters.productId ?? undefined,
      payment_method: advancedFilters.paymentMethod ?? undefined,
      payment_status: advancedFilters.paymentStatus ?? undefined,
      has_payment_proof: advancedFilters.hasPaymentProof ?? undefined,
      reservation_status: advancedFilters.reservationStatus === 'not_reserved' ? undefined : advancedFilters.reservationStatus ?? undefined,
      shipping_company: advancedFilters.shippingCompany ?? undefined,
      date_from: advancedFilters.dateFrom ?? undefined,
      date_to: advancedFilters.dateTo ?? undefined,
      governorate: advancedFilters.governorate ?? undefined,
      city: advancedFilters.city ?? undefined,
      zone: advancedFilters.zone ?? undefined,
      min_amount: advancedFilters.minAmount ? Number(advancedFilters.minAmount) : undefined,
      max_amount: advancedFilters.maxAmount ? Number(advancedFilters.maxAmount) : undefined,
      customer_filter: customerFilters.length > 0 ? customerFilters.join(',') : undefined,
      has_location: hasLocation ?? undefined,
      min_shipping_attempts: minShippingAttempts ?? undefined,
    }),
    [search, channelId, advancedFilters, customerFilters, hasLocation, minShippingAttempts],
  );

  const statusKpis = useOrderStatusKpis(kpiParams);
  const deleteOrder = useDeleteOrder();

  // ── Workspace persistence: save tab + sort + channel + filters on change ──────
  useEffect(() => {
    saveWorkspace({ activeStatus, sort, channelId, advancedFilters });
  }, [activeStatus, sort, channelId, advancedFilters]);

  // ── Bulk workflow hooks ───────────────────────────────────────────────────────
  const bulkConfirm          = useBulkConfirm();
  const bulkCancel           = useBulkCancel();
  const bulkMoveToPrep       = useBulkMoveToPreparation();
  const bulkCompleteDelivery = useBulkCompleteDelivery();
  const bulkComplete         = useBulkComplete();
  const bulkDispatch         = useBulkDispatch();
  const bulkAwaitingStock    = useBulkMarkAwaitingStock();
  const bulkResume           = useBulkResume();
  const bulkReview           = useBulkMoveToReview();
  const bulkReschedule          = useBulkReschedule();
  const bulkReturn              = useBulkReturn();
  const bulkReturnToConfirmed   = useBulkReturnToConfirmed();
  const bulkResumeToConfirmed   = useBulkResumeToConfirmed();

  // useMemo, not a bare `?? []`: the fallback minted a new array on every render
  // while the page was loading, re-running every dependent effect and memo.
  const orders = useMemo(() => data?.items ?? [], [data]);

  // ── Row selection ─────────────────────────────────────────────────────────────
  const selectionHook = useRowSelection({ items: orders, getId: (o) => o.id });
  const { selectedIds, selectedCount, clearSelection } = selectionHook;

  // Part 1: selectedOrders drives the dynamic bulk action computation in the toolbar
  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds],
  );

  const meta = data?.meta;

  // ── UI-005: stateRef avoids stale closures in the keyboard handler ────────────
  const stateRef = useRef({ orders, viewOrder, focusedRowIndex });
  useEffect(() => {
    stateRef.current = { orders, viewOrder, focusedRowIndex };
  }, [orders, viewOrder, focusedRowIndex]);

  // Reset row focus when data changes (new page / filter applied)
  useEffect(() => { setFocusedRowIndex(null); }, [data]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const { orders: ords, viewOrder: vo, focusedRowIndex: fi } = stateRef.current;

      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !inInput)) {
        e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return;
      }
      if (e.key === 'Escape' && !inInput) {
        if (vo !== null) { setViewOrder(null); return; }
        setSearchKey((k) => k + 1); setSearch(''); setPage(1); clearSelection(); setFocusedRowIndex(null); return;
      }
      if (e.key === 'ArrowDown' && !inInput && ords.length > 0) {
        e.preventDefault(); setFocusedRowIndex(fi === null ? 0 : Math.min(fi + 1, ords.length - 1)); return;
      }
      if (e.key === 'ArrowUp' && !inInput && ords.length > 0) {
        e.preventDefault(); setFocusedRowIndex(fi === null ? 0 : Math.max(fi - 1, 0)); return;
      }
      if (e.key === 'Enter' && !inInput && fi !== null) {
        e.preventDefault(); const order = ords[fi]; if (order) setViewOrder(order); return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && !inInput) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9 && num <= STATUS_TAB_ORDER.length) {
          e.preventDefault(); setActiveStatus(STATUS_TAB_ORDER[num - 1]); setPage(1); clearSelection();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Active filter counts ──────────────────────────────────────────────────────
  const dateFilterActive = !!(advancedFilters.dateFrom || advancedFilters.dateTo);
  const advancedNonDateCount =
    (advancedFilters.productId ? 1 : 0) +
    (advancedFilters.paymentMethod ? 1 : 0) +
    (advancedFilters.paymentStatus ? 1 : 0) +
    (advancedFilters.hasPaymentProof !== null ? 1 : 0) +
    (advancedFilters.reservationStatus ? 1 : 0) +
    (advancedFilters.shippingCompany ? 1 : 0) +
    (advancedFilters.zone ? 1 : 0) +
    (advancedFilters.minAmount ? 1 : 0) +
    (advancedFilters.maxAmount ? 1 : 0);
  const advancedActiveCount = advancedNonDateCount + (dateFilterActive ? 1 : 0) + (channelId ? 1 : 0);

  // ── Reset helpers ─────────────────────────────────────────────────────────────
  function resetPage() { setPage(1); clearSelection(); }

  function handleStatusChange(status: StatusFilter) {
    setActiveStatus(status);
    resetPage();
  }

  function handleSortChange(field: string) {
    const sortField = field as OrderSortField;
    setSort((curr) =>
      curr.field === sortField
        ? { field: sortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: sortField, direction: 'asc' },
    );
    setPage(1);
  }

  function handleSearchCommit(value: string) {
    setSearch(value);
    resetPage();
  }

  function clearSearch() {
    setSearchKey((k) => k + 1);
    setSearch('');
    resetPage();
  }

  function handleEdit(order: Order) {
    navigate(`${ROUTES.orders}/${order.id}/edit`);
  }

  // Part 11: Filter-aware CSV export of current page orders
  function handleExport() {
    const header = ['Order #', 'Date', 'Customer', 'Status', 'Total', 'Payment', 'Channel', 'Phone', 'Governorate'];
    const rows = orders.map((o) => [
      o.order_number,
      o.order_date ?? '',
      o.customer?.name ?? '',
      o.status,
      String(o.total),
      o.payment_method ?? '',
      o.channel?.name ?? '',
      o.billing_phone ?? o.customer?.phone ?? '',
      o.governorate ?? '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildCsvContent() {
    const header = ['Order #', 'Date', 'Customer', 'Status', 'Total', 'Payment', 'Channel', 'Phone', 'Governorate'];
    const rows = orders.map((o) => [
      o.order_number,
      o.order_date ?? '',
      o.customer?.name ?? '',
      o.status,
      String(o.total),
      o.payment_method ?? '',
      o.channel?.name ?? '',
      o.billing_phone ?? o.customer?.phone ?? '',
      o.governorate ?? '',
    ]);
    return [header, ...rows]
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  function handleCopyToClipboard() {
    void navigator.clipboard.writeText(buildCsvContent());
  }

  function handlePrint() {
    const csv = buildCsvContent();
    const lines = csv.split('\n');
    const tableRows = lines
      .map((line, i) => {
        const cells = line.split(',').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
        const tag = i === 0 ? 'th' : 'td';
        return `<tr>${cells.map((c) => `<${tag} style="padding:4px 8px;border:1px solid #ddd">${c}</${tag}>`).join('')}</tr>`;
      })
      .join('');
    const html = `<!doctype html><html><head><title>Orders</title><style>table{border-collapse:collapse;font-size:12px;font-family:sans-serif}th{background:#f5f5f5}</style></head><body><table>${tableRows}</table></body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  }

  function clearAdvancedFilters() {
    setAdvancedFilters(EMPTY_ADVANCED);
    setChannelId(null);
    resetPage();
  }

  function handleAdvancedFiltersChange(next: AdvancedFilterValues) {
    setAdvancedFilters(next);
    resetPage();
  }

  // Multi-select handler for the chip panel
  function handleCustomerFiltersChange(next: CustomerIntelligenceFilter[]) {
    setCustomerFilters(next);
    resetPage();
  }

  // Single-value handler for SmartToolbar ops (replaces current selection)
  function handleSmartToolbarCustomerFilter(f: CustomerIntelligenceFilter | null) {
    setCustomerFilters(f ? [f] : []);
    resetPage();
  }

  // ── Bulk action dispatch ──────────────────────────────────────────────────────
  // Step 1: Capture intent — open confirmation dialog (or date picker for reschedule).
  function handleBulkAction(action: BulkActionKey) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (action === 'reschedule') {
      setPendingRescheduleIds(ids);
      setBulkRescheduleDate('');
      setBulkRescheduleOpen(true);
      return;
    }
    setPendingBulkAction(action);
  }

  // Step 2: Execute after user confirms in the dialog.
  function executeBulkAction() {
    const action = pendingBulkAction;
    if (!action) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    switch (action) {
      case 'confirm':
      case 'verify_payment':           bulkConfirm.mutate(ids); break;
      case 'cancel':                   bulkCancel.mutate({ ids }); break;
      case 'move_to_preparation':
      case 'return_to_preparation':    bulkMoveToPrep.mutate(ids); break;
      case 'complete_delivery':        bulkCompleteDelivery.mutate(ids); break;
      case 'complete':                 bulkComplete.mutate(ids); break;
      case 'dispatch':                 bulkDispatch.mutate(ids); break;
      case 'awaiting_stock':           bulkAwaitingStock.mutate({ ids }); break;
      case 'resume':
      case 'retry_reservation':        bulkResume.mutate(ids); break;
      case 'resume_confirmed':         bulkResumeToConfirmed.mutate(ids); break;
      case 'review':                   // on_hold action
      case 'delivery_failed':          bulkReview.mutate({ ids }); break;
      case 'return':                   bulkReturn.mutate({ ids }); break;
      case 'return_to_confirmed':
      case 'return_to_stock':          bulkReturnToConfirmed.mutate(ids); break;
      // Pending backend implementation — no-op for now:
      // move_to_awaiting_payment, start_manufacturing, purchase_materials,
      // inspect_return, scrap
      default: break;
    }
    clearSelection();
    setPendingBulkAction(null);
  }

  function confirmBulkReschedule() {
    if (!bulkRescheduleDate) return;
    bulkReschedule.mutate({ ids: pendingRescheduleIds, date: bulkRescheduleDate });
    setBulkRescheduleOpen(false);
    clearSelection();
  }

  // ── Page header subtitle — total count + active filter summary ────────────────
  const totalCount = meta?.total;
  const activeFilterCount =
    (search ? 1 : 0) +
    (channelId ? 1 : 0) +
    advancedNonDateCount +
    (dateFilterActive ? 1 : 0) +
    (customerFilters.length > 0 ? 1 : 0) +
    (hasLocation !== null ? 1 : 0) +
    (minShippingAttempts !== null ? 1 : 0);

  const headerSubtitle = (
    <span className="inline-flex items-center gap-2">
      {totalCount !== undefined ? (
        <span className="font-medium text-foreground">
          {totalCount.toLocaleString()} {t($ => $.title).toLowerCase()}
        </span>
      ) : (
        <span>{t($ => $.subtitle)}</span>
      )}
      {activeFilterCount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          <Filter className="size-3" />
          {activeFilterCount} {activeFilterCount === 1 ? t($ => $.filters.filterSingular) : t($ => $.filters.filterPlural)}
        </span>
      ) : null}
    </span>
  );

  return (
    <div className="flex h-full flex-col">
      {/* ── Page header ── */}
      <div className="border-b bg-background px-6 py-4">
        <PageHeader
          title={t($ => $.title)}
          subtitle={headerSubtitle}
          breadcrumbs={[
            { label: tCommon($ => $.home), to: ROUTES.dashboard },
            { label: t($ => $.title) },
          ]}
        />
      </div>

      {/* ── Standard Actions Toolbar ── */}
      <OrderListToolbar
        selectedOrders={selectedOrders}
        selectedCount={selectedCount}
        isFetching={isFetching}
        columns={columnMeta}
        columnVisibility={columnVisibility}
        onNew={() => navigate(ROUTES.ordersNew)}
        onBulkAction={handleBulkAction}
        onRefresh={() => void refetch()}
        onColumnToggle={toggleColumn}
        onColumnReset={resetColumns}
        onExport={handleExport}
        onCopyToClipboard={handleCopyToClipboard}
        onPrint={handlePrint}
      />

      {/* ── KPI Cards (replace status tabs) ── */}
      <div className="sticky top-0 z-20 bg-background">
        <OrderStatusTabs
          activeStatus={activeStatus}
          counts={statusKpis}
          onChange={handleStatusChange}
        />
      </div>

      {/* ── Filter bar: Search + Channel + Date range + toggles ── */}
      <div className="border-b bg-background px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search — DD-024 */}
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              key={searchKey}
              ref={searchRef}
              type="search"
              placeholder={`${t($ => $.search)} · / or Ctrl+K`}
              defaultValue={search}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchCommit(e.currentTarget.value);
                if (e.key === 'Escape') clearSearch();
              }}
              onBlur={(e) => handleSearchCommit(e.currentTarget.value)}
              className="h-8 w-full rounded-md border border-input bg-background ps-8 pe-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* DD-023 — Channel filter */}
          <select
            value={channelId ?? ''}
            onChange={(e) => { setChannelId(e.target.value || null); resetPage(); }}
            aria-label={t($ => $.filters.channel)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">{t($ => $.filters.allChannels)}</option>
            {channelOptions.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {/* Advanced Filters toggle — DD-026 */}
          <Button
            type="button"
            variant={showAdvancedFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            aria-expanded={showAdvancedFilters}
            aria-label={t($ => $.filters.advanced)}
          >
            <Filter className="size-3.5" />
            {t($ => $.filters.advanced)}
            {advancedActiveCount > 0 ? (
              <span className={cn(
                'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                showAdvancedFilters ? 'bg-foreground/20 text-foreground' : 'bg-primary/15 text-primary',
              )}>
                {advancedActiveCount}
              </span>
            ) : null}
          </Button>

          {/* Customer Intelligence toggle — DD-025 */}
          <Button
            type="button"
            variant={showCustomerIntelligence ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowCustomerIntelligence((v) => !v)}
            aria-expanded={showCustomerIntelligence}
            aria-label={t($ => $.customerIntelligence.title)}
          >
            <Users className="size-3.5" />
            {t($ => $.customerIntelligence.title)}
            {customerFilters.length > 0 ? (
              <span className={cn(
                'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                showCustomerIntelligence ? 'bg-foreground/20 text-foreground' : 'bg-primary/15 text-primary',
              )}>
                {customerFilters.length}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      {/* ── DD-026 Advanced Filters panel (collapsible) ── */}
      {showAdvancedFilters ? (
        <OrderAdvancedFilters
          values={advancedFilters}
          onChange={handleAdvancedFiltersChange}
          onClear={clearAdvancedFilters}
        />
      ) : null}

      {/* ── DD-025 Customer Intelligence panel (collapsible) ── */}
      {showCustomerIntelligence ? (
        <OrderCustomerIntelligence
          value={customerFilters}
          onChange={handleCustomerFiltersChange}
        />
      ) : null}

      {/* ── DD-028 / DD-029 Smart Operations Toolbar ── */}
      <OrderSmartToolbar
        activeStatus={activeStatus}
        selectedIds={selectedIds}
        orders={orders}
        advancedFilters={advancedFilters}
        setAdvancedFilters={(next) => { setAdvancedFilters(next); resetPage(); }}
        setCustomerFilter={handleSmartToolbarCustomerFilter}
        setActiveStatus={handleStatusChange}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        showCustomerIntelligence={showCustomerIntelligence}
        setShowCustomerIntelligence={setShowCustomerIntelligence}
        setHasLocation={(v) => { setHasLocation(v); resetPage(); }}
        setMinShippingAttempts={(v) => { setMinShippingAttempts(v); resetPage(); }}
      />

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {/* Contextual empty state — derives message from active filters */}
        {(() => {
          const hasFilters = search || activeStatus !== 'all' || channelId || customerFilters.length > 0
            || advancedFilters.productId || advancedFilters.paymentMethod || advancedFilters.paymentStatus
            || advancedFilters.hasPaymentProof !== null || advancedFilters.reservationStatus
            || advancedFilters.shippingCompany || advancedFilters.zone
            || advancedFilters.minAmount || advancedFilters.maxAmount
            || advancedFilters.dateFrom || advancedFilters.dateTo;
          const contextualEmptyState = search
            ? <EmptyState title={t($ => $.table.empty)} description={`No orders matching "${search}". Try a different search term.`} />
            : activeStatus !== 'all'
              ? <EmptyState title={t($ => $.table.empty)} description={`No orders with status "${statusTabLabel[activeStatus as OrderStatus]}".`} />
              : hasFilters
                ? <EmptyState title={t($ => $.table.empty)} description="No orders match the current filters. Try clearing some filters." />
                : undefined;
          return (
            <OrderTable
              orders={orders}
              isLoading={isLoading}
              isError={isError}
              sort={sort}
              onSortChange={handleSortChange}
              selection={selectionHook}
              onView={(order) => setViewOrder(order)}
              onEdit={handleEdit}
              onDelete={(order) => setDeletingOrder(order)}
              onStatusUpdated={() => void refetch()}
              onConfirmCustomer={(order) => setConfirmingOrder(order)}
              onTimeline={(order) => setViewOrder(order)}
              onVerifyPayment={(order) => setViewOrder(order)}
              onPrint={(order) => { void navigate(`${ROUTES.orders}/${order.id}`); }}
              focusedRowId={focusedRowIndex !== null ? (orders[focusedRowIndex]?.id ?? null) : null}
              columnVisibility={columnVisibility}
              emptyState={contextualEmptyState}
              pagination={meta ? ({
                meta: {
                  page: meta.current_page,
                  perPage: meta.per_page,
                  total: meta.total,
                  lastPage: meta.last_page,
                },
                onPageChange: (p: number) => { setPage(p); clearSelection(); },
              } satisfies GridPaginationConfig) : undefined}
            />
          );
        })()}
      </div>

      {/* ── Detail Drawer ── */}
      <OrderDetailDrawer
        order={viewOrder}
        open={viewOrder !== null}
        onOpenChange={(open) => { if (!open) setViewOrder(null); }}
        onEdit={handleEdit}
      />

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={deletingOrder !== null}
        onOpenChange={(open) => { if (!open) setDeletingOrder(null); }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deletingOrder?.order_number ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteOrder.isPending}
        onConfirm={() => {
          if (deletingOrder) {
            deleteOrder.mutate(deletingOrder.id, { onSuccess: () => setDeletingOrder(null) });
          }
        }}
      />

      {/* ── Customer Confirmation Dialog ── */}
      <OrderConfirmCustomerDialog
        order={confirmingOrder}
        open={confirmingOrder !== null}
        onOpenChange={(open) => { if (!open) setConfirmingOrder(null); }}
      />

      {/* ── Bulk Action Confirmation Dialog ── */}
      {(() => {
        const action = pendingBulkAction;
        if (!action) return null;
        const count = selectedOrders.length;
        const isIrreversible = IRREVERSIBLE_BULK_ACTIONS.has(action);
        const targetLabel = BULK_ACTION_TARGET_LABEL[action] ?? action;
        const statusDist = selectedOrders.reduce<Record<string, number>>((acc, o) => {
          acc[o.status] = (acc[o.status] ?? 0) + 1;
          return acc;
        }, {});
        return (
          <Dialog open onOpenChange={(open) => { if (!open) setPendingBulkAction(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{bulkLabel[action]}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1 text-sm">
                <p className="text-foreground">
                  You are about to perform this action on{' '}
                  <span className="font-semibold">{count} {count === 1 ? 'order' : 'orders'}</span>.
                </p>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Selected orders
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(statusDist).map(([status, n]) => (
                      <span key={status} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {n} × {statusLabel[status as OrderStatus]}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Target state
                  </p>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    → {targetLabel}
                  </span>
                </div>
                {isIrreversible ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    This action cannot be undone.
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setPendingBulkAction(null)}>
                  {tCommon($ => $.common.cancel)}
                </Button>
                <Button
                  size="sm"
                  variant={isIrreversible ? 'destructive' : 'default'}
                  onClick={executeBulkAction}
                >
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Bulk Reschedule Date Dialog ── */}
      <Dialog open={bulkRescheduleOpen} onOpenChange={setBulkRescheduleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t($ => $.bulk.rescheduleTitle, { count: pendingRescheduleIds.length })}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t($ => $.bulk.rescheduleDate)}
            </label>
            <input
              type="date"
              value={bulkRescheduleDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBulkRescheduleDate(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkRescheduleOpen(false)}>
              {tCommon($ => $.common.cancel)}
            </Button>
            <Button
              size="sm"
              disabled={!bulkRescheduleDate || bulkReschedule.isPending}
              onClick={confirmBulkReschedule}
            >
              {t($ => $.bulk.rescheduleConfirm)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
