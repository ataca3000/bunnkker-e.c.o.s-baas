import { cn } from '@/lib/utils';
import type { DeliveryStopStatus } from '../types/driver-mobile';
import { STOP_STATUS_COLORS, STOP_STATUS_LABELS } from '../types/driver-mobile';

interface StopStatusBadgeProps {
  status: DeliveryStopStatus;
  className?: string;
}

export function StopStatusBadge({ status, className }: StopStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STOP_STATUS_COLORS[status],
        className,
      )}
    >
      {STOP_STATUS_LABELS[status]}
    </span>
  );
}
