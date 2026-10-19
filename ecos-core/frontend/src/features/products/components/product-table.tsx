import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  UniversalDataGrid,
  useRowSelection,
} from '@/components/data-grid';
import type {
  ColumnVisibilityState,
  GridPaginationConfig,
  GridSelectionAPI,
  GridSortState,
} from '@/components/data-grid/types';
import { EmptyState, ErrorState } from '@/components/crud';

import { createProductColumns } from './product-column-defs';
import { ProductMobileCard } from './product-mobile-card';
import type { Product } from '../types/product';

// ── Re-exports (backward compat for any consumer that imported from here) ──────
export type { UseRowSelectionReturn as ProductSelectionAPI } from '@/components/data-grid';
export { useRowSelection };

// ── Props ─────────────────────────────────────────────────────────────────────

export type ProductTableProps = {
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  sort: GridSortState;
  onSortChange: (field: string) => void;
  selection: GridSelectionAPI;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onStatusToggle: (product: Product) => void;
  onViewRecipe?: (product: Product) => void;
  onCreateRecipe?: (product: Product) => void;
  focusedRowId?: string | null;
  columnVisibility?: ColumnVisibilityState;
  pagination?: GridPaginationConfig;
  emptyState?: ReactNode;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Products workspace table — a thin wrapper around UniversalDataGrid<Product>.
 *
 * All domain logic lives in products-page.tsx.
 * Column definitions live in product-column-defs.tsx.
 * Column visibility metadata lives in product-column-meta.ts.
 */
export function ProductTable({
  products,
  isLoading,
  isError,
  sort,
  onSortChange,
  selection,
  onView,
  onEdit,
  onDelete,
  onStatusToggle,
  onViewRecipe,
  onCreateRecipe,
  focusedRowId,
  columnVisibility,
  pagination,
  emptyState,
}: ProductTableProps) {
  const { t } = useTranslation('products');
  const columns = useMemo(
    () => createProductColumns({ onView, onEdit, onDelete, onStatusToggle, onViewRecipe, onCreateRecipe }, t),
     
    [t, onView, onEdit, onDelete, onStatusToggle, onViewRecipe, onCreateRecipe],
  );

  return (
    <UniversalDataGrid<Product>
      data={products}
      columns={columns}
      rowId={(p) => p.id}
      loading={isLoading}
      error={isError}
      sort={sort}
      onSortChange={onSortChange}
      selection={selection}
      focusedRowId={focusedRowId}
      columnVisibility={columnVisibility}
      pagination={pagination}
      skeletonRows={8}
      emptyState={emptyState ?? <EmptyState title={t($ => $.emptyState.withFiltersTitle)} />}
      errorState={<ErrorState />}
      renderMobileCard={(product, sel) => (
        <ProductMobileCard
          product={product}
          isSelected={sel?.isSelected(product.id) ?? false}
          isFocused={focusedRowId === product.id}
          onView={onView}
          onEdit={onEdit}
          onSelect={sel?.selectRow}
        />
      )}
    />
  );
}
