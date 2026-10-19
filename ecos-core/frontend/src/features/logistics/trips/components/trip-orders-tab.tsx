import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/features/authorization';

import {
  useAddTripOrder,
  useMoveTripOrder,
  useRemoveTripOrder,
  useTripOrders,
} from '../hooks/use-trip-execution';

/**
 * Orders assigned to a trip.
 *
 * Orders are addressed by UUID and this endpoint offers no lookup, so the id is
 * entered directly and the screen says so. Inventing a picker here would mean
 * querying an unrelated module's list endpoint and guessing which orders are
 * eligible — the assignment endpoint already owns that rule and refuses what it
 * will not accept.
 */
export function TripOrdersTab({ tripId }: { tripId: string }) {
  const { t } = useTranslation('logistics');
  const { can } = usePermission();
  const canWrite = can('logistics.distribution.update');
  const { data: orders, isLoading } = useTripOrders(tripId);

  const addOrder = useAddTripOrder(tripId);
  const removeOrder = useRemoveTripOrder(tripId);
  const moveOrder = useMoveTripOrder(tripId);

  const [showAdd, setShowAdd] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [zoneCode, setZoneCode] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [targetTrip, setTargetTrip] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submitAdd() {
    if (!orderId.trim()) return;
    setError(null);
    try {
      await addOrder.mutateAsync({
        order_id: orderId.trim(),
        zone_code: zoneCode.trim() || null,
        governorate: governorate.trim() || null,
        assignment_type: 'manual',
      });
      setOrderId('');
      setZoneCode('');
      setGovernorate('');
      setShowAdd(false);
    } catch {
      setError(t(($) => $.trips.execution.orders.addFailed));
    }
  }

  async function submitRemove(id: string) {
    setError(null);
    try {
      await removeOrder.mutateAsync(id);
    } catch {
      setError(t(($) => $.trips.execution.orders.removeFailed));
    }
  }

  async function submitMove() {
    if (!movingId || !targetTrip.trim()) return;
    setError(null);
    try {
      await moveOrder.mutateAsync({ order_id: movingId, target_trip_id: targetTrip.trim() });
      setMovingId(null);
      setTargetTrip('');
    } catch {
      setError(t(($) => $.trips.execution.orders.moveFailed));
    }
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t(($) => $.trips.execution.orders.title)}</h3>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="me-1 h-3.5 w-3.5" />
            {t(($) => $.trips.execution.orders.add)}
          </Button>
        )}
      </div>

      {showAdd && canWrite && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">
            {t(($) => $.trips.execution.orders.addDescription)}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-order-id">
              {t(($) => $.trips.execution.orders.orderIdLabel)}
            </Label>
            <Input
              id="assign-order-id"
              value={orderId}
              placeholder={t(($) => $.trips.execution.orders.orderIdPlaceholder)}
              onChange={(e) => setOrderId(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {t(($) => $.trips.execution.orders.idNote)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              value={zoneCode}
              maxLength={30}
              placeholder={t(($) => $.trips.execution.orders.zonePlaceholder)}
              onChange={(e) => setZoneCode(e.target.value)}
            />
            <Input
              value={governorate}
              maxLength={100}
              placeholder={t(($) => $.trips.execution.orders.governoratePlaceholder)}
              onChange={(e) => setGovernorate(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" disabled={!orderId.trim() || addOrder.isPending} onClick={() => void submitAdd()}>
              {addOrder.isPending
                ? t(($) => $.trips.execution.common.saving)
                : t(($) => $.trips.execution.common.save)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t(($) => $.trips.execution.common.cancel)}
            </Button>
          </div>
        </div>
      )}

      {(orders ?? []).length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          {t(($) => $.trips.execution.orders.empty)}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(orders ?? []).map((order) => (
            <li key={order.id} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs">{order.order_id}</span>
                <Badge variant={order.is_manual ? 'secondary' : 'outline'} className="text-[10px]">
                  {order.is_manual
                    ? t(($) => $.trips.execution.orders.manual)
                    : t(($) => $.trips.execution.orders.auto)}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t(($) => $.trips.execution.orders.zone)}:{' '}
                  {order.zone_code_snapshot ?? t(($) => $.trips.execution.common.none)}
                </span>
                <span>
                  {t(($) => $.trips.execution.orders.governorate)}:{' '}
                  {order.governorate_snapshot ?? t(($) => $.trips.execution.common.none)}
                </span>
              </div>

              {canWrite && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setMovingId(movingId === order.order_id ? null : order.order_id)}
                  >
                    {t(($) => $.trips.execution.orders.move)}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive"
                    disabled={removeOrder.isPending}
                    onClick={() => void submitRemove(order.order_id)}
                  >
                    <Trash2 className="me-1 h-3 w-3" />
                    {t(($) => $.trips.execution.orders.remove)}
                  </Button>
                </div>
              )}

              {movingId === order.order_id && canWrite && (
                <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
                  <p className="text-xs text-muted-foreground">
                    {t(($) => $.trips.execution.orders.moveDescription)}
                  </p>
                  <Input
                    value={targetTrip}
                    placeholder={t(($) => $.trips.execution.orders.targetTripPlaceholder)}
                    onChange={(e) => setTargetTrip(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-7 self-start text-xs"
                    disabled={!targetTrip.trim() || moveOrder.isPending}
                    onClick={() => void submitMove()}
                  >
                    {t(($) => $.trips.execution.orders.move)}
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
