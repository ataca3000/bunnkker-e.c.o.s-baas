import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  BookMarked,
  ChevronsUpDown,
  Columns3,
  Copy,
  DollarSign,
  Download,
  Eye,
  FileText,
  Filter,
  Package,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';

import { ConfirmDialog, PageHeader, Pagination } from '@/components/crud';
import { ActionMenu } from '@/components/crud/action-menu';
import { EmptyState } from '@/components/crud/empty-state';
import { QuickStatCard } from '@/components/ds/quick-stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CompanySelect } from '@/features/branches/components/company-select';
import { ChannelSelect } from '@/features/channels/components/channel-select';
import {
  useDeleteRecipe,
  useRecipeQuery,
  useRecipesQuery,
  useSetRecipeStatus,
} from '@/features/recipes/hooks/use-recipes';
import {
  ALL_RECIPE_COLUMNS,
  useRecipeColumnPreferences,
} from '@/features/recipes/hooks/use-recipe-column-preferences';
import type { RecipeColumnKey } from '@/features/recipes/hooks/use-recipe-column-preferences';
import type { RecipeListRow, RecipeSortField, RecipesQuery } from '@/features/recipes/types/recipe';
import { recipesService } from '@/features/recipes/services/recipes-service';
import { useCompany } from '@/features/organization/context/company-context';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { calcTotalFromStored } from '@/lib/recipe-cost-calculator';
import { getMediaUrl } from '@/lib/media';
import { ROUTES } from '@/router/routes';
import { RecipeDetailDrawer } from '@/features/recipes/components/recipe-detail-drawer';

const PER_PAGE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCost(n: number, currency: string, locale = 'en-EG'): string {
  return formatMoney(n, currency, locale);
}

function fmtAbbrev(n: number, currency: string, locale = 'en-EG'): string {
  return formatMoneyCompact(n, currency, locale);
}

// ADR-RECIPE-001: stored recipe_cost = material costs only (updated by CostCascadeService).
// For list views, total = stored materials + overhead (valid per ADR for aggregations).
function computeRecipeCost(recipe: RecipeListRow): number {
  return calcTotalFromStored(recipe.recipe_cost ?? 0, recipe.manufacturing_cost ?? 0, recipe.other_costs ?? 0);
}

