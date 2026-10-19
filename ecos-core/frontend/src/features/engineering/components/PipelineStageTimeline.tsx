import { CheckCircle2, Circle, Loader2, XCircle, SkipForward, RotateCcw, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ORDERED_STAGES } from '../types/engineering';
import type { PipelineLog, StageStatus } from '../types/engineering';

const STATUS_CONFIG: Record<StageStatus, {
  icon: React.ReactNode;
  color: string;
  bg: string;
  label: string;
}> = {
  pending:   { icon: <Circle className="h-4 w-4" />,        color: 'text-muted-foreground', bg: 'bg-muted/40',      label: 'Pending' },
  running:   { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-600', bg: 'bg-blue-50',   label: 'Running' },
  success:   { icon: <CheckCircle2 className="h-4 w-4" />,  color: 'text-green-600',        bg: 'bg-green-50',      label: 'Success' },
  failed:    { icon: <XCircle className="h-4 w-4" />,       color: 'text-red-600',          bg: 'bg-red-50',        label: 'Failed' },
  retrying:  { icon: <RotateCcw className="h-4 w-4 animate-spin" />, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Retrying' },
  skipped:   { icon: <SkipForward className="h-4 w-4" />,   color: 'text-muted-foreground', bg: 'bg-muted/20',      label: 'Skipped' },
  cancelled: { icon: <Ban className="h-4 w-4" />,           color: 'text-muted-foreground', bg: 'bg-muted/20',      label: 'Cancelled' },
};

interface Props {
  logs: PipelineLog[];
  currentStage: string | null;
  compact?: boolean;
}

export function PipelineStageTimeline({ logs, currentStage, compact = false }: Props) {
  const sorted = [...logs].sort(
    (a, b) => ORDERED_STAGES.indexOf(a.stage) - ORDERED_STAGES.indexOf(b.stage),
  );

  return (
    <div className="flex flex-col gap-0">
      {sorted.map((log, idx) => {
        const cfg = STATUS_CONFIG[log.status];
        const isLast = idx === sorted.length - 1;
        const isCurrent = log.stage === currentStage;

        return (
          <div key={log.id} className="flex gap-3">
            {/* Connector column */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                cfg.bg,
                cfg.color,
                isCurrent && 'ring-2 ring-blue-400 ring-offset-1',
              )}>
                {cfg.icon}
              </div>
              {!isLast && (
                <div className={cn(
                  'w-px flex-1 mt-1',
                  log.status === 'success' ? 'bg-green-200' : 'bg-border'
                )} style={{ minHeight: compact ? '12px' : '20px' }} />
              )}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-1', isLast ? 'pb-0' : '', compact ? 'mb-1' : 'mb-2')}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-blue-600' : cfg.color,
                    log.status === 'success' && 'text-foreground',
                  )}>
                    {log.stage_label}
                  </span>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded', cfg.bg, cfg.color)}>
                    {cfg.label}
                  </span>
                  {log.retry_count > 0 && (
                    <span className="text-xs text-amber-600">retry #{log.retry_count}</span>
                  )}
                </div>
                {log.duration_seconds != null && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {log.duration_seconds}s
                  </span>
                )}
              </div>

              {!compact && log.message && (
                <p className="mt-1 text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap line-clamp-3">
                  {log.message}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
