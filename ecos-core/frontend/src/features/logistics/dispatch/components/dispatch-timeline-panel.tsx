import { useTranslation } from 'react-i18next';
import { AlertTriangle, Circle, Info, XCircle } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { useAuditTrail, useBoardTimeline } from '../hooks/use-dispatch-ops';

const SEVERITY = {
  info: { Icon: Info, className: 'text-muted-foreground' },
  warning: { Icon: AlertTriangle, className: 'text-amber-600' },
  critical: { Icon: XCircle, className: 'text-destructive' },
} as const;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

/**
 * What happened on this board, and who overrode what.
 *
 * Both feeds are append-only on the server — this is a record, not a status.
 */
export function DispatchTimelinePanel({ boardId }: { boardId: string | null }) {
  const { t } = useTranslation('logistics');
  const { data: events, isLoading } = useBoardTimeline(boardId);
  const { data: audit } = useAuditTrail(true);

  return (
    <div className="space-y-4">
      <Panel title={t($ => $.dispatch.timeline.boardTitle)}>
        {boardId === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t($ => $.dispatch.timeline.pickBoard)}
          </p>
        ) : isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !events || events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t($ => $.dispatch.timeline.empty)}
          </p>
        ) : (
          <ol className="relative space-y-4 border-s ps-5">
            {events.map((event) => {
              const { Icon, className } = SEVERITY[event.severity] ?? SEVERITY.info;

              return (
                <li key={event.id} className="relative">
                  <span className="absolute -start-[27px] top-0.5 rounded-full bg-background p-0.5">
                    <Icon className={`size-3.5 ${className}`} />
                  </span>
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.description && (
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : '—'}
                    {event.actor_name ? ` · ${event.actor_name}` : ''}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <Panel title={t($ => $.dispatch.timeline.overridesTitle)}>
        {!audit || audit.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t($ => $.dispatch.timeline.overridesEmpty)}
          </p>
        ) : (
          <ul className="space-y-2">
            {audit.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 text-xs">
                <Circle className="mt-1 size-2 shrink-0 fill-destructive text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{entry.action}</p>
                  {/* The reason is the point of the record. */}
                  {entry.reason && <p className="text-muted-foreground">{entry.reason}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {entry.performed_at ? new Date(entry.performed_at).toLocaleString() : '—'}
                    {entry.actor_name ? ` · ${entry.actor_name}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
