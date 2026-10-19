import { ChevronRight, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/router/routes';
import type { WorkspaceBreadcrumb } from '../types';

/**
 * The platform's single breadcrumb renderer.
 *
 * Both page headers delegate here — `WorkspaceHeader` and the CRUD
 * `PageHeader` — so every workspace draws breadcrumbs from one implementation
 * with one set of rules for separators, truncation, collapsing and RTL.
 *
 * ┌─ THE HOME CRUMB IS NORMALISED HERE, NOT AT THE CALL SITE ────────────────┐
 * │ The label was hardcoded to the string 'Home' in this component, and ~53   │
 * │ CRUD pages passed their own first crumb — some translated, some with the  │
 * │ literal 'Home'. In Arabic the result was visibly split: Orders showed     │
 * │ الرئيسية while Finance showed "Home" (BUG-GL-006).                        │
 * │                                                                           │
 * │ Rather than edit 89 pages, any crumb pointing at the dashboard is         │
 * │ recognised here and rewritten to the translated label and the Home icon.  │
 * │ Callers may pass one or omit it; either way exactly one appears, in the   │
 * │ viewer's language. A caller cannot get this wrong any more.               │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
type Props = {
  crumbs: WorkspaceBreadcrumb[];
  className?: string;
};

const ELLIPSIS = '…';

export function WorkspaceBreadcrumbs({ crumbs, className }: Props) {
  const { t } = useTranslation('common');
  const homeLabel = t(($) => $.home);

  // Drop any caller-supplied home crumb, then prepend the canonical one. This
  // is what keeps the label translated no matter which header called us.
  const rest = crumbs.filter((c) => c.to !== ROUTES.dashboard);
  const all: WorkspaceBreadcrumb[] = [
    { label: homeLabel, to: ROUTES.dashboard, icon: Home },
    ...rest,
  ];

  // Collapse middle segments when the path is deep (> 4 items total).
  const visible =
    all.length <= 4
      ? all
      : [
          all[0],
          { label: ELLIPSIS } as WorkspaceBreadcrumb,
          all[all.length - 2],
          all[all.length - 1],
        ];

  return (
    <nav
      aria-label={t(($) => $.breadcrumb)}
      className={cn('flex items-center text-xs text-muted-foreground', className)}
    >
      <ol className="flex flex-wrap items-center gap-0.5">
        {visible.map((crumb, i) => {
          const isLast = i === visible.length - 1;
          const isEllipsis = crumb.label === ELLIPSIS;
          const Icon = crumb.icon;
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-0.5">
              {i > 0 ? (
                <ChevronRight
                  className="mx-0.5 size-3 shrink-0 text-muted-foreground/40"
                  data-flip-rtl
                  aria-hidden
                />
              ) : null}
              {isEllipsis ? (
                <span className="px-1 text-muted-foreground/60">{ELLIPSIS}</span>
              ) : crumb.to && !isLast ? (
                <Link
                  to={crumb.to}
                  className={cn(
                    'flex items-center gap-1 rounded px-1 py-0.5 transition-colors',
                    'hover:bg-accent hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                >
                  {Icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
                  <span className="max-w-[9rem] truncate">{crumb.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    'flex items-center gap-1 px-1 py-0.5',
                    isLast && 'font-medium text-foreground',
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {Icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
                  <span className="max-w-[12rem] truncate">{crumb.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
