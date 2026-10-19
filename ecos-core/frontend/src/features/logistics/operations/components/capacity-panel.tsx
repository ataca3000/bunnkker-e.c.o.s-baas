import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ds/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useCapacityMonitoring,
  useConfirmReservation,
  useReleaseReservation,
  useReservations,
} from '../hooks/use-operations';
import { ReservationStatusBadge } from './operations-badges';
import { ReservationDrawer } from './reservation-drawer';

function percent(value: number | null | undefined, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  return `${Math.round(value * 100)}%`;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Reservations and what the network made of them.
 *
 * Every figure here is Network's. Operations asked; the ledger answered; this
 * reports the answer.
 */
export function CapacityPanel() {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const { data, isLoading } = useReservations();
  const { data: monitoring } = useCapacityMonitoring();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const confirm = useConfirmReservation();
  const release = useReleaseReservation();

  const rows = data?.data ?? [];
  const refusals = monitoring?.refusal_reasons ?? [];
  const noData = t($ => $.common.noDataYet);

  return (
    <div className="space-y-4">
      {refusals.length > 0 && (
        <Alert>
          <AlertDescription className="text-xs">
            {/* One refusal is an incident; forty of the same is a plan that
                needs changing. */}
            {t($ => $.operations.capacity.mostCommonRefusal, {
              reason: refusals[0].reason,
              times: refusals[0].count,
            })}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t($ => $.operations.capacity.slotsToday)}>
          <div className="space-y-1.5">
            <Stat
              label={t($ => $.operations.capacity.slots)}
              value={monitoring?.slots.slot_count ?? 0}
            />
            <Stat
              label={t($ => $.operations.capacity.averageUtilisation)}
              value={percent(monitoring?.slots.avg_utilisation, noData)}
            />
            <Stat
              label={t($ => $.operations.capacity.nearCapacity)}
              value={monitoring?.slots.at_warn_threshold ?? 0}
            />
            <Stat
              label={t($ => $.operations.capacity.exhausted)}
              value={monitoring?.slots.exhausted ?? 0}
            />
          </div>
        </Panel>

        <Panel title={t($ => $.operations.capacity.ourReservations)}>
          <div className="space-y-1.5">
            <Stat
              label={t($ => $.operations.capacity.requested)}
              value={monitoring?.reservations.requested ?? 0}
            />
            <Stat
              label={t($ => $.operations.capacity.currentlyHolding)}
              value={monitoring?.reservations.currently_holding ?? 0}
            />
            <Stat
              label={t($ => $.operations.capacity.confirmed)}
              value={monitoring?.reservations.confirmed ?? 0}
            />
            <Stat
              label={t($ => $.operations.capacity.refused)}
              value={monitoring?.reservations.refused ?? 0}
            />
            {/* Null, not zero, when nothing was asked. */}
            <Stat
              label={t($ => $.operations.capacity.refusalRate)}
              value={percent(monitoring?.reservations.refusal_rate, noData)}
            />
            <Stat
              label={t($ => $.operations.capacity.rebalanced)}
              value={monitoring?.reservations.rebalanced ?? 0}
            />
          </div>
        </Panel>
      </div>

      <Panel title={t($ => $.operations.capacity.reservationsTitle, { total: data?.meta.total ?? 0 })}>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t($ => $.operations.capacity.empty)}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="h-9 pe-3 font-medium">{t($ => $.operations.capacity.colPurpose)}</th>
                  <th className="h-9 px-3 font-medium">{t($ => $.common.status)}</th>
                  <th className="h-9 px-3 font-medium">{t($ => $.operations.capacity.colLedger)}</th>
                  <th className="h-9 px-3 text-end font-medium">
                    {t($ => $.operations.capacity.colOrders)}
                  </th>
                  <th className="h-9 px-3 font-medium">{t($ => $.operations.capacity.colWindow)}</th>
                  <th className="h-9 px-3 font-medium">{t($ => $.common.actions)}</th>
                  <th className="h-9 w-8 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-muted/40">
                    <td className="py-2.5 pe-3">
                      <div className="font-medium">{reservation.purpose ?? t($ => $.common.na)}</div>
                      {reservation.failure_reason && (
                        // Network's own words, kept whole.
                        <div className="text-xs text-destructive">
                          {reservation.failure_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <ReservationStatusBadge status={reservation.status} />
                    </td>
                    <td className="px-3 py-2.5 text-xs capitalize text-muted-foreground">
                      {reservation.ledger_status ?? t($ => $.common.na)}
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums">
                      {reservation.requested.orders}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {reservation.slot?.window_start ?? t($ => $.common.na)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {reservation.status === 'held' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            disabled={confirm.isPending}
                            onClick={() =>
                              confirm.mutate(reservation.id, {
                                onSuccess: () =>
                                  toast({ title: t($ => $.operations.capacity.toast.confirmed) }),
                                onError: () =>
                                  toast({
                                    title: t($ => $.operations.capacity.toast.confirmFailed),
                                    variant: 'destructive',
                                  }),
                              })
                            }
                          >
                            {t($ => $.common.confirm)}
                          </Button>
                        )}
                        {reservation.holds_capacity && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            disabled={release.isPending}
                            onClick={() => {
                              setSelectedId(reservation.id);
                              setDrawerOpen(true);
                            }}
                          >
                            {t($ => $.operations.capacity.manage)}
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <button
                        type="button"
                        aria-label={t($ => $.common.viewDetails)}
                        onClick={() => {
                          setSelectedId(reservation.id);
                          setDrawerOpen(true);
                        }}
                      >
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ReservationDrawer
        reservationId={selectedId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
