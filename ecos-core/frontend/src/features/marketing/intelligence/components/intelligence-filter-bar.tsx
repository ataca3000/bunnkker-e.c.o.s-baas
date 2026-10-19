import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IntelligenceFilters } from '../../types/intelligence';

const DATE_PRESETS = [
  'today',
  'yesterday',
  'last_7d',
  'last_30d',
  'last_90d',
  'last_180d',
  'this_month',
  'last_month',
] as const;

interface Props {
  filters:         IntelligenceFilters;
  onFilterChange:  (patch: Partial<IntelligenceFilters>) => void;
  onRefresh?:      () => void;
  isFetching?:     boolean;
  /** Extra controls rendered after the date picker */
  children?:       React.ReactNode;
}

export function IntelligenceFilterBar({
  filters,
  onFilterChange,
  onRefresh,
  isFetching,
  children,
}: Props) {
  const { t } = useTranslation('marketing');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.date_preset ?? 'last_30d'}
        onValueChange={(v) => onFilterChange({ date_preset: v, date_start: undefined, date_stop: undefined })}
      >
        <SelectTrigger className="w-36 h-8 text-sm">
          <SelectValue placeholder={t($ => $.intelligence.filters.dateRange)} />
        </SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>{t($ => $.intelligence.datePreset[p])}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {children}

      {onRefresh && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}
