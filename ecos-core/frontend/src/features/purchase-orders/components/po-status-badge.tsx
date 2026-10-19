import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/crud';
import type { PurchaseOrderStatus } from '@/features/purchase-orders/types/purchase-order';

const STATUS_VARIANTS: Record<PurchaseOrderStatus, 'pending' | 'active' | 'archived'> = {
  draft: 'pending',
  submitted: 'pending',
  approved: 'active',
  partially_received: 'active',
  received: 'active',
  cancelled: 'archived',
};

export function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { t } = useTranslation('purchase-orders');
  return <StatusBadge status={STATUS_VARIANTS[status]} label={t($ => $.status[status])} />;
}
