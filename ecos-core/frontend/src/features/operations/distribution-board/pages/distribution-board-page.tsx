import { useState } from 'react';
import { Plus, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useDistributionBoard,
  useFinalizeBoard,
  useValidateBoard,
  useZoneOrders,
} from '../hooks/use-distribution-board';
import { WaveHeader } from '../components/wave-header';
import { ZoneTabs } from '../components/zone-tabs';
import { OrdersPool } from '../components/orders-pool';
import { TripCard } from '../components/trip-card';
import { TripFormDrawer } from '../components/trip-form-drawer';
import { ValidationPanel } from '../components/validation-panel';
import { WaveExceptionsPanel } from '../components/wave-exceptions-panel';
import type { DistributionTrip } from '../types/distribution-board';

export function DistributionBoardPage() {
  const { data, isLoading, isError } = useDistributionBoard();

  const [activeZoneId, setActiveZoneId] = useState<number | null>(null);
  const [tripDrawerOpen, setTripDrawerOpen] = useState(false);
  const [editingTrip, setEditingTrip]       = useState<DistributionTrip | null>(null);
  const [finalizeOpen, setFinalizeOpen]     = useState(false);

  const finalize    = useFinalizeBoard();
  const zoneOrdersQ = useZoneOrders(activeZoneId);
  // Canonical finalize-readiness from the backend — single source of truth.
  const { data: validation } = useValidateBoard(Boolean(data));
  const issues = validation?.issues ?? [];
  const canFinalize = validation?.ready ?? false;

  const zones = data?.zones ?? [];
  const allTrips = data?.trips ?? [];
  const resolvedZoneId = activeZoneId ?? zones[0]?.zone_id ?? null;
  const activeZone     = zones.find((z) => z.zone_id === resolvedZoneId);

  const trips = allTrips.filter((t) =>
    resolvedZoneId ? t.distribution_zone_id === resolvedZoneId : true,
  );

  function handleFinalizeClick() {
    if (canFinalize) {
      setFinalizeOpen(true);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full gap-3 p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-3 flex-1">
          <Skeleton className="w-72 flex-shrink-0" />
          <Skeleton className="flex-1" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Failed to load distribution board. Please refresh the page.</p>
      </div>
    );
  }

  if (!data?.wave) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="p-4 rounded-full bg-muted">
          <Truck className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg mb-1">No Active Wave</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            No active preparation wave found. Create a wave in the preparation system to start distribution planning.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Wave header — sticky */}
      <WaveHeader
        wave={data.wave}
        onFinalize={handleFinalizeClick}
        finalizing={finalize.isPending}
        canFinalize={canFinalize}
      />

      {/* Zone tabs */}
      <ZoneTabs
        zones={zones}
        activeZoneId={resolvedZoneId}
        onSelect={(id) => setActiveZoneId(id)}
      />

      {/* Main split layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Orders pool */}
        <div className="w-72 shrink-0 flex flex-col min-h-0">
          <OrdersPool
            orders={zoneOrdersQ.data?.orders ?? []}
            isLoading={zoneOrdersQ.isLoading && resolvedZoneId !== null}
            selectedZoneName={activeZone?.name_en ?? 'Selected Zone'}
          />
        </div>

        {/* Right: Trips panel */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0">
            <span className="text-sm font-medium">
              Today's Trips
              {allTrips.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">({allTrips.length})</span>
              )}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => { setEditingTrip(null); setTripDrawerOpen(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Trip
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-3 space-y-3">
              {trips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Truck className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No trips yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
                    Create a trip and orders from this zone will be added automatically.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => { setEditingTrip(null); setTripDrawerOpen(true); }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create First Trip
                  </Button>
                </div>
              ) : (
                trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onEdit={(t) => { setEditingTrip(t); setTripDrawerOpen(true); }}
                    allTrips={allTrips}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wave Exceptions panel */}
      <WaveExceptionsPanel />

      {/* Validation panel — bottom */}
      <ValidationPanel issues={issues} ready={canFinalize && issues.length === 0} />

      {/* Trip form drawer */}
      <TripFormDrawer
        open={tripDrawerOpen}
        onClose={() => { setTripDrawerOpen(false); setEditingTrip(null); }}
        waveId={data.wave.id}
        zones={zones}
        trip={editingTrip}
        defaultZoneId={resolvedZoneId}
      />

      {/* Finalize confirmation dialog */}
      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize All Remaining Trips?</AlertDialogTitle>
            <AlertDialogDescription>
              All planning trips will be moved to the loading system at once.
              You can also approve each trip individually using the <strong>Approve</strong> button.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                finalize.mutate(undefined, { onSuccess: () => setFinalizeOpen(false) });
              }}
            >
              Yes, Finalize All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
