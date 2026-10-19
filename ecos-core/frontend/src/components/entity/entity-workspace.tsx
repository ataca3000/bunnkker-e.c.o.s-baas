import type { ReactNode } from 'react';

import { EntityTable } from '@/components/crud';
import type { ColumnDef, SortState } from '@/components/crud/types';
import { BulkActionBar } from '@/components/data-grid';
import {
  PageEmptyState,
  PageErrorState,
  PageLoadingState,
  PageNoResultsState,
  PagePagination,
  WorkspacePage,
} from '@/components/page';
import { WorkspaceHeader } from '@/components/workspace';

import { EntityWorkspaceToolbar } from './toolbar/entity-workspace-toolbar';
import type {
  EntityBulkConfig,
  EntityEmptyStateConfig,
  EntityHeaderConfig,
  EntityPaginationConfig,
  EntityToolbarConfig,
} from './types';

type EntityWorkspaceProps<T> = {
  // ── WorkspaceHeader ───────────────────────────────────────────────────────────
  /** Omit to render without a page header (e.g. embedded workspaces). */
  header?: EntityHeaderConfig;

  // ── Toolbar (drives EntityWorkspaceToolbar) ────────────────────────────────────
  /** Omit to render without a toolbar. */
  toolbar?: EntityToolbarConfig;

  // ── Quick filter chips / status tabs ──────────────────────────────────────────
  quickFilters?: ReactNode;

  // ── Data grid ─────────────────────────────────────────────────────────────────
  columns: ColumnDef<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
  sort?: SortState;
  onSortChange?: (field: string) => void;
  rowActions?: (row: T) => ReactNode;
  focusedRowId?: string | null;
  skeletonRows?: number;
  onRetry?: () => void;

  // ── Empty / no-results states ──────────────────────────────────────────────────
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  /** Shown in the no-results state description. */
  noResultsQuery?: string;
  emptyState?: EntityEmptyStateConfig;

  // ── Bulk row selection ─────────────────────────────────────────────────────────
  bulk?: EntityBulkConfig;

  // ── Pagination ─────────────────────────────────────────────────────────────────
  pagination?: EntityPaginationConfig;

  // ── ReactNode drawer / dialog slots ───────────────────────────────────────────
  /** Form drawer (PageFormDrawer). Rendered outside the page layout. */
  formDrawer?: ReactNode;
  /** Destructive confirm dialog (PageConfirmDialog). Rendered outside the layout. */
  confirmDialog?: ReactNode;

  // ── Extension point slots (future: Column Presets, Wizards, AI) ───────────────
  /** Column visibility / preset picker. Injected into toolbar right-group. */
  columnPresets?: ReactNode;
  /** Import wizard sheet. Rendered outside the layout. */
  importWizard?: ReactNode;
  /** Export wizard sheet. Rendered outside the layout. */
  exportWizard?: ReactNode;
  /** AI-assisted action panel. Injected into toolbar right-group. */
  aiActions?: ReactNode;

  // ── Layout ────────────────────────────────────────────────────────────────────
  className?: string;
};

/**
 * Generic entity workspace — the standard CRUD workspace for every master-data
 * module in ECOS ERP.
 *
 * Layer hierarchy:
 *   WorkspaceHeader → WorkspacePage → EntityWorkspaceToolbar + QuickFilterChips
 *   + EntityTable + PagePagination + BulkActionBar + page states
 *
 * The consuming module supplies: data, columns, handlers, and config objects.
 * All layout, state-handling, and UX patterns are standardised here.
 *
 * Extension slots (pass as ReactNode):
 *   columnPresets — column visibility / preset picker (injected in toolbar)
 *   importWizard  — import wizard sheet
 *   exportWizard  — export wizard sheet
 *   aiActions     — AI-assisted operations (injected in toolbar)
 *
 * Usage:
 *   <EntityWorkspace<Supplier>
 *     header={{ title: 'Suppliers', description: '...', metrics, savedViews }}
 *     toolbar={{ searchValue, onSearchChange, onImport, onExport }}
 *     quickFilters={<QuickFilterChips chips={statusChips} className="px-4 sm:px-6" />}
 *     columns={columns}
 *     data={items}
 *     getRowId={(s) => s.id}
 *     isLoading={isLoading}
 *     isError={isError}
 *     hasActiveFilters={hasActiveFilters}
 *     onClearFilters={clearFilters}
 *     emptyState={{ icon: Building2, title: 'No suppliers yet', action: { label: 'Add supplier', onClick: openCreate } }}
 *     pagination={meta ? { page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page, onPageChange: setPage } : undefined}
 *     formDrawer={<SupplierFormDrawer ... />}
 *     confirmDialog={<PageConfirmDialog ... />}
 *   />
 */
