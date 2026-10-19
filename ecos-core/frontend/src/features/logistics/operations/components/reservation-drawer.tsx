import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { useToast } from '@/components/ds/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useRebalanceCandidates,
  useRebalanceReservation,
  useReleaseReservation,
  useReservationAudit,
  useReservations,
} from '../hooks/use-operations';
import { ReservationStatusBadge } from './operations-badges';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * One reservation: what was asked, what Network said, and where it could move.
 *
 * Rebalance candidates are advisory — nothing is held, so two operators may be
 * shown the same slot. Whichever acts first gets it and the second is refused
 * with a reason, which is the honest behaviour for a shared resource.
 */
export function ReservationDrawer({
  reservationId,
  open,
  onOpenChange,
}: {
  reservationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { data: page } = useReservations();
  const { data: audit, isLoading } = useReservationAudit(reservationId);
  const { data: candidates } = useRebalanceCandidates(reservationId);
  const [reason, setReason] = useState('');

  const release = useReleaseReservation();
  const rebalance = useRebalanceReservation();

  const reservation = (page?.data ?? []).find((r) => r.id === reservationId) ?? null;

  if (reservationId === null) return null;

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={reservation?.purpose ?? 'Reservation'}
      description="What was asked, and what Network answered"
      size="2xl"
    >
      {!reservation ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <ReservationStatusBadge status={reservation.status} />
            {reservation.was_rebalanced && (
              <span className="text-xs text-muted-foreground">Moved from another slot</span>
            )}
          </div>

          {reservation.failure_reason && (
            <Alert variant="destructive">
              {/* Network's own words. Never paraphrased. */}
              <AlertDescription className="text-xs">
                {reservation.failure_reason}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Orders asked">{reservation.requested.orders}</Field>
            <Field label="Stops asked">{reservation.requested.stops}</Field>
            <Field label="Weight asked">{reservation.requested.weight_kg} kg</Field>
            <Field label="Volume asked">{reservation.requested.volume_m3} m³</Field>
            <Field label="Ledger status">{reservation.ledger_status ?? '—'}</Field>
            <Field label="Slot utilisation">
              {reservation.slot?.utilisation !== null && reservation.slot?.utilisation !== undefined
                ? `${Math.round(reservation.slot.utilisation * 100)}%`
                : 'No data yet'}
            </Field>
            <Field label="Requested at">
              {reservation.requested_at ? new Date(reservation.requested_at).toLocaleString() : '—'}
            </Field>
            <Field label="Confirmed at">
              {reservation.confirmed_at ? new Date(reservation.confirmed_at).toLocaleString() : '—'}
            </Field>
          </div>

          {reservation.holds_capacity && (
            <>
              <Separator />

              <div className="space-y-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason"
                  className="h-8 max-w-sm text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  // A confirmed release needs a reason; the server enforces it too.
                  disabled={
                    (reservation.status === 'confirmed' && reason.trim().length === 0) ||
                    release.isPending
                  }
                  onClick={() =>
                    release.mutate(
                      { id: reservation.id, reason: reason.trim() || undefined },
                      {
                        onSuccess: () => {
                          toast({ title: 'Capacity given back.' });
                          onOpenChange(false);
                        },
                        onError: () =>
                          toast({ title: 'That could not be released.', variant: 'destructive' }),
                      },
                    )
                  }
                >
                  Release
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Move to another slot</h4>
                {!candidates || candidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No other slot in this area can take it.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {candidates.map((candidate) => (
                      <li
                        key={candidate.slot_id}
                        className="flex items-center justify-between rounded-md border p-2 text-xs"
                      >
                        <span>
                          {candidate.window_start ?? '—'} – {candidate.window_end ?? '—'}
                          <span className="ml-2 text-muted-foreground">
                            {candidate.utilisation !== null
                              ? `${Math.round(candidate.utilisation * 100)}% full`
                              : 'empty'}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={rebalance.isPending}
                          onClick={() =>
                            rebalance.mutate(
                              {
                                id: reservation.id,
                                destinationSlotId: candidate.slot_id,
                                reason: reason.trim() || undefined,
                              },
                              {
                                onSuccess: () =>
                                  toast({
                                    title: 'Moved. The new hold is unconfirmed.',
                                  }),
                                onError: () =>
                                  toast({
                                    title: 'The move was refused; nothing changed.',
                                    variant: 'destructive',
                                  }),
                              },
                            )
                          }
                        >
                          <ArrowRightLeft className="mr-1 size-3" />
                          Move
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Audit trail</h4>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !audit || audit.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing recorded.</p>
            ) : (
              // Oldest first: a reservation only reads in the order it happened.
              <ol className="space-y-1.5">
                {audit.map((entry) => (
                  <li key={entry.id} className="rounded-md border p-2 text-xs">
                    <span className="font-medium capitalize">{entry.action}</span>
                    {entry.outcome && (
                      <span className="text-muted-foreground"> — {entry.outcome}</span>
                    )}
                    {entry.reason && <p className="text-muted-foreground">{entry.reason}</p>}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {entry.performed_at ? new Date(entry.performed_at).toLocaleString() : '—'}
                      {entry.actor_name ? ` · ${entry.actor_name}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </PageDrawer>
  );
}
