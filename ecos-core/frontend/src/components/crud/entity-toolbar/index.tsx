import { useState, type ReactNode, type RefObject } from 'react';
import { Download, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FilterPanel } from '@/components/crud/filter-panel';
import { SearchInput } from '@/components/crud/search-input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EntityToolbarProps = {
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  initialSearch?: string;
  /** Forwarded to the search input — lets pages focus it via Ctrl+K or "/". */
  searchRef?: RefObject<HTMLInputElement | null>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onExport?: () => void;
  /** Filter controls; when provided a "Filters" toggle and panel are shown. */
  filterPanel?: ReactNode;
  onClearFilters?: () => void;
  /** Extra items rendered on the right of the toolbar. */
  children?: ReactNode;
};

/**
 * Reusable list toolbar: search, filters, refresh and export (placeholder).
 */
export function EntityToolbar({
  searchPlaceholder,
  onSearchChange,
  initialSearch,
  searchRef,
  onRefresh,
  isRefreshing = false,
  onExport,
  filterPanel,
  onClearFilters,
  children,
}: EntityToolbarProps) {
  const { t } = useTranslation('common');
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {onSearchChange ? (
          <SearchInput
            ref={searchRef}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            initialValue={initialSearch}
          />
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {children}
          {filterPanel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="size-4" />
              {t($ => $.toolbar.filters)}
            </Button>
          ) : null}
          {onRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
              {t($ => $.toolbar.refresh)}
            </Button>
          ) : null}
          {onExport ? (
            <Button type="button" variant="outline" size="sm" onClick={onExport}>
              <Download className="size-4" />
              {t($ => $.toolbar.export)}
            </Button>
          ) : null}
        </div>
      </div>

      {filterPanel ? (
        <FilterPanel open={filtersOpen} onClear={onClearFilters}>
          {filterPanel}
        </FilterPanel>
      ) : null}
    </div>
  );
}
