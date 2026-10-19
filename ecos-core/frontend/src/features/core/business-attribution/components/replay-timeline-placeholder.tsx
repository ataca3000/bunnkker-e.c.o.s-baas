import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface TimelineEvent {
  id: string;
  event_name: string;
  occurred_at: string;
  entity_type?: string;
}

interface Props {
  events?: TimelineEvent[];
  isLoading?: boolean;
}

/**
 * PATCH-CORE-001 — Replay Timeline Placeholder.
 * Renders a skeleton timeline. Will be replaced by the full
 * EnhancedReplayService-backed interactive timeline in a future sprint.
 */
export function ReplayTimelinePlaceholder({ events = [], isLoading = false }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="h-3 w-3 rounded-full bg-muted mt-1 shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-muted rounded w-1/2" />
              <div className="h-2 bg-muted rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Clock className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No replay events available</p>
        <Badge variant="secondary" className="text-[10px]">Replay Engine Ready</Badge>
      </div>
    );
  }

  return (
    <ol className="relative border-l border-border ml-2 space-y-3">
      {events.map((ev, idx) => (
        <li key={ev.id} className="ml-4">
          <span className={`absolute -left-[5px] flex h-2.5 w-2.5 items-center justify-center rounded-full ${
            idx === 0 ? 'bg-primary' : 'bg-muted-foreground/40'
          }`} />
          <p className="text-xs font-medium leading-none">{ev.event_name}</p>
          <time className="text-[10px] text-muted-foreground">
            {new Date(ev.occurred_at).toLocaleString()}
          </time>
          {ev.entity_type && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5 mt-0.5">
              {ev.entity_type}
            </Badge>
          )}
        </li>
      ))}
    </ol>
  );
}
