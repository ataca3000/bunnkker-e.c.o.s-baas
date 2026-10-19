import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PackageCheck, Plus } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/features/authorization';

import { useConfirmReturn, useRecordReturn, useTripReturns } from '../hooks/use-trip-execution';
import { RETURN_KINDS, type ReturnKind } from '../types/trip-execution';

/**
 * Returns — products and custody in one list, because the backend models them
 * as one aggregate with a `kind` discriminator.
 *
 * The required fields differ by kind (`required_if:kind,product` and
 * `required_if:kind,custody`), so the form shows only the fields the chosen
 * kind actually needs rather than a superset that would fail validation.
 */
export function TripReturnsTab({ tripId }: { tripId: string }) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  const canWrite = can('logistics.distribution.update');

  const { data: returns, isLoading } = useTripReturns(tripId);
  const record = useRecordReturn(tripId);
  const confirm = useConfirmReturn(tripId);

  const [showRecord, setShowRecord] = useState(false);
  const [kind, setKind] = useState<ReturnKind>('product');
  const [orderId, setOrderId] = useState('');
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [custodyType, setCustodyType] = useState('');
  const [returnedQty, setReturnedQty] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState<number | null>(null);
  const [confirmQty, setConfirmQty] = useState('');
  const [driverLiable, setDriverLiable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (value: number | string | null) =>
    value === null || value === undefined
      ? t(($) => $.trips.execution.common.none)
      : new Intl.NumberFormat(i18n.language).format(Number(value));

  const canSubmit =
    returnedQty !== '' &&
    Number(returnedQty) >= 0 &&
    (kind === 'product' ? orderId.trim() !== '' && productId.trim() !== '' : custodyType.trim() !== '');

  async function submitRecord() {
    if (!canSubmit) return;
    setError(null);
    try {
      await record.mutateAsync({
        kind,
        returned_qty: Number(returnedQty),
        order_id: kind === 'product' ? orderId.trim() : null,
        product_id: kind === 'product' ? productId.trim() : null,
        product_name: kind === 'product' ? productName.trim() || null : null,
        custody_type: kind === 'custody' ? custodyType.trim() : null,
        reason: reason.trim() || null,
      });
      setOrderId('');
      setProductId('');
      setProductName('');
      setCustodyType('');
      setReturnedQty('');
      setReason('');
      setShowRecord(false);
    } catch {
      setError(t(($) => $.trips.execution.returns.recordFailed));
    }
  }

  async function submitConfirm(returnId: number) {
    if (confirmQty === '' || Number(confirmQty) < 0) return;
    setError(null);
    try {
      await confirm.mutateAsync({
        returnId,
        payload: { warehouse_confirmed_qty: Number(confirmQty), driver_liable: driverLiable },
      });
      setConfirming(null);
      setConfirmQty('');
      setDriverLiable(false);
    } catch {
      setError(t(($) => $.trips.execution.returns.confirmFailed));
    }
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const list = returns ?? [];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t(($) => $.trips.execution.returns.title)}</h3>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={() => setShowRecord((v) => !v)}>
            <Plus className="me-1 h-3.5 w-3.5" />
            {t(($) => $.trips.execution.returns.record)}
          </Button>
        )}
      </div>

      {showRecord && canWrite && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">
            {t(($) => $.trips.execution.returns.recordDescription)}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="return-kind">{t(($) => $.trips.execution.returns.kind)}</Label>
            <select
              id="return-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ReturnKind)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {RETURN_KINDS.map((value) => (
                <option key={value} value={value}>
                  {value === 'product'
                    ? t(($) => $.trips.execution.returns.product)
                    : t(($) => $.trips.execution.returns.custody)}
                </option>
              ))}
            </select>
          </div>

          {kind === 'product' ? (
            <div className="flex flex-col gap-2">
              <Input
                value={orderId}
                placeholder={t(($) => $.trips.execution.returns.orderIdPlaceholder)}
                onChange={(e) => setOrderId(e.target.value)}
              />
              <Input
                value={productId}
                placeholder={t(($) => $.trips.execution.returns.productIdPlaceholder)}
                onChange={(e) => setProductId(e.target.value)}
              />
              <Input
                value={productName}
                maxLength={255}
                placeholder={t(($) => $.trips.execution.returns.productNamePlaceholder)}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
          ) : (
            <Input
              value={custodyType}
              maxLength={40}
              placeholder={t(($) => $.trips.execution.returns.custodyTypePlaceholder)}
              onChange={(e) => setCustodyType(e.target.value)}
            />
          )}

          <Input
            type="number"
            min={0}
            step="0.01"
            value={returnedQty}
            placeholder={t(($) => $.trips.execution.returns.returnedQty)}
            onChange={(e) => setReturnedQty(e.target.value)}
          />

          <Textarea
            rows={2}
            value={reason}
            maxLength={2000}
            placeholder={t(($) => $.trips.execution.returns.reason)}
            onChange={(e) => setReason(e.target.value)}
          />

          <div className="flex gap-2">
            <Button size="sm" disabled={!canSubmit || record.isPending} onClick={() => void submitRecord()}>
              {record.isPending
                ? t(($) => $.trips.execution.common.saving)
                : t(($) => $.trips.execution.common.save)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRecord(false)}>
              {t(($) => $.trips.execution.common.cancel)}
            </Button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          {t(($) => $.trips.execution.returns.empty)}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {row.kind === 'product'
                    ? (row.product_name ?? row.product_id ?? t(($) => $.trips.execution.returns.product))
                    : (row.custody_type ?? t(($) => $.trips.execution.returns.custody))}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {row.kind === 'product'
                      ? t(($) => $.trips.execution.returns.product)
                      : t(($) => $.trips.execution.returns.custody)}
                  </Badge>
                  <Badge variant={row.is_confirmed ? 'outline' : 'secondary'}>
                    {row.is_confirmed
                      ? t(($) => $.trips.execution.returns.confirmed)
                      : t(($) => $.trips.execution.returns.awaitingConfirmation)}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t(($) => $.trips.execution.returns.dispatched)}: {num(row.dispatched_qty)}
                </span>
                <span>
                  {t(($) => $.trips.execution.returns.returnedQty)}: {num(row.returned_qty)}
                </span>
                <span>
                  {t(($) => $.trips.execution.returns.confirmedQty)}:{' '}
                  {num(row.warehouse_confirmed_qty)}
                </span>
                {row.has_discrepancy && (
                  <span className="text-destructive">
                    {t(($) => $.trips.execution.returns.discrepancy)}: {num(row.discrepancy_qty)}
                  </span>
                )}
                {row.driver_liable && (
                  <span>{t(($) => $.trips.execution.returns.driverLiable)}</span>
                )}
              </div>

              {row.reason && <p className="text-xs">{row.reason}</p>}

              {!row.is_confirmed && canWrite && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 self-start text-xs"
                    onClick={() => setConfirming(confirming === row.id ? null : row.id)}
                  >
                    <PackageCheck className="me-1 h-3 w-3" />
                    {t(($) => $.trips.execution.returns.confirm)}
                  </Button>

                  {confirming === row.id && (
                    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">
                        {t(($) => $.trips.execution.returns.confirmDescription)}
                      </p>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={confirmQty}
                        placeholder={t(($) => $.trips.execution.returns.warehouseQty)}
                        onChange={(e) => setConfirmQty(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={driverLiable}
                          onChange={(e) => setDriverLiable(e.target.checked)}
                        />
                        {t(($) => $.trips.execution.returns.driverLiable)}
                      </label>
                      <Button
                        size="sm"
                        className="h-7 self-start text-xs"
                        disabled={confirmQty === '' || confirm.isPending}
                        onClick={() => void submitConfirm(row.id)}
                      >
                        {t(($) => $.trips.execution.returns.confirm)}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
