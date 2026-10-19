import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Plus, Search, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/crud';
import {
  ColumnVisibilityMenu,
  SmartToolbar,
  useColumnVisibility,
  useRowSelection,
} from '@/components/data-grid';
import type { GridPaginationConfig, GridSortState } from '@/components/data-grid/types';
import { EmptyState } from '@/components/crud';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ds/use-toast';

import type { DrawerMode } from '@/features/products/components/product-detail-drawer';
import { ProductDetailDrawer } from '@/features/products/components/product-detail-drawer';
import { ProductFilterBar, DEFAULT_FILTERS } from '@/features/products/components/product-filter-bar';
import type { ProductFilters } from '@/features/products/components/product-filter-bar';
import { PRODUCT_COLUMN_META } from '@/features/products/components/product-column-meta';
import { ProductImportModal } from '@/features/products/components/product-import-modal';
import {
  ProductQuickStats,
  type StatFilter,
  type ProductStatsData,
} from '@/features/products/components/product-quick-stats';
import { ProductTable } from '@/features/products/components/product-table';
import {
  useDeleteProduct,
  useProductsQuery,
  useToggleProductStatus,
  useBulkUpdateStockStatus,
} from '@/features/products/hooks/use-products';
import { productsService } from '@/features/products/services/products-service';
import type { Product, ProductSortField } from '@/features/products/types/product';
import { ROUTES } from '@/router/routes';

// ── Constants ─────────────────────────────────────────────────────────────────

const PER_PAGE = 20;
const COLUMN_STORAGE_KEY = 'ecos_products_cols_v3';

// ── Stat filter helpers ───────────────────────────────────────────────────────

function applyStatFilter(stat: StatFilter | null): Partial<ProductFilters> {
  if (!stat) return DEFAULT_FILTERS;
  const base = { ...DEFAULT_FILTERS };
  switch (stat.type) {
    case 'status':               return { ...base, status: stat.value };
    case 'is_published':         return { ...base, is_published: stat.value };
    case 'low_stock':            return { ...base, low_stock: stat.value };
    case 'not_synced':           return { ...base, not_synced: stat.value };
    case 'manufacturing_ready':  return { ...base, manufacturing_ready: stat.value };
    case 'missing_recipe':       return { ...base, has_recipe: 'false' };
    case 'needs_pricing_review': return { ...base, needs_pricing_review: stat.value };
    case 'low_margin':           return { ...base, low_margin: stat.value };
    case 'mfg_instock':         return { ...base, manufacturing_availability: 'instock' };
    case 'mfg_outofstock':      return { ...base, manufacturing_availability: 'outofstock' };
    case 'mfg_recipe_missing':  return { ...base, manufacturing_availability: 'recipe_missing' };
    default:                     return base;
  }
}

// ── Stats (parallel queries) ──────────────────────────────────────────────────

