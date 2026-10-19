import { useTranslation } from 'react-i18next';
import { AlertTriangle, ListOrdered, PlayCircle } from 'lucide-react';

import { useToast } from '@/components/ds/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useBuildQueue, useClaimNext, useQueue } from '../hooks/use-dispatch-ops';
import type { QueueItem } from '../types/dispatch-ops';
import { PriorityBadge, QueueStatusBadge } from './dispatch-status-badges';

function QueueSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/**
 * The dispatch queue for one board.
 *
 * Rank is server-computed and never re-sorted here — the order a dispatcher
 * sees has to be the order the claim endpoint will hand out, or claiming the
 * "top" item stops meaning anything.
 */
export function DispatchQueuePanel({
  boardId,
  sessionId,
  onSelectItem,
}: {
  boardId: string | null;
  sessionId: string | null;
  onSelectItem: (item: QueueItem) => void;
}) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const { data: items, isLoading } = useQueue(boardId);
  const build = useBuildQueue();
  const claimNext = useClaimNext();

  if (boardId === null) {
    return (
      <div className="rounded-lg border bg-card py-16 text-center">
        <ListOrdered className="mx-auto mb-3 size-10 text-muted-foreground/20" />
        <p className="text-sm font-medium">{t($ => $.dispatch.queue.pickBoardTitle)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t($ => $.dispatch.queue.pickBoardHint)}</p>
      </div>
    );
  }

  if (isLoading) return <QueueSkeleton />;

  const rows = items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={build.isPending}
          onClick={() =>
            build.mutate(boardId, {
              onSuccess: (r) =>
                toast({
                  title:
                    r.added === 0
                      ? t($ => $.dispatch.toast.queueNothingNew)
                      : t($ => $.dispatch.toast.queueBuilt, { count: r.added }),
                }),
              onError: () =>
                toast({ title: t($ => $.dispatch.toast.queueBuildFailed), variant: 'destructive' }),
            })
          }
        >
          {t($ => $.dispatch.queue.build)}
        </Button>

        <Button
          size="sm"
          className="h-8 text-xs"
          // Claiming needs an open session — that is where the lock is held.
          disabled={sessionId === null || claimNext.isPending}
          onClick={() =>
            sessionId &&
            claimNext.mutate(sessionId, {
              onSuccess: (item) =>
                item === null ? toast({ title: t($ => $.dispatch.toast.queueEmpty) }) : onSelectItem(item),
              onError: () =>
                toast({ title: t($ => $.dispatch.toast.claimFailed), variant: 'destructive' }),
            })
          }
        >
          <PlayCircle className="me-1 size-3.5" />
          {t($ => $.dispatch.queue.claimNext)}
        </Button>

        {sessionId === null && (
          <span className="text-xs text-muted-foreground">
            {t($ => $.dispatch.queue.openSessionHint)}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center">
          <ListOrdered className="mx-auto mb-3 size-10 text-muted-foreground/20" />
          <p className="text-sm font-medium">{t($ => $.dispatch.queue.emptyTitle)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t($ => $.dispatch.queue.emptyHint)}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <th className="h-10 w-12 px-3 text-end font-medium">#</th>
                <th className="h-10 px-3 font-medium">{t($ => $.dispatch.queue.colTrip)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.common.status)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.common.priority)}</th>
                <th className="h-10 px-3 text-end font-medium">{t($ => $.dispatch.queue.colWaiting)}</th>
                <th className="h-10 px-3 text-end font-medium">{t($ => $.dispatch.queue.colAttempts)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.dispatch.queue.colClaimedBy)}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item, index) => (
                <tr
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onSelectItem(item)}
                >
                  <td className="px-3 py-2.5 text-end tabular-nums text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{item.trip_number ?? '—'}</span>
                      {/* Repeated failure needs a human, not another retry. */}
                      {item.is_stuck && (
                        <AlertTriangle
                          className="size-3.5 text-amber-600"
                          aria-label={t($ => $.dispatch.queue.repeatedlyFailed)}
                        />
                      )}
                    </div>
                    {item.last_failure_reason && (
                      <div className="text-xs text-muted-foreground">
                        {item.last_failure_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <QueueStatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <PriorityBadge priority={item.priority} />
                    {item.priority_reason && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {item.priority_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">
                    {t($ => $.dispatch.units.minutes, { value: item.waiting_minutes })}
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{item.attempt_count}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {item.claimed_by ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
