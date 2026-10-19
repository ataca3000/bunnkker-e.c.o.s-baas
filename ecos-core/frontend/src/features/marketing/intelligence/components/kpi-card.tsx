import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label:   string;
  value:   string | null;
  growth?: number | null;
  sub?:    string;
  accent?: 'default' | 'green' | 'red' | 'yellow' | 'blue';
}

export function KpiCard({ label, value, growth, sub, accent = 'default' }: KpiCardProps) {
  const valueColor =
    accent === 'green'  ? 'text-green-600 dark:text-green-400' :
    accent === 'red'    ? 'text-red-600 dark:text-red-400' :
    accent === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
    accent === 'blue'   ? 'text-blue-600 dark:text-blue-400' :
    'text-foreground';

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={cn('text-2xl font-semibold tabular-nums leading-tight', valueColor)}>
        {value ?? '—'}
      </p>
      <div className="flex items-center gap-1.5 mt-0.5">
        {growth != null && (
          <GrowthBadge pct={growth} />
        )}
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function GrowthBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium',
      positive ? 'text-green-600' : 'text-red-600',
    )}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted mb-2" />
      <div className="h-7 w-16 rounded bg-muted mb-1" />
      <div className="h-3 w-12 rounded bg-muted" />
    </div>
  );
}
