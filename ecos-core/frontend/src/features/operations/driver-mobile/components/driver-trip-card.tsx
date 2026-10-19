import { useNavigate } from 'react-router-dom';
import { useFormatter } from '@/hooks/use-formatter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Package, DollarSign } from 'lucide-react';
import { ROUTES } from '@/router/routes';
import type { DriverTrip } from '../types/driver-mobile';

interface DriverTripCardProps {
  trip: DriverTrip;
}

const STATUS_COLORS: Record<string, string> = {
  out_for_delivery: 'bg-blue-100 text-blue-700',
  in_progress:      'bg-amber-100 text-amber-700',
  completed:        'bg-green-100 text-green-700',
};

export function DriverTripCard({ trip }: DriverTripCardProps) {
  const { money } = useFormatter();
  const navigate = useNavigate();

  const statusLabel =
    trip.status === 'out_for_delivery' ? 'Out for Delivery' :
    trip.status === 'in_progress'      ? 'In Progress' :
    trip.status;

  const collected =
    Number(trip.total_cash_collected) +
    Number(trip.total_bank_transfers) +
    Number(trip.total_already_paid);

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm">{trip.trip_number}</p>
          {trip.name && <p className="text-xs text-muted-foreground">{trip.name}</p>}
        </div>
        <Badge
          className={STATUS_COLORS[trip.status] ?? 'bg-gray-100 text-gray-700'}
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {trip.zone_code && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {trip.zone_code}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Package className="h-3.5 w-3.5" />
          {trip.orders_count} orders
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-3.5 w-3.5" />
          {money(collected)}
        </span>
      </div>

      {/* Driver / vehicle */}
      {(trip.driver_name || trip.vehicle_plate) && (
        <p className="text-xs text-muted-foreground">
          {[trip.driver_name, trip.vehicle_plate].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* CTA */}
      <Button
        size="sm"
        className="w-full"
        onClick={() => navigate(ROUTES.driverTrip.replace(':tripId', trip.id))}
      >
        Open Trip
      </Button>
    </div>
  );
}
