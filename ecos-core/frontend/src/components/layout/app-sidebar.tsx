import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AppModule } from '@/config/module-navigation';
import { usePriceReviewBadge } from '@/features/cost-management/hooks/use-pricing-reviews';
import { useLanguage } from '@/providers/language-context';
import { useNavLabel } from './use-nav-label';

function PriceReviewBadge() {
  const { data } = usePriceReviewBadge();
  const count = data?.pending ?? 0;
  if (count === 0) return null;
  return (
    <span className="ms-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  );
}

type AppSidebarProps = {
  activeModule: AppModule | undefined;
  collapsed?: boolean;
  onCollapse?: () => void;
  onNavigate?: () => void;
  className?: string;
};

export function AppSidebar({
  activeModule,
  collapsed = false,
  onCollapse,
  onNavigate,
  className,
}: AppSidebarProps) {
  const { dir } = useLanguage();
  const { t } = useTranslation('common');
  const navLabel = useNavLabel();
  if (!activeModule || activeModule.items.length === 0) return null;

  // In RTL the sidebar is at the inline-end (physical right), so chevron direction flips.
  const ExpandIcon  = dir === 'rtl' ? ChevronLeft  : ChevronRight;
  const CollapseIcon = dir === 'rtl' ? ChevronRight : ChevronLeft;

  if (collapsed) {
    return (
      <div className={cn('flex flex-col items-center bg-sidebar py-2 w-9', className)}>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onCollapse}
          aria-label={t($ => $.nav.expandSidebar)}
        >
          <ExpandIcon className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex w-60 flex-col bg-sidebar', className)}>
      {/* Sidebar header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <span className="truncate text-sm font-semibold text-foreground">
          {navLabel.group(activeModule.id)}
        </span>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={onCollapse}
            aria-label={t($ => $.nav.collapseSidebar)}
          >
            <CollapseIcon className="size-4" />
          </Button>
        )}
      </div>

      {/* Nav items */}
      <nav
        aria-label={t($ => $.nav.moduleNav, {
          module: navLabel.group(activeModule.id),
        })}
        className="flex flex-col gap-0.5 overflow-y-auto p-2"
      >
        {activeModule.items.map((item) => {
          if (item.isSection) {
            return (
              <div key={item.key} className="mb-1 mt-4 px-3 first:mt-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {navLabel.item(item.key)}
                </p>
              </div>
            );
          }
          const Icon = item.icon;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{navLabel.item(item.key)}</span>
              {item.key === 'price-review' && <PriceReviewBadge />}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
