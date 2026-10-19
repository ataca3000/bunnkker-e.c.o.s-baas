import { cn } from '@/lib/utils';
import type { WorkspaceMetric } from '../types';
import { WorkspaceMetricCard } from './workspace-metric-card';

type Props = {
  metrics: WorkspaceMetric[];
  className?: string;
};

const GRID_COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
};

export function WorkspaceMetricsRow({ metrics, className }: Props) {
  if (metrics.length === 0) return null;
  const count = Math.min(metrics.length, 4);
  const colClass = GRID_COLS[count] ?? 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div
      className={cn(
        'flex gap-3 overflow-x-auto pb-1',
        'sm:grid sm:overflow-visible sm:pb-0',
        colClass,
        className,
      )}
    >
      {metrics.map((metric) => (
        <div key={metric.id} className="min-w-[11rem] shrink-0 sm:min-w-0">
          <WorkspaceMetricCard {...metric} />
        </div>
      ))}
    </div>
  );
}
