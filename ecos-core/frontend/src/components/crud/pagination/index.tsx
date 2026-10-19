import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/components/crud/types';
import { useLanguage } from '@/providers/language-context';

type PaginationProps = {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
};

export function Pagination({ meta, onPageChange }: PaginationProps) {
  const { t } = useTranslation('common');
  const { page, total, lastPage } = meta;
  const canPrevious = page > 1;
  const canNext = page < lastPage;
  const { dir } = useLanguage();
  const PrevIcon = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = dir === 'rtl' ? ChevronLeft  : ChevronRight;

  return (
    <div className="text-muted-foreground flex flex-col items-center justify-between gap-2 text-sm sm:flex-row">
      <span>
        {total === 0
          ? t($ => $.pagination.noResults)
          : t($ => $.pagination.pageOf, { page, lastPage: Math.max(lastPage, 1), total })}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          <PrevIcon className="size-4" aria-hidden />
          {t($ => $.pagination.previous)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
        >
          {t($ => $.pagination.next)}
          <NextIcon className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