function useProductStats(): ProductStatsData {
  const base = { product_type: 'finished_good' as const, per_page: 1, page: 1 };
  const { data: totalData }            = useQuery({ queryKey: ['ps', 'total'],            queryFn: () => productsService.list(base),                                      staleTime: 30_000 });
  const { data: publishedData }        = useQuery({ queryKey: ['ps', 'published'],        queryFn: () => productsService.list({ ...base, is_published: true }),            staleTime: 30_000 });
  const { data: lowStockData }         = useQuery({ queryKey: ['ps', 'lowStock'],         queryFn: () => productsService.list({ ...base, low_stock: true }),               staleTime: 30_000 });
  const { data: inactiveData }         = useQuery({ queryKey: ['ps', 'inactive'],         queryFn: () => productsService.list({ ...base, status: 'inactive' }),            staleTime: 30_000 });
  const { data: notSyncedData }        = useQuery({ queryKey: ['ps', 'notSynced'],        queryFn: () => productsService.list({ ...base, not_synced: true }),              staleTime: 30_000 });
  const { data: mfgReadyData }         = useQuery({ queryKey: ['ps', 'mfgReady'],         queryFn: () => productsService.list({ ...base, manufacturing_ready: true }),     staleTime: 30_000 });
  const { data: missingRecipeData }    = useQuery({ queryKey: ['ps', 'missingRecipe'],    queryFn: () => productsService.list({ ...base, has_recipe: 'false' }),           staleTime: 30_000 });
  const { data: pendingReviewData }    = useQuery({ queryKey: ['ps', 'pendingReview'],    queryFn: () => productsService.list({ ...base, needs_pricing_review: true }),    staleTime: 30_000 });
  const { data: lowMarginData }        = useQuery({ queryKey: ['ps', 'lowMargin'],        queryFn: () => productsService.list({ ...base, low_margin: true }),                                  staleTime: 30_000 });
  const { data: mfgInStockData }       = useQuery({ queryKey: ['ps', 'mfgInStock'],       queryFn: () => productsService.list({ ...base, manufacturing_availability: 'instock' }),       staleTime: 30_000 });
  const { data: mfgOutOfStockData }    = useQuery({ queryKey: ['ps', 'mfgOutOfStock'],    queryFn: () => productsService.list({ ...base, manufacturing_availability: 'outofstock' }),    staleTime: 30_000 });
  const { data: mfgRecipeMissingData } = useQuery({ queryKey: ['ps', 'mfgRecipeMissing'], queryFn: () => productsService.list({ ...base, manufacturing_availability: 'recipe_missing' }), staleTime: 30_000 });
  return {
    total:               totalData?.meta.total             ?? 0,
    published:           publishedData?.meta.total         ?? 0,
    lowStock:            lowStockData?.meta.total          ?? 0,
    notSynced:           notSyncedData?.meta.total         ?? 0,
    inactive:            inactiveData?.meta.total          ?? 0,
    manufacturingReady:  mfgReadyData?.meta.total          ?? 0,
    missingRecipe:       missingRecipeData?.meta.total     ?? 0,
    needsPricingReview:  pendingReviewData?.meta.total     ?? 0,
    lowMargin:           lowMarginData?.meta.total         ?? 0,
    mfgInStock:          mfgInStockData?.meta.total        ?? 0,
    mfgOutOfStock:       mfgOutOfStockData?.meta.total     ?? 0,
    mfgRecipeMissing:    mfgRecipeMissingData?.meta.total  ?? 0,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const { t } = useTranslation('products');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const { t: tCommon } = useTranslation('common');
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Column visibility (framework hook with localStorage persistence) ───────
  const { visibility: columnVisibility, toggle: toggleColumn, reset: resetColumns } =
    useColumnVisibility(COLUMN_STORAGE_KEY, PRODUCT_COLUMN_META);

  // ── Search ────────────────────────────────────────────────────────────────
  const [search, setSearch]       = useState('');
  const [searchKey, setSearchKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filters, setFilters]   = useState<ProductFilters>(DEFAULT_FILTERS);
  const [activeStat, setActiveStat] = useState<StatFilter | null>(null);
  const [page, setPage]         = useState(1);
  const [sort, setSort]         = useState<GridSortState>({ field: 'updated_at', direction: 'desc' });

  // ── Row selection (framework hook) ────────────────────────────────────────
  const { data: productsForSelection } = useProductsQuery(
    useMemo(() => ({ product_type: 'finished_good' as const, per_page: PER_PAGE, page }), [page]),
  );
  const selection = useRowSelection({
    items: productsForSelection?.items ?? [],
    getId: (p) => p.id,
  });

  // ── Arrow-key row focus ───────────────────────────────────────────────────
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

  // ── Drawer ────────────────────────────────────────────────────────────────
  const [drawerProduct, setDrawerProduct]   = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [drawerMode, setDrawerMode]         = useState<DrawerMode>('view');
  const [drawerInitialTab, setDrawerInitialTab] = useState<string>('general');

  function openView(product: Product, tab?: string) {
    setDrawerProduct(product);
    setDrawerMode('view');
    setDrawerInitialTab(tab ?? 'general');
    setDrawerOpen(true);
  }
  function openEdit(product: Product) {
    setDrawerProduct(product);
    setDrawerMode('edit');
    setDrawerInitialTab('general');
    setDrawerOpen(true);
  }
  function openCreate() {
    setDrawerProduct(null);
    setDrawerMode('edit');
    setDrawerInitialTab('general');
    setDrawerOpen(true);
  }

  // ── Recipe callbacks (PART 8) ─────────────────────────────────────────────
  function handleViewRecipe(product: Product) {
    openView(product, 'recipe');
  }
  function handleCreateRecipe(product: Product) {
    navigate(ROUTES.recipesNew, { state: { product_id: product.id } });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useProductStats();

  // ── Bulk availability (PART 3) ────────────────────────────────────────────
  const [availDialog, setAvailDialog] = useState<{ status: 'instock' | 'outofstock' } | null>(null);
  const bulkUpdateStock = useBulkUpdateStockStatus();

  // ── Import modal (PART 1) ─────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);

  // ── Main query ────────────────────────────────────────────────────────────
  const params = useMemo(() => ({
    search:               search || undefined,
    product_type:         'finished_good' as const,
    category_id:          filters.category_id       ?? undefined,
    warehouse_id:         filters.warehouse_id      ?? undefined,
    brand_id:             filters.brand_id          ?? undefined,
    channel_id:           filters.channel_id        ?? undefined,
    status:               filters.status !== 'all' ? filters.status : undefined,
    stock_status:         filters.stock_status      || undefined,
    is_published:         filters.is_published      ?? undefined,
    low_stock:            filters.low_stock         || undefined,
    has_images:           filters.has_images        ?? undefined,
    not_synced:           filters.not_synced        || undefined,
    has_recipe:                filters.has_recipe                   ?? undefined,
    manufacturing_ready:       filters.manufacturing_ready          || undefined,
    needs_pricing_review:      filters.needs_pricing_review         || undefined,
    low_margin:                filters.low_margin                   || undefined,
    manufacturing_availability: filters.manufacturing_availability  || undefined,
    page,
    per_page:  PER_PAGE,
    sort_by:   sort.field as ProductSortField,
    sort_dir:  sort.direction,
  }), [search, filters, page, sort]);

  const { data, isLoading, isError, isFetching, refetch } = useProductsQuery(params);
  const deleteProduct   = useDeleteProduct();
  const toggleStatus    = useToggleProductStatus();
  // Memoised so the empty-state fallback keeps a stable identity between renders.
  const products        = useMemo(() => data?.items ?? [], [data]);
  const meta            = data?.meta;

  const hasFilters =
    Boolean(search) ||
    filters.category_id !== null || filters.brand_id !== null || filters.warehouse_id !== null || filters.channel_id !== null ||
    filters.status !== 'all' || filters.stock_status !== '' || filters.is_published !== null ||
    filters.low_stock || filters.has_images !== null || filters.not_synced ||
    filters.has_recipe !== null || filters.manufacturing_ready || filters.needs_pricing_review || filters.low_margin ||
    filters.manufacturing_availability !== '';

  // Reset row focus when list contents change
  useEffect(() => { setFocusedRowIndex(null); }, [search, filters, page]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearch = (value: string) => { setSearch(value); setPage(1); };

  const handleFilterChange = (delta: Partial<ProductFilters>) => {
    setFilters((p) => ({ ...p, ...delta }));
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchKey((k) => k + 1);
    setFilters(DEFAULT_FILTERS);
    setActiveStat(null);
    setPage(1);
  };

  const handleStatFilter = (stat: StatFilter | null) => {
    setActiveStat(stat);
    setFilters(applyStatFilter(stat) as ProductFilters);
    setPage(1);
    setSearch('');
    setSearchKey((k) => k + 1);
  };

  const handleSortChange = (field: string) => {
    setSort((p) => p.field === field
      ? { field, direction: p.direction === 'asc' ? 'desc' : 'asc' }
      : { field, direction: 'asc' });
    setPage(1);
  };

  const handleBulkAction = (label: string) => {
    if (!selection.selectedCount) return;
    toast({ type: 'info', title: label, description: tAny('toasts.queued', { count: selection.selectedCount }) });
    selection.clearSelection();
  };

  const handleBulkAvailability = () => {
    if (!availDialog) return;
    const ids = Array.from(selection.selectedIds);
    bulkUpdateStock.mutate(
      { ids, status: availDialog.status },
      {
        onSuccess: () => {
          toast({
            type: 'success',
            title: availDialog.status === 'instock' ? t($ => $.availabilityDialog.successInstock) : t($ => $.availabilityDialog.successOutofstock),
            description: tAny('availabilityDialog.successDescription', { count: ids.length }),
          });
          selection.clearSelection();
          setAvailDialog(null);
        },
        onError: () => {
          toast({ type: 'error', title: t($ => $.availabilityDialog.errorTitle), description: t($ => $.availabilityDialog.errorDescription) });
        },
      },
    );
  };

  const handleExport = async () => {
    try {
      const result = await productsService.list({ ...params, per_page: 9999, page: 1 });
      const visibleMeta = PRODUCT_COLUMN_META.filter(
        (col) => col.alwaysVisible || columnVisibility[col.key] !== false,
      );
      const header = visibleMeta.map((c) => c.label).join(',');
      const rows = result.items.map((p) =>
        visibleMeta
          .map((col) => {
            switch (col.key) {
              case 'image':         return '';
              case 'name':          return `"${(p.name ?? '').replace(/"/g, '""')}"`;
              case 'category':      return `"${p.category?.name ?? ''}"`;
              case 'channels':      return `"${(p.channels ?? []).map((c) => c.name).join(', ')}"`;
              case 'product_cost':  return p.product_cost ?? '';
              case 'regular_price': return p.regular_price ?? '';
              case 'sale_price':    return p.sale_price ?? '';
              case 'gross_profit':  return p.gross_profit_pct != null ? p.gross_profit_pct.toFixed(2) : '';
              case 'final_margin':  return p.final_margin_pct != null ? p.final_margin_pct.toFixed(2) : '';
              case 'stock_status':  return p.stock_status === 'instock' ? 'In Stock' : 'Out of Stock';
              case 'recipe':        return p.has_recipe ? 'Available' : 'Missing';
              case 'sku':           return p.sku;
              case 'is_published':  return p.is_published ? 'Published' : 'Unpublished';
              case 'sync_status':   return p.sync_status ?? '';
              case 'updated_at':    return p.updated_at ?? '';
              case 'pricing_review': return p.pending_review ? 'Review Required' : 'OK';
              default:              return '';
            }
          })
          .join(','),
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ type: 'error', title: t($ => $.toasts.exportFailed), description: t($ => $.toasts.exportFailedDescription) });
    }
  };

  const handleImport = () => setImportOpen(true);

  // ── Open-create navigation effect ─────────────────────────────────────────
  useEffect(() => {
    if ((location.state as Record<string, unknown> | null)?.openCreate) {
      openCreate();
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const stateRef = useRef({ products, drawerOpen, focusedRowIndex });
  useEffect(() => {
    stateRef.current = { products, drawerOpen, focusedRowIndex };
  }, [products, drawerOpen, focusedRowIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const { products: prods, drawerOpen: isOpen, focusedRowIndex: fi } = stateRef.current;

      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !inInput)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === 'n' && (e.ctrlKey || e.metaKey) && !inInput) {
        e.preventDefault();
        openCreate();
        return;
      }
      if (e.key === 'Escape' && !inInput) {
        if (isOpen) { setDrawerOpen(false); return; }
        clearFilters();
        setFocusedRowIndex(null);
        return;
      }
      if (e.key === 'ArrowDown' && !inInput && prods.length > 0) {
        e.preventDefault();
        setFocusedRowIndex(fi === null ? 0 : Math.min(fi + 1, prods.length - 1));
        return;
      }
      if (e.key === 'ArrowUp' && !inInput && prods.length > 0) {
        e.preventDefault();
        setFocusedRowIndex(fi === null ? 0 : Math.max(fi - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !inInput && fi !== null) {
        e.preventDefault();
        const product = prods[fi];
        if (product) openView(product);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
     
  }, []);

  // ── Pagination config ─────────────────────────────────────────────────────
  const pagination: GridPaginationConfig | undefined = meta ? {
    meta: {
      page:     meta.current_page,
      perPage:  meta.per_page,
      total:    meta.total,
      lastPage: meta.last_page,
    },
    onPageChange: setPage,
  } : undefined;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* ── Page Header ── */}
      <PageHeader
        title={t($ => $.finishedGoods.title)}
        subtitle={t($ => $.finishedGoods.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.finishedGoods.title) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {meta ? tAny('page.totalCount', { count: meta.total.toLocaleString() }) : null}
            </span>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              {t($ => $.actions.new)}
            </Button>
          </div>
        }
      />

      {/* ── Quick Stats ── */}
      <ProductQuickStats
        stats={stats}
        activeFilter={activeStat}
        onFilterChange={handleStatFilter}
      />

      {/* ── Smart Toolbar ── */}
      <SmartToolbar
        primaryAction={{
          label: t($ => $.actions.new),
          onClick: openCreate,
          icon: Plus,
        }}
        secondaryActions={[
          {
            key: 'import',
            label: t($ => $.actions.import),
            icon: Upload,
            onClick: handleImport,
            hideOnMobile: true,
          },
          {
            key: 'export',
            label: t($ => $.actions.export),
            icon: Download,
            onClick: handleExport,
            hideOnMobile: true,
          },
        ]}
        bulkActions={[
          { key: 'mark-available',       label: t($ => $.bulkActions.markAvailable),     onClick: () => setAvailDialog({ status: 'instock' }) },
          { key: 'mark-unavailable',     label: t($ => $.bulkActions.markUnavailable),   onClick: () => setAvailDialog({ status: 'outofstock' }) },
          { key: 'activate',             label: t($ => $.bulkActions.activate),          onClick: () => handleBulkAction(t($ => $.bulkActions.activate)), separator: true },
          { key: 'deactivate',           label: t($ => $.bulkActions.deactivate),        onClick: () => handleBulkAction(t($ => $.bulkActions.deactivate)) },
          { key: 'publish',              label: t($ => $.bulkActions.publishToChannels), onClick: () => handleBulkAction(t($ => $.bulkActions.publishToChannels)) },
          { key: 'assign-category',      label: t($ => $.bulkActions.assignCategory),    onClick: () => handleBulkAction(t($ => $.bulkActions.assignCategory)), separator: true },
          { key: 'create-price-review',  label: t($ => $.bulkActions.createPriceReview), onClick: () => navigate(ROUTES.costManagementPriceReview), separator: true },
          { key: 'export-selected',      label: t($ => $.bulkActions.exportSelected),    onClick: handleExport, separator: true },
        ]}
        bulkActionsLabel={t($ => $.bulkActions.label)}
        selectedCount={selection.selectedCount}
        onRefresh={() => void refetch()}
        isFetching={isFetching}
        viewControls={
          <div className="flex items-center gap-1.5">
            {/* Search — Ctrl+K or / focuses this */}
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                key={searchKey}
                ref={searchRef}
                type="search"
                placeholder={`${t($ => $.search)} · /`}
                defaultValue={search}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch(e.currentTarget.value);
                  if (e.key === 'Escape') { clearFilters(); e.currentTarget.blur(); }
                }}
                onBlur={(e) => handleSearch(e.currentTarget.value)}
                className="h-8 w-48 rounded-md border border-input bg-background ps-8 pe-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring lg:w-64"
              />
            </div>

            {/* Column Manager */}
            <ColumnVisibilityMenu
              columns={PRODUCT_COLUMN_META}
              visibility={columnVisibility}
              onToggle={toggleColumn}
              onReset={resetColumns}
            />
          </div>
        }
      />

      {/* Search (mobile — shown below toolbar on small screens) */}
      <div className="relative sm:hidden">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          key={`m-${searchKey}`}
          type="search"
          placeholder={t($ => $.search)}
          defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch(e.currentTarget.value);
          }}
          onBlur={(e) => handleSearch(e.currentTarget.value)}
          className="h-9 w-full rounded-md border border-input bg-background ps-8 pe-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* ── Filter Bar ── */}
      <ProductFilterBar
        filters={filters}
        onChange={handleFilterChange}
        onClear={clearFilters}
      />

      {/* ── Product Grid ── */}
      <ProductTable
        products={products}
        isLoading={isLoading}
        isError={isError}
        sort={sort}
        onSortChange={handleSortChange}
        selection={selection}
        onView={openView}
        onEdit={openEdit}
        onDelete={(p) =>
          deleteProduct.mutate(p.id, {
            onSuccess: () => toast({ type: 'success', title: t($ => $.toasts.archived), description: tAny('toasts.archivedDescription', { name: p.name }) }),
            onError:   () => toast({ type: 'error',   title: t($ => $.availabilityDialog.errorTitle), description: t($ => $.toasts.archiveError) }),
          })
        }
        onStatusToggle={(p) => toggleStatus.mutate(p)}
        onViewRecipe={handleViewRecipe}
        onCreateRecipe={handleCreateRecipe}
        focusedRowId={focusedRowIndex !== null ? (products[focusedRowIndex]?.id ?? null) : null}
        columnVisibility={columnVisibility}
        pagination={pagination}
        emptyState={
          hasFilters ? (
            <EmptyState title={t($ => $.emptyState.withFiltersTitle)} />
          ) : (
            <EmptyState title={t($ => $.emptyState.noProductsTitle)} />
          )
        }
      />

      {/* ── Product Detail Drawer ── */}
      <ProductDetailDrawer
        product={drawerProduct}
        open={drawerOpen}
        onOpenChange={(open) => { setDrawerOpen(open); if (!open) setDrawerProduct(null); }}
        initialMode={drawerMode}
        initialTab={drawerInitialTab}
      />

      {/* ── Bulk Availability Confirmation (PART 3) ── */}
      <AlertDialog
        open={availDialog !== null}
        onOpenChange={(open) => { if (!open) setAvailDialog(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t($ => $.availabilityDialog.title)}</AlertDialogTitle>
            <AlertDialogDescription>
              {availDialog?.status === 'instock'
                ? tAny('availabilityDialog.confirmInstock', { count: selection.selectedCount })
                : tAny('availabilityDialog.confirmOutofstock', { count: selection.selectedCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t($ => $.availabilityDialog.cancel)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAvailability}
              disabled={bulkUpdateStock.isPending}
            >
              {bulkUpdateStock.isPending ? t($ => $.availabilityDialog.updating) : t($ => $.availabilityDialog.confirm)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Import Modal (PART 1) ── */}
      <ProductImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => { void refetch(); setImportOpen(false); }}
      />
    </div>
  );
}
