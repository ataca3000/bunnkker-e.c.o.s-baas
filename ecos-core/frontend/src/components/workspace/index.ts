// Main composition component
export { WorkspaceHeader } from './header/workspace-header';

// Sub-components (composable individually)
export { WorkspaceBreadcrumbs } from './breadcrumbs/workspace-breadcrumbs';
export { WorkspacePageIdentity } from './header/workspace-page-identity';
export { WorkspaceMetricCard } from './metrics/workspace-metric-card';
export { WorkspaceMetricsRow } from './metrics/workspace-metrics-row';
export { WorkspaceContextActions } from './context-actions/workspace-context-actions';
export { WorkspaceSavedViews } from './saved-views/workspace-saved-views';
export { WorkspaceToolbarSlot } from './toolbar/workspace-toolbar-slot';

// Types
export type {
  WorkspaceBreadcrumb,
  WorkspaceMetric,
  WorkspaceAction,
  SavedView,
  SavedViewsConfig,
  WorkspaceHeaderProps,
} from './types';
