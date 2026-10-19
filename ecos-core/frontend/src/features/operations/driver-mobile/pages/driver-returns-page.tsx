import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PlusCircle, CheckCircle } from 'lucide-react';
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
import { useTripReturns, useAddReturn, useConfirmReturn } from '../hooks/use-driver-mobile';
import { ReturnForm } from '../components/return-form';
import type { DeliveryReturn } from '../types/driver-mobile';

export function DriverReturnsPage() {
  const { tripId = '' } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: returns, isLoading } = useTripReturns(tripId);
  const addMutation     = useAddReturn(tripId);
  const confirmMutation = useConfirmReturn(tripId);

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
        <h1 className="font-semibold text-base flex-1">Returns</h1>
        <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
          <PlusCircle className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))
        ) : returns && returns.length > 0 ? (
          returns.map((ret: DeliveryReturn) => (
            <div key={ret.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{ret.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Qty: {ret.returned_qty} ·{' '}
                    <Badge variant="outline" className="text-xs">
                      {ret.return_type}
                    </Badge>
                  </p>
                </div>
                {ret.warehouse_confirmed_at ? (
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <Badge variant="secondary" className="text-xs shrink-0">Pending</Badge>
                )}
              </div>

              {ret.reason && (
                <p className="text-xs text-muted-foreground">{ret.reason}</p>
              )}

              {ret.warehouse_confirmed_qty !== null && (
                <p className="text-xs">
                  Warehouse Confirmed: {ret.warehouse_confirmed_qty}
                  {ret.discrepancy_qty !== null && ret.discrepancy_qty !== 0 && (
                    <span className="text-red-600 ml-1">(Δ {ret.discrepancy_qty})</span>
                  )}
                </p>
              )}

              {/* Warehouse confirm action */}
              {!ret.warehouse_confirmed_at && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    confirmMutation.mutate({
                      returnId: ret.id,
                      confirmedQty: ret.returned_qty,
                    })
                  }
                  disabled={confirmMutation.isPending}
                >
                  Confirm Receipt
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="text-center text-sm text-muted-foreground py-10">
            No returns recorded yet.
          </p>
        )}
      </div>

      {/* Add return sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Record Return</SheetTitle>
          </SheetHeader>
          <ReturnForm
            orderId={0}
            isLoading={addMutation.isPending}
            onSubmit={(payload) => {
              addMutation.mutate(payload, {
                onSuccess: () => setSheetOpen(false),
              });
            }}
            onCancel={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
