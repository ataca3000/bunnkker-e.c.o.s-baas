// ── Core component ───────────────────────────────────────────────────────────
export { UniversalDataGrid } from './universal-data-grid';
export type { UniversalDataGridProps } from './universal-data-grid';

// ── Toolbar + view controls ──────────────────────────────────────────────────
export { SmartToolbar } from './smart-toolbar';
export type { SmartToolbarAction, SmartToolbarBulkAction } from './smart-toolbar';

export { SavedViewsMenu } from './saved-views-menu';
export { ColumnVisibilityMenu } from './column-visibility-menu';
export { BulkActionBar } from './bulk-action-bar';
export type { BulkActionItem } from './bulk-action-bar';

// ── Hooks ────────────────────────────────────────────────────────────────────
export { useRowSelection } from './use-row-selection';
export type { UseRowSelectionReturn } from './use-row-selection';

export { useColumnVisibility } from './use-column-visibility';
export { useColumnOrder } from './hooks/use-column-order';
export { useSavedViews } from './hooks/use-saved-views';

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  ColumnMeta,
  ColumnVisibilityState,
  DataGridColumnDef,
  GridSelectionAPI,
  GridSortState,
  GridPaginationConfig,
  SortDirection,
} from './types';
