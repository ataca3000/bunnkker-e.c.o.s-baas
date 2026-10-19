import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/crud/empty-state';
import { ErrorState } from '@/components/crud/error-state';
import type { ColumnDef, SortState } from '@/components/crud/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type EntityTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  sort?: SortState;
  onSortChange?: (field: string) => void;
  /** Renders the row-actions cell (e.g. an ActionMenu). */
  rowActions?: (row: T) => ReactNode;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  skeletonRows?: number;
  /** Highlights this row with a focus ring — used for keyboard arrow navigation. */
  focusedRowId?: string | null;
};

const ALIGN_CLASS = {
  left: 'text-start',
  center: 'text-center',
  right: 'text-end',
} as const;

/**
 * Generic, responsive data table: sorting, loading skeleton, empty/error
 * states and optional row actions. Holds no business logic — columns and row
 * actions are supplied by the consuming module.
 */
export function EntityTable<T>({
  columns,
  data,
  getRowId,
  isLoading = false,
  isError = false,
  sort,
  onSortChange,
  rowActions,
  emptyState,
  errorState,
  skeletonRows = 5,
  focusedRowId = null,
}: EntityTableProps<T>) {
  const { t } = useTranslation('common');
  const totalColumns = columns.length + (rowActions ? 1 : 0);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
          <TableRow>
            {columns.map((column) => {
              const isSorted = sort?.field === column.key;
              const SortIcon = isSorted
                ? sort?.direction === 'asc'
                  ? ArrowUp
                  : ArrowDown
                : ChevronsUpDown;

              return (
                <TableHead
                  key={column.key}
                  className={cn(column.align && ALIGN_CLASS[column.align], column.headerClassName)}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key)}
                      className="hover:text-foreground inline-flex items-center gap-1.5"
                    >
                      {column.header}
                      <SortIcon className="size-3.5 opacity-70" />
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
            {rowActions ? <TableHead className="w-12 text-end">{t($ => $.table.actions)}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }, (_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`}>
                {Array.from({ length: totalColumns }, (_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={totalColumns} className="p-0">
                {errorState ?? <ErrorState />}
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={totalColumns} className="p-0">
                {emptyState ?? <EmptyState title={t($ => $.table.noRecords)} />}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow
                key={getRowId(row)}
                className={cn(
                  focusedRowId === getRowId(row) && 'outline outline-1 outline-primary/50 bg-accent/30',
                )}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(column.align && ALIGN_CLASS[column.align], column.cellClassName)}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
                {rowActions ? (
                  <TableCell className="text-end">{rowActions(row)}</TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
