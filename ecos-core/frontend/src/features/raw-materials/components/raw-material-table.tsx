import {
  ArrowDown,
  ArrowUp,
  BarChart2,
  ChevronsUpDown,
  Edit,
  History,
  Package,
  PackagePlus,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ActionMenu } from '@/components/crud/action-menu';
import { ErrorState } from '@/components/crud/error-state';
import { EmptyState } from '@/components/crud/empty-state';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToggleAllowNegative } from '@/features/raw-materials/hooks/use-raw-materials';
import type { ColumnKey } from '@/features/raw-materials/hooks/use-column-preferences';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompany } from '@/features/organization/context/company-context';
import { getMediaUrl } from '@/lib/media';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { RawMaterial } from '@/features/raw-materials/types';
import { resolveMaterialStockStatus } from '@/features/raw-materials/utils/material-stock-status';
import { InlineCostEditor } from '@/features/raw-materials/components/inline-cost-editor';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCost(n: number | null | undefined, currency: string, locale: string): string {
  if (n == null) return '—';
  return formatMoney(n, currency, locale);
}

// ─── Cell sub-components ──────────────────────────────────────────────────────

function AllowNegativeToggle({
  material,
  canEdit,
}: {
  material: RawMaterial;
  canEdit:  boolean;
}) {
  const { t } = useTranslation('raw-materials');
  const toggle  = useToggleAllowNegative();
  const allowed = material.allow_negative_stock ?? false;

  const switchEl = (
    <Switch
      checked={allowed}
      onCheckedChange={(checked) => toggle.mutate({ id: material.id, allow_negative_stock: checked })}
      disabled={!canEdit || toggle.isPending}
      aria-label={allowed ? t($ => $.table.allowNegativeOn) : t($ => $.table.allowNegativeOff)}
      onClick={(e) => e.stopPropagation()}
    />
  );

  if (canEdit) return switchEl;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{switchEl}</TooltipTrigger>
        <TooltipContent>{t($ => $.table.noPermission)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function QtyCell({ qty, colorize }: { qty: number | null | undefined; colorize?: 'available' }) {
  if (qty == null) return <span className="text-sm text-muted-foreground tabular-nums">—</span>;

  const colorClass =
    colorize === 'available'
      ? qty <= 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-emerald-600 dark:text-emerald-400'
      : 'text-foreground';

  return (
    <span className={cn('text-sm font-medium tabular-nums', colorClass)}>
      {qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
    </span>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

type RawMaterialTableProps = {
  data:             RawMaterial[];
  isLoading:        boolean;
  isError:          boolean;
  sort?:            SortState;
  onSortChange?:    (field: string) => void;
  selectedIds:      Set<string>;
  onSelectionChange:(ids: Set<string>) => void;
  onRowClick:       (m: RawMaterial) => void;
  onEdit:           (m: RawMaterial) => void;
  onPriceHistory:   (m: RawMaterial) => void;
  onStockHistory:   (m: RawMaterial) => void;
  onAddStock:       (m: RawMaterial) => void;
  onDelete:         (m: RawMaterial) => void;
  visibleColumns:   Set<ColumnKey>;
  onCostSave:       (id: string, newCost: number, reason: string) => void;
  savingCostId?:    string | null;
  canEditCost?:     boolean;
};

export function RawMaterialTable({
  data, isLoading, isError, sort, onSortChange,
  selectedIds, onSelectionChange,
  onRowClick, onEdit, onPriceHistory, onStockHistory,
  onAddStock, onDelete,
  visibleColumns,
  onCostSave, savingCostId, canEditCost = true,
}: RawMaterialTableProps) {
  const { t } = useTranslation('raw-materials');
  const { currency, locale } = useCompany();
  const allSelected  = data.length > 0 && data.every((m) => selectedIds.has(m.id));
  const someSelected = !allSelected && data.some((m) => selectedIds.has(m.id));

  // +1 for checkbox column (always shown)
  const colCount = 1 + [
    'image', 'name', 'material_type', 'category', 'unit',
    'stock_status', 'on_hand', 'reserved', 'available',
    'current_cost', 'inventory_value', 'allow_negative', 'sku', 'actions',
  ].filter((k) => visibleColumns.has(k as ColumnKey)).length;

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selectedIds);
      data.forEach((m) => next.delete(m.id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      data.forEach((m) => next.add(m.id));
      onSelectionChange(next);
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  }

  const show = (key: ColumnKey) => visibleColumns.has(key);

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
          <TableRow>
            {/* Checkbox — always visible */}
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label={t($ => $.table.name)}
              />
            </TableHead>

            {/* 1 — Image */}
            {show('image') && <TableHead className="w-14">{t($ => $.table.image)}</TableHead>}

            {/* 2 — Name (locked) */}
            {show('name') && (
              <SortableHead field="name" label={t($ => $.table.name)} sort={sort} onSort={onSortChange} />
            )}

            {/* 3 — Material Type */}
            {show('material_type') && <TableHead>{t($ => $.table.materialType)}</TableHead>}

            {/* 4 — Category */}
            {show('category') && <TableHead>{t($ => $.table.category)}</TableHead>}

            {/* 5 — Unit */}
            {show('unit') && <TableHead>{t($ => $.table.unit)}</TableHead>}

            {/* 6 — Stock Status */}
            {show('stock_status') && <TableHead>{t($ => $.table.stockStatus)}</TableHead>}

            {/* 7 — On Hand */}
            {show('on_hand') && (
              <SortableHead field="on_hand_qty" label={t($ => $.table.onHand)} sort={sort} onSort={onSortChange} align="right" />
            )}

            {/* 8 — Reserved */}
            {show('reserved') && <TableHead className="text-end">{t($ => $.table.reserved)}</TableHead>}

            {/* 9 — Available */}
            {show('available') && <TableHead className="text-end">{t($ => $.table.available)}</TableHead>}

            {/* 10 — Current Cost */}
            {show('current_cost') && (
              <SortableHead field="material_cost" label={t($ => $.table.currentCost)} sort={sort} onSort={onSortChange} align="right" />
            )}

            {/* 11 — Inventory Value */}
            {show('inventory_value') && <TableHead className="text-end">{t($ => $.table.inventoryValue)}</TableHead>}

            {/* 12 — Allow Negative */}
            {show('allow_negative') && <TableHead>{t($ => $.table.allowNegative)}</TableHead>}

            {/* 13 — SKU */}
            {show('sku') && (
              <SortableHead field="sku" label={t($ => $.table.sku)} sort={sort} onSort={onSortChange} />
            )}

            {/* 14 — Actions (locked) */}
            {show('actions') && <TableHead className="w-12 text-end">{t($ => $.table.actions)}</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }, (_, i) => (
              <TableRow key={`sk-${i}`}>
                {Array.from({ length: colCount }, (__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={colCount} className="p-0">
                <ErrorState />
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="p-0">
                <EmptyState
                  title={t($ => $.table.empty.title)}
                  description={t($ => $.table.empty.description)}
                />
              </TableCell>
            </TableRow>
          ) : (
            data.map((m) => {
              const isSelected  = selectedIds.has(m.id);
              const stockStatus = resolveMaterialStockStatus(m.available_qty, m.allow_negative_stock);

              return (
                <TableRow
                  key={m.id}
                  data-selected={isSelected}
                  className={cn(
                    'cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40',
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, [role="menuitem"], [data-radix-collection-item], [role="checkbox"]')) return;
                    onRowClick(m);
                  }}
                >
                  {/* Checkbox */}
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(m.id)}
                      aria-label={t($ => $.table.actionsLabel, { name: m.name })}
                    />
                  </TableCell>

                  {/* Image */}
                  {show('image') && (
                    <TableCell>
                      <div className="size-10 overflow-hidden rounded-md border bg-muted flex items-center justify-center shrink-0">
                        {getMediaUrl(m.image_url) ? (
                          <img src={getMediaUrl(m.image_url)!} alt={m.name} className="size-full object-cover" />
                        ) : (
                          <Package className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                  )}

                  {/* Name */}
                  {show('name') && (
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate max-w-40">{m.name}</p>
                        {m.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-40">{m.description}</p>
                        )}
                      </div>
                    </TableCell>
                  )}

                  {/* Material Type */}
                  {show('material_type') && (
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          m.product_type === 'packaging_material'
                            ? 'border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400'
                            : 'border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-400',
                        )}
                      >
                        {m.product_type === 'packaging_material'
                          ? t($ => $.table.typePackaging)
                          : t($ => $.table.typeRaw)}
                      </Badge>
                    </TableCell>
                  )}

                  {/* Category */}
                  {show('category') && (
                    <TableCell>
                      <span className="text-sm">{m.category?.name ?? '—'}</span>
                    </TableCell>
                  )}

                  {/* Unit */}
                  {show('unit') && (
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{m.unit?.name ?? '—'}</span>
                    </TableCell>
                  )}

                  {/* Stock Status */}
                  {show('stock_status') && (
                    <TableCell>
                      {stockStatus === 'in_stock' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-xs">
                          {t($ => $.table.inStock)}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 text-xs">
                          {t($ => $.table.outOfStock)}
                        </Badge>
                      )}
                    </TableCell>
                  )}

                  {/* On Hand */}
                  {show('on_hand') && (
                    <TableCell className="text-end">
                      <QtyCell qty={m.on_hand_qty} />
                    </TableCell>
                  )}

                  {/* Reserved */}
                  {show('reserved') && (
                    <TableCell className="text-end">
                      <QtyCell qty={m.reserved_qty} />
                    </TableCell>
                  )}

                  {/* Available */}
                  {show('available') && (
                    <TableCell className="text-end">
                      <QtyCell qty={m.available_qty} colorize="available" />
                    </TableCell>
                  )}

                  {/* Current Cost */}
                  {show('current_cost') && (
                    <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                      <InlineCostEditor
                        materialId={m.id}
                        currentCost={m.material_cost}
                        canEdit={canEditCost}
                        isSaving={savingCostId === m.id}
                        onSave={onCostSave}
                      />
                    </TableCell>
                  )}

                  {/* Inventory Value */}
                  {show('inventory_value') && (
                    <TableCell className="text-end">
                      <span className="text-sm tabular-nums text-muted-foreground">{fmtCost(m.inventory_value, currency, locale)}</span>
                    </TableCell>
                  )}

                  {/* Allow Negative */}
                  {show('allow_negative') && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <AllowNegativeToggle material={m} canEdit={true} />
                    </TableCell>
                  )}

                  {/* SKU */}
                  {show('sku') && (
                    <TableCell>
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{m.sku}</code>
                    </TableCell>
                  )}

                  {/* Actions */}
                  {show('actions') && (
                    <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        label={t($ => $.table.actionsLabel, { name: m.name })}
                        items={[
                          { key: 'view',          label: t($ => $.table.actionView),         icon: Package,     onSelect: () => onRowClick(m) },
                          { key: 'edit',          label: t($ => $.table.actionEdit),         icon: Edit,        onSelect: () => onEdit(m) },
                          { key: 'price-history', label: t($ => $.table.actionPriceHistory), icon: BarChart2,   onSelect: () => onPriceHistory(m) },
                          { key: 'stock-history', label: t($ => $.table.actionStockHistory), icon: History,     onSelect: () => onStockHistory(m) },
                          { key: 'add-stock',     label: t($ => $.table.actionAddStock),     icon: PackagePlus, onSelect: () => onAddStock(m) },
                          { key: 'delete', label: t($ => $.table.actionDelete), icon: Trash2, onSelect: () => onDelete(m), variant: 'destructive' },
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
