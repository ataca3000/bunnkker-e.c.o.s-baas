import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Tag, Trash2, X } from 'lucide-react';

import { PageHeader, Pagination } from '@/components/crud';
import { ConfirmDialog } from '@/components/crud/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RawMaterialDetailDrawer } from '@/features/raw-materials/components/raw-material-detail-drawer';
import { RawMaterialFilterBar } from '@/features/raw-materials/components/raw-material-filter-bar';
import { RawMaterialFormDrawer } from '@/features/raw-materials/components/raw-material-form-drawer';
import { RawMaterialStats } from '@/features/raw-materials/components/raw-material-stats';
import { RawMaterialTable } from '@/features/raw-materials/components/raw-material-table';
import {
  useBulkUpdateRawMaterials,
  useDeleteRawMaterial,
  useRawMaterialsQuery,
  useUpdateMaterialCost,
} from '@/features/raw-materials/hooks/use-raw-materials';
import { useColumnPreferences } from '@/features/raw-materials/hooks/use-column-preferences';
import type { ColumnKey } from '@/features/raw-materials/hooks/use-column-preferences';
import { rawMaterialsService } from '@/features/raw-materials/services/raw-materials-service';
import type { MaterialType, RawMaterial } from '@/features/raw-materials/types';
import { resolveMaterialStockStatus } from '@/features/raw-materials/utils/material-stock-status';
import { ROUTES } from '@/router/routes';
import { useCategoriesQuery } from '@/features/categories/hooks/use-categories';
import type { TFunction } from 'i18next';
import type enRawMaterials from '@/i18n/locales/en/raw-materials.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. Indexing this table by a runtime value is
 * still fine — the lookup yields a selector, which is what t() expects.
 */
type RawMaterialsLabel = ($: typeof enRawMaterials) => string;

type SortField = 'name' | 'sku' | 'material_cost' | 'on_hand_qty' | 'created_at';
type SortDir   = 'asc' | 'desc';

const PER_PAGE = 25;

// Module-level CSV column definitions — value functions only (no translated headers)
type CsvColDef = { key: ColumnKey; value: (m: RawMaterial, t: TFunction<'raw-materials'>) => string };

const CSV_COL_DEFS: CsvColDef[] = [
  { key: 'image',           value: (m)    => m.image_url ?? '' },
  { key: 'name',            value: (m)    => m.name },
  { key: 'material_type',   value: (m, t) => m.product_type === 'packaging_material' ? t($ => $.csv.packagingMaterial) : t($ => $.csv.rawMaterial) },
  { key: 'category',        value: (m)    => m.category?.name ?? '' },
  { key: 'unit',            value: (m)    => m.unit?.name ?? '' },
  { key: 'stock_status',    value: (m, t) => resolveMaterialStockStatus(m.available_qty, m.allow_negative_stock) === 'in_stock' ? t($ => $.csv.inStock) : t($ => $.csv.outOfStock) },
  { key: 'on_hand',         value: (m)    => String(m.on_hand_qty ?? '') },
  { key: 'reserved',        value: (m)    => String(m.reserved_qty ?? '') },
  { key: 'available',       value: (m)    => String(m.available_qty ?? '') },
  { key: 'current_cost',    value: (m)    => String(m.material_cost ?? '') },
  { key: 'inventory_value', value: (m)    => String(m.inventory_value ?? '') },
  { key: 'allow_negative',  value: (m, t) => (m.allow_negative_stock ? t($ => $.csv.yes) : t($ => $.csv.no)) },
  { key: 'sku',             value: (m)    => m.sku },
];

// CSV header key mapping
const CSV_HEADER_KEYS: Record<string, RawMaterialsLabel> = {
  image:           ($) => $.csv.imageUrl,
  name:            ($) => $.csv.name,
  material_type:   ($) => $.csv.materialType,
  category:        ($) => $.csv.category,
  unit:            ($) => $.csv.unit,
  stock_status:    ($) => $.csv.stockStatus,
  on_hand:         ($) => $.csv.onHand,
  reserved:        ($) => $.csv.reserved,
  available:       ($) => $.csv.available,
  current_cost:    ($) => $.csv.currentCost,
  inventory_value: ($) => $.csv.inventoryValue,
  allow_negative:  ($) => $.csv.allowNegative,
  sku:             ($) => $.csv.sku,
};

