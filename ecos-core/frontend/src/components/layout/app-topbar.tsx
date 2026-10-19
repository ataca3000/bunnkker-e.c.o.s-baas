import { PanelLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/common/brand-logo';

import {
  BrandSwitcher,
  CompanySwitcher,
  GlobalSearch,
  NotificationCenter,
  SmartCreate,
  UserMenu,
  WarehouseSwitcher,
} from './header';

type AppTopbarProps = {
  onOpenSidebar: () => void;
};

/**
 * Global ERP command bar — sticky, z-40, h-14.
 *
 * Layout (left → right):
 *   BrandLogo | SidebarToggle(md-only) | GlobalSearch(flex-1, sm+)
 *   | SearchIcon(mobile) | Company(md+) | Warehouse(md+)
 *   | SmartCreate(md+) | Notifications | UserMenu
 *
 * Language + Theme are accessible via the UserMenu dropdown on all screen sizes.
 */
export function AppTopbar({ onOpenSidebar }: AppTopbarProps) {
  const { t } = useTranslation('common');

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-3 sm:px-4">

      {/* ── Left: Brand + sidebar toggle ── */}
      <BrandLogo />

      <Button
        variant="ghost"
        size="icon"
        className="hidden md:flex lg:hidden shrink-0"
        onClick={onOpenSidebar}
        aria-label={t($ => $.nav.toggleSidebar)}
      >
        <PanelLeft className="size-5" aria-hidden data-flip-rtl />
      </Button>

      {/* ── Center: Global search (flex-1 so it fills available space) ── */}
      <div className="hidden flex-1 sm:flex">
        <GlobalSearch />
      </div>

      {/* ── Right section ── */}
      <div className="ms-auto flex items-center gap-1 sm:gap-1.5">

        {/* Search icon — mobile only (dialog triggered via context) */}
        <div className="sm:hidden">
          <GlobalSearch />
        </div>

        {/* Company + Brand + Warehouse switchers — tablet+ */}
        <div className="hidden md:flex items-center gap-1.5">
          <CompanySwitcher />
          <BrandSwitcher />
          <WarehouseSwitcher />
        </div>

        {/* Smart Create — tablet+ */}
        <div className="hidden md:block">
          <SmartCreate />
        </div>

        {/* Notifications — always visible */}
        <NotificationCenter />

        {/* User menu — always visible (lang+theme inside dropdown) */}
        <UserMenu />
      </div>
    </header>
  );
}
