import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import {
  useDisputeSettlement,
  useFinalizeSettlement,
  useOpenSettlement,
  useReconcileSettlement,
  useSubmitDriverCash,
  useTripFinancialSummary,
  useTripSettlement,
} from '../hooks/use-trip-settlement';
import type { SettlementStatus } from '../types/trip-settlement';

type LogisticsLabel = ($: typeof enLogistics) => string;

const STATUS_LABEL: Record<SettlementStatus, LogisticsLabel> = {
  draft: ($) => $.trips.settlement.status.draft,
  submitted: ($) => $.trips.settlement.status.submitted,
  reconciled: ($) => $.trips.settlement.status.reconciled,
  disputed: ($) => $.trips.settlement.status.disputed,
  finalized: ($) => $.trips.settlement.status.finalized,
};

const STATUS_CLASS: Record<SettlementStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  reconciled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  disputed: 'bg-destructive/10 text-destructive',
  finalized: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/**
 * Settlement — lifecycle, driver cash, reconciliation, disputes and approval.
 *
 * Every figure shown is computed by the backend from the payment ledger. The
 * discrepancy in particular is the domain's, not a subtraction done here: the
 * settlement decides what counts toward cash expected, and re-deriving it in
 * the browser would produce a second number that disagrees under the exact
 * conditions that matter.
 */
