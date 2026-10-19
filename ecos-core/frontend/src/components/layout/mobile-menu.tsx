import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/common/brand-logo';
import { Button } from '@/components/ui/button';
import { APP_MODULES } from '@/config/module-navigation';
import { CompanySwitcher } from '@/components/layout/header';
import { WarehouseSwitcher } from '@/components/layout/header';
import { useNavLabel } from './use-nav-label';

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const { t } = useTranslation('common');
  const navLabel = useNavLabel();

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t($ => $.nav.menu)}
      className="fixed inset-0 z-50 flex flex-col bg-background md:hidden"
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <BrandLogo />
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t($ => $.nav.closeMenu)}>
          <X className="size-5" aria-hidden />
        </Button>
      </div>

      {/* Company + Warehouse context — mobile only */}
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <CompanySwitcher className="flex-1" />
        <WarehouseSwitcher className="flex-1" />
      </div>

      {/* Module grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t($ => $.nav.workspaces)}
        </p>
        <div className="flex flex-col gap-1">
          {APP_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div key={mod.id}>
                <NavLink
                  to={mod.defaultPath}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl border p-3.5 transition-colors',
                      isActive
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/40',
                    )
                  }
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {navLabel.group(mod.id)}
                    </p>
                    {mod.items.length > 0 && (
                      <p className="truncate text-xs text-muted-foreground">
                        {mod.items
                          .map((i) => navLabel.item(i.key))
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </NavLink>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