export function EntityWorkspace<T>({
  header,
  toolbar,
  quickFilters,
  columns,
  data,
  getRowId,
  isLoading = false,
  isError = false,
  isFetching = false,
  sort,
  onSortChange,
  rowActions,
  focusedRowId,
  skeletonRows,
  onRetry,
  hasActiveFilters = false,
  onClearFilters,
  noResultsQuery,
  emptyState,
  bulk,
  pagination,
  formDrawer,
  confirmDialog,
  columnPresets,
  importWizard,
  exportWizard,
  aiActions,
  className,
}: EntityWorkspaceProps<T>) {
  // Compose extension-point slots into the toolbar's extra group
  const toolbarExtra =
    toolbar?.extra || columnPresets || aiActions ? (
      <>
        {toolbar?.extra}
        {columnPresets}
        {aiActions}
      </>
    ) : undefined;

  return (
    <>
      {/* ── Workspace header ─────────────────────────────────────────────────── */}
      {header ? (
        <WorkspaceHeader
          title={header.title}
          description={header.description}
          breadcrumbs={header.breadcrumbs}
          primaryAction={
            header.primaryAction
              ? {
                  key: header.primaryAction.key ?? 'primary',
                  label: header.primaryAction.label,
                  icon: header.primaryAction.icon,
                  onClick: header.primaryAction.onClick,
                  disabled: header.primaryAction.disabled,
                }
              : undefined
          }
          metrics={header.metrics}
          savedViews={header.savedViews}
        />
      ) : null}

      {/* ── Page layout shell ─────────────────────────────────────────────────── */}
      <WorkspacePage
        className={className}
        toolbar={
          toolbar ? (
            <EntityWorkspaceToolbar
              {...toolbar}
              extra={toolbarExtra}
            />
          ) : undefined
        }
        quickFilters={quickFilters}
        pagination={
          pagination ? (
            <PagePagination
              page={pagination.page}
              perPage={pagination.perPage}
              total={pagination.total}
              lastPage={pagination.lastPage}
              onPageChange={pagination.onPageChange}
              isLoading={pagination.isLoading ?? isFetching}
              className="px-4 pb-2 sm:px-6"
            />
          ) : undefined
        }
      >
        {isLoading ? (
          <PageLoadingState variant="table" />
        ) : isError ? (
          <PageErrorState onRetry={onRetry} />
        ) : data.length === 0 && hasActiveFilters ? (
          <PageNoResultsState query={noResultsQuery} onClear={onClearFilters} />
        ) : data.length === 0 ? (
          <PageEmptyState
            icon={emptyState?.icon}
            title={emptyState?.title ?? 'No records yet'}
            description={emptyState?.description}
            action={emptyState?.action}
          />
        ) : (
          <EntityTable<T>
            columns={columns}
            data={data}
            getRowId={getRowId}
            sort={sort}
            onSortChange={onSortChange}
            rowActions={rowActions}
            focusedRowId={focusedRowId}
            skeletonRows={skeletonRows}
          />
        )}
      </WorkspacePage>

      {/* ── Floating bulk-action bar (shows when rows are selected) ──────────── */}
      {bulk && bulk.selectedCount > 0 ? (
        <BulkActionBar
          selectedCount={bulk.selectedCount}
          actions={bulk.actions}
          onClear={bulk.onClearSelection}
          entityLabel={bulk.entityLabel}
        />
      ) : null}

      {/* ── Module-specific portal slots ──────────────────────────────────────── */}
      {formDrawer}
      {confirmDialog}
      {importWizard}
      {exportWizard}
    </>
  );
}
