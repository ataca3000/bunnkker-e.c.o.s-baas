import { useNavigate } from 'react-router-dom';
import { useFormatter } from '@/hooks/use-formatter';
import {
  ClipboardList,
  Package,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useLoadingDashboard } from '../hooks/use-loading-manifest';
import {
  LOADING_STATUS_COLORS,
  LOADING_STATUS_LABELS,
  type LoadingDashboardTrip,
  type LoadingStatus,
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

function LoadingProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground min-w-[2.5rem] text-end">
        {value}/{max}
      </span>
    </div>
  );
}

function TripLoadingCard({ trip }: { trip: LoadingDashboardTrip }) {
  const { money } = useFormatter();
  const navigate = useNavigate();
  const badgeClass = LOADING_STATUS_COLORS[trip.loading_status as LoadingStatus] ?? 'bg-muted text-muted-foreground';

  const driverLine = [
    trip.driver_display !== 'No Driver' ? trip.driver_display : null,
    trip.vehicle_plate || trip.carrier_name || null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
      {/* Color strip */}
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: trip.zone_color ?? '#64748b' }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{trip.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{trip.trip_number}</span>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', badgeClass)}>
                {LOADING_STATUS_LABELS[trip.loading_status as LoadingStatus] ?? trip.loading_status}
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
            variant="outline"
            className="h-7 text-xs gap-1 shrink-0"
            onClick={() => navigate(`${ROUTES.loadingWorkspace}/${trip.id}/loading`)}
          >
            <ClipboardList className="h-3 w-3" />
            Open
          </Button>
        </div>

        {/* Driver & vehicle */}
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
            <div className="text-lg font-bold tabular-nums">
              {money(trip.collection_amount)}
            </div>
            <div className="text-xs text-muted-foreground">Collection</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{trip.total_products}</div>
            <div className="text-xs text-muted-foreground">Products</div>
          </div>
        </div>

        {/* Warehouse progress */}
        {trip.total_products > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Warehouse Loading</span>
              <span className="tabular-nums">{trip.confirmed_products}/{trip.total_products}</span>
            </div>
            <LoadingProgressBar value={trip.confirmed_products} max={trip.total_products} />
          </div>
        )}

        {/* Driver confirmation progress (only in driver handover phase) */}
        {(trip.loading_status === 'loaded' || trip.loading_status === 'ready_for_dispatch') && trip.total_products > 0 && (
          <div className="space-y-1.5 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Driver Confirmation</span>
              <span className="tabular-nums">{trip.driver_confirmed}/{trip.total_products}</span>
            </div>
            <LoadingProgressBar value={trip.driver_confirmed} max={trip.total_products} />
            {trip.driver_discrepancies > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {trip.driver_discrepancies} discrepanc{trip.driver_discrepancies !== 1 ? 'ies' : 'y'} need review
              </p>
            )}
          </div>
        )}

        {/* Custody */}
        {trip.custody_total > 0 && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Package className="h-3 w-3 shrink-0" />
            <span>Custody: {trip.custody_confirmed}/{trip.custody_total} confirmed</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function LoadingDashboardPage() {
  const { data, isLoading, isError } = useLoadingDashboard();

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Failed to load loading system dashboard. Please refresh the page.</p>
      </div>
    );
  }

  const stats = data?.stats;
  const trips = data?.trips ?? [];

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="p-4 rounded-full bg-muted">
          <Truck className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg mb-1">No Active Loading Trips</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Approved trips will appear here for loading. Approve a trip on the distribution board to get started.
          </p>
        </div>
      </div>
    );
  }

  const grouped: Record<LoadingStatus, LoadingDashboardTrip[]> = {
    waiting_for_loading: [],
    loading:             [],
    loaded:              [],
    ready_for_dispatch:  [],
  };

  for (const trip of trips) {
    const key = trip.loading_status as LoadingStatus;
    if (grouped[key]) {
      grouped[key].push(trip);
    }
  }

  const orderedSections: LoadingStatus[] = ['ready_for_dispatch', 'loaded', 'loading', 'waiting_for_loading'];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
          <Truck className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-sm">Loading System Dashboard</h1>
          <p className="text-xs text-muted-foreground">All active warehouse loading trips</p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {stats && (
            <Badge variant="outline" className="text-xs">
              {stats.total} trips
            </Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 p-4 pb-0 shrink-0">
          <StatCard label="Waiting for Loading"  value={stats.waiting_for_loading} />
          <StatCard label="Loading"              value={stats.loading}             color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Driver Handover"      value={stats.loaded}              color="text-amber-600 dark:text-amber-400" />
          <StatCard label="Ready to Dispatch"    value={stats.ready_for_dispatch}  color="text-emerald-600 dark:text-emerald-400" />
        </div>
      )}

      {/* Trip sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {orderedSections.map((section) => {
          const sectionTrips = grouped[section];
          if (sectionTrips.length === 0) return null;

          return (
            <section key={section}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold">{LOADING_STATUS_LABELS[section]}</h2>
                <span className="text-xs text-muted-foreground">({sectionTrips.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sectionTrips.map((trip) => (
                  <TripLoadingCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
