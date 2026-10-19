import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Package, DollarSign, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ROUTES } from '@/router/routes';
import {
  useDriverStopDetail,
  useSubmitDeliveryAction,
  useCollectPayment,
} from '../hooks/use-driver-mobile';
import { DeliveryActionForm } from '../components/delivery-action-form';
import { PaymentCollectionForm } from '../components/payment-collection-form';
import { StopStatusBadge } from '../components/stop-status-badge';
import type { DeliveryActionType } from '../types/driver-mobile';
import { ACTION_TYPE_LABELS } from '../types/driver-mobile';

type SheetMode = 'action' | 'payment' | null;

const ACTION_BUTTONS: { type: DeliveryActionType; label: string; variant: 'default' | 'outline' | 'destructive' }[] = [
  { type: 'completed',     label: 'Delivered',       variant: 'default'     },
  { type: 'partial',       label: 'Partial',         variant: 'outline'     },
  { type: 'refused',       label: 'Refused',         variant: 'destructive' },
  { type: 'not_available', label: 'Not Available',   variant: 'outline'     },
  { type: 'delay',         label: 'Delay Requested', variant: 'outline'     },
  { type: 'wrong_address', label: 'Wrong Address',   variant: 'outline'     },
  { type: 'unreachable',   label: 'Unreachable',     variant: 'outline'     },
];

export function DriverStopDetailPage() {
  const { money } = useFormatter();
  const { tripId = '', stopId = '' } = useParams<{ tripId: string; stopId: string }>();
  const navigate = useNavigate();

  const { data: stop, isLoading } = useDriverStopDetail(tripId, stopId);
  const actionMutation  = useSubmitDeliveryAction(stopId);
  const paymentMutation = useCollectPayment(stopId);

  const [sheetMode,   setSheetMode]   = useState<SheetMode>(null);
  const [actionType,  setActionType]  = useState<DeliveryActionType>('completed');

  function openAction(type: DeliveryActionType) {
    setActionType(type);
    setSheetMode('action');
  }

  const isPending = stop?.status === 'pending' || stop?.status === 'in_progress';
  const isDone    = ['delivered', 'partial', 'failed', 'returned', 'skipped'].includes(stop?.status ?? '');

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!stop) {
    return <div className="p-4 text-center text-muted-foreground">Stop not found.</div>;
  }

  const { order } = stop;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(ROUTES.driverTripStops.replace(':tripId', tripId))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base">Stop #{stop.sequence}</h1>
          <p className="text-xs text-muted-foreground truncate">{order?.order_number}</p>
        </div>
        <StopStatusBadge status={stop.status} />
      </div>

      <div className="p-4 space-y-4">
        {/* Customer */}
        <div className="rounded-xl border p-4 space-y-2">
          <p className="font-semibold">{order?.customer_name ?? 'No Name'}</p>
          {order?.billing_phone && (
            <a
              href={`tel:${order.billing_phone}`}
              className="flex items-center gap-2 text-blue-600 text-sm"
            >
              <Phone className="h-4 w-4" />
              {order.billing_phone}
            </a>
          )}
          {order?.shipping_address && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {[order.shipping_address, order.area, order.city, order.governorate]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>
          )}
          {order?.delivery_notes && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
              {order.delivery_notes}
            </p>
          )}
        </div>

        {/* Products */}
        {order?.lines && order.lines.length > 0 && (
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <Package className="h-4 w-4" />
              Products ({order.lines.length})
            </div>
            <div className="space-y-2">
              {order.lines.map((line) => (
                <div key={line.product_id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {line.quantity}× {line.product_name}
                  </span>
                  <span>
                    {money(Number(line.line_total))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment summary */}
        <div className="rounded-xl border p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-sm mb-2">
            <DollarSign className="h-4 w-4" />
            Payment
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="capitalize">{order?.payment_method ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span>{money(Number(order?.grand_total ?? 0))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Deposit Paid</span>
            <span className="text-green-600">
              - {money(Number(order?.deposit_paid ?? 0))}
            </span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t pt-1.5">
            <span>Balance Due</span>
            <span>
              {money(Number(order?.remaining_balance ?? 0))}
            </span>
          </div>
        </div>

        {/* Delivery action summary (if done) */}
        {isDone && stop.delivery_type && (
          <div className="rounded-xl border bg-muted/30 p-4 space-y-1.5">
            <p className="text-sm font-semibold">Recorded Action</p>
            <Badge variant="secondary">
              {ACTION_TYPE_LABELS[stop.delivery_type] ?? stop.delivery_type}
            </Badge>
            {stop.notes && <p className="text-xs text-muted-foreground">{stop.notes}</p>}
            <p className="text-xs text-muted-foreground">
              Collected: {money(Number(stop.collected_amount ?? 0))}
            </p>
          </div>
        )}

        {/* Delivery action buttons */}
        {isPending && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Record Delivery</p>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_BUTTONS.map((btn) => (
                <Button
                  key={btn.type}
                  variant={btn.variant}
                  size="sm"
                  onClick={() => openAction(btn.type)}
                  className="text-xs"
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Add payment button (after delivery) */}
        {isDone && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setSheetMode('payment')}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        )}

        {/* POD button */}
        {isDone && (
          <Button variant="outline" className="w-full" onClick={() => navigate(
            `${ROUTES.driverTripStop
              .replace(':tripId', tripId)
              .replace(':stopId', stopId)}/proof`,
          )}>
            <Camera className="mr-2 h-4 w-4" />
            Proof of Delivery
          </Button>
        )}
      </div>

      {/* Action sheet */}
      <Sheet open={sheetMode === 'action'} onOpenChange={(o) => !o && setSheetMode(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Delivery Action</SheetTitle>
          </SheetHeader>
          <DeliveryActionForm
            actionType={actionType}
            isLoading={actionMutation.isPending}
            onSubmit={(payload) => {
              actionMutation.mutate(payload, {
                onSuccess: () => setSheetMode(null),
              });
            }}
            onCancel={() => setSheetMode(null)}
          />
        </SheetContent>
      </Sheet>

      {/* Payment sheet */}
      <Sheet open={sheetMode === 'payment'} onOpenChange={(o) => !o && setSheetMode(null)}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Record Payment</SheetTitle>
          </SheetHeader>
          <PaymentCollectionForm
            isLoading={paymentMutation.isPending}
            defaultAmount={Number(order?.remaining_balance ?? 0)}
            onSubmit={(payload) => {
              paymentMutation.mutate(payload, {
                onSuccess: () => setSheetMode(null),
              });
            }}
            onCancel={() => setSheetMode(null)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
