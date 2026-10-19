import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { StockSyncStatus } from '@/features/stock-sync/types/stock-sync';

const STATUS_CLASS: Record<StockSyncStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  success: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
};

export function StockSyncStatusBadge({ status }: { status: StockSyncStatus }) {
  const { t } = useTranslation('stock-sync');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_CLASS[status],
      )}
    >
      {t($ => $.status[status])}
    </span>
  );
}
