import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState, ErrorState, Pagination } from '@/components/crud';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type {
  ColumnVisibilityState,
  DataGridColumnDef,
  GridPaginationConfig,
  GridSelectionAPI,
  GridSortState,
} from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const SELECTION_COL_WIDTH = 40; // px — keeps pinned offsets exact

const ALIGN: Record<string, string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

// ── Sticky offset computation ────────────────────────────────────────────────

function computePinnedOffsets<T>(
  cols: DataGridColumnDef<T>[],
  hasSelection: boolean,
): { left: Map<string, number>; right: Map<string, number> } {
  const left = new Map<string, number>();
  let leftCursor = hasSelection ? SELECTION_COL_WIDTH : 0;
  for (const col of cols) {
    if (col.pin === 'left') {
      left.set(col.key, leftCursor);
      leftCursor += col.width ?? 128;
    }
  }

  const right = new Map<string, number>();
  let rightCursor = 0;
  for (const col of [...cols].reverse()) {
    if (col.pin === 'right') {
      right.set(col.key, rightCursor);
      rightCursor += col.width ?? 40;
    }
  }

  return { left, right };
}

// ── Internal primitives ──────────────────────────────────────────────────────

function Th({
  children,
  className,
  style,
  pinned,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  pinned?: boolean;
}) {
  return (
    <th
      scope="col"
      style={style}
      className={cn(
        'h-10 px-3 text-start text-xs font-medium text-muted-foreground first:ps-4 last:pe-4',
        pinned && 'sticky z-20 bg-muted/60 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  style,
  pinned,
  selected,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  pinned?: boolean;
  selected?: boolean;
}) {
  return (
    <td
      style={style}
      className={cn(
        'px-3 py-2.5 text-sm first:ps-4 last:pe-4 align-top',
        pinned && 'sticky z-[5] transition-colors',
        pinned &&
          (selected
            ? 'bg-primary/5 group-hover:bg-primary/10'
            : 'bg-card group-hover:bg-accent/40'),
        className,
      )}
    >
      {children}
    </td>
  );
}

// ── Public props ─────────────────────────────────────────────────────────────

export type UniversalDataGridProps<T> = {
  data: T[];
  columns: DataGridColumnDef<T>[];
  rowId: (row: T) => string;
  loading?: boolean;
  error?: boolean;
  sort?: GridSortState;
  onSortChange?: (field: string) => void;
  selection?: GridSelectionAPI;
  focusedRowId?: string | null;
  columnVisibility?: ColumnVisibilityState;
  pagination?: GridPaginationConfig;
  /** Renders a mobile card for each row. Receives the selection API for checkbox support. */
  renderMobileCard?: (row: T, selection: GridSelectionAPI | undefined) => ReactNode;
  /** Shown when data is empty. Defaults to a generic empty state. */
  emptyState?: ReactNode;
  /** Shown on error. Defaults to a generic error state. */
  errorState?: ReactNode;
  skeletonRows?: number;
  /** Called when a non-interactive area of a row is clicked. */
  onRowClick?: (row: T) => void;
};

// ── Component ────────────────────────────────────────────────────────────────

/**
 * UniversalDataGrid — the ECOS ERP universal list component.
 *
 * Handles: sticky columns, row selection, column visibility, sort, skeleton loading,
 * empty + error states, mobile card layout, and pagination.
 *
 * Consumers provide: data, column definitions, and callback handlers.
 * No domain logic lives here.
 *
 * Future extension points:
 *   - Column resizing: add `onColumnResize` prop + `width` state
 *   - Column reordering: wrap columns in `useColumnOrder` hook result
 *   - Virtual scrolling: replace `<tbody>` with a virtualizer (e.g. TanStack Virtual)
 *   - Context menu: add `onRowContextMenu` prop
 *   - Inline editing: add `editingRowId` + `onCellCommit` props
 */
export function UniversalDataGrid<T>({
  data,
  columns,
  rowId,
  loading = false,
  error = false,
  sort,
  onSortChange,
  selection,
  focusedRowId = null,
  columnVisibility,
  pagination,
  renderMobileCard,
  emptyState,
  errorState,
  skeletonRows = 8,
  onRowClick,
}: UniversalDataGridProps<T>) {
  const { t } = useTranslation('common');

  // ── Visible columns ────────────────────────────────────────────────────────
  const visibleCols = useMemo(
    () =>
      columns.filter((col) => {
        if (col.alwaysVisible) return true;
        if (columnVisibility) return columnVisibility[col.key] ?? col.defaultVisible !== false;
        return col.defaultVisible !== false;
      }),
    [columns, columnVisibility],
  );

  const hasSelection = !!selection;
  const colCount = visibleCols.length + (hasSelection ? 1 : 0);

  // ── Sticky offsets ─────────────────────────────────────────────────────────
  const { left: leftOf, right: rightOf } = useMemo(
    () => computePinnedOffsets(visibleCols, hasSelection),
    [visibleCols, hasSelection],
  );

  const defaultEmpty = emptyState ?? <EmptyState title={t(($) => $.table.noRecords)} />;
  const defaultError = errorState ?? <ErrorState />;

  // ── Scroll interactions ───────────────────────────────────────────────────
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Grab-to-scroll: click-and-drag scrolls horizontally.
  // mousemove/mouseup on document so dragging continues outside the element.
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const node = el;

    let dragging = false;
    let originX = 0;
    let originScrollLeft = 0;

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      // Let clicks on interactive elements (buttons, checkboxes, links) pass through
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea, [role="button"]')) return;

      dragging = true;
      originX = e.clientX;
      originScrollLeft = node.scrollLeft;
      // Apply grabbing cursor and disable selection globally for the drag gesture
      document.documentElement.style.cursor = 'grabbing';
      document.documentElement.style.userSelect = 'none';
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      node.scrollLeft = originScrollLeft - (e.clientX - originX);
    }

    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
    }

    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Safety cleanup if unmounted mid-drag
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
    };
  }, []);

  // Shift + Mouse Wheel → horizontal scroll (non-passive to allow preventDefault).
  const handleWheel = useCallback((e: WheelEvent) => {
    const el = tableScrollRef.current;
    if (!el || !e.shiftKey) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
  }, []);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Card layout (< lg, i.e. tablet + mobile) ── */}
      <div className="block lg:hidden overflow-hidden rounded-lg border bg-card">
        {loading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="animate-pulse space-y-2 p-3.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <div className="mt-1 flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          defaultError
        ) : data.length === 0 ? (
          defaultEmpty
        ) : renderMobileCard ? (
          <div role="list">
            {/* Keyed by the caller's own row id, the same identity the desktop
                table uses. Without it React warned on every grid in the app —
                this branch renders even on desktop, where CSS hides it. Keying
                by array index would silence the warning while still remapping
                state onto the wrong row after a sort or filter. */}
            {data.map((row) => (
              <Fragment key={rowId(row)}>{renderMobileCard(row, selection)}</Fragment>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Desktop (lg+) ── */}
      <div className="hidden lg:block overflow-hidden rounded-lg border bg-card">
        {/* scrollbar-none hides the native scrollbar; grab-to-scroll + Shift+Wheel handle horizontal navigation */}
        <div ref={tableScrollRef} className="overflow-x-auto scrollbar-none cursor-grab">
          <table className="w-full caption-bottom text-sm">
            {/* Sticky header */}
            <thead className="sticky top-0 z-30 border-b bg-muted/60 backdrop-blur-sm">
              <tr>
                {hasSelection && (
                  <Th pinned style={{ left: 0 }} className="w-10">
                    <input
                      type="checkbox"
                      aria-label={t(($) => $.selection.selectAllRows)}
                      checked={selection.allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selection.someSelected;
                      }}
                      onChange={(e) => selection.selectAll(e.target.checked)}
                      className="size-4 cursor-pointer rounded accent-primary"
                    />
                  </Th>
                )}

                {visibleCols.map((col) => {
                  const isPinned = !!col.pin;
                  const style: CSSProperties =
                    col.pin === 'left'
                      ? { left: leftOf.get(col.key) }
                      : col.pin === 'right'
                        ? { right: rightOf.get(col.key) }
                        : {};

                  const isSorted = sort?.field === col.key;
                  const SortIcon = isSorted
                    ? sort?.direction === 'asc'
                      ? ArrowUp
                      : ArrowDown
                    : ChevronsUpDown;

                  return (
                    <Th
                      key={col.key}
                      pinned={isPinned}
                      style={style}
                      className={cn(col.align && ALIGN[col.align], col.headerClassName)}
                    >
                      {col.sortable && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => onSortChange(col.key)}
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
                            (col.align === 'end' || col.align === 'center') && 'w-full',
                            col.align === 'end' && 'justify-end',
                            col.align === 'center' && 'justify-center',
                          )}
                        >
                          {col.header ?? col.label}
                          <SortIcon className="size-3" />
                        </button>
                      ) : (
                        (col.header ?? col.label)
                      )}
                    </Th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={`skel-${i}`} className="border-b last:border-0">
                    {hasSelection && (
                      <td className="px-3 py-2.5 first:ps-4">
                        <Skeleton className="size-4 rounded" />
                      </td>
                    )}
                    {visibleCols.map((col) => (
                      <td key={col.key} className="px-3 py-2.5 first:ps-4 last:pe-4">
                        <Skeleton className={col.skeletonClassName ?? 'h-4 w-24'} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={colCount} className="p-0">
                    {defaultError}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="p-0">
                    {defaultEmpty}
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const id = rowId(row);
                  const isSelected = selection?.isSelected(id) ?? false;
                  const isFocused = focusedRowId === id;

                  return (
                    <tr
                      key={id}
                      data-focused={isFocused || undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        'group transition-colors hover:bg-accent/40',
                        onRowClick && 'cursor-pointer',
                        isSelected && 'bg-primary/5',
                        isFocused &&
                          'outline outline-1 -outline-offset-1 outline-primary/50 bg-accent/30',
                      )}
                    >
                      {hasSelection && (
                        <Td pinned selected={isSelected} style={{ left: 0 }} className="w-10">
                          <input
                            type="checkbox"
                            aria-label={t(($) => $.selection.selectRow)}
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => selection.selectRow(id, e.target.checked)}
                            className="size-4 cursor-pointer rounded accent-primary"
                          />
                        </Td>
                      )}

                      {visibleCols.map((col) => {
                        const isPinned = !!col.pin;
                        const style: CSSProperties =
                          col.pin === 'left'
                            ? { left: leftOf.get(col.key) }
                            : col.pin === 'right'
                              ? { right: rightOf.get(col.key) }
                              : {};

                        return (
                          <Td
                            key={col.key}
                            pinned={isPinned}
                            selected={isPinned ? isSelected : undefined}
                            style={style}
                            className={cn(col.align && ALIGN[col.align], col.cellClassName)}
                          >
                            {col.cell(row)}
                          </Td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {pagination && !loading ? (
        <div className="mt-3">
          <Pagination meta={pagination.meta} onPageChange={pagination.onPageChange} />
        </div>
      ) : null}
    </>
  );
}
