import { RefreshCw, Smartphone } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDriverTrips } from '../hooks/use-driver-mobile';
import { DriverTripCard } from '../components/driver-trip-card';

export function DriverHomePage() {
  const { money } = useFormatter();
  const { data: trips, isLoading, refetch, isFetching } = useDriverTrips();

  const totalOrders    = trips?.reduce((s, t) => s + t.orders_count, 0) ?? 0;
  const totalCollected = trips?.reduce(
    (s, t) => s + Number(t.total_cash_collected) + Number(t.total_bank_transfers) + Number(t.total_already_paid),
    0,
  ) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">Driver Mobile</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* KPI row */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-px bg-border mx-0">
          {[
            { label: 'Active Trips', value: trips?.length ?? 0 },
            { label: 'Total Orders', value: totalOrders },
            { label: money(totalCollected), value: 'Collected' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-background px-3 py-3 text-center">
              <p className="font-bold text-base">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Trip list */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))
        ) : trips && trips.length > 0 ? (
          trips.map((trip) => <DriverTripCard key={trip.id} trip={trip} />)
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Smartphone className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-base font-medium">No active trips</p>
            <p className="text-sm mt-1">Trips will appear here once dispatched.</p>
          </div>
        )}
      </div>
    </div>
  );
}
