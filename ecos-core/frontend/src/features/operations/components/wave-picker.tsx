import { Waves } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePreparationWaves } from '../hooks/use-preparation';
import { useWaveStatusLabels, WAVE_STATUS_COLORS } from '../hooks/use-operations-labels';

type Props = {
  className?: string;
  showBadge?: boolean;
};

/** Reads/writes ?wave_id= in the current URL. Drop into any toolbar. */
export function WavePicker({ className, showBadge = true }: Props) {
  const { t } = useTranslation('operations');
  const [searchParams, setSearchParams] = useSearchParams();
  const waveId = searchParams.get('wave_id') ?? '';
  const { waveStatusLabel } = useWaveStatusLabels();

  const { data, isLoading } = usePreparationWaves({ per_page: 50 });
  const waves = data?.data ?? [];

  const selected = waves.find((w) => w.id === waveId);

  function handleChange(id: string) {
    setSearchParams((p) => {
      p.set('wave_id', id);
      return p;
    });
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Waves className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select value={waveId} onValueChange={handleChange}>
        <SelectTrigger className="h-7 text-xs w-52 border-dashed">
          <SelectValue
            placeholder={isLoading ? t($ => $.wave.picker.loading) : t($ => $.wave.picker.placeholder)}
          />
        </SelectTrigger>
        <SelectContent>
          {waves.map((w) => (
            <SelectItem key={w.id} value={w.id} className="text-xs">
              <span className="font-mono font-medium">{w.wave_number}</span>
              <span className="ml-2 text-muted-foreground">
                {new Date(w.planning_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </SelectItem>
          ))}
          {!isLoading && waves.length === 0 && (
            <SelectItem value="__none__" disabled className="text-xs text-muted-foreground">
              {t($ => $.wave.picker.noWaves)}
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {showBadge && selected && (
        <Badge className={`text-[10px] h-5 px-1.5 ${WAVE_STATUS_COLORS[selected.status]}`}>
          {waveStatusLabel[selected.status]}
        </Badge>
      )}
    </div>
  );
}

/** Hook: returns the currently selected wave ID from the URL. */
export function useSelectedWaveId(): string | null {
  const [searchParams] = useSearchParams();
  return searchParams.get('wave_id');
}
