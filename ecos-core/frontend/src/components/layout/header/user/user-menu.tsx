import { Activity, ChevronDown, Keyboard, LogOut, Settings2, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Avatar, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageSwitcher } from '@/components/common/language-switcher';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { ROUTES } from '@/router/routes';

export function UserMenu() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const name = user?.name ?? t(($) => $.userMenu.fallbackName);
  const email = user?.email ?? '';
  // Extension point: derive from user.roles when RBAC is wired.
  const role = t(($) => $.userMenu.role);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label={t(($) => $.userMenu.ariaLabel, { name })}
          className="h-9 gap-2 rounded-full px-1.5 sm:rounded-lg sm:px-2"
        >
          <Avatar className="size-7">
            <AvatarFallback className="text-[11px] font-semibold">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          {/* Name + role — lg+ (Desktop) */}
          <span className="hidden flex-col items-start lg:flex">
            <span className="max-w-[7rem] truncate text-xs font-semibold leading-tight">
              {name}
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground">{role}</span>
          </span>
          {/* Name only — md (Tablet) */}
          <span className="hidden max-w-[6rem] truncate text-xs font-semibold leading-tight md:block lg:hidden">
            {name}
          </span>
          <ChevronDown className="hidden size-3.5 shrink-0 opacity-50 md:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {/* ── Identity header ── */}
        <DropdownMenuLabel className="py-0">
          <div className="flex items-center gap-3 py-3">
            <Avatar className="size-10 shrink-0">
              <AvatarFallback className="text-sm font-bold">{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <span className="mt-0.5 inline-block rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                {role}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* ── Menu items ── */}
        <DropdownMenuItem disabled>
          <User className="size-4" aria-hidden />
          {t(($) => $.userMenu.profile)}
          <span className="ms-auto text-[10px] text-muted-foreground/60">
            {t(($) => $.userMenu.soon)}
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => navigate(ROUTES.settings)}>
          <Settings2 className="size-4" aria-hidden />
          {t(($) => $.userMenu.preferences)}
        </DropdownMenuItem>

        <DropdownMenuItem disabled>
          <Keyboard className="size-4" aria-hidden />
          {t(($) => $.userMenu.shortcuts)}
          <span className="ms-auto text-[10px] text-muted-foreground/60">
            {t(($) => $.userMenu.soon)}
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem disabled>
          <Activity className="size-4" aria-hidden />
          {t(($) => $.userMenu.activityLog)}
          <span className="ms-auto text-[10px] text-muted-foreground/60">
            {t(($) => $.userMenu.soon)}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* ── Language + Theme ── */}
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-xs text-muted-foreground">{t(($) => $.userMenu.appearance)}</span>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* ── Logout ── */}
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut className="size-4" aria-hidden />
          {t(($) => $.userMenu.logout)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
