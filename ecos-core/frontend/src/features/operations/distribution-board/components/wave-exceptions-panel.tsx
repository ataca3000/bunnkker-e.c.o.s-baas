import { AlertCircle, ArrowRightCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWaveExceptions } from '../hooks/use-distribution-board';

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
}

const REASON_LABELS: Record<string, string> = {
  supervisor_return: 'Supervisor Return',
  zone_mismatch:     'Zone Mismatch',
  outlier:           'Geographic Outlier',
  capacity_exceeded: 'Capacity Exceeded',
  other:             'Other',
};

export function WaveExceptionsPanel() {
  const { data, isLoading } = useWaveExceptions();

  const exceptions = data?.exceptions ?? [];
  const count = data?.count ?? 0;

  if (!isLoading && count === 0) return null;

  return (
    <div className="border-t bg-amber-50/50 dark:bg-amber-950/10">
      <div className="px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Wave Exceptions
          </span>
          {count > 0 && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-xs bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
            >
              {count}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Orders returned to the wave — need reassignment</p>
      </div>

      {isLoading ? (
        <div className="px-4 pb-3 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-40 rounded-md" />
          ))}
        </div>
      ) : (
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          {exceptions.map((ex) => (
            <div
              key={ex.id}
              className="flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-background text-xs"
            >
              <span className="font-mono font-semibold text-primary">#{ex.order_number}</span>
              <span className="text-muted-foreground">{ex.city_name}</span>
              {ex.from_trip_number && (
                <div className="flex items-center gap-0.5 text-muted-foreground/70">
                  <ArrowRightCircle className="h-3 w-3" />
                  <span>{ex.from_trip_number}</span>
                </div>
              )}
              <span className="text-muted-foreground/60">{formatTime(ex.returned_at)}</span>
              <span className="text-amber-600 dark:text-amber-400">
                {REASON_LABELS[ex.reason] ?? ex.reason}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
