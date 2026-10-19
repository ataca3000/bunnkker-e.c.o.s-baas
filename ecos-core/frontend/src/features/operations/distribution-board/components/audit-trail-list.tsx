import { Clock } from 'lucide-react';
import type { TripAuditEntry } from '../types/distribution-board';
import { AUDIT_ACTION_LABELS } from '../types/distribution-board';
import { cn } from '@/lib/utils';

interface Props {
  entries: TripAuditEntry[];
}

const ACTION_COLORS: Record<string, string> = {
  loading_completed:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  driver_accepted:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  dispatch_blocked:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  vehicle_dispatched: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
};

export function AuditTrailList({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[1.125rem] top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="flex gap-4">
            {/* Dot */}
            <div className={cn(
              'h-5 w-5 rounded-full border-2 border-background ring-2 mt-0.5 shrink-0 z-10',
              ACTION_COLORS[entry.action]
                ? 'ring-current bg-current'
                : 'ring-muted-foreground/30 bg-muted',
            )} />

            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-md font-medium',
                  ACTION_COLORS[entry.action] ?? 'bg-muted text-muted-foreground',
                )}>
                  {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                {entry.from_status && entry.to_status && (
                  <span className="text-xs text-muted-foreground">
                    {entry.from_status} → {entry.to_status}
                  </span>
                )}
              </div>

              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                {entry.performed_by_name && <span>{entry.performed_by_name}</span>}
                {entry.performed_by_name && <span>·</span>}
                <span>{new Date(entry.performed_at).toLocaleString('en-US')}</span>
              </div>

              {entry.notes && (
                <p className="mt-1 text-sm text-foreground/80">{entry.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
