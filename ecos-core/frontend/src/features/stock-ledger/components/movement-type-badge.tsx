import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MovementType } from '@/features/stock-ledger/types/stock-movement';

const TYPE_DOT: Record<MovementType, string> = {
  purchase_receipt: 'bg-emerald-500',
  sales_issue: 'bg-rose-500',
  adjustment_in: 'bg-blue-500',
  adjustment_out: 'bg-orange-500',
  transfer_in: 'bg-violet-500',
  transfer_out: 'bg-amber-500',
};

export function MovementTypeBadge({ type }: { type: MovementType }) {
  const { t } = useTranslation('stock-ledger');
  return (
    <Badge variant="secondary" className="gap-1.5 whitespace-nowrap">
      <span className={cn('size-1.5 rounded-full', TYPE_DOT[type])} />
      {t(`movementTypes.${type}`)}
    </Badge>
  );
}