function triggerCsvDownload(
  items: RawMaterial[],
  visibleColumns: Set<ColumnKey>,
  materialType: MaterialType | '',
  t: TFunction<'raw-materials'>,
) {
  const cols = CSV_COL_DEFS.filter((c) => visibleColumns.has(c.key));
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const header = cols.map((c) => escape(CSV_HEADER_KEYS[c.key] ? t(CSV_HEADER_KEYS[c.key]) : c.key)).join(',');
  const rows   = items.map((m) => cols.map((c) => escape(c.value(m, t))).join(','));
  const csv    = [header, ...rows].join('\n');

  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  const filename = materialType === 'packaging_material' ? 'packaging-materials'
    : materialType === 'raw_material' ? 'raw-materials'
    : 'all-materials';

  a.href     = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

type BulkBarProps = {
  selectedCount:    number;
  onClear:          () => void;
  onAllowNeg:       () => void;
  onBlockNeg:       () => void;
  onChangeCategory: (id: string) => void;
  onExport:         () => void;
  onDelete:         () => void;
  categories:       Array<{ id: string; name: string }>;
  isPending:        boolean;
};

function BulkActionBar({
  selectedCount, onClear,
  onAllowNeg, onBlockNeg, onChangeCategory, onExport, onDelete,
  categories, isPending,
}: BulkBarProps) {
  const { t } = useTranslation('raw-materials');

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 shadow-sm">
      <span className="text-sm font-medium shrink-0">{t($ => $.bulk.selected, { count: selectedCount })}</span>
      <div className="w-px h-5 bg-border mx-1" />

      <Button variant="outline" size="sm" onClick={onAllowNeg} disabled={isPending} className="gap-1.5 h-8">
        {t($ => $.bulk.allowNegative)}
      </Button>
      <Button variant="outline" size="sm" onClick={onBlockNeg} disabled={isPending} className="gap-1.5 h-8">
        {t($ => $.bulk.blockNegative)}
      </Button>

      <Select onValueChange={onChangeCategory}>
        <SelectTrigger className="h-8 w-40 text-sm">
          <div className="flex items-center gap-1.5">
            <Tag className="size-3.5" />
            <SelectValue placeholder={t($ => $.bulk.changeCategory)} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={onExport} disabled={isPending} className="gap-1.5 h-8">
        <Download className="size-3.5" />
        {t($ => $.bulk.exportSelected)}
      </Button>
      <Button variant="destructive" size="sm" onClick={onDelete} disabled={isPending} className="gap-1.5 h-8">
        <Trash2 className="size-3.5" />
        {t($ => $.bulk.delete)}
      </Button>

      <Button variant="ghost" size="sm" onClick={onClear} className="ms-auto h-8 gap-1.5 text-muted-foreground">
        <X className="size-3.5" />
        {t($ => $.bulk.clear)}
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RawMaterialsPage() {
  const { t } = useTranslation('raw-materials');

  // ── Column preferences ────────────────────────────────────────────────────
  const { visibleColumns, toggleColumn, restoreDefaults, showAll } = useColumnPreferences();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [categoryId,    setCategoryId]    = useState('');
  const [supplierId,    setSupplierId]    = useState('');
  const [warehouseId,   setWarehouseId]   = useState('');
  const [availability,  setAvailability]  = useState('');
  const [allowNegative, setAllowNegative] = useState('');
  const [materialType,  setMaterialType]  = useState<MaterialType | ''>('');
  const [page,          setPage]          = useState(1);
  const [sortField,     setSortField]     = useState<SortField>('name');
  const [sortDir,       setSortDir]       = useState<SortDir>('asc');

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Drawers ───────────────────────────────────────────────────────────────
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [detailMaterial, setDetailMaterial] = useState<RawMaterial | null>(null);
  const [detailTab,      setDetailTab]      = useState('overview');
  const [formOpen,       setFormOpen]       = useState(false);
  const [formMaterial,   setFormMaterial]   = useState<RawMaterial | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<RawMaterial | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const deleteMut    = useDeleteRawMaterial();
  const bulkUpdate   = useBulkUpdateRawMaterials();
  const costUpdateMut = useUpdateMaterialCost();
  const [savingCostId, setSavingCostId] = useState<string | null>(null);

  // ── Categories for bulk bar ───────────────────────────────────────────────
  const { data: rmCategories } = useCategoriesQuery({ scope: 'material', status: 'active', per_page: 200 });
  const categoryOptions = (rmCategories?.items ?? []).map((c) => ({ id: c.id, name: c.name }));

  // ── SHARED QUERY PARAMS ───────────────────────────────────────────────────
  const sharedFilter = {
    search:       search       || undefined,
    category_id:  categoryId   || undefined,
    supplier_id:  supplierId   || undefined,
    warehouse_id: warehouseId  || undefined,
    material_type: materialType || undefined,
  } as const;

  const queryParams = {
    ...sharedFilter,
    availability:   availability as 'available' | 'out_of_stock' | undefined || undefined,
    allow_negative: allowNegative === 'allowed' ? true : allowNegative === 'blocked' ? false : undefined,
    page,
    per_page: PER_PAGE,
    sort_by:  sortField,
    sort_dir: sortDir,
  };

  // ── Table query ───────────────────────────────────────────────────────────
  const { data, isFetching, isError, refetch } = useRawMaterialsQuery(queryParams);

  const materials = data?.items ?? [];
  const meta      = data?.meta;

  // ── Derived title & subtitle ──────────────────────────────────────────────
  const title = materialType === 'raw_material'
    ? t($ => $.page.titleRaw)
    : materialType === 'packaging_material'
    ? t($ => $.page.titlePackaging)
    : t($ => $.page.titleAll);

  const subtitle = materialType === 'raw_material'
    ? t($ => $.page.subtitleRaw)
    : materialType === 'packaging_material'
    ? t($ => $.page.subtitlePackaging)
    : t($ => $.page.subtitleAll);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const resetPage = useCallback(() => setPage(1), []);

  function handleSearch(v: string)        { setSearch(v);       resetPage(); }
  function handleCategory(v: string)      { setCategoryId(v);   resetPage(); }
  function handleSupplier(v: string)      { setSupplierId(v);   resetPage(); }
  function handleWarehouse(v: string)     { setWarehouseId(v);  resetPage(); }
  function handleAvailability(v: string)  { setAvailability(v); resetPage(); }
  function handleAllowNegative(v: string)          { setAllowNegative(v); resetPage(); }
  function handleMaterialType(v: MaterialType | '') { setMaterialType(v);  resetPage(); }

  function handleSort(field: string) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field as SortField);
      setSortDir('asc');
    }
    resetPage();
  }

  function openDetail(m: RawMaterial, tab = 'overview') {
    setDetailMaterial(m);
    setDetailTab(tab);
    setDetailOpen(true);
  }

  function openEdit(m: RawMaterial) {
    setFormMaterial(m);
    setFormOpen(true);
  }

  function openNew() {
    setFormMaterial(null);
    setFormOpen(true);
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    if (selectedIds.size > 0) {
      const selected = materials.filter((m) => selectedIds.has(m.id));
      triggerCsvDownload(selected, visibleColumns, materialType, t);
      return;
    }
    const result = await rawMaterialsService.list({ ...queryParams, per_page: 10_000, page: 1 });
    triggerCsvDownload(result.items, visibleColumns, materialType, t);
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const ids = Array.from(selectedIds);

  async function bulkAllowNeg() {
    await bulkUpdate.mutateAsync({ ids, patch: { allow_negative_stock: true } });
    setSelectedIds(new Set());
  }

  async function bulkBlockNeg() {
    await bulkUpdate.mutateAsync({ ids, patch: { allow_negative_stock: false } });
    setSelectedIds(new Set());
  }

  async function bulkChangeCategory(cid: string) {
    await bulkUpdate.mutateAsync({ ids, patch: { category_id: cid } });
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    await Promise.all(ids.map((id) => deleteMut.mutateAsync(id)));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  }

  // ── Inline cost edit ──────────────────────────────────────────────────────
  async function handleCostSave(id: string, newCost: number, reason: string) {
    setSavingCostId(id);
    try {
      await costUpdateMut.mutateAsync({ id, materialCost: newCost, reason });
    } finally {
      setSavingCostId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[
          { label: t($ => $.page.breadcrumbs.dashboard), to: ROUTES.dashboard },
          { label: t($ => $.page.breadcrumbs.inventory), to: ROUTES.inventory },
          { label: title },
        ]}
      />

      {/* Stats — share the same filter query as the table */}
      <RawMaterialStats query={sharedFilter} />

      <div className="flex flex-col gap-4">
        <RawMaterialFilterBar
          search={search}
          categoryId={categoryId}
          supplierId={supplierId}
          warehouseId={warehouseId}
          availability={availability}
          allowNegative={allowNegative}
          materialType={materialType}
          onSearch={handleSearch}
          onCategory={handleCategory}
          onSupplier={handleSupplier}
          onWarehouse={handleWarehouse}
          onAvailability={handleAvailability}
          onAllowNegative={handleAllowNegative}
          onMaterialType={handleMaterialType}
          onRefresh={() => refetch()}
          onExport={handleExport}
          onNew={openNew}
          isRefreshing={isFetching}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          onRestoreDefaults={restoreDefaults}
          onShowAll={showAll}
        />

        {selectedIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onAllowNeg={bulkAllowNeg}
            onBlockNeg={bulkBlockNeg}
            onChangeCategory={bulkChangeCategory}
            onExport={handleExport}
            onDelete={() => setBulkDeleteOpen(true)}
            categories={categoryOptions}
            isPending={bulkUpdate.isPending || deleteMut.isPending}
          />
        )}

        <RawMaterialTable
          data={materials}
          isLoading={isFetching && !data}
          isError={isError}
          sort={{ field: sortField, direction: sortDir }}
          onSortChange={handleSort}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={openDetail}
          onEdit={openEdit}
          onPriceHistory={(m) => openDetail(m, 'price-history')}
          onStockHistory={(m) => openDetail(m, 'stock-history')}
          onAddStock={(m) => openDetail(m, 'inventory')}
          onDelete={(m) => setDeleteTarget(m)}
          visibleColumns={visibleColumns}
          onCostSave={handleCostSave}
          savingCostId={savingCostId}
        />

        {meta && meta.last_page > 1 && (
          <Pagination
            meta={{ page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page }}
            onPageChange={setPage}
          />
        )}
      </div>

      <RawMaterialDetailDrawer
        material={detailMaterial}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailMaterial(null);
        }}
        onEdit={openEdit}
        initialTab={detailTab}
      />

      <RawMaterialFormDrawer
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormMaterial(null);
        }}
        material={formMaterial}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t($ => $.page.deleteDialog.title)}
        description={t($ => $.page.deleteDialog.description, { name: deleteTarget?.name ?? '' })}
        confirmLabel={t($ => $.page.deleteDialog.confirmLabel)}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleteMut.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t($ => $.page.bulkDeleteDialog.title)}
        description={t($ => $.page.bulkDeleteDialog.description, { count: selectedIds.size })}
        confirmLabel={t($ => $.page.bulkDeleteDialog.confirmLabel, { count: selectedIds.size })}
        onConfirm={handleBulkDelete}
        variant="destructive"
        loading={deleteMut.isPending}
      />
    </div>
  );
}
