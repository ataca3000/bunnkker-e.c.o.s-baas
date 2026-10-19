import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { findNavItemByPath } from '@/config/module-navigation';
import { ROUTES } from '@/router/routes';
import { useNavLabel } from './use-nav-label';

/**
 * Breadcrumb bar. Derives the current segment from the active navigation item.
 */
export function AppBreadcrumbs() {
  const { t } = useTranslation('common');
  const navLabel = useNavLabel();
  const { pathname } = useLocation();
  const current = findNavItemByPath(pathname);
  const isDashboard = pathname === ROUTES.dashboard;

  return (
    <div className="text-muted-foreground flex items-center gap-1.5 border-b px-4 py-2.5 text-sm sm:px-6">
      <Link to={ROUTES.dashboard} className="hover:text-foreground transition-colors">
        {t($ => $.home)}
      </Link>
      {!isDashboard && current ? (
        <>
          <ChevronRight className="size-3.5" data-flip-rtl aria-hidden />
          <span className="text-foreground font-medium">{current.kind === 'item' ? navLabel.item(current.key) : navLabel.group(current.id)}</span>
        </>
      ) : null}
    </div>
  );
}
