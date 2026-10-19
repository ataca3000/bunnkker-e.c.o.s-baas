import type { ComponentType, ReactNode } from 'react';

import type { BulkActionItem } from '@/components/data-grid';
import type { SavedViewsConfig, WorkspaceBreadcrumb, WorkspaceMetric } from '@/components/workspace';

// ── Header ─────────────────────────────────────────────────────────────────────

export type EntityHeaderConfig = {
  title: string;
  description?: string;
  breadcrumbs?: WorkspaceBreadcrumb[];
  /** Rendered as the primary action button in WorkspaceHeader (top-right). */
  primaryAction?: {
    key?: string;
    label: string;
    icon?: ComponentType<{ className?: string }>;
    onClick: () => void;
    disabled?: boolean;
  };
  metrics?: WorkspaceMetric[];
  savedViews?: SavedViewsConfig;
};

// ── Toolbar ────────────────────────────────────────────────────────────────────

export type EntityToolbarConfig = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Center slot — view toggles, density controls, custom content. */
  center?: ReactNode;
  /** Import button. Omit to hide. */
  onImport?: () => void;
  importLabel?: string;
  /** Export button. Omit to hide. */
  onExport?: () => void;
  exportLabel?: string;
  /** Extra items inserted in the right group, before column presets and AI actions. */
  extra?: ReactNode;
};

// ── Bulk selection ─────────────────────────────────────────────────────────────

export type EntityBulkConfig = {
  selectedCount: number;
  actions: BulkActionItem[];
  onClearSelection: () => void;
  /** e.g. "suppliers", "customers". Defaults to "items". */
  entityLabel?: string;
};

// ── Pagination ─────────────────────────────────────────────────────────────────

export type EntityPaginationConfig = {
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
};

// ── Empty state ────────────────────────────────────────────────────────────────

export type EntityEmptyStateConfig = {
  icon?: ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  action?: {
    label: string;
    icon?: ComponentType<{ className?: string }>;
    onClick: () => void;
  };
};
