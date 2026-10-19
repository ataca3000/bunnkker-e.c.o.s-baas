import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock } from 'lucide-react';

import { useToast } from '@/components/ds/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useBreakLock,
  useCloseSession,
  useHeldLocks,
  useSessions,
} from '../hooks/use-dispatch-ops';
import { SessionStatusBadge } from './dispatch-status-badges';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function HeldLocks() {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const { data: locks } = useHeldLocks();
  const [breaking, setBreaking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const breakLock = useBreakLock();

  if (!locks || locks.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t($ => $.dispatch.locks.empty)}</p>
    );
  }

  return (
    <div className="space-y-2">
      {locks.map((lock) => (
        <div key={lock.id} className="rounded-md border p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Lock className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{lock.resource}</span>
              <span className="text-muted-foreground">
                {t($ => $.dispatch.locks.heldBy, { name: lock.held_by ?? t($ => $.common.unknown) })}
              </span>
              {!lock.is_effective && (
                <Badge variant="outline" className="text-[10px]">
                  {t($ => $.dispatch.locks.lapsed)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Every lock expires on its own; the countdown is the safety net
                  that keeps a crashed session from freezing a vehicle. */}
              <span className="tabular-nums text-xs text-muted-foreground">
                {t($ => $.dispatch.locks.minutesLeft, {
                  value: Math.max(0, Math.round(lock.remaining_seconds / 60)),
                })}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setBreaking(breaking === lock.id ? null : lock.id)}
              >
                <Unlock className="me-1 size-3.5" />
                {t($ => $.dispatch.locks.break)}
              </Button>
            </div>
          </div>

          {breaking === lock.id && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t($ => $.dispatch.locks.reasonPlaceholder)}
                className="h-8 max-w-xs text-xs"
              />
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs"
                // Taking a resource from a colleague mid-decision is always audited.
                disabled={reason.trim().length === 0 || breakLock.isPending}
                onClick={() =>
                  breakLock.mutate(
                    { id: lock.id, reason: reason.trim() },
                    {
                      onSuccess: () => {
                        toast({ title: t($ => $.dispatch.toast.lockBroken) });
                        setBreaking(null);
                        setReason('');
                      },
                      onError: () =>
                        toast({
                          title: t($ => $.dispatch.toast.lockBreakFailed),
                          variant: 'destructive',
                        }),
                    },
                  )
                }
              >
                {t($ => $.common.confirm)}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function DispatchSessionsPanel({ activeSessionId }: { activeSessionId: string | null }) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const { data, isLoading } = useSessions();
  const close = useCloseSession();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const sessions = data?.data ?? [];

  return (
    <div className="space-y-4">
      <Panel title={t($ => $.dispatch.sessions.title)}>
        {sessions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t($ => $.dispatch.sessions.empty)}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-start text-muted-foreground">
                  <th className="py-1.5 font-normal">{t($ => $.dispatch.sessions.colOperator)}</th>
                  <th className="py-1.5 font-normal">{t($ => $.common.status)}</th>
                  <th className="py-1.5 font-normal">{t($ => $.dispatch.sessions.colMode)}</th>
                  <th className="py-1.5 text-end font-normal">{t($ => $.common.assigned)}</th>
                  <th className="py-1.5 text-end font-normal">{t($ => $.dispatch.sessions.colReleased)}</th>
                  <th className="py-1.5 text-end font-normal">
                    {t($ => $.dispatch.sessions.colConflicts)}
                  </th>
                  <th className="py-1.5 text-end font-normal">
                    {t($ => $.dispatch.sessions.colDuration)}
                  </th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.map((session) => (
                  <tr key={session.id} className={session.id === activeSessionId ? 'bg-muted/40' : ''}>
                    <td className="py-2">
                      {session.operator_name ?? '—'}
                      {/* An idle open session is holding locks nobody is using. */}
                      {session.is_idle && (
                        <Badge variant="outline" className="ms-1.5 border-amber-500 text-[10px]">
                          {t($ => $.dispatch.sessions.idle)}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2">
                      <SessionStatusBadge status={session.status} />
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {t($ => $.dispatch.sessions.mode[session.mode])}
                    </td>
                    <td className="py-2 text-end tabular-nums">{session.assigned_count}</td>
                    <td className="py-2 text-end tabular-nums">{session.released_count}</td>
                    <td className="py-2 text-end tabular-nums">{session.conflict_count}</td>
                    <td className="py-2 text-end tabular-nums text-muted-foreground">
                      {session.duration_minutes !== null
                        ? t($ => $.dispatch.units.minutesShort, { value: session.duration_minutes })
                        : '—'}
                    </td>
                    <td className="py-2 text-end">
                      {session.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={close.isPending}
                          onClick={() =>
                            close.mutate(
                              { id: session.id },
                              {
                                onSuccess: () =>
                                  toast({ title: t($ => $.dispatch.toast.sessionClosedLocksReleased) }),
                                onError: () =>
                                  toast({
                                    title: t($ => $.dispatch.toast.sessionCloseFailed),
                                    variant: 'destructive',
                                  }),
                              },
                            )
                          }
                        >
                          {t($ => $.common.close)}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={t($ => $.dispatch.locks.title)}>
        <HeldLocks />
      </Panel>
    </div>
  );
}
