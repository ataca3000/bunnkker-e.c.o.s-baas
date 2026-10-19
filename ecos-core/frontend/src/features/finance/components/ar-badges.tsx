import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/crud';

import type { DocumentStatus } from '../types/finance-ar';

const VARIANT: Record<DocumentStatus, 'active' | 'inactive' | 'pending' | 'archived'> = {
  draft: 'pending',
  posted: 'active',
  void: 'archived',
};

/** Document status badge (Draft / Posted / Void) — colour from the enterprise StatusBadge. */
export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation('finance');
  return <StatusBadge status={VARIANT[status]} label={t(($) => $.ar.docStatus[status])} />;
}

/**
 * Renders a customer reference. The AR API exposes only `customer_id` (uuid) — no name —
 * so we show a shortened id with the full id on hover, and callers surface the name-gap note.
 */
export function CustomerRef({ id }: { id: string }) {
  return (
    <span className="font-mono text-xs" title={id}>
      {id.slice(0, 8)}…
    </span>
  );
}
