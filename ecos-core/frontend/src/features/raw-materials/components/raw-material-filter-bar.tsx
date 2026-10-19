import { Columns3, Download, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { useCategoriesQuery } from '@/features/categories/hooks/use-categories';
import { useSuppliersQuery } from '@/features/suppliers/hooks/use-suppliers';
import { useWarehousesQuery } from '@/features/warehouses/hooks/use-warehouses';
import { ALL_COLUMNS } from '@/features/raw-materials/hooks/use-column-preferences';
import type { ColumnKey } from '@/features/raw-materials/hooks/use-column-preferences';
import type { MaterialType } from '@/features/raw-materials/types';

// ─── Column Manager Popover ───────────────────────────────────────────────────

type ColumnManagerProps = {
  visibleColumns:    Set<ColumnKey>;
  onToggleColumn:    (key: ColumnKey) => void;
  onRestoreDefaults: () => void;
  onShowAll:         () => void;
};

function ColumnManagerPanel({ visibleColumns, onToggleColumn, onRestoreDefaults, onShowAll }: ColumnManagerProps) {
  const { t } = useTranslation('raw-materials');
  return (
    <PopoverContent align="end" className="w-56 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">{t($ => $.filters.columns)}</p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={onShowAll}>
            {t($ => $.filters.showAll)}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={onRestoreDefaults}>
            <RotateCcw className="size-3 mr-1" />
            {t($ => $.filters.reset)}
          </Button>
        </div>
      </div>
      <Separator className="mb-2" />
      <div className="flex flex-col gap-1.5">
        {ALL_COLUMNS.map((col) => (
          <label
            key={col.key}
            className={`flex items-center gap-2 text-sm rounded px-1 py-0.5 ${col.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/60'}`}
          >
            <Checkbox
              checked={visibleColumns.has(col.key)}
              onCheckedChange={() => !col.locked && onToggleColumn(col.key)}
              disabled={col.locked}
              aria-label={col.label}
            />
            <span>{col.label}</span>
            {col.locked && (
              <span className="ms-auto text-[10px] text-muted-foreground">{t($ => $.filters.locked)}</span>
            )}
          </label>
        ))}
      </div>
    </PopoverContent>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

type RawMaterialFilterBarProps = {
  search:          string;
  categoryId:      string;
  supplierId:      string;
  warehouseId:     string;
  availability:    string;
  allowNegative:   string;
  materialType:    MaterialType | '';
  onSearch:        (v: string) => void;
  onCategory:      (v: string) => void;
  onSupplier:      (v: string) => void;
  onWarehouse:     (v: string) => void;
  onAvailability:  (v: string) => void;
  onAllowNegative: (v: string) => void;
  onMaterialType:  (v: MaterialType | '') => void;
  onRefresh:       () => void;
  onExport:        () => void;
  onNew:           () => void;
  isRefreshing:    boolean;
  // Column manager
  visibleColumns:    Set<ColumnKey>;
  onToggleColumn:    (key: ColumnKey) => void;
  onRestoreDefaults: () => void;
  onShowAll:         () => void;
};

export function RawMaterialFilterBar({
  search, categoryId, supplierId, warehouseId, availability, allowNegative, materialType,
  onSearch, onCategory, onSupplier, onWarehouse, onAvailability, onAllowNegative, onMaterialType,
  onRefresh, onExport, onNew, isRefreshing,
  visibleColumns, onToggleColumn, onRestoreDefaults, onShowAll,
}: RawMaterialFilterBarProps) {
  const { t } = useTranslation('raw-materials');

  const { data: categoriesResult } = useCategoriesQuery({ scope: 'material', status: 'active', per_page: 200 });
  const { data: suppliersResult  } = useSuppliersQuery({ status: 'active', per_page: 200 });
  const { data: warehousesResult } = useWarehousesQuery({ per_page: 200 });

  const categories = categoriesResult?.items ?? [];
  const suppliers  = suppliersResult?.items  ?? [];
  const warehouses = warehousesResult?.items ?? [];

  const newLabel = materialType === 'packaging_material'
    ? t($ => $.filters.newPackagingMaterial)
    : materialType === 'raw_material'
      ? t($ => $.filters.newRawMaterial)
      : t($ => $.filters.newMaterial);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-52 max-w-80">
        <Input
          placeholder={t($ => $.filters.searchPlaceholder)}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Material Type */}
      <Select value={materialType || '_all'} onValueChange={(v) => onMaterialType(v === '_all' ? '' : v as MaterialType)}>
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder={t($ => $.filters.allMaterials)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">{t($ => $.filters.allMaterials)}</SelectItem>
          <SelectItem value="raw_material">{t($ => $.filters.rawMaterials)}</SelectItem>
          <SelectItem value="packaging_material">{t($ => $.filters.packagingMaterials)}</SelectItem>
        </SelectContent>
      </Select>

      {/* Category */}
      <Select value={categoryId || '_all'} onValueChange={(v) => onCategory(v === '_all' ? '' : v)}>
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder={t($ => $.filters.allCategories)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">{t($ => $.filters.allCategories)}</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Supplier */}
      <Select value={supplierId || '_all'} onValueChange={(v) => onSupplier(v === '_all' ? '' : v)}>
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder={t($ => $.filters.allSuppliers)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">{t($ => $.filters.allSuppliers)}</SelectItem>
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Warehouse */}
      <Select value={warehouseId || '_all'} onValueChange={(v) => onWarehouse(v === '_all' ? '' : v)}>
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder={t($ => $.filters.allWarehouses)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">{t($ => $.filters.allWarehouses)}</SelectItem>
          {warehouses.map((w) => (
            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Stock Status */}
      <Select value={availability || '_all'} onValueChange={(v) => onAvailability(v === '_all' ? '' : v)}>
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder={t($ => $.filters.stockStatus)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">{t($ => $.filters.allStock)}</SelectItem>
          <SelectItem value="available">{t($ => $.filters.inStock)}</SelectItem>
          <SelectItem value="out_of_stock">{t($ => $.filters.outOfStock)}</SelectItem>
        </SelectContent>
      </Select>

      {/* Negative stock */}
      <Select value={allowNegative || '_all'} onValueChange={(v) => onAllowNegative(v === '_all' ? '' : v)}>
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder={t($ => $.filters.negStock)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">{t($ => $.filters.allStock)}</SelectItem>
          <SelectItem value="allowed">{t($ => $.filters.negAllowed)}</SelectItem>
          <SelectItem value="blocked">{t($ => $.filters.negBlocked)}</SelectItem>
        </SelectContent>
      </Select>

      {/* Action buttons — order: New | Columns | Refresh | Export */}
      <div className="ms-auto flex items-center gap-2">
        <Button size="sm" onClick={onNew} className="gap-1.5">
          <Plus className="size-4" />
          {newLabel}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Columns3 className="size-4" />
              {t($ => $.filters.columns)}
            </Button>
          </PopoverTrigger>
          <ColumnManagerPanel
            visibleColumns={visibleColumns}
            onToggleColumn={onToggleColumn}
            onRestoreDefaults={onRestoreDefaults}
            onShowAll={onShowAll}
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
          {t($ => $.filters.refresh)}
        </Button>

        <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
          <Download className="size-4" />
          {t($ => $.filters.export)}
        </Button>
      </div>
    </div>
  );
}
