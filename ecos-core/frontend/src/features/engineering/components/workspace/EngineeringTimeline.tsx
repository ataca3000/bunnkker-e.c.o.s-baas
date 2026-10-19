import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkspaceTimeline } from '../../hooks/useWorkspace';
import type { TimelineEvent } from '../../services/workspace-service';

const SOURCE_STYLES: Record<TimelineEvent['source'], string> = {
  repair: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  validation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  guardian: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const FILTERS: Array<{ label: string; value?: string }> = [
  { label: 'All' },
  { label: 'Repairs', value: 'repair' },
  { label: 'Validations', value: 'validation' },
  { label: 'Guardian', value: 'guardian' },
];

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return date.toLocaleString();
}

export function EngineeringTimeline() {
  const [type, setType] = useState<string | undefined>(undefined);
  const { events, loading, error } = useWorkspaceTimeline(type);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter.label}
            variant={type === filter.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setType(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading timeline…</p>}

      {!loading && events.length === 0 && (
        <p className="text-sm text-muted-foreground">No engineering events yet.</p>
      )}

      <ol className="relative border-s border-border ps-6 space-y-4">
        {events.map((event, index) => (
          <li key={`${event.source}-${event.subject_id}-${index}`} className="relative">
            <span className="absolute -start-[1.72rem] top-1.5 h-2.5 w-2.5 rounded-full bg-border" aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={SOURCE_STYLES[event.source]} variant="secondary">
                {event.source}
              </Badge>
              <span className="text-sm font-medium">{event.event_type}</span>
              <span className="text-xs text-muted-foreground">{formatWhen(event.occurred_at)}</span>
            </div>
            {event.data?.reason !== undefined && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{String(event.data.reason)}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