export function TripSettlementTab({ tripId }: { tripId: string }) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  const canWrite = can('logistics.distribution.update');

  const { data: settlement, isLoading } = useTripSettlement(tripId);
  const { data: summary } = useTripFinancialSummary(tripId);

  const open = useOpenSettlement(tripId);
  const submitCash = useSubmitDriverCash(tripId);
  const reconcile = useReconcileSettlement(tripId);
  const dispute = useDisputeSettlement(tripId);
  const finalize = useFinalizeSettlement(tripId);

  const [cash, setCash] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const money = (value: number | null | undefined) =>
    value === null || value === undefined
      ? t(($) => $.trips.settlement.settlement.notSubmitted)
      : new Intl.NumberFormat(i18n.language).format(value);
  const dateTime = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';

  async function run(action: () => Promise<unknown>, failure: LogisticsLabel) {
    setError(null);
    try {
      await action();
      setNotes('');
    } catch {
      // The domain refuses illegal transitions with a 422 and a reason; showing
      // the refusal is the point.
      setError(t(failure));
    }
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  // No settlement yet is a normal state, not a failure.
  if (!settlement) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {t(($) => $.trips.settlement.settlement.notOpened)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {t(($) => $.trips.settlement.settlement.notOpenedHint)}
        </p>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {summary && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label={t(($) => $.trips.settlement.settlement.totalCollected)}
              value={money(summary.total_collected)}
            />
            <Stat
              label={t(($) => $.trips.settlement.settlement.cashExpected)}
              value={money(summary.cash_expected)}
            />
            <Stat
              label={t(($) => $.trips.settlement.summary.stopsOutstanding)}
              value={summary.stops_outstanding}
            />
          </div>
        )}

        {canWrite && (
          <Button
            size="sm"
            className="self-start"
            disabled={open.isPending}
            onClick={() =>
              void run(() => open.mutateAsync(), ($) => $.trips.settlement.settlement.openFailed)
            }
          >
            {t(($) => $.trips.settlement.settlement.open)}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{t(($) => $.trips.settlement.settlement.title)}</h3>
        <Badge variant="secondary" className={STATUS_CLASS[settlement.status]}>
          {t(STATUS_LABEL[settlement.status])}
        </Badge>
        {settlement.is_final && (
          <Badge variant="outline" className="text-[10px]">
            <Lock className="me-1 h-3 w-3" />
            {t(($) => $.trips.settlement.settlement.final)}
          </Badge>
        )}
        {settlement.is_balanced ? (
          <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="me-1 h-3 w-3" />
            {t(($) => $.trips.settlement.settlement.balanced)}
          </Badge>
        ) : (
          settlement.is_short && (
            <Badge variant="outline" className="text-[10px] text-destructive">
              <AlertTriangle className="me-1 h-3 w-3" />
              {t(($) => $.trips.settlement.settlement.short)}
            </Badge>
          )
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(($) => $.trips.settlement.settlement.totals)}
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label={t(($) => $.trips.settlement.settlement.cashCollected)}
            value={money(settlement.cash_collected)}
          />
          <Stat
            label={t(($) => $.trips.settlement.settlement.bankTransfers)}
            value={money(settlement.bank_transfers_pending)}
          />
          <Stat
            label={t(($) => $.trips.settlement.settlement.alreadyPaid)}
            value={money(settlement.already_paid)}
          />
          <Stat
            label={t(($) => $.trips.settlement.settlement.totalCollected)}
            value={money(settlement.total_collected)}
          />
          <Stat
            label={t(($) => $.trips.settlement.settlement.cashExpected)}
            value={money(settlement.cash_expected)}
          />
          <Stat
            label={t(($) => $.trips.settlement.settlement.driverSubmitted)}
            value={money(settlement.driver_cash_submitted)}
          />
          <Stat
            label={t(($) => $.trips.settlement.settlement.discrepancy)}
            value={money(settlement.discrepancy)}
          />
          {summary && (
            <>
              <Stat
                label={t(($) => $.trips.settlement.summary.stopsTotal)}
                value={summary.stops_total}
              />
              <Stat
                label={t(($) => $.trips.settlement.summary.stopsOutstanding)}
                value={summary.stops_outstanding}
              />
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t(($) => $.trips.settlement.settlement.derivedNote)}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(($) => $.trips.settlement.settlement.timeline)}
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label={t(($) => $.trips.settlement.settlement.submittedAt)}
            value={dateTime(settlement.submitted_at)}
          />
          <Stat
            label={t(($) => $.trips.settlement.settlement.reconciledAt)}
            value={dateTime(settlement.reconciled_at)}
          />
          <Stat
            label={t(($) => $.trips.settlement.settlement.finalizedAt)}
            value={dateTime(settlement.finalized_at)}
          />
        </div>
        {settlement.notes && (
          <p className="rounded-md border bg-muted/30 p-2 text-xs">{settlement.notes}</p>
        )}
      </section>

      {canWrite && !settlement.is_final && (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h4 className="text-sm font-semibold">{t(($) => $.trips.settlement.driver.title)}</h4>
          <p className="text-xs text-muted-foreground">
            {t(($) => $.trips.settlement.driver.submitCashDescription)}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="driver-cash">{t(($) => $.trips.settlement.driver.amount)}</Label>
            <Input
              id="driver-cash"
              type="number"
              min={0}
              step="0.01"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
          </div>

          <Button
            size="sm"
            className="self-start"
            disabled={cash === '' || submitCash.isPending}
            onClick={() =>
              void run(
                () => submitCash.mutateAsync({ driver_cash_submitted: Number(cash) }),
                ($) => $.trips.settlement.driver.submitFailed,
              )
            }
          >
            {t(($) => $.trips.settlement.driver.submit)}
          </Button>

          {settlement.is_short && (
            <p className="text-xs text-destructive">
              {t(($) => $.trips.settlement.driver.shortWarning)}
            </p>
          )}
        </section>
      )}

      {canWrite && !settlement.is_final && (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h4 className="text-sm font-semibold">{t(($) => $.trips.settlement.actions.title)}</h4>

          {settlement.allowed_transitions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t(($) => $.trips.settlement.actions.noTransitions)}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {t(($) => $.trips.settlement.actions.allowed)}:{' '}
              {settlement.allowed_transitions.map((s) => t(STATUS_LABEL[s.value])).join(' · ')}
            </p>
          )}

          <Textarea
            rows={2}
            value={notes}
            maxLength={2000}
            placeholder={t(($) => $.trips.settlement.actions.notesPlaceholder)}
            onChange={(e) => setNotes(e.target.value)}
          />

          <p className="text-[11px] text-muted-foreground">
            {t(($) => $.trips.settlement.actions.finalizeDescription)}
          </p>

          {/* Only the transitions the settlement itself declares are offered. */}
          <div className="flex flex-wrap gap-2">
            {settlement.allowed_transitions.some((s) => s.value === 'reconciled') && (
              <Button
                size="sm"
                variant="secondary"
                disabled={reconcile.isPending}
                onClick={() =>
                  void run(
                    () => reconcile.mutateAsync({ notes: notes.trim() || null }),
                    ($) => $.trips.settlement.actions.reconcileFailed,
                  )
                }
              >
                {t(($) => $.trips.settlement.actions.reconcile)}
              </Button>
            )}

            {settlement.allowed_transitions.some((s) => s.value === 'disputed') && (
              <Button
                size="sm"
                variant="outline"
                disabled={dispute.isPending}
                onClick={() =>
                  void run(
                    () => dispute.mutateAsync({ notes: notes.trim() || null }),
                    ($) => $.trips.settlement.actions.disputeFailed,
                  )
                }
              >
                {t(($) => $.trips.settlement.actions.dispute)}
              </Button>
            )}

            {settlement.allowed_transitions.some((s) => s.value === 'finalized') && (
              <Button
                size="sm"
                disabled={finalize.isPending}
                onClick={() =>
                  void run(
                    () => finalize.mutateAsync(),
                    ($) => $.trips.settlement.actions.finalizeFailed,
                  )
                }
              >
                {t(($) => $.trips.settlement.actions.finalize)}
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Stated rather than omitted: the platform settles a trip with its
          driver, and no carrier-settlement endpoint exists to build against. */}
      <section className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(($) => $.trips.settlement.carrier.title)}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t(($) => $.trips.settlement.carrier.unavailable)}
        </p>
      </section>
    </div>
  );
}
