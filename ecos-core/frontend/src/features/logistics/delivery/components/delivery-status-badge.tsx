import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  MapPin,
  PackageCheck,
  RotateCcw,
  Truck,
  Undo2,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { DeliveryStatus } from '../types/delivery';

import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of
 * key strings can never type-check. The selector is the same expression
 * the compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

/**
 * `labelKey` is a `logistics` namespace key — resolved at render, never stored translated.
 *
 * Module-private: nothing outside this file reads it, and exporting a constant
 * beside a component is what stops Fast Refresh from hot-reloading the module.
 */
const DELIVERY_STATUS_CONFIG: Record<
  DeliveryStatus,
  { labelKey: LogisticsLabel; className: string; Icon: typeof CheckCircle }
> = {
  pending: {
    labelKey: ($) => $.common.pending,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    Icon: Clock,
  },
  scheduled: {
    labelKey: ($) => $.common.scheduled,
    className: 'bg-sky-600 hover:bg-sky-600 text-white',
    Icon: Clock,
  },
  in_transit: {
    labelKey: ($) => $.delivery.status.inTransit,
    className: 'bg-blue-600 hover:bg-blue-600 text-white',
    Icon: Truck,
  },
  out_for_delivery: {
    labelKey: ($) => $.delivery.status.outForDelivery,
    className: 'bg-indigo-600 hover:bg-indigo-600 text-white',
    Icon: MapPin,
  },
  attempted: {
    labelKey: ($) => $.delivery.status.attempted,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
    Icon: AlertTriangle,
  },
  delivered: {
    labelKey: ($) => $.delivery.status.delivered,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
    Icon: CheckCircle,
  },
  partially_delivered: {
    labelKey: ($) => $.delivery.status.partiallyDelivered,
    className: 'bg-amber-600 hover:bg-amber-600 text-white',
    Icon: PackageCheck,
  },
  failed: {
    labelKey: ($) => $.common.failed,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
    Icon: XCircle,
  },
  awaiting_retry: {
    labelKey: ($) => $.delivery.status.awaitingRetry,
    className: 'bg-orange-500 hover:bg-orange-500 text-white',
    Icon: RotateCcw,
  },
  returning: {
    labelKey: ($) => $.delivery.status.returning,
    className: 'bg-purple-600 hover:bg-purple-600 text-white',
    Icon: Undo2,
  },
  returned: {
    labelKey: ($) => $.delivery.status.returned,
    className: 'bg-slate-600 hover:bg-slate-600 text-white',
    Icon: Undo2,
  },
  cancelled: {
    labelKey: ($) => $.common.cancelled,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    Icon: Ban,
  },
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className, Icon } = DELIVERY_STATUS_CONFIG[status];

  return (
    <Badge className={`gap-1 text-xs ${className}`}>
      <Icon className="size-3" />
      {t(labelKey)}
    </Badge>
  );
}
