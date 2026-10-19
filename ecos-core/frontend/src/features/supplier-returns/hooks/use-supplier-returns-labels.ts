import { useTranslation } from 'react-i18next';

import type { SupplierReturnStatus } from '../types/supplier-return';

// ── Static style map ──────────────────────────────────────────────────────────

export const RETURN_STATUS_COLORS: Record<SupplierReturnStatus, string> = {
  draft:            'bg-gray-100 text-gray-700',
  waiting_approval: 'bg-yellow-100 text-yellow-800',
  approved:         'bg-blue-100 text-blue-800',
  sent:             'bg-purple-100 text-purple-800',
  credit_pending:   'bg-orange-100 text-orange-800',
  completed:        'bg-green-100 text-green-800',
  cancelled:        'bg-red-100 text-red-700',
  rejected:         'bg-red-100 text-red-700',
};

// ── Supplier return status labels ─────────────────────────────────────────────
// Single source of truth — badge cells, filter chips, and drawer all consume this.

export function useSupplierReturnLabels() {
  const { t } = useTranslation('supplier-returns');

  const returnStatusLabel: Record<SupplierReturnStatus, string> = {
    draft:            t($ => $.status.draft),
    waiting_approval: t($ => $.status.waiting_approval),
    approved:         t($ => $.status.approved),
    sent:             t($ => $.status.sent),
    credit_pending:   t($ => $.status.credit_pending),
    completed:        t($ => $.status.completed),
    cancelled:        t($ => $.status.cancelled),
    rejected:         t($ => $.status.rejected),
  };

  const returnColumnHeaders = {
    number:     t($ => $.columns.number),
    supplier:   t($ => $.columns.supplier),
    returnDate: t($ => $.columns.returnDate),
    reason:     t($ => $.columns.reason),
    amount:     t($ => $.columns.amount),
    status:     t($ => $.columns.status),
  };

  return { returnStatusLabel, returnColumnHeaders };
}
