import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/crud';

import type { JournalStatus } from '../types/finance-gl';

/** Map a JournalStatus to the enterprise StatusBadge colour variant. */
const VARIANT: Record<JournalStatus, 'active' | 'inactive' | 'pending' | 'archived'> = {
  draft: 'pending',
  approved: 'pending',
  posted: 'active',
  locked: 'inactive',
  cancelled: 'archived',
  reversed: 'archived',
};

/** Journal status badge — colour from the enterprise StatusBadge, label from the finance ns. */
export function JournalStatusBadge({ status }: { status: JournalStatus }) {
  const { t } = useTranslation('finance');
  return <StatusBadge status={VARIANT[status]} label={t(($) => $.gl.journal.status[status])} />;
}
