import { useTranslation } from 'react-i18next';
import { Archive, CheckCircle, Truck, UserCheck, Wrench, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { VehicleStatus } from '../types/vehicle';

import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of
 * key strings can never type-check. The selector is the same expression
 * the compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

const CONFIG: Record<VehicleStatus, { labelKey: LogisticsLabel; className: string; Icon: typeof CheckCircle }> = {
  available: {
    labelKey: ($) => $.common.available,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
    Icon: CheckCircle,
  },
  assigned: {
    labelKey: ($) => $.common.assigned,
    className: 'bg-blue-600 hover:bg-blue-600 text-white',
    Icon: UserCheck,
  },
  in_delivery: {
    labelKey: ($) => $.vehicles.status.inDelivery,
    className: 'bg-indigo-600 hover:bg-indigo-600 text-white',
    Icon: Truck,
  },
  maintenance: {
    labelKey: ($) => $.vehicles.status.maintenance,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
    Icon: Wrench,
  },
  out_of_service: {
    labelKey: ($) => $.vehicles.status.outOfService,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
    Icon: XCircle,
  },
  archived: {
    labelKey: ($) => $.vehicles.status.archived,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    Icon: Archive,
  },
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className, Icon } = CONFIG[status];

  return (
    <Badge className={`gap-1 text-xs ${className}`}>
      <Icon className="size-3" />
      {t(labelKey)}
    </Badge>
  );
}
