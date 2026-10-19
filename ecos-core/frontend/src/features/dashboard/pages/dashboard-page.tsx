import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Briefcase,
  ChevronDown,
  Factory,
  Landmark,
  Megaphone,
  Package,
  Settings,
  Users,
  Wrench,
} from 'lucide-react';

import { Badge }              from '@/components/ui/badge';
import { Button }             from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn }                 from '@/lib/utils';
import { useAuthStore }       from '@/features/auth/store/auth-store';

import { DashboardHeroStrip }  from '../components/dashboard-hero-strip';
import { DashboardAiBrief }    from '../components/dashboard-ai-brief';
import { DashboardAnalytics }  from '../components/dashboard-analytics';

import { useExecutiveDashboard }    from '../hooks/use-executive-dashboard';
import type { DashboardProfile }    from '../registry/widget-definitions';

// ── Profile definitions ────────────────────────────────────────────────────

const PROFILE_ICONS: Record<DashboardProfile, React.ComponentType<{ className?: string }>> = {
  executive: Briefcase, operations: Factory, marketing: Megaphone,
  warehouse: Package, finance: Landmark, manufacturing: Wrench, crm: Users,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function loadProfile(): DashboardProfile {
  try {
    const v = localStorage.getItem('ecos-dashboard:profile');
    if (v && v in PROFILE_ICONS) return v as DashboardProfile;
  } catch { /* ignore */ }
  return 'executive';
}

function saveProfile(p: DashboardProfile) {
  try { localStorage.setItem('ecos-dashboard:profile', p); } catch { /* ignore */ }
}

// ── Section label ──────────────────────────────────────────────────────────

function SectionLabel({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?:   React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {children}
      </p>
      {aside}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t, i18n } = useTranslation('dashboard');
  const user      = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0] ?? t($ => $.page.fallbackName);
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const greetingText = (() => { const h = new Date().getHours(); if (h < 12) return t($ => $.page.goodMorning); if (h < 17) return t($ => $.page.goodAfternoon); if (h < 21) return t($ => $.page.goodEvening); return t($ => $.page.goodNight); })();
  const todayText = new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });

  const [profile, setProfile] = useState<DashboardProfile>(loadProfile);

  const handleProfileChange = useCallback((p: DashboardProfile) => {
    setProfile(p);
    saveProfile(p);
  }, []);

  // `isError` and `refetch` were never read, so a failed request was
  // indistinguishable from a slow one and the page skeletoned forever
  // (TASK-GL-HOTFIX-001).
  const { data, isLoading, isError, refetch } = useExecutiveDashboard();
  const loading = isLoading;
  const retry = () => void refetch();

  const alertCount = data
    ? (data.sales.cancelled_today > 0 ? 1 : 0) + (data.shipping.failed_today > 0 ? 1 : 0)
    : 0;
  const operational = alertCount === 0;
  const ProfileIcon = PROFILE_ICONS[profile];

  return (
    <div className="flex flex-col gap-0 pb-10">

      {/* ── Section 1: Executive Header ──────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        {/* Left — greeting */}
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-[11px] font-medium text-muted-foreground">{greetingText}</p>
            <span className="text-muted-foreground/30">·</span>
            <p className="text-[11px] text-muted-foreground">{todayText}</p>
          </div>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{firstName}</h1>

          {/* Status row */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 text-xs',
                operational
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
              )}
            >
              <span className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                operational ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse',
              )} />
              {operational ? t($ => $.page.statusOperational) : (alertCount > 1 ? t($ => $.page.statusAlertPlural, { count: alertCount }) : t($ => $.page.statusAlertSingular, { count: alertCount }))}
            </Badge>
            {data?.sales.out_for_delivery ? (
              <Badge variant="outline" className="gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                {t($ => $.page.outForDelivery, { count: data.sales.out_for_delivery })}
              </Badge>
            ) : null}
            {data?.operations.active_waves ? (
              <Badge variant="outline" className="gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                {data.operations.active_waves === 1 ? t($ => $.page.activeWaveSingular, { count: data.operations.active_waves }) : t($ => $.page.activeWavePlural, { count: data.operations.active_waves })}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Right — dashboard profile switcher (dashboard-specific, not in global header) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <ProfileIcon className="h-3.5 w-3.5" />
              {t($ => $.profiles[profile].label)}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t($ => $.page.profileLabel)}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.entries(PROFILE_ICONS) as [DashboardProfile, React.ComponentType<{ className?: string }>][]).map(([key, Icon]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => handleProfileChange(key)}
                className={cn('gap-2 text-sm', profile === key && 'bg-muted')}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">{t($ => $.profiles[key].label)}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{t($ => $.profiles[key].description)}</p>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-xs text-muted-foreground" disabled>
              <Settings className="h-3.5 w-3.5" />
              {t($ => $.page.workspaceSettings)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Section 2: Hero KPI Strip ─────────────────────────────────── */}
      <DashboardHeroStrip data={data} loading={loading} profile={profile} error={isError} onRetry={retry} />

      {/* ── Workspace body ─────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-col gap-10">

        {/* ── Section 3: AI Executive Brief ─────────────────────────── */}
        <section>
          <SectionLabel
            aside={
              <span className="text-[10px] text-muted-foreground/50">
                {t($ => $.page.updatesEvery5min)}
              </span>
            }
          >
            {t($ => $.page.aiBriefSection)}
          </SectionLabel>
          <DashboardAiBrief data={data} loading={loading} error={isError} onRetry={retry} />
        </section>

        {/* Divider */}
        <div className="-mt-4 border-t" />

        {/* ── Section 4: Business Analytics ──────────────────────────────── */}
        <section className="-mt-4">
          <SectionLabel
            aside={
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {t($ => $.page.monthlyHistorical)}
              </Badge>
            }
          >
            {t($ => $.page.analyticsSection)}
          </SectionLabel>
          <DashboardAnalytics data={data} loading={loading} />
        </section>

      </div>
    </div>
  );
}
