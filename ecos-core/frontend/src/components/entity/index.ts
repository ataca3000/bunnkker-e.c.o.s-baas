// ── Main composition component ────────────────────────────────────────────────
export { EntityWorkspace } from './entity-workspace';

// ── Sub-components (composable individually) ──────────────────────────────────
export { EntityWorkspaceToolbar } from './toolbar/entity-workspace-toolbar';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  EntityHeaderConfig,
  EntityToolbarConfig,
  EntityBulkConfig,
  EntityPaginationConfig,
  EntityEmptyStateConfig,
} from './types';
