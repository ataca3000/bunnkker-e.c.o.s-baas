import { useNavigate } from 'react-router-dom';
import { useFormatter } from '@/hooks/use-formatter';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDispatchGate } from '../hooks/use-dispatch-gate';
import {
  TRIP_STATUS_LABELS,
  TRIP_STATUS_COLORS,
  type DispatchGateTripCard,
  type TripStatus,
} from '../types/distribution-board';
import { ROUTES } from '@/router/routes';
import { cn } from '@/lib/utils';

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <span className={cn('text-2xl font-bold tabular-nums', color)}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function GateTripCard({ trip }: { trip: DispatchGateTripCard }) {
  const { money } = useFormatter();
  const navigate = useNavigate();

  const statusColor = TRIP_STATUS_COLORS[trip.status as TripStatus] ?? 'bg-muted text-muted-foreground';
  const statusLabel = TRIP_STATUS_LABELS[trip.status as TripStatus] ?? trip.status;

  const driverLine = [
    trip.driver_display !== 'No Driver' ? trip.driver_display : null,
    trip.vehicle_plate || trip.carrier_name || null,
  ].filter(Boolean).join(' · ');

  const isBlocked   = trip.status === 'dispatch_blocked';
  const isAccepted  = trip.status === 'driver_accepted';

  return (
    <div className={cn(
      'rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow',
      isBlocked && 'border-red-300 dark:border-red-900/60',
    )}>
      {/* Zone color strip */}
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: trip.zone_color ?? '#64748b' }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{trip.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{trip.trip_number}</span>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', statusColor)}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {trip.zone_name && <span>{trip.zone_name}</span>}
              {trip.wave_number && (
                <>
                  <span>·</span>
                  <span>{trip.wave_number}</span>
                </>
              )}
            </div>
          </div>

          <Button
            size="sm"
            variant={isBlocked ? 'destructive' : isAccepted ? 'default' : 'outline'}
            className="h-7 text-xs gap-1 shrink-0"
            onClick={() => navigate(`${ROUTES.dispatchGate}/${trip.id}`)}
          >
            <ClipboardList className="h-3 w-3" />
            {isBlocked ? 'Resolve' : isAccepted ? 'Dispatch' : 'Review'}
          </Button>
        </div>

        {/* Driver */}
        {driverLine && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Truck className="h-3.5 w-3.5 shrink-0" />
            <span>{driverLine}</span>
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{trip.orders_count}</div>
            <div className="text-xs text-muted-foreground">Orders</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold tabular-nums">
              {money(trip.collection_amount)}
            </div>
            <div className="text-xs text-muted-foreground">Collection</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{trip.total_products}</div>
            <div className="text-xs text-muted-foreground">Products</div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3 text-xs">
          {isBlocked ? (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Discrepancy Reported</span>
            </div>
          ) : isAccepted ? (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Driver Accepted</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Loader2 className="h-3.5 w-3.5" />
              <span>Awaiting Driver Acceptance</span>
            </div>
          )}

          {trip.loading_completed_at && (
            <span className="ms-auto text-muted-foreground">
              Loaded at {new Date(trip.loading_completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DispatchGatePage() {
  const { data, isLoading, isError } = useDispatchGate();

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Failed to load dispatch gate. Please refresh the page.</p>
      </div>
    );
  }

  const trips = data?.trips ?? [];
  const stats = data?.stats;

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="p-4 rounded-full bg-muted">
          <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg mb-1">Dispatch Gate Empty</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            No trips are awaiting dispatch gate authorization. Trips will appear here after warehouse loading is complete.
          </p>
        </div>
      </div>
    );
  }

  const grouped = {
    dispatch_blocked:  trips.filter((t) => t.status === 'dispatch_blocked'),
    driver_accepted:   trips.filter((t) => t.status === 'driver_accepted'),
    loading_completed: trips.filter((t) => t.status === 'loading_completed'),
  };

  const sections: { key: keyof typeof grouped; label: string; emptyHidden?: boolean }[] = [
    { key: 'dispatch_blocked',  label: 'Dispatch Blocked — Needs Resolution' },
    { key: 'driver_accepted',   label: 'Driver Accepted — Ready to Dispatch' },
    { key: 'loading_completed', label: 'Awaiting Driver Acceptance' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-sm">Dispatch Gate</h1>
          <p className="text-xs text-muted-foreground">Official driver acceptance and vehicle dispatch authorization</p>
        </div>
        {stats && (
          <Badge variant="outline" className="ms-auto text-xs">
            {stats.total} trips
          </Badge>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 p-4 pb-0 shrink-0">
          <StatCard label="Awaiting Acceptance"  value={stats.loading_completed} />
          <StatCard label="Driver Accepted"      value={stats.driver_accepted}  color="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Dispatch Blocked"     value={stats.dispatch_blocked} color="text-red-600 dark:text-red-400" />
        </div>
      )}

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {sections.map(({ key, label }) => {
          const sectionTrips = grouped[key];
          if (sectionTrips.length === 0) return null;
          return (
            <section key={key}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold">{label}</h2>
                <span className="text-xs text-muted-foreground">({sectionTrips.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sectionTrips.map((trip) => (
                  <GateTripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
