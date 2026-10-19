import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/features/product-mappings/types/product-mapping';

const DOT_CLASS: Record<SyncStatus, string> = {
  pending: 'bg-amber-500',
  synced: 'bg-emerald-500',
  error: 'bg-rose-500',
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const { t } = useTranslation('product-mappings');
  const dotClass = DOT_CLASS[status] ?? 'bg-gray-400';
  const label = status === 'error'
    ? t($ => $.syncStatus.failed)
    : t($ => $.syncStatus[status]);

  return (
    <Badge variant="secondary" className="gap-1.5 whitespace-nowrap">
      <span className={cn('size-1.5 rounded-full', dotClass)} />
      {label}
    </Badge>
  );
}
