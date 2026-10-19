import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PlusCircle, CheckCircle, AlertTriangle } from 'lucide-react';
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
import { useTripExceptions } from '../hooks/use-driver-mobile';
import type { DeliveryException } from '../types/driver-mobile';
import { EXCEPTION_TYPE_LABELS } from '../types/driver-mobile';

export function DriverExceptionsPage() {
  const { tripId = '' } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: exceptions, isLoading } = useTripExceptions(tripId);

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
        <h1 className="font-semibold text-base flex-1">Exceptions</h1>
        <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
          <PlusCircle className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))
        ) : exceptions && exceptions.length > 0 ? (
          exceptions.map((ex: DeliveryException) => (
            <div key={ex.id} className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="secondary" className="text-xs">
                  {EXCEPTION_TYPE_LABELS[ex.exception_type] ?? ex.exception_type}
                </Badge>
                {ex.resolved_at ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Resolved
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Open
                  </span>
                )}
              </div>
              <p className="text-sm">{ex.description}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(ex.created_at).toLocaleString('ar-EG')}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No exceptions reported.</p>
          </div>
        )}
      </div>

      {/* Sheet for adding exception — simplified: redirect to stop to add exception from stop context */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Add Exception</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-4">
            To report an exception, open the relevant delivery stop and use the exception button.
          </p>
          <Button
            className="w-full mt-4"
            onClick={() => {
              setSheetOpen(false);
              navigate(ROUTES.driverTripStops.replace(':tripId', tripId));
            }}
          >
            Go to Stops
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
