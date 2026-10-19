import { useNavigate } from 'react-router-dom';
import { useFormatter } from '@/hooks/use-formatter';
import { Phone } from 'lucide-react';
import { ROUTES } from '@/router/routes';
import type { DeliveryStop } from '../types/driver-mobile';
import { StopStatusBadge } from './stop-status-badge';

interface DeliveryStopCardProps {
  stop: DeliveryStop;
  tripId: string;
}

const STATUS_BORDER: Record<string, string> = {
  pending:     'border-l-gray-300',
  in_progress: 'border-l-blue-500',
  delivered:   'border-l-green-500',
  partial:     'border-l-amber-500',
  failed:      'border-l-red-500',
  returned:    'border-l-purple-500',
  skipped:     'border-l-gray-200',
};

export function DeliveryStopCard({ stop, tripId }: DeliveryStopCardProps) {
  const { money } = useFormatter();
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(
      ROUTES.driverTripStop
        .replace(':tripId', tripId)
        .replace(':stopId', stop.id),
    );
  };

  const phone = (stop as unknown as Record<string, unknown>)['billing_phone'] as string | undefined
    ?? stop.order?.billing_phone;

  return (
    <div
      className={`cursor-pointer rounded-lg border border-l-4 bg-card p-3 shadow-sm hover:shadow-md transition-shadow ${STATUS_BORDER[stop.status] ?? 'border-l-gray-300'}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Sequence + order number */}
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
            {stop.sequence}
          </span>
          <div>
            <p className="text-sm font-medium">
              {stop.order?.order_number ?? `Stop #${stop.sequence}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {stop.order?.customer_name ?? '—'}
            </p>
          </div>
        </div>
        <StopStatusBadge status={stop.status} />
      </div>

      {/* Address */}
      {stop.order?.shipping_address && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
          {stop.order.shipping_address}
        </p>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {money(Number(stop.collected_amount || 0))}
        </span>
        {phone && (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-blue-600 hover:underline"
          >
            <Phone className="h-3 w-3" />
            {phone}
          </a>
        )}
      </div>
    </div>
  );
}
