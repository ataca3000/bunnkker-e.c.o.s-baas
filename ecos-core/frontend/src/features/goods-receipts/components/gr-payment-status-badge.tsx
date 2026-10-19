import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/crud';
import type { PaymentStatus } from '@/features/goods-receipts/types/goods-receipt';

const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, 'active' | 'pending' | 'inactive'> = {
  paid: 'active',
  partially_paid: 'pending',
  unpaid: 'inactive',
};

export function GrPaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation('goods-receipts');
  const label: Record<PaymentStatus, string> = {
    paid:           t($ => $.paymentStatus.paid),
    partially_paid: t($ => $.paymentStatus.partiallyPaid),
    unpaid:         t($ => $.paymentStatus.unpaid),
  };
  return <StatusBadge status={PAYMENT_STATUS_VARIANTS[status]} label={label[status]} />;
}
