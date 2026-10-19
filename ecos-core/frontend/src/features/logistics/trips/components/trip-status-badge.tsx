import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import type { TripStatus } from '../types/trip';

type LogisticsLabel = ($: typeof enLogistics) => string;

/**
 * Status colours follow the operational meaning of the state, not its position
 * in the sequence: anything blocking dispatch reads as a problem, anything on
 * the road reads as active, and terminal states are muted.
 */
const STATUS_CLASS: Record<TripStatus, string> = {
  planning: 'bg-muted text-muted-foreground',
  loading: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  loading_completed: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  driver_accepted: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  dispatch_blocked: 'bg-destructive/10 text-destructive',
  ready_for_dispatch: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  dispatched: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  out_for_delivery: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  in_progress: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  settlement_pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  closed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground line-through',
};

/**
 * Every trip status has its own translated label, so the backend's English
 * `status_label` is never rendered — it is a fallback for surfaces that have no
 * translation layer, and using it here would leak English into Arabic.
 */
const STATUS_LABEL: Record<TripStatus, LogisticsLabel> = {
  planning: ($) => $.trips.status.planning,
  loading: ($) => $.trips.status.loading,
  loading_completed: ($) => $.trips.status.loading_completed,
  driver_accepted: ($) => $.trips.status.driver_accepted,
  dispatch_blocked: ($) => $.trips.status.dispatch_blocked,
  ready_for_dispatch: ($) => $.trips.status.ready_for_dispatch,
  dispatched: ($) => $.trips.status.dispatched,
  out_for_delivery: ($) => $.trips.status.out_for_delivery,
  in_progress: ($) => $.trips.status.in_progress,
  completed: ($) => $.trips.status.completed,
  settlement_pending: ($) => $.trips.status.settlement_pending,
  closed: ($) => $.trips.status.closed,
  cancelled: ($) => $.trips.status.cancelled,
};

/**
 * Kept module-private: a file that exports both a hook and a component breaks
 * Fast Refresh, and this label is only ever needed by the badge itself.
 */
function useTripStatusLabel() {
  const { t } = useTranslation('logistics');
  return (status: TripStatus) => t(STATUS_LABEL[status]);
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  const label = useTripStatusLabel();

  return (
    <Badge variant="secondary" className={STATUS_CLASS[status]}>
      {label(status)}
    </Badge>
  );
}
