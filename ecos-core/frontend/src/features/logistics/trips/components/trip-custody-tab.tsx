import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PackageCheck, Plus, Trash2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import {
  useAddCustody,
  useConfirmCustody,
  useRemoveCustody,
  useTripCustody,
} from '../hooks/use-trip-execution';
import { CUSTODY_ITEM_TYPES, type CustodyItemType } from '../types/trip-execution';

type LogisticsLabel = ($: typeof enLogistics) => string;

const TYPE_LABEL: Record<CustodyItemType, LogisticsLabel> = {
  cash_float: ($) => $.trips.execution.custody.type.cash_float,
  pos_device: ($) => $.trips.execution.custody.type.pos_device,
  ice_boxes: ($) => $.trips.execution.custody.type.ice_boxes,
  ice_packs: ($) => $.trips.execution.custody.type.ice_packs,
  thermal_bags: ($) => $.trips.execution.custody.type.thermal_bags,
  delivery_bags: ($) => $.trips.execution.custody.type.delivery_bags,
  other: ($) => $.trips.execution.custody.type.other,
};

/**
 * Custody — equipment and cash floats handed to the driver with the trip.
 *
 * The shortfall shown on each row is the backend's, derived from dispatched
 * versus received. It is never recomputed here: a second number computed in the
 * browser would disagree the moment a partial confirmation lands, and this is
 * the figure the driver can be held liable for.
 */
export function TripCustodyTab({ tripId }: { tripId: string }) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  const canWrite = can('logistics.distribution.update');

  const { data: items, isLoading } = useTripCustody(tripId);
  const addCustody = useAddCustody(tripId);
  const confirmCustody = useConfirmCustody(tripId);
  const removeCustody = useRemoveCustody(tripId);

  const [showAdd, setShowAdd] = useState(false);
  const [itemType, setItemType] = useState<CustodyItemType>('delivery_bags');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [confirming, setConfirming] = useState<number | null>(null);
  const [received, setReceived] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';

  async function submitAdd() {
    setError(null);
    try {
      await addCustody.mutateAsync({
        item_type: itemType,
        description: description.trim() || null,
        quantity: Number(quantity) || 1,
      });
      setDescription('');
      setQuantity('1');
      setShowAdd(false);
    } catch {
      setError(t(($) => $.trips.execution.custody.addFailed));
    }
  }

  async function submitConfirm(custodyId: number) {
    if (received === '' || Number(received) < 0) return;
    setError(null);
    try {
      await confirmCustody.mutateAsync({ custodyId, receivedQuantity: Number(received) });
      setConfirming(null);
      setReceived('');
    } catch {
      setError(t(($) => $.trips.execution.custody.confirmFailed));
    }
  }

  async function submitRemove(custodyId: number) {
    setError(null);
    try {
      await removeCustody.mutateAsync(custodyId);
    } catch {
      setError(t(($) => $.trips.execution.custody.removeFailed));
    }
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const list = items ?? [];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t(($) => $.trips.execution.custody.title)}</h3>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="me-1 h-3.5 w-3.5" />
            {t(($) => $.trips.execution.custody.add)}
          </Button>
        )}
      </div>

      {showAdd && canWrite && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">
            {t(($) => $.trips.execution.custody.addDescription)}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custody-type">{t(($) => $.trips.execution.custody.itemType)}</Label>
            <select
              id="custody-type"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as CustodyItemType)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {CUSTODY_ITEM_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(TYPE_LABEL[value])}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              value={description}
              maxLength={200}
              placeholder={t(($) => $.trips.execution.custody.descriptionPlaceholder)}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Input
              type="number"
              min={1}
              max={9999}
              value={quantity}
              aria-label={t(($) => $.trips.execution.custody.quantityLabel)}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" disabled={addCustody.isPending} onClick={() => void submitAdd()}>
              {t(($) => $.trips.execution.common.save)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t(($) => $.trips.execution.common.cancel)}
            </Button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          {t(($) => $.trips.execution.custody.empty)}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {list.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {t(TYPE_LABEL[item.item_type])}
                    {item.description ? ` — ${item.description}` : ''}
                  </span>
                  <Badge variant={item.is_driver_confirmed ? 'outline' : 'secondary'}>
                    {item.is_driver_confirmed
                      ? t(($) => $.trips.execution.custody.confirmed)
                      : t(($) => $.trips.execution.custody.awaiting)}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t(($) => $.trips.execution.custody.quantity)}: {item.quantity}
                  </span>
                  <span>
                    {t(($) => $.trips.execution.custody.received)}: {item.received_quantity ?? '—'}
                  </span>
                  {item.has_shortfall && (
                    <span className="text-destructive">
                      {t(($) => $.trips.execution.custody.shortfall)}: {item.shortfall_quantity}
                    </span>
                  )}
                  {item.driver_confirmed_at && (
                    <span>
                      {t(($) => $.trips.execution.custody.confirmedAt)}:{' '}
                      {dateTime(item.driver_confirmed_at)}
                    </span>
                  )}
                </div>

                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    {!item.is_driver_confirmed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setConfirming(confirming === item.id ? null : item.id)}
                      >
                        <PackageCheck className="me-1 h-3 w-3" />
                        {t(($) => $.trips.execution.custody.confirm)}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive"
                      disabled={removeCustody.isPending}
                      onClick={() => void submitRemove(item.id)}
                    >
                      <Trash2 className="me-1 h-3 w-3" />
                      {t(($) => $.trips.execution.custody.remove)}
                    </Button>
                  </div>
                )}

                {confirming === item.id && canWrite && (
                  <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">
                      {t(($) => $.trips.execution.custody.confirmTitle)}
                    </p>
                    <Input
                      type="number"
                      min={0}
                      max={9999}
                      value={received}
                      placeholder={t(($) => $.trips.execution.custody.receivedQuantity)}
                      onChange={(e) => setReceived(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-7 self-start text-xs"
                      disabled={received === '' || confirmCustody.isPending}
                      onClick={() => void submitConfirm(item.id)}
                    >
                      {t(($) => $.trips.execution.custody.confirm)}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-muted-foreground">
            {t(($) => $.trips.execution.custody.shortfallNote)}
          </p>
        </>
      )}
    </div>
  );
}