// Waste badge thresholds (PKG-RECIPE-006 PART 4)
function WasteBadge({ pct }: { pct: number }) {
  const { t } = useTranslation('recipes');
  if (pct <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  let cls: string;
  let labelKey: string;
  if (pct <= 2)       { cls = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'; labelKey = 'waste.excellent'; }
  else if (pct <= 5)  { cls = 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'; labelKey = 'waste.normal'; }
  else if (pct <= 10) { cls = 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'; labelKey = 'waste.high'; }
  else                { cls = 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'; labelKey = 'waste.critical'; }
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={`text-xs ${cls}`}>{(t as unknown as (k: string) => string)(labelKey)}</Badge>
      <span className="text-xs tabular-nums text-muted-foreground">{pct.toFixed(2)} %</span>
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

type SharedFilter = Pick<RecipesQuery, 'search' | 'status' | 'company_id' | 'channel_id' | 'has_manufacturing_cost' | 'has_packaging_materials' | 'updated_from' | 'updated_to'>;

function RecipeStats({ query }: { query: SharedFilter }) {
  const { t } = useTranslation('recipes');
  const { currency, locale } = useCompany();
  const { data, isLoading } = useRecipesQuery({ ...query, per_page: 999 });
  const recipes   = data?.items ?? [];
  const total     = data?.meta?.total ?? 0;
  const active    = recipes.filter((r) => r.is_active).length;
  const draft     = recipes.filter((r) => !r.is_active).length;
  const totalCost = recipes.reduce((sum, r) => sum + computeRecipeCost(r), 0);
  const avgCost   = recipes.length > 0 ? totalCost / recipes.length : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <QuickStatCard icon={BookOpen}   title={t($ => $.page.stats.total)}   value={total}                                      colorClassName="text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30" />
      <QuickStatCard icon={BookMarked} title={t($ => $.page.stats.active)}  value={active}                                     colorClassName="text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30" />
      <QuickStatCard icon={FileText}   title={t($ => $.page.stats.draft)}   value={draft}                                      colorClassName="text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30" />
      <QuickStatCard icon={DollarSign} title={t($ => $.page.stats.avgCost)} value={fmtAbbrev(avgCost, currency, locale)}       colorClassName="text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30" />
    </div>
  );
}

// ─── Column Manager ───────────────────────────────────────────────────────────

type ColumnManagerProps = {
  visibleColumns:    Set<RecipeColumnKey>;
  onToggle:          (key: RecipeColumnKey) => void;
  onRestoreDefaults: () => void;
  onShowAll:         () => void;
};

function ColumnManagerPanel({ visibleColumns, onToggle, onRestoreDefaults, onShowAll }: ColumnManagerProps) {
  const { t } = useTranslation('recipes');
  return (
    <PopoverContent align="end" className="w-56 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">{t($ => $.columnManager.title)}</p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={onShowAll}>
            {t($ => $.columnManager.showAll)}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={onRestoreDefaults}>
            <RotateCcw className="size-3 mr-1" />
            {t($ => $.columnManager.reset)}
          </Button>
        </div>
      </div>
      <Separator className="mb-2" />
      <div className="flex flex-col gap-1.5">
        {ALL_RECIPE_COLUMNS.map((col) => (
          <label
            key={col.key}
            className={`flex items-center gap-2 text-sm rounded px-1 py-0.5 ${col.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/60'}`}
          >
            <Checkbox
              checked={visibleColumns.has(col.key)}
              onCheckedChange={() => !col.locked && onToggle(col.key)}
              disabled={col.locked}
              aria-label={col.label}
            />
            <span>{col.label}</span>
            {col.locked && <span className="ms-auto text-[10px] text-muted-foreground">{t($ => $.columnManager.locked)}</span>}
          </label>
        ))}
      </div>
    </PopoverContent>
  );
}

// ─── Secondary Filters Panel ─────────────────────────────────────────────────

type FiltersState = {
  hasMfgCost:      boolean;
  hasPkgMaterials: boolean;
  updatedFrom:     string;
  updatedTo:       string;
};

type FiltersPanelProps = FiltersState & {
  onChange: (patch: Partial<FiltersState>) => void;
  onClear:  () => void;
};

function FiltersPanel({ hasMfgCost, hasPkgMaterials, updatedFrom, updatedTo, onChange, onClear }: FiltersPanelProps) {
  const { t } = useTranslation('recipes');
  const hasAny = hasMfgCost || hasPkgMaterials || !!updatedFrom || !!updatedTo;
  return (
    <PopoverContent align="end" className="w-72 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">{t($ => $.filtersPanel.title)}</p>
        {hasAny && (
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground" onClick={onClear}>
            <X className="size-3 mr-1" />{t($ => $.filtersPanel.clearAll)}
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="text-sm">{t($ => $.filtersPanel.hasMfgCost)}</label>
          <Switch checked={hasMfgCost} onCheckedChange={(v) => onChange({ hasMfgCost: v })} />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-sm">{t($ => $.filtersPanel.hasPkgMaterials)}</label>
          <Switch checked={hasPkgMaterials} onCheckedChange={(v) => onChange({ hasPkgMaterials: v })} />
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t($ => $.filtersPanel.updatedDate)}</p>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={updatedFrom}
              onChange={(e) => onChange({ updatedFrom: e.target.value })}
              className="h-8 text-sm"
              placeholder={t($ => $.filtersPanel.from)}
            />
            <span className="text-muted-foreground text-xs shrink-0">{t($ => $.filtersPanel.toConnector)}</span>
            <Input
              type="date"
              value={updatedTo}
              onChange={(e) => onChange({ updatedTo: e.target.value })}
              className="h-8 text-sm"
              placeholder={t($ => $.filtersPanel.to)}
            />
          </div>
        </div>
      </div>
    </PopoverContent>
  );
}

// ─── Toolbar / Filter Bar ─────────────────────────────────────────────────────

type ToolbarProps = {
  search:      string;
  status:      string;
  companyId:   string | null;
  channelId:   string | null;
  filters:     FiltersState;
  isRefreshing: boolean;
  visibleColumns:    Set<RecipeColumnKey>;
  onSearch:    (v: string) => void;
  onStatus:    (v: string) => void;
  onCompany:   (v: string | null) => void;
  onChannel:   (v: string | null) => void;
  onFilters:   (patch: Partial<FiltersState>) => void;
  onClearFilters: () => void;
  onNew:       () => void;
  onToggleColumn: (key: RecipeColumnKey) => void;
  onRestoreDefaults: () => void;
  onShowAll:   () => void;
  onRefresh:   () => void;
  onExport:    () => void;
};

function RecipeToolbar({
  search, status, companyId, channelId, filters, isRefreshing, visibleColumns,
  onSearch, onStatus, onCompany, onChannel, onFilters, onClearFilters,
  onNew, onToggleColumn, onRestoreDefaults, onShowAll, onRefresh, onExport,
}: ToolbarProps) {
  const { t } = useTranslation('recipes');
  const activeFilterCount = [
    filters.hasMfgCost,
    filters.hasPkgMaterials,
    !!filters.updatedFrom,
    !!filters.updatedTo,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-52 max-w-80">
        <Input
          placeholder={t($ => $.toolbar.searchPlaceholder)}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Status */}
      <Select value={status} onValueChange={onStatus}>
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder={t($ => $.toolbar.allStatuses)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t($ => $.toolbar.allStatuses)}</SelectItem>
          <SelectItem value="active">{t($ => $.status.active)}</SelectItem>
          <SelectItem value="draft">{t($ => $.status.draft)}</SelectItem>
        </SelectContent>
      </Select>

      {/* Company */}
      <div className="w-44">
        <CompanySelect value={companyId} onChange={onCompany} placeholder={t($ => $.toolbar.allCompanies)} />
      </div>

      {/* Channel */}
      <div className="w-44">
        <ChannelSelect value={channelId} onChange={onChannel} placeholder={t($ => $.toolbar.allChannels)} />
      </div>

      {/* Action buttons */}
      <div className="ms-auto flex items-center gap-2">
        <Button size="sm" onClick={onNew} className="gap-1.5">
          <Plus className="size-4" />
          {t($ => $.toolbar.newRecipe)}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Columns3 className="size-4" />
              {t($ => $.toolbar.columns)}
            </Button>
          </PopoverTrigger>
          <ColumnManagerPanel
            visibleColumns={visibleColumns}
            onToggle={onToggleColumn}
            onRestoreDefaults={onRestoreDefaults}
            onShowAll={onShowAll}
          />
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 relative">
              <Filter className="size-4" />
              {t($ => $.toolbar.filters)}
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <FiltersPanel
            {...filters}
            onChange={onFilters}
            onClear={onClearFilters}
          />
        </Popover>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t($ => $.toolbar.refresh)}
        </Button>

        <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
          <Download className="size-4" />
          {t($ => $.toolbar.export)}
        </Button>
      </div>
    </div>
  );
}

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

function BulkActionBar({
  count, onExport, onClear,
}: { count: number; onExport: () => void; onClear: () => void }) {
  const { t } = useTranslation('recipes');
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 shadow-sm">
      <span className="text-sm font-medium shrink-0">{t($ => $.bulk.selected, { count })}</span>
      <div className="w-px h-5 bg-border mx-1" />
      <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5 h-8">
        <Download className="size-3.5" />
        {t($ => $.bulk.exportSelected)}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} className="ms-auto h-8 gap-1.5 text-muted-foreground">
        <X className="size-3.5" />
        {t($ => $.bulk.clearSelection)}
      </Button>
    </div>
  );
}

// ─── Sort Header ──────────────────────────────────────────────────────────────

type SortState = { field: string; direction: 'asc' | 'desc' };

function SortableHead({
  field, label, sort, onSort, align = 'left',
}: { field: string; label: string; sort?: SortState; onSort?: (f: string) => void; align?: 'left' | 'right' }) {
  const isSorted = sort?.field === field;
  const Icon     = isSorted ? (sort?.direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
  if (!onSort) return <TableHead className={align === 'right' ? 'text-end' : ''}>{label}</TableHead>;
  return (
    <TableHead className={align === 'right' ? 'text-end' : ''}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        {label}
        <Icon className="size-3.5 opacity-70" />
      </button>
    </TableHead>
  );
}

// ─── Recipe Table ─────────────────────────────────────────────────────────────

/**
 * The table renders list rows. Callbacks hand back a RecipeListRow, so a
 * consumer that needs components has to fetch the detail rather than assume
 * the row carries them — see BUG-BOM-DATA-LOSS-001.
 */
type RecipeTableProps = {
  data:            RecipeListRow[];
  isLoading:       boolean;
  isError:         boolean;
  sort?:           SortState;
  onSortChange?:   (field: string) => void;
  visibleColumns:  Set<RecipeColumnKey>;
  selectedIds:     Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick:      (r: RecipeListRow) => void;
  onEdit:          (r: RecipeListRow) => void;
  onCreateFrom:    (r: RecipeListRow) => void;
  onToggle:        (r: RecipeListRow) => void;
  onDelete:        (r: RecipeListRow) => void;
  onViewMaterials: (r: RecipeListRow) => void;
};

function RecipeTable({
  data, isLoading, isError, sort, onSortChange, visibleColumns,
  selectedIds, onSelectionChange, onRowClick, onEdit, onCreateFrom, onToggle, onDelete,
  onViewMaterials,
}: RecipeTableProps) {
  const { t } = useTranslation('recipes');
  const { currency, locale } = useCompany();
  const vis = (key: RecipeColumnKey) => visibleColumns.has(key);

  const allSelected  = data.length > 0 && data.every((r) => selectedIds.has(r.id));
  const someSelected = data.some((r) => selectedIds.has(r.id)) && !allSelected;

  function toggleAll() {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map((r) => r.id)));
    }
  }

  function toggleRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  // +1 for checkbox column
  const colSpan = 1 + Array.from(visibleColumns).length;

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={someSelected ? 'indeterminate' : allSelected}
                onCheckedChange={toggleAll}
                aria-label={t($ => $.table.selectAll)}
              />
            </TableHead>
            {vis('image')           && <TableHead className="w-14">{t($ => $.table.headers.image)}</TableHead>}
            {vis('product')         && <SortableHead field="product_name"    label={t($ => $.table.headers.product)}        sort={sort} onSort={onSortChange} />}
            {vis('category')        && <SortableHead field="category"        label={t($ => $.table.headers.category)}       sort={sort} onSort={onSortChange} />}
            {vis('recipe_cost')     && <SortableHead field="recipe_cost"     label={t($ => $.table.headers.recipeCost)}     sort={sort} onSort={onSortChange} align="right" />}
            {vis('waste_pct')       && <SortableHead field="total_waste_pct" label={t($ => $.table.headers.wastePct)}       sort={sort} onSort={onSortChange} />}
            {vis('total_materials') && <SortableHead field="lines_count"     label={t($ => $.table.headers.totalMaterials)} sort={sort} onSort={onSortChange} align="right" />}
            {vis('channel')         && <TableHead>{t($ => $.table.headers.channel)}</TableHead>}
            {vis('company')         && <TableHead>{t($ => $.table.headers.company)}</TableHead>}
            {vis('updated')         && <SortableHead field="updated_at"      label={t($ => $.table.headers.updatedAt)}      sort={sort} onSort={onSortChange} />}
            {vis('status')          && <TableHead>{t($ => $.table.headers.status)}</TableHead>}
            {vis('actions')         && <TableHead className="w-12 text-end">{t($ => $.table.headers.actions)}</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }, (_, i) => (
              <TableRow key={`sk-${i}`}>
                {Array.from({ length: colSpan }, (__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-12 text-center text-muted-foreground">
                {t($ => $.table.error)}
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan}>
                <EmptyState
                  icon={BookOpen}
                  title={t($ => $.table.empty.title)}
                  description={t($ => $.table.empty.description)}
                />
              </TableCell>
            </TableRow>
          ) : (
            data.map((r) => {
              const cost       = computeRecipeCost(r);
              const isSelected = selectedIds.has(r.id);

              return (
                <TableRow
                  key={r.id}
                  className={`cursor-pointer hover:bg-muted/40 ${isSelected ? 'bg-primary/5' : ''}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, [role="menuitem"], [data-radix-collection-item], input[type="checkbox"]')) return;
                    onRowClick(r);
                  }}
                >
                  {/* Checkbox */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(r.id)}
                      aria-label={t($ => $.table.selectRow, { name: r.product?.name ?? r.bom_number })}
                    />
                  </TableCell>

                  {/* Image */}
                  {vis('image') && (
                    <TableCell>
                      <div className="size-9 overflow-hidden rounded border bg-muted flex items-center justify-center shrink-0">
                        {getMediaUrl(r.product?.image_url) ? (
                          <img src={getMediaUrl(r.product!.image_url)!} alt={r.product!.name} className="size-full object-cover" />
                        ) : (
                          <BookOpen className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                  )}

                  {/* Product */}
                  {vis('product') && (
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-48">{r.product?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.product?.sku}</p>
                      </div>
                    </TableCell>
                  )}

                  {/* Category */}
                  {vis('category') && (
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {r.product?.category?.name ?? '—'}
                      </span>
                    </TableCell>
                  )}

                  {/* Recipe Cost */}
                  {vis('recipe_cost') && (
                    <TableCell className="text-end">
                      <span className="text-sm font-medium tabular-nums">
                        {cost > 0 ? fmtCost(cost, currency, locale) : <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                  )}

                  {/* Waste % */}
                  {vis('waste_pct') && (
                    <TableCell>
                      <WasteBadge pct={r.total_waste_pct ?? 0} />
                    </TableCell>
                  )}

                  {/* Total Materials — interactive preview popover */}
                  {vis('total_materials') && (
                    <TableCell className="text-end">
                      <MaterialsPreviewPopover recipe={r} onViewMaterials={onViewMaterials} />
                    </TableCell>
                  )}

                  {/* Channel */}
                  {vis('channel') && (
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {r.product?.channels?.length ? r.product.channels.map((c) => c.name).join(', ') : '—'}
                      </span>
                    </TableCell>
                  )}

                  {/* Company */}
                  {vis('company') && (
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {r.product?.channels?.[0]?.company_name ?? '—'}
                      </span>
                    </TableCell>
                  )}

                  {/* Updated */}
                  {vis('updated') && (
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {r.updated_at ? r.updated_at.slice(0, 10) : r.created_at?.slice(0, 10) ?? '—'}
                      </span>
                    </TableCell>
                  )}

                  {/* Status */}
                  {vis('status') && (
                    <TableCell>
                      {r.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-xs">
                          {t($ => $.status.active)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">{t($ => $.status.draft)}</Badge>
                      )}
                    </TableCell>
                  )}

                  {/* Actions */}
                  {vis('actions') && (
                    <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        label={t($ => $.table.actionsFor, { name: r.product?.name ?? r.bom_number })}
                        items={[
                          { key: 'view',        label: t($ => $.actions.view),       icon: Eye,    onSelect: () => onRowClick(r) },
                          { key: 'edit',        label: t($ => $.actions.edit),       icon: Pencil, onSelect: () => onEdit(r) },
                          { key: 'create-from', label: t($ => $.actions.createFrom), icon: Copy,   onSelect: () => onCreateFrom(r) },
                          {
                            key: 'toggle',
                            label: r.is_active ? t($ => $.actions.setDraft) : t($ => $.actions.setActive),
                            icon: Power,
                            onSelect: () => onToggle(r),
                          },
                          { key: 'delete', label: t($ => $.actions.delete), icon: Trash2, onSelect: () => onDelete(r), variant: 'destructive' },
                        ]}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Materials Preview Popover (PKG-RECIPE-008) ────────────────────────────────

function SkeletonMaterialList() {
  return (
    <div className="flex flex-col gap-2.5 p-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded shrink-0" />
          <div className="flex-1 flex flex-col gap-1">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

type PreviewLine = {
  id: string;
  raw_material: { name: string; sku: string; product_type?: string; image_url?: string; material_cost?: number } | null;
  quantity: number;
  waste_percentage: number;
};

function MaterialPreviewRow({ line }: { line: PreviewLine }) {
  const { t } = useTranslation('recipes');
  const isPkg   = line.raw_material?.product_type === 'packaging_material';
  const hasCost = (line.raw_material?.material_cost ?? 0) > 0;

  return (
    <div className="flex items-center gap-2.5 py-1.5 px-3 hover:bg-muted/40 rounded-sm transition-colors">
      {/* Thumbnail */}
      <div className="size-8 rounded bg-muted border flex items-center justify-center shrink-0 overflow-hidden">
        {getMediaUrl(line.raw_material?.image_url) ? (
          <img
            src={getMediaUrl(line.raw_material!.image_url)!}
            alt={line.raw_material!.name}
            className="size-full object-cover"
          />
        ) : (
          <Package className="size-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-tight">{line.raw_material?.name ?? '—'}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge
            variant="outline"
            className={`text-[9px] px-1 py-0 leading-tight ${
              isPkg
                ? 'border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400'
                : 'border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-400'
            }`}
          >
            {isPkg ? t($ => $.materialTypes.packaging) : t($ => $.materialTypes.raw)}
          </Badge>
          {line.waste_percentage > 0 && (
            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
              {t($ => $.waste.wasteSuffix, { pct: line.waste_percentage.toFixed(0) })}
            </span>
          )}
        </div>
      </div>

      {/* Qty + cost warning */}
      <div className="flex flex-col items-end shrink-0 gap-0.5">
        <span className="text-xs tabular-nums font-medium">{line.quantity}</span>
        {!hasCost && (
          <span className="text-[9px] text-amber-500 flex items-center gap-0.5">
            <TriangleAlert className="size-2.5" />{t($ => $.noCost)}
          </span>
        )}
      </div>
    </div>
  );
}

function MaterialsPreviewPopover({
  recipe,
  onViewMaterials,
}: {
  recipe: RecipeListRow;
  onViewMaterials: (recipe: RecipeListRow) => void;
}) {
  const { t } = useTranslation('recipes');
  const [open, setOpen]       = useState(false);
  const closeTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const materialsCount         = recipe.lines_count ?? 0;

  const { data: fullRecipe, isFetching } = useRecipeQuery(open ? recipe.id : '');

  function handleMouseEnterTrigger() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function handleMouseLeaveTrigger() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function handleMouseEnterContent() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  function handleMouseLeaveContent() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  const lines: PreviewLine[] = (fullRecipe?.lines ?? []) as PreviewLine[];
  const rawCount = lines.filter((l) => l.raw_material?.product_type !== 'packaging_material').length;
  const pkgCount = lines.filter((l) => l.raw_material?.product_type === 'packaging_material').length;

  if (materialsCount === 0) {
    return <span className="text-sm tabular-nums text-muted-foreground">—</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-sm tabular-nums underline decoration-dotted underline-offset-2 cursor-pointer hover:text-foreground transition-colors text-muted-foreground"
          onMouseEnter={handleMouseEnterTrigger}
          onMouseLeave={handleMouseLeaveTrigger}
          onClick={() => setOpen((v) => !v)}
          aria-label={t($ => $.preview.ariaLabel, { count: materialsCount, name: recipe.product?.name ?? recipe.bom_number })}
        >
          {t($ => $.preview.materialsCount, { count: materialsCount })}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={8}
        className="w-72 p-0 shadow-lg"
        onMouseEnter={handleMouseEnterContent}
        onMouseLeave={handleMouseLeaveContent}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b">
          <p className="text-xs font-semibold truncate">{recipe.product?.name ?? recipe.bom_number}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {rawCount > 0 && t($ => $.preview.rawCount, { count: rawCount })}
            {rawCount > 0 && pkgCount > 0 && ' · '}
            {pkgCount > 0 && t($ => $.preview.pkgCount, { count: pkgCount })}
          </p>
        </div>

        {/* Materials list */}
        <div className="max-h-[280px] overflow-y-auto py-1">
          {isFetching && lines.length === 0 ? (
            <SkeletonMaterialList />
          ) : lines.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">{t($ => $.preview.noMaterials)}</p>
          ) : (
            lines.map((line) => <MaterialPreviewRow key={line.id} line={line} />)
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {t($ => $.preview.total, { count: materialsCount })}
          </span>
          <button
            type="button"
            className="text-[10px] text-primary font-medium flex items-center gap-1 hover:underline"
            onClick={() => { setOpen(false); onViewMaterials(recipe); }}
          >
            {t($ => $.actions.viewFullRecipe)}
            <ArrowRight className="size-3" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RecipesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('recipes');

  // ── Column preferences ────────────────────────────────────────────────────
  const { visibleColumns, toggleColumn, restoreDefaults, showAll } = useRecipeColumnPreferences();

  // ── Primary filter state ──────────────────────────────────────────────────
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('all');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);

  // ── Secondary filter state ────────────────────────────────────────────────
  const [filters, setFilters] = useState<FiltersState>({
    hasMfgCost:      false,
    hasPkgMaterials: false,
    updatedFrom:     '',
    updatedTo:       '',
  });

  // ── Pagination / sort ─────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: RecipeSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at', direction: 'desc',
  });

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Drawers / dialogs ─────────────────────────────────────────────────────
  const [detailOpen,       setDetailOpen]       = useState(false);
  const [detailRecipe,     setDetailRecipe]     = useState<RecipeListRow | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<string>('overview');
  const [deleting,         setDeleting]         = useState<RecipeListRow | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const deleteRecipe = useDeleteRecipe();
  const setRecipeStatus = useSetRecipeStatus();

  // ── CSV columns — depends on t(), must be inside component body ───────────
  type CsvCol = { key: RecipeColumnKey; header: string; value: (r: RecipeListRow) => string };
  const csvColumns = useMemo<CsvCol[]>(() => [
    { key: 'image',           header: t($ => $.csv.headers.image),          value: (r) => r.product?.image_url ?? '' },
    { key: 'product',         header: t($ => $.csv.headers.product),        value: (r) => `${r.product?.name ?? ''} (${r.product?.sku ?? ''})` },
    { key: 'category',        header: t($ => $.csv.headers.category),       value: (r) => r.product?.category?.name ?? '' },
    { key: 'recipe_cost',     header: t($ => $.csv.headers.recipeCost),     value: (r) => computeRecipeCost(r).toFixed(2) },
    { key: 'waste_pct',       header: t($ => $.csv.headers.wastePct),       value: (r) => `${(r.total_waste_pct ?? 0).toFixed(2)}%` },
    { key: 'total_materials', header: t($ => $.csv.headers.totalMaterials), value: (r) => String(r.lines_count ?? 0) },
    { key: 'channel',         header: t($ => $.csv.headers.channel),        value: (r) => r.product?.channels?.map((c) => c.name).join(', ') ?? '' },
    { key: 'company',         header: t($ => $.csv.headers.company),        value: (r) => r.product?.channels?.[0]?.company_name ?? '' },
    { key: 'updated',         header: t($ => $.csv.headers.updated),        value: (r) => (r.updated_at ?? r.created_at ?? '').slice(0, 10) },
    { key: 'status',          header: t($ => $.csv.headers.status),         value: (r) => (r.is_active ? t($ => $.status.active) : t($ => $.status.draft)) },
  ], [t]);

  // ── Shared filter (one source of truth for stats + table + export) ────────
  const sharedFilter: SharedFilter = {
    search:                  search || undefined,
    status:                  status !== 'all' ? (status as 'active' | 'draft') : undefined,
    company_id:              companyId ?? undefined,
    channel_id:              channelId ?? undefined,
    has_manufacturing_cost:  filters.hasMfgCost  || undefined,
    has_packaging_materials: filters.hasPkgMaterials || undefined,
    updated_from:            filters.updatedFrom || undefined,
    updated_to:              filters.updatedTo   || undefined,
  };

  // ── Table query ───────────────────────────────────────────────────────────
  const queryParams = {
    ...sharedFilter,
    page,
    per_page: PER_PAGE,
    sort_by:  sort.field,
    sort_dir: sort.direction,
  };

  const { data, isLoading, isError, isFetching, refetch } = useRecipesQuery(queryParams);

  const items = data?.items ?? [];
  const meta  = data?.meta;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const resetPage = useCallback(() => setPage(1), []);

  function handleSearch(v: string)             { setSearch(v);    resetPage(); }
  function handleStatus(v: string)             { setStatus(v);    resetPage(); }
  function handleCompany(v: string | null)     { setCompanyId(v); resetPage(); }
  function handleChannel(v: string | null)     { setChannelId(v); resetPage(); }

  function handleFilters(patch: Partial<FiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    resetPage();
  }

  function handleClearFilters() {
    setFilters({ hasMfgCost: false, hasPkgMaterials: false, updatedFrom: '', updatedTo: '' });
    resetPage();
  }

  function handleSort(field: string) {
    setSort((cur) =>
      cur.field === field
        ? { field: field as RecipeSortField, direction: cur.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as RecipeSortField, direction: 'asc' },
    );
    resetPage();
  }

  function openDetail(r: RecipeListRow, tab = 'overview') {
    setDetailInitialTab(tab);
    setDetailRecipe(r);
    setDetailOpen(true);
  }

  function handleViewMaterials(r: RecipeListRow) {
    openDetail(r, 'materials');
  }

  function handleEdit(r: RecipeListRow)       { navigate(`${ROUTES.recipes}/${r.id}/edit`); }
  function handleCreateFrom(r: RecipeListRow) { navigate(ROUTES.recipesNew, { state: { sourceRecipeId: r.id } }); }

  // ── Export ────────────────────────────────────────────────────────────────
  function triggerCsvDownload(csvItems: RecipeListRow[], cols: CsvCol[]) {
    const visibleCols = cols.filter((c) => visibleColumns.has(c.key));
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = visibleCols.map((c) => escape(c.header)).join(',');
    const rows   = csvItems.map((r) => visibleCols.map((c) => escape(c.value(r))).join(','));
    const csv    = [header, ...rows].join('\n');
    const blob   = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href     = url;
    a.download = `recipes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    if (selectedIds.size > 0) {
      triggerCsvDownload(items.filter((r) => selectedIds.has(r.id)), csvColumns);
      return;
    }
    const result = await recipesService.list({ ...sharedFilter, per_page: 10_000 });
    triggerCsvDownload(result.items, csvColumns);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.page.title)}
        subtitle={t($ => $.page.subtitle)}
        breadcrumbs={[
          { label: t($ => $.page.breadcrumbs.home),      to: ROUTES.dashboard },
          { label: t($ => $.page.breadcrumbs.inventory), to: ROUTES.inventoryProducts },
          { label: t($ => $.page.breadcrumbs.recipes) },
        ]}
      />

      {/* Stats — filter-aware, driven by sharedFilter */}
      <RecipeStats query={sharedFilter} />

      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <RecipeToolbar
          search={search}
          status={status}
          companyId={companyId}
          channelId={channelId}
          filters={filters}
          isRefreshing={isFetching}
          visibleColumns={visibleColumns}
          onSearch={handleSearch}
          onStatus={handleStatus}
          onCompany={handleCompany}
          onChannel={handleChannel}
          onFilters={handleFilters}
          onClearFilters={handleClearFilters}
          onNew={() => navigate(ROUTES.recipesNew)}
          onToggleColumn={toggleColumn}
          onRestoreDefaults={restoreDefaults}
          onShowAll={showAll}
          onRefresh={() => void refetch()}
          onExport={() => void handleExport()}
        />

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <BulkActionBar
            count={selectedIds.size}
            onExport={() => void handleExport()}
            onClear={() => setSelectedIds(new Set())}
          />
        )}

        {/* Table */}
        <RecipeTable
          data={items}
          isLoading={isLoading}
          isError={isError}
          sort={sort}
          onSortChange={handleSort}
          visibleColumns={visibleColumns}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={openDetail}
          onEdit={handleEdit}
          onCreateFrom={handleCreateFrom}
          onToggle={(r) => setRecipeStatus.mutate({ id: r.id, isActive: !r.is_active })}
          onDelete={(r) => setDeleting(r)}
          onViewMaterials={handleViewMaterials}
        />

        {meta && meta.last_page > 1 && (
          <Pagination
            meta={{ page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page }}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Detail drawer */}
      <RecipeDetailDrawer
        recipe={detailRecipe}
        open={detailOpen}
        initialTab={detailInitialTab}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) { setDetailRecipe(null); setDetailInitialTab('overview'); }
        }}
        onEdit={handleEdit}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.delete.title)}
        description={t($ => $.delete.description, { name: deleting?.product?.name ?? deleting?.bom_number ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteRecipe.isPending}
        onConfirm={() => {
          if (deleting) deleteRecipe.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
