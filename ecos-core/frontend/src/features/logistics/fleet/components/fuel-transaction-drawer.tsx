import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

import { EntityDrawer } from '@/components/crud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import {
  useDisputeFuel,
  useFuelTransaction,
  useReconcileFuel,
  useRejectFuel,
  useWriteOffFuel,
} from '../hooks/use-fleet';

type LogisticsLabel = ($: typeof enLogistics) => string;

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

/**
 * One fuel transaction, with the four review outcomes the API offers.
 *
 * Reconcile, dispute, reject and write-off are four distinct decisions, not
 * shades of one. Reconciling accepts the record as correct; disputing contests
 * it with the supplier; rejecting says it should never have been recorded;
 * writing off accepts it and absorbs the cost. Three of the four require a
 * reason, and that reason is the audit trail — so it is required here too
 * rather than defaulted.
 *
 * Only transitions the transaction itself declares are offered. A terminal
 * transaction offers none, which is why the section disappears rather than
 * showing buttons that would be refused.
 */
export function FuelTransactionDrawer({
  transactionId,
  open,
  onOpenChange,
}: {
  transactionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  const canReconcile = can('fleet.fuel.reconcile');

  const { data: tx, isLoading } = useFuelTransaction(open ? transactionId : null);

  const reconcile = useReconcileFuel();
  const dispute = useDisputeFuel();
  const reject = useRejectFuel();
  const writeOff = useWriteOffFuel();

  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const num = (value: number | null) =>
    value === null || value === undefined
      ? '—'
      : new Intl.NumberFormat(i18n.language).format(value);
  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';

  async function run(action: () => Promise<unknown>, failure: LogisticsLabel, needsReason: boolean) {
    if (needsReason && !reason.trim()) {
      setError(t(($) => $.fleet.review.reasonRequired));
      return;
    }
    setError(null);
    try {
      await action();
      setReason('');
    } catch {
      setError(t(failure));
    }
  }

  const allows = (value: string) => tx?.allowed_transitions.some((o) => o.value === value) ?? false;

  return (
    <EntityDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={tx ? `${tx.station ?? t(($) => $.fleet.review.title)}` : t(($) => $.fleet.review.title)}
      description={tx?.status_label}
    >
      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && !tx && (
        <p className="py-6 text-sm text-muted-foreground">{t(($) => $.fleet.review.notFound)}</p>
      )}

      {tx && (
        <div className="flex flex-col gap-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t(($) => $.fleet.review.station)} value={tx.station ?? '—'} />
            <Field
              label={t(($) => $.fleet.review.reference)}
              value={tx.reference_number ?? '—'}
            />
            <Field label={t(($) => $.fleet.review.litres)} value={num(tx.litres)} />
            <Field
              label={t(($) => $.fleet.review.cost)}
              value={`${num(tx.cost)} ${tx.currency}`}
            />
            <Field
              label={t(($) => $.fleet.review.pricePerLitre)}
              value={num(tx.price_per_litre)}
            />
            <Field label={t(($) => $.fleet.review.odometer)} value={num(tx.odometer_km)} />
            <Field
              label={t(($) => $.fleet.review.transactedAt)}
              value={dateTime(tx.transacted_at)}
            />
            <Field
              label={t(($) => $.fleet.review.resolutionReason)}
              value={tx.resolution_reason ?? '—'}
            />
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t(($) => $.fleet.review.anomalies)}</h3>
            {tx.anomaly_flags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(($) => $.fleet.review.noAnomalies)}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {tx.anomaly_flags.map((flag) => (
                  <li key={flag}>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-amber-600 dark:text-amber-400"
                    >
                      <AlertTriangle className="me-1 h-3 w-3" />
                      {flag}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canReconcile && !tx.is_terminal && tx.allowed_transitions.length > 0 && (
            <section className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fuel-reason">{t(($) => $.fleet.review.reason)}</Label>
                <Input
                  id="fuel-reason"
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {allows('reconciled') && (
                  <Button
                    size="sm"
                    disabled={reconcile.isPending}
                    onClick={() =>
                      void run(
                        () => reconcile.mutateAsync(tx.id),
                        ($) => $.fleet.review.reconcileFailed,
                        false,
                      )
                    }
                  >
                    {t(($) => $.fleet.review.reconcile)}
                  </Button>
                )}
                {allows('disputed') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={dispute.isPending}
                    onClick={() =>
                      void run(
                        () => dispute.mutateAsync({ id: tx.id, reason: reason.trim() }),
                        ($) => $.fleet.review.disputeFailed,
                        true,
                      )
                    }
                  >
                    {t(($) => $.fleet.review.dispute)}
                  </Button>
                )}
                {allows('rejected') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reject.isPending}
                    onClick={() =>
                      void run(
                        () => reject.mutateAsync({ id: tx.id, reason: reason.trim() }),
                        ($) => $.fleet.review.rejectFailed,
                        true,
                      )
                    }
                  >
                    {t(($) => $.fleet.review.reject)}
                  </Button>
                )}
                {allows('written_off') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={writeOff.isPending}
                    onClick={() =>
                      void run(
                        () => writeOff.mutateAsync({ id: tx.id, reason: reason.trim() }),
                        ($) => $.fleet.review.writeOffFailed,
                        true,
                      )
                    }
                  >
                    {t(($) => $.fleet.review.writeOff)}
                  </Button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                {t(($) => $.fleet.review.outcomesNote)}
              </p>
            </section>
          )}
        </div>
      )}
    </EntityDrawer>
  );
}
