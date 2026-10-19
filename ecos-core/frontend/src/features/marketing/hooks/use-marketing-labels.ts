import { useTranslation } from 'react-i18next';

import type { CampaignInternalStatus } from '../campaign-studio/types/campaign-studio';

// ── Static style maps (not i18n-dependent) ────────────────────────────────────

export const CAMPAIGN_INTERNAL_STATUS_COLORS: Record<CampaignInternalStatus, string> = {
  draft:          'bg-gray-100 text-gray-700',
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved:       'bg-blue-100 text-blue-700',
  scheduled:      'bg-purple-100 text-purple-700',
  publishing:     'bg-indigo-100 text-indigo-700',
  published:      'bg-green-100 text-green-800',
  paused:         'bg-orange-100 text-orange-700',
  archived:       'bg-gray-100 text-gray-500',
  failed:         'bg-red-100 text-red-700',
  rejected:       'bg-red-100 text-red-700',
};

// ── Marketing labels ──────────────────────────────────────────────────────────
// Single source of truth for internal campaign flow labels.
// External Meta platform statuses (ACTIVE, PAUSED, …) → CAMPAIGN_STATUS_LABELS in types/campaign.ts
// internalStatusLabel    → internal draft-flow statuses (draft, pending_review, …)
// internalStatusTabLabel → abbreviated tab labels for the Campaign Studio

export function useMarketingLabels() {
  const { t } = useTranslation('marketing');

  const internalStatusLabel: Record<CampaignInternalStatus, string> = {
    draft:          t($ => $.campaigns.status.draft),
    pending_review: t($ => $.campaigns.status.pending_review),
    approved:       t($ => $.campaigns.status.approved),
    scheduled:      t($ => $.campaigns.status.scheduled),
    publishing:     t($ => $.campaigns.status.publishing),
    published:      t($ => $.campaigns.status.published),
    paused:         t($ => $.campaigns.status.paused),
    archived:       t($ => $.campaigns.status.archived),
    failed:         t($ => $.campaigns.status.failed),
    rejected:       t($ => $.campaigns.status.rejected),
  };

  const internalStatusTabLabel: Partial<Record<CampaignInternalStatus | 'all', string>> = {
    all:            t($ => $.campaigns.statusTab.all),
    draft:          t($ => $.campaigns.statusTab.draft),
    pending_review: t($ => $.campaigns.statusTab.pending_review),
    approved:       t($ => $.campaigns.statusTab.approved),
    scheduled:      t($ => $.campaigns.statusTab.scheduled),
    published:      t($ => $.campaigns.statusTab.published),
    paused:         t($ => $.campaigns.statusTab.paused),
    archived:       t($ => $.campaigns.statusTab.archived),
    failed:         t($ => $.campaigns.statusTab.failed),
  };

  return { internalStatusLabel, internalStatusTabLabel };
}
