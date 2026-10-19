import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/crud';

import type { DocumentStatus, PaymentStatus } from '../types/finance-ap';

const BILL_VARIANT: Record<DocumentStatus, 'active' | 'inactive' | 'pending' | 'archived'> = {
  draft: 'pending',
  posted: 'active',
  void: 'archived',
};

/** AP payment lifecycle: draft → approved → posted → void (maker/checker). */
const PAYMENT_VARIANT: Record<PaymentStatus, 'active' | 'inactive' | 'pending' | 'archived'> = {
  draft: 'pending',
  approved: 'pending',
  posted: 'active',
  void: 'archived',
};

/** Bill status badge (Draft / Posted / Void). */
export function BillStatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation('finance');
  return <StatusBadge status={BILL_VARIANT[status]} label={t(($) => $.ap.docStatus[status])} />;
}

/** Payment status badge (Draft / Approved / Posted / Void). */
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation('finance');
  return <StatusBadge status={PAYMENT_VARIANT[status]} label={t(($) => $.ap.paymentStatus[status])} />;
}

/**
 * Renders a supplier reference. The AP API exposes only `supplier_id` (uuid) — no name — so
 * the shortened id is shown with the EXACT backend identifier in the tooltip, undecorated and
 * uninterpreted (see the report's Finance ↔ vendor boundary).
 */
export function SupplierRef({ id }: { id: string }) {
  return (
    <span className="font-mono text-xs" title={id}>
      {id.slice(0, 8)}…
    </span>
  );
}
