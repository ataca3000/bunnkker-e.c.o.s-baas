import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/crud';
import type { GoodsReceiptStatus } from '@/features/goods-receipts/types/goods-receipt';

const STATUS_VARIANTS: Record<GoodsReceiptStatus, 'pending' | 'active'> = {
  draft: 'pending',
  posted: 'active',
};

export function GrStatusBadge({ status }: { status: GoodsReceiptStatus }) {
  const { t } = useTranslation('goods-receipts');
  return <StatusBadge status={STATUS_VARIANTS[status]} label={t($ => $.status[status])} />;
}
