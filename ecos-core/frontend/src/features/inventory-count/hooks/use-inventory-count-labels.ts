import { useTranslation } from 'react-i18next';

import type { CountSessionStatus } from '../types/inventory-count';

// ── Static style map ──────────────────────────────────────────────────────────

export const COUNT_STATUS_COLORS: Record<CountSessionStatus, string> = {
  draft:       'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  completed:   'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  approved:    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  cancelled:   'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
};

// ── Count session status labels ───────────────────────────────────────────────
// Single source of truth for CountSessionStatus → display string.
// Note: 'completed' renders as "Pending Approval" — the count is done but
// awaiting supervisor sign-off before adjustments are posted.

export function useInventoryCountLabels() {
  const { t } = useTranslation('inventory-count');

  const countStatusLabel: Record<CountSessionStatus, string> = {
    draft:       t($ => $.sessions.status.draft),
    in_progress: t($ => $.sessions.status.in_progress),
    completed:   t($ => $.sessions.status.completed),
    approved:    t($ => $.sessions.status.approved),
    cancelled:   t($ => $.sessions.status.cancelled),
  };

  const countStatusFilter: Array<{ value: CountSessionStatus | 'all'; label: string }> = [
    { value: 'all',         label: t($ => $.sessions.status.all, { defaultValue: 'All' }) },
    { value: 'draft',       label: t($ => $.sessions.status.draft) },
    { value: 'in_progress', label: t($ => $.sessions.status.in_progress) },
    { value: 'completed',   label: t($ => $.sessions.status.completed) },
    { value: 'approved',    label: t($ => $.sessions.status.approved) },
    { value: 'cancelled',   label: t($ => $.sessions.status.cancelled) },
  ];

  return { countStatusLabel, countStatusFilter };
}
