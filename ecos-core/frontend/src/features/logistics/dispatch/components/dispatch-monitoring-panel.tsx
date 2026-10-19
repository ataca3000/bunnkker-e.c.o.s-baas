import { useTranslation } from 'react-i18next';

import {
  useAssignmentHealth,
  useCapacityUtilisation,
  useDispatchKpis,
  useQueueStatistics,
} from '../hooks/use-dispatch-ops';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <dl className="space-y-1.5 text-xs">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value ?? '—'}</dd>
    </div>
  );
}

/**
 * Operational metrics only — what happened, never what will happen.
 */
export function DispatchMonitoringPanel() {
  const { t } = useTranslation('logistics');
  const { data: kpis } = useDispatchKpis();
  const { data: queue } = useQueueStatistics();
  const { data: health } = useAssignmentHealth();
  const { data: capacity } = useCapacityUtilisation();

  /**
   * A rate with no denominator is not zero — it is unknown. Saying "0%" when
   * nothing was attempted invites a decision that the data does not support.
   */
  const percent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return t($ => $.common.noDataYet);
    return `${Math.round(value * 100)}%`;
  };

  const minutes = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return t($ => $.common.noDataYet);
    return t($ => $.dispatch.units.minutes, { value });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title={t($ => $.dispatch.monitoring.dispatch)}>
        <Row label={t($ => $.dispatch.monitoring.sessionsOpened)} value={kpis?.sessions_opened} />
        <Row label={t($ => $.dispatch.monitoring.sessionsActive)} value={kpis?.sessions_active} />
        <Row label={t($ => $.dispatch.monitoring.sessionsAbandoned)} value={kpis?.sessions_abandoned} />
        <Row
          label={t($ => $.dispatch.monitoring.allocationsAttempted)}
          value={kpis?.allocations_attempted}
        />
        <Row
          label={t($ => $.dispatch.monitoring.allocationsConfirmed)}
          value={kpis?.allocations_confirmed}
        />
        <Row label={t($ => $.dispatch.monitoring.allocationsFailed)} value={kpis?.allocations_failed} />
        <Row
          label={t($ => $.dispatch.monitoring.confirmationRate)}
          value={percent(kpis?.confirmation_rate)}
        />
        <Row label={t($ => $.dispatch.monitoring.automaticShare)} value={percent(kpis?.automatic_share)} />
        <Row
          label={t($ => $.dispatch.monitoring.avgSessionLength)}
          value={minutes(kpis?.avg_session_minutes)}
        />
      </Panel>

      <Panel title={t($ => $.dispatch.monitoring.queue)}>
        <Row label={t($ => $.dispatch.monitoring.depth)} value={queue?.depth} />
        <Row label={t($ => $.dispatch.monitoring.needsAction)} value={queue?.needs_action} />
        <Row label={t($ => $.dispatch.monitoring.stuck)} value={queue?.stuck} />
        <Row label={t($ => $.dispatch.monitoring.avgWait)} value={minutes(queue?.avg_wait_minutes)} />
        <Row
          label={t($ => $.dispatch.monitoring.longestWait)}
          value={minutes(queue?.oldest_wait_minutes)}
        />
      </Panel>

      <Panel title={t($ => $.dispatch.monitoring.assignmentHealth)}>
        <Row label={t($ => $.dispatch.monitoring.openConflicts)} value={health?.open_conflicts} />
        <Row label={t($ => $.dispatch.monitoring.blockingConflicts)} value={health?.blocking_conflicts} />
        <Row
          label={t($ => $.dispatch.monitoring.oldestConflict)}
          value={minutes(health?.oldest_conflict_minutes)}
        />
        <Row label={t($ => $.dispatch.monitoring.pendingReviews)} value={health?.pending_reviews} />
        <Row
          label={t($ => $.dispatch.monitoring.oldestReview)}
          value={minutes(health?.oldest_review_minutes)}
        />
        <Row label={t($ => $.dispatch.monitoring.heldResources)} value={health?.held_locks} />
      </Panel>

      {/* Read from Network's ledger. Dispatch reports it; it does not own it. */}
      <Panel title={t($ => $.dispatch.monitoring.capacityOwnedByNetwork)}>
        <Row label={t($ => $.dispatch.monitoring.slots)} value={capacity?.slot_count} />
        <Row
          label={t($ => $.dispatch.monitoring.avgUtilisation)}
          value={percent(capacity?.avg_utilisation)}
        />
        <Row label={t($ => $.dispatch.monitoring.nearCapacity)} value={capacity?.at_warn_threshold} />
        <Row label={t($ => $.dispatch.monitoring.exhausted)} value={capacity?.exhausted} />
      </Panel>
    </div>
  );
}
