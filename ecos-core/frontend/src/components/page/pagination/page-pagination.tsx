import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-context';

type PagePaginationProps = {
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  perPageOptions?: number[];
  isLoading?: boolean;
  className?: string;
};

function getPageNumbers(current: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const result: (number | '…')[] = [1];
  if (current > 3) result.push('…');

  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);
  for (let p = start; p <= end; p++) result.push(p);

  if (current < last - 2) result.push('…');
  result.push(last);

  return result;
}

/**
 * Enhanced pagination with page number buttons, total count, and per-page selector.
 *
 * Responsive:
 *   Mobile  — prev/next + "X / Y" count, no page numbers
 *   Desktop — numbered pages + "Showing X–Y of Z" + optional per-page selector
 *
 * Usage:
 *   <PagePagination
 *     page={page} perPage={perPage} total={meta.total} lastPage={meta.lastPage}
 *     onPageChange={setPage}
 *     onPerPageChange={setPerPage}  // optional
 *   />
 */
export function PagePagination({
  page,
  perPage,
  total,
  lastPage,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 20, 50, 100],
  isLoading = false,
  className,
}: PagePaginationProps) {
  const { t } = useTranslation('common');
  const canPrev = page > 1;
  const canNext = page < lastPage;
  const pages = getPageNumbers(page, Math.max(lastPage, 1));
  const { dir } = useLanguage();
  const PrevIcon = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = dir === 'rtl' ? ChevronLeft  : ChevronRight;

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 sm:flex-row sm:justify-between',
        className,
      )}
    >
      {/* Left: count summary (desktop) */}
      <p className="order-2 whitespace-nowrap text-xs text-muted-foreground sm:order-1">
        {total === 0
          ? t($ => $.pagination.noResults)
          : t($ => $.pagination.showing, {
              from: from.toLocaleString(),
              to: to.toLocaleString(),
              total: total.toLocaleString(),
            })}
        {isLoading ? ` · ${t($ => $.loading)}` : ''}
      </p>

      {/* Center: page buttons */}
      <div className="order-1 flex items-center gap-1 sm:order-2">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev || isLoading}
          aria-label={t($ => $.pagination.previousPage)}
        >
          <PrevIcon className="size-4" aria-hidden />
        </Button>

        {/* Desktop: numbered pages */}
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="icon"
                className="size-8 text-xs"
                onClick={() => onPageChange(p)}
                disabled={isLoading}
                aria-label={t($ => $.pagination.pageNumber, { page: p })}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </Button>
            ),
          )}
        </div>

        {/* Mobile: X / Y label */}
        <span className="whitespace-nowrap px-2 text-xs text-muted-foreground sm:hidden">
          {page} / {Math.max(lastPage, 1)}
        </span>

        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext || isLoading}
          aria-label={t($ => $.pagination.nextPage)}
        >
          <NextIcon className="size-4" aria-hidden />
        </Button>
      </div>

      {/* Right: per-page selector */}
      <div className="order-3 flex items-center gap-1.5">
        {onPerPageChange ? (
          <>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {t($ => $.pagination.rows)}
            </span>
            <select
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t($ => $.pagination.rowsPerPage)}
            >
              {perPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </>
        ) : (
          // Spacer keeps layout symmetric on desktop when no per-page control
          <div className="hidden sm:block" aria-hidden />
        )}
      </div>
    </div>
  );
}
