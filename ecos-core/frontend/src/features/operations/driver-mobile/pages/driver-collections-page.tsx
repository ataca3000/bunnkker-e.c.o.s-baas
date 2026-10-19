import { useParams, useNavigate } from 'react-router-dom';
import { useFormatter } from '@/hooks/use-formatter';
import { ArrowLeft, DollarSign, CreditCard, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/router/routes';
import { useTripCollections, useDriverTrip } from '../hooks/use-driver-mobile';
import type { PaymentCollection } from '../types/driver-mobile';
import { PAYMENT_TYPE_LABELS } from '../types/driver-mobile';

function PaymentTypeIcon({ type }: { type: string }) {
  if (type === 'cash')          return <DollarSign className="h-4 w-4 text-green-600" />;
  if (type === 'bank_transfer') return <CreditCard className="h-4 w-4 text-blue-600" />;
  return <CheckCircle className="h-4 w-4 text-gray-500" />;
}

export function DriverCollectionsPage() {
  const { money } = useFormatter();
  const { tripId = '' } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const { data: trip }        = useDriverTrip(tripId);
  const { data: collections, isLoading } = useTripCollections(tripId);

  const totals = {
    cash:  Number(trip?.total_cash_collected ?? 0),
    bank:  Number(trip?.total_bank_transfers ?? 0),
    paid:  Number(trip?.total_already_paid ?? 0),
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(ROUTES.driverTrip.replace(':tripId', tripId))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-base">Collections</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Cash',          value: totals.cash, color: 'text-green-600' },
            { label: 'Bank Transfer', value: totals.bank, color: 'text-blue-600'  },
            { label: 'Pre-Paid',      value: totals.paid, color: 'text-gray-600'  },
          ].map((t) => (
            <div key={t.label} className="rounded-lg border p-3 text-center">
              <p className={`font-bold text-sm ${t.color}`}>
                {t.value.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))
          ) : collections && (collections as PaymentCollection[]).length > 0 ? (
            (collections as PaymentCollection[]).map((col) => (
              <div key={col.id} className="flex items-start gap-3 rounded-lg border p-3">
                <PaymentTypeIcon type={col.payment_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {PAYMENT_TYPE_LABELS[col.payment_type] ?? col.payment_type}
                    </span>
                    <span className="font-semibold text-sm">
                      {money(Number(col.amount))}
                    </span>
                  </div>
                  {col.reference_number && (
                    <p className="text-xs text-muted-foreground">Ref: {col.reference_number}</p>
                  )}
                  <div className="flex items-center justify-between mt-0.5">
                    <Badge variant="outline" className="text-xs">
                      {col.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(col.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-muted-foreground py-10">
              No collections recorded yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
