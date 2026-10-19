import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Navigation, Package2, DollarSign, AlertTriangle, RotateCcw, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ROUTES } from '@/router/routes';
import { useDriverTrip, useStartTrip, useFinishTrip } from '../hooks/use-driver-mobile';
import { TripKpiGrid } from '../components/trip-kpi-grid';

export function DriverTripDashboardPage() {
  const { tripId = '' } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const { data: trip, isLoading } = useDriverTrip(tripId);
  const startMutation  = useStartTrip(tripId);
  const finishMutation = useFinishTrip(tripId);

  const [startDialogOpen,  setStartDialogOpen]  = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);

  function handleStartTrip() {
    if (!navigator.geolocation) {
      startMutation.mutate({ lat: 0, lng: 0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startMutation.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStartDialogOpen(false);
      },
      () => {
        startMutation.mutate({ lat: 0, lng: 0 });
        setStartDialogOpen(false);
      },
    );
  }

  function handleFinishTrip() {
    if (!navigator.geolocation) {
      finishMutation.mutate({ lat: 0, lng: 0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finishMutation.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setFinishDialogOpen(false);
      },
      () => {
        finishMutation.mutate({ lat: 0, lng: 0 });
        setFinishDialogOpen(false);
      },
    );
  }

  const go = (path: string) => navigate(path);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Trip not found.
      </div>
    );
  }

  const STATUS_BADGE: Record<string, string> = {
    out_for_delivery: 'bg-blue-100 text-blue-700',
    in_progress:      'bg-amber-100 text-amber-700',
    completed:        'bg-green-100 text-green-700',
    closed:           'bg-gray-100 text-gray-600',
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(ROUTES.driverHome)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base truncate">{trip.trip_number}</h1>
          {trip.name && <p className="text-xs text-muted-foreground truncate">{trip.name}</p>}
        </div>
        <Badge className={STATUS_BADGE[trip.status] ?? 'bg-gray-100 text-gray-600'}>
          {trip.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="p-4 space-y-4">
        {/* Meta */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {trip.wave_number && (
            <span className="flex items-center gap-1">
              <Package2 className="h-3.5 w-3.5" />
              {trip.wave_number}
            </span>
          )}
          {trip.zone_code && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {trip.zone_code}
            </span>
          )}
          {trip.driver_name && <span>{trip.driver_name}</span>}
          {trip.vehicle_plate && <span>{trip.vehicle_plate}</span>}
        </div>

        {/* Remaining stops */}
        {trip.kpis && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
            <p className="text-4xl font-bold text-primary">{trip.kpis.remaining_stops}</p>
            <p className="text-sm text-muted-foreground mt-1">Remaining Stops</p>
          </div>
        )}

        {/* KPI Grid */}
        {trip.kpis && <TripKpiGrid kpis={trip.kpis} />}

        {/* Action buttons */}
        <div className="space-y-2">
          {trip.status === 'out_for_delivery' && (
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={() => setStartDialogOpen(true)}
              disabled={startMutation.isPending}
            >
              <Navigation className="mr-2 h-5 w-5" />
              {startMutation.isPending ? 'Starting...' : 'Start Trip'}
            </Button>
          )}

          {trip.status === 'in_progress' && (
            <>
              <Button
                className="w-full"
                variant="default"
                onClick={() => go(ROUTES.driverTripStops.replace(':tripId', tripId))}
              >
                View Stops ({trip.kpis?.remaining_stops ?? '?'} remaining)
              </Button>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => go(ROUTES.driverTripCollections.replace(':tripId', tripId))}>
                  <DollarSign className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => go(ROUTES.driverTripExceptions.replace(':tripId', tripId))}>
                  <AlertTriangle className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => go(ROUTES.driverTripTimeline.replace(':tripId', tripId))}>
                  <Clock className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setFinishDialogOpen(true)}
                disabled={finishMutation.isPending || (trip.kpis?.remaining_stops ?? 1) > 0}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Finish Trip
              </Button>
            </>
          )}

          {trip.status === 'completed' && (
            <>
              <Button
                className="w-full"
                onClick={() => go(ROUTES.driverTripSettlement.replace(':tripId', tripId))}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Settlement
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => go(ROUTES.driverTripReturns.replace(':tripId', tripId))}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Returns
                </Button>
                <Button variant="outline" onClick={() => go(ROUTES.driverTripCustody.replace(':tripId', tripId))}>
                  Custody
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Start trip dialog */}
      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Trip?</DialogTitle>
            <DialogDescription>
              This will update the trip to in-progress and log your current GPS location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setStartDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStartTrip} disabled={startMutation.isPending}>
              {startMutation.isPending ? 'Starting...' : 'Start Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish trip dialog */}
      <Dialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish Trip?</DialogTitle>
            <DialogDescription>
              All stops must be processed before finishing. This action logs the trip end location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setFinishDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleFinishTrip} disabled={finishMutation.isPending}>
              {finishMutation.isPending ? 'Finishing...' : 'Finish Trip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
