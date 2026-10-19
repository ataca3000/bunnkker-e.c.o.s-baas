import type { ReactNode } from 'react';

import type { BreadcrumbItem } from '@/components/crud/types';
import { WorkspaceBreadcrumbs } from '@/components/workspace/breadcrumbs/workspace-breadcrumbs';

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  /** Primary action(s) shown on the right (e.g. a "New" button). */
  actions?: ReactNode;
};

/**
 * Reusable page header: breadcrumbs, title, subtitle and primary actions.
 *
 * Breadcrumbs are delegated to WorkspaceBreadcrumbs rather than drawn here.
 * This header used to render its own `<nav>` with its own separators, its own
 * truncation rules and no collapsing, while WorkspaceHeader rendered a
 * different one — so the same trail looked and behaved differently depending on
 * which header a page happened to use, and the home crumb was translated in one
 * and hardcoded English in the other (BUG-GL-006). There is now one renderer.
 */
export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumbs && breadcrumbs.length > 0 ? <WorkspaceBreadcrumbs crumbs={breadcrumbs} /> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <div className="text-muted-foreground mt-1 text-sm">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
