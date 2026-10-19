import { cn } from '@/lib/utils';

import { WorkspaceBreadcrumbs } from '../breadcrumbs/workspace-breadcrumbs';
import { WorkspaceContextActions } from '../context-actions/workspace-context-actions';
import { WorkspaceMetricsRow } from '../metrics/workspace-metrics-row';
import { WorkspaceSavedViews } from '../saved-views/workspace-saved-views';
import type { WorkspaceHeaderProps } from '../types';
import { WorkspacePageIdentity } from './workspace-page-identity';

export function WorkspaceHeader({
  breadcrumbs,
  title,
  description,
  badge,
  metrics,
  primaryAction,
  secondaryActions,
  savedViews,
  toolbarSlot,
  noBorder = false,
  className,
}: WorkspaceHeaderProps) {
  const hasMetrics = metrics && metrics.length > 0;
  const hasSavedViews = savedViews && savedViews.views.length > 0;

  return (
    <div className={cn('bg-background', !noBorder && 'border-b', className)}>
      {/* ── Identity: breadcrumbs + title + actions + metrics ── */}
      <div className="px-4 pb-4 pt-3 sm:px-6">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <WorkspaceBreadcrumbs crumbs={breadcrumbs} className="mb-2.5" />
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <WorkspacePageIdentity title={title} description={description} badge={badge} />
          <WorkspaceContextActions
            primaryAction={primaryAction}
            secondaryActions={secondaryActions}
          />
        </div>

        {hasMetrics ? <WorkspaceMetricsRow metrics={metrics!} className="mt-4" /> : null}
      </div>

      {/* ── Saved views tab strip ── */}
      {hasSavedViews ? (
        <div className="border-t px-4 sm:px-6">
          <WorkspaceSavedViews {...savedViews!} />
        </div>
      ) : null}

      {/* ── Toolbar injection slot ── */}
      {toolbarSlot ? <div className="border-t px-4 py-3 sm:px-6">{toolbarSlot}</div> : null}
    </div>
  );
}
