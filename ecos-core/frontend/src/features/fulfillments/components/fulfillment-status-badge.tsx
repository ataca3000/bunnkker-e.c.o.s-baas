import { useTranslation } from 'react-i18next';

import type { FulfillmentStatus } from '@/features/fulfillments/types/fulfillment';

const STATUS_CLASS: Record<FulfillmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  fulfilled: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

export function FulfillmentStatusBadge({ status }: { status: FulfillmentStatus }) {
  const { t } = useTranslation('fulfillments');
  const className = STATUS_CLASS[status] ?? STATUS_CLASS.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {t($ => $.status[status])}
    </span>
  );
}
