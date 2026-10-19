import type { ComponentType, ReactNode } from 'react';

export type WorkspaceBreadcrumb = {
  label: string;
  to?: string;
  icon?: ComponentType<{ className?: string }>;
};

export type WorkspaceMetric = {
  id: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  colorClass?: string;
  onClick?: () => void;
  active?: boolean;
  isLoading?: boolean;
};

export type WorkspaceAction = {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  soon?: boolean;
};

export type SavedView = {
  id: string;
  label: string;
  isDefault?: boolean;
  count?: number;
};

export type SavedViewsConfig = {
  views: SavedView[];
  activeId: string;
  onViewChange: (id: string) => void;
};

export type WorkspaceHeaderProps = {
  breadcrumbs?: WorkspaceBreadcrumb[];
  title: string;
  description?: string;
  badge?: ReactNode;
  metrics?: WorkspaceMetric[];
  primaryAction?: WorkspaceAction;
  secondaryActions?: WorkspaceAction[];
  savedViews?: SavedViewsConfig;
  toolbarSlot?: ReactNode;
  noBorder?: boolean;
  className?: string;
};
