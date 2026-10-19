import { CheckCircle2, Loader2, Truck } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-EG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateStr));
}
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ActiveWave } from '../types/distribution-board';

interface WaveHeaderProps {
  wave: ActiveWave;
  onFinalize: () => void;
  finalizing: boolean;
  canFinalize: boolean;
}

function KpiPill({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border ${
      highlight
        ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
        : 'bg-muted/50 border-border'
    }`}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function WaveHeader({ wave, onFinalize, finalizing, canFinalize }: WaveHeaderProps) {
  const { money } = useFormatter();
  const { summary } = wave;

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
      {/* Wave identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Truck className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">Wave {wave.wave_number}</span>
            <Badge variant="secondary" className="text-xs capitalize shrink-0">{wave.status.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDate(wave.planning_date)}
          </p>
        </div>
      </div>

      <div className="h-6 w-px bg-border shrink-0" />

      {/* KPI pills */}
      <div className="flex items-center gap-2 flex-wrap flex-1">
        <KpiPill label="Total" value={summary.total_orders} />
        <KpiPill
          label="Unassigned"
          value={summary.unassigned_orders}
          highlight={summary.unassigned_orders > 0}
        />
        <KpiPill label="Trips" value={summary.trip_count} />
        <KpiPill
          label="Collection"
          value={money(summary.total_value)}
        />
      </div>

      {/* Finalize CTA */}
      <Button
        size="sm"
        onClick={onFinalize}
        disabled={!canFinalize || finalizing}
        className="shrink-0 gap-1.5"
      >
        {finalizing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        Finalize Plan
      </Button>
    </div>
  );
}
