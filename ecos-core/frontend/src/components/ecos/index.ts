/**
 * ECOS Component Library
 *
 * Single entry point for all shared UI components.
 * Organises: crud/ (generic CRUD kit) + ds/ (design system) + ecos/ (domain-shared).
 *
 * Import from here in feature modules:
 *   import { PhoneCell, SyncBadge, EntityTable, StatusBadge } from '@/components/ecos';
 */

// ── Enterprise CRUD Kit ───────────────────────────────────────────────────────
export { PageHeader }                from '@/components/crud/page-header';
export { EntityTable }               from '@/components/crud/entity-table';
export { EntityToolbar }             from '@/components/crud/entity-toolbar';
export { SearchInput }               from '@/components/crud/search-input';
export { FilterPanel }               from '@/components/crud/filter-panel';
export { Pagination }                from '@/components/crud/pagination';
export { EmptyState }                from '@/components/crud/empty-state';
export { LoadingState }              from '@/components/crud/loading-state';
export { ErrorState }                from '@/components/crud/error-state';
export { ConfirmDialog }             from '@/components/crud/confirm-dialog';
export { Combobox }                  from '@/components/crud/combobox';
export { StatusBadge }               from '@/components/crud/status-badge';
export { EntityForm, FormField }     from '@/components/crud/entity-form';
export { EntityDrawer }              from '@/components/crud/entity-drawer';
export { ActionMenu }                from '@/components/crud/action-menu';

// ── Design System ─────────────────────────────────────────────────────────────
export { QuickStatCard }             from '@/components/ds/quick-stat-card';
export { Tabs, type TabItem }        from '@/components/ds/tabs';
export { ToastProvider }             from '@/components/ds/toast-provider';
export { useToast, useToastStore }   from '@/components/ds/use-toast';

// ── Domain-Shared Components ──────────────────────────────────────────────────
export { PhoneCell, type PhoneCellLabels }  from '@/components/ecos/phone-cell';
export { SyncBadge, type SyncStatus }       from '@/components/ecos/sync-badge';
export * from '@/components/ecos/tokens';
