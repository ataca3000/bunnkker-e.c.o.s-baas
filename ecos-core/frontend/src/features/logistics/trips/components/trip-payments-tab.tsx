import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Plus, XCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import { useTripStops } from '../hooks/use-trip-execution';
import {
  useRecordPayment,
  useRejectPayment,
  useTripPayments,
  useVerifyPayment,
} from '../hooks/use-trip-settlement';
import { PAYMENT_TYPES, type PaymentType } from '../types/trip-settlement';

type LogisticsLabel = ($: typeof enLogistics) => string;

const PAYMENT_TYPE_LABEL: Record<PaymentType, LogisticsLabel> = {
  cash: ($) => $.trips.settlement.paymentType.cash,
  bank_transfer: ($) => $.trips.settlement.paymentType.bank_transfer,
  card: ($) => $.trips.settlement.paymentType.card,
  already_paid: ($) => $.trips.settlement.paymentType.already_paid,
};

/**
 * The payment ledger: one row per collection at a stop.
 *
 * `counts_toward_cash_expected` is surfaced on every row because it is the
 * reason two payments of the same amount can affect the settlement differently
 * — a card payment is collected but is not cash the driver hands over. Hiding
 * that would make the settlement arithmetic look wrong.
 *
 * Payment status is a free string on the resource, so it is rendered as the
 * backend sends it rather than mapped through a client-side enum that could
 * silently fall through.
 */
export function TripPaymentsTab({ tripId }: { tripId: string }) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  const canWrite = can('logistics.distribution.update');

  const { data: payments, isLoading } = useTripPayments(tripId);
  const { data: stops } = useTripStops(tripId);

  const record = useRecordPayment(tripId);
  const verify = useVerifyPayment(tripId);
  const reject = useRejectPayment(tripId);

  const [showRecord, setShowRecord] = useState(false);
  const [stopId, setStopId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const money = (value: number | string) =>
    new Intl.NumberFormat(i18n.language).format(Number(value));
  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';

  async function submitRecord() {
    if (!stopId || amount === '') return;
    setError(null);
    try {
      await record.mutateAsync({
        stopId: Number(stopId),
        payload: {
          payment_type: paymentType,
          amount: Number(amount),
          reference_number: reference.trim() || null,
        },
      });
      setAmount('');
      setReference('');
      setShowRecord(false);
    } catch {
      setError(t(($) => $.trips.settlement.payments.recordFailed));
    }
  }

  async function submitVerify(paymentId: number) {
    setError(null);
    try {
      await verify.mutateAsync(paymentId);
    } catch {
      setError(t(($) => $.trips.settlement.payments.verifyFailed));
    }
  }

  async function submitReject(paymentId: number) {
    setError(null);
    try {
      await reject.mutateAsync({ paymentId, notes: rejectNotes.trim() || undefined });
      setRejecting(null);
      setRejectNotes('');
    } catch {
      setError(t(($) => $.trips.settlement.payments.rejectFailed));
    }
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const list = payments ?? [];
  const stopList = stops ?? [];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t(($) => $.trips.settlement.payments.title)}</h3>
        {canWrite && stopList.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setShowRecord((v) => !v)}>
            <Plus className="me-1 h-3.5 w-3.5" />
            {t(($) => $.trips.settlement.payments.record)}
          </Button>
        )}
      </div>

      {canWrite && stopList.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t(($) => $.trips.settlement.payments.noStops)}
        </p>
      )}

      {showRecord && canWrite && stopList.length > 0 && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">
            {t(($) => $.trips.settlement.payments.recordDescription)}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-stop">
              {t(($) => $.trips.settlement.payments.selectStop)}
            </Label>
            <select
              id="payment-stop"
              value={stopId}
              onChange={(e) => setStopId(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {stopList.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.sequence} · {stop.order_id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-type">{t(($) => $.trips.settlement.payments.type)}</Label>
            <select
              id="payment-type"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {PAYMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(PAYMENT_TYPE_LABEL[value])}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              placeholder={t(($) => $.trips.settlement.payments.amount)}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              value={reference}
              maxLength={100}
              placeholder={t(($) => $.trips.settlement.payments.referencePlaceholder)}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!stopId || amount === '' || record.isPending}
              onClick={() => void submitRecord()}
            >
              {t(($) => $.trips.settlement.payments.record)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRecord(false)}>
              {t(($) => $.trips.execution.common.cancel)}
            </Button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          {t(($) => $.trips.settlement.payments.empty)}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((payment) => (
            <li key={payment.id} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {money(payment.amount)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    {t(PAYMENT_TYPE_LABEL[payment.payment_type])}
                  </span>
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {payment.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  {t(($) => $.trips.settlement.payments.stop)}: {payment.stop_id}
                </span>
                {payment.reference_number && (
                  <span>
                    {t(($) => $.trips.settlement.payments.reference)}: {payment.reference_number}
                  </span>
                )}
                {payment.verified_at && (
                  <span>
                    {t(($) => $.trips.settlement.payments.verifiedAt)}:{' '}
                    {dateTime(payment.verified_at)}
                  </span>
                )}
                <span>
                  {payment.counts_toward_cash_expected
                    ? t(($) => $.trips.settlement.payments.countsToward)
                    : t(($) => $.trips.settlement.payments.notCounted)}
                </span>
              </div>

              {canWrite && payment.verified_at === null && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={verify.isPending}
                    onClick={() => void submitVerify(payment.id)}
                  >
                    <BadgeCheck className="me-1 h-3 w-3" />
                    {t(($) => $.trips.settlement.payments.verify)}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive"
                    onClick={() => setRejecting(rejecting === payment.id ? null : payment.id)}
                  >
                    <XCircle className="me-1 h-3 w-3" />
                    {t(($) => $.trips.settlement.payments.reject)}
                  </Button>
                </div>
              )}

              {rejecting === payment.id && canWrite && (
                <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
                  <Textarea
                    rows={2}
                    value={rejectNotes}
                    maxLength={2000}
                    placeholder={t(($) => $.trips.settlement.payments.rejectNotes)}
                    onChange={(e) => setRejectNotes(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 self-start text-xs"
                    disabled={reject.isPending}
                    onClick={() => void submitReject(payment.id)}
                  >
                    {t(($) => $.trips.settlement.payments.reject)}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
