import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  Layers,
  Link2Off,
  RefreshCw,
  Shield,
  Users,
  Warehouse,
  Webhook,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/crud';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BusinessAccountFormDrawer } from '@/features/business-accounts/components/business-account-form-drawer';
import { BrandFormDrawer } from '@/features/brands/components/brand-form-drawer';
import { useBrandsQuery } from '@/features/brands/hooks/use-brands';
import type { Brand } from '@/features/brands/types/brand';
import { ChannelFormDrawer } from '@/features/channels/components/channel-form-drawer';
import { CompanyFormDrawer } from '@/features/companies/components/company-form-drawer';
import { useCompaniesQuery } from '@/features/companies/hooks/use-companies';
import type { Company } from '@/features/companies/types/company';
import { TeamFormDrawer } from '@/features/teams/components/team-form-drawer';
import { WarehouseFormDrawer } from '@/features/warehouses/components/warehouse-form-drawer';
import { useAdminDashboard } from '@/features/organization/hooks/use-admin-dashboard';
import { ROUTES } from '@/router/routes';

// ── Compact KPI Card ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  loading,
  href,
  accent,
  onCreateNew,
}: {
  icon: React.ElementType;
  label: string;
  value: number | null | undefined;
  loading?: boolean;
  href?: string;
  accent?: string;
  onCreateNew?: () => void;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (href) navigate(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (href && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      navigate(href);
    }
  };

  return (
    <div className="group">
      <Card
        className={cn('transition-colors', href && 'cursor-pointer hover:border-primary/40')}
        role={href ? 'button' : undefined}
        tabIndex={href ? 0 : undefined}
        aria-label={href ? `${label}: ${value ?? 0}. Press Enter to view.` : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <CardContent className="px-4 pt-3 pb-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
              <Icon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium leading-none mb-1">
                {label}
              </p>
              {loading ? (
                <div className="h-4 w-10 animate-pulse rounded bg-muted" />
              ) : (
                <p className={cn('text-base font-semibold leading-none tabular-nums', accent)}>
                  {value ?? 0}
                </p>
              )}
            </div>
          </div>
          {href && (
            <div className="flex items-center gap-1.5 h-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] text-muted-foreground/70 hover:text-muted-foreground">
                View →
              </span>
              {onCreateNew && (
                <>
                  <span className="text-muted-foreground/30 text-[10px]">·</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCreateNew(); }}
                    className="text-[10px] text-primary/70 hover:text-primary focus:outline-none"
                  >
                    + New
                  </button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Health Card ───────────────────────────────────────────────────────────────

function HealthCard({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  variant: 'ok' | 'warn' | 'error' | 'neutral';
}) {
  const colors = {
    ok: 'text-emerald-600',
    warn: 'text-amber-600',
    error: 'text-destructive',
    neutral: 'text-muted-foreground',
  };
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted/40 p-1.5">
            <Icon className={`size-4 ${colors[variant]}`} />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className={`text-sm font-semibold ${colors[variant]}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Org Tree ──────────────────────────────────────────────────────────────────

function OrgTree({
  companies,
  brands,
}: {
  companies: Company[];
  brands: Brand[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (companies[0]) s.add(companies[0].id);
    return s;
  });

  const brandsByCompany = useMemo(() => {
    const map = new Map<string, Brand[]>();
    for (const b of brands) {
      const list = map.get(b.company_id) ?? [];
      list.push(b);
      map.set(b.company_id, list);
    }
    return map;
  }, [brands]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Building2 className="text-muted-foreground/30 size-10" />
        <p className="text-muted-foreground text-sm">No companies yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y">
      {companies.map((company) => {
        const isOpen = expanded.has(company.id);
        const companyBrands = brandsByCompany.get(company.id) ?? [];
        return (
          <div key={company.id}>
            <button
              type="button"
              onClick={() => toggle(company.id)}
              className="flex w-full items-center gap-2.5 px-2 py-2.5 text-start hover:bg-muted/30 transition-colors rounded-md"
            >
              {isOpen ? (
                <ChevronDown className="text-muted-foreground size-4 shrink-0" />
              ) : (
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              )}
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Building2 className="text-primary size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{company.name}</p>
                <p className="text-muted-foreground truncate text-xs font-mono">{company.code}</p>
              </div>
              <Badge variant={company.is_active ? 'default' : 'secondary'} className="text-[10px]">
                {company.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {companyBrands.length > 0 && (
                <span className="text-muted-foreground text-xs shrink-0">
                  {companyBrands.length} brand{companyBrands.length !== 1 ? 's' : ''}
                </span>
              )}
            </button>

            {isOpen && companyBrands.length > 0 && (
              <div className="ml-8 border-l pl-3 pb-2">
                {companyBrands.map((brand) => (
                  <div key={brand.id} className="flex items-center gap-2.5 py-1.5">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded bg-muted">
                      <Layers className="text-muted-foreground size-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{brand.name}</p>
                      <p className="text-muted-foreground truncate text-xs font-mono">{brand.code}</p>
                    </div>
                    <Badge variant={brand.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {brand.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {isOpen && companyBrands.length === 0 && (
              <div className="ml-8 border-l pl-3 py-2">
                <p className="text-muted-foreground/60 text-xs italic">No brands yet</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Activity Timeline ─────────────────────────────────────────────────────────

const PLACEHOLDER_ACTIVITY = [
  { icon: Building2, label: 'Company created',           detail: 'ECOS Holding Company', time: 'Today' },
  { icon: Layers,    label: 'Brand created',             detail: 'CAI-HQ',               time: 'Today' },
  { icon: Warehouse, label: 'Warehouse added',           detail: 'Main Warehouse',        time: 'Today' },
  { icon: Briefcase, label: 'Business Account connected', detail: 'WooCommerce',          time: 'Today' },
  { icon: Users,     label: 'User invited',              detail: 'Administrator',          time: 'Today' },
];

function ActivityTimeline() {
  return (
    <div className="flex flex-col gap-0">
      {PLACEHOLDER_ACTIVITY.map((item, idx) => (
        <div key={idx} className="flex items-start gap-3 py-2.5">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
            <item.icon className="text-muted-foreground size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-muted-foreground text-xs">{item.detail}</p>
          </div>
          <p className="text-muted-foreground/60 shrink-0 text-xs">{item.time}</p>
        </div>
      ))}
      <p className="text-muted-foreground/50 pt-2 text-center text-xs">
        Live activity feed available once audit integration is complete.
      </p>
    </div>
  );
}

// ── Quick Action Button ───────────────────────────────────────────────────────

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="text-primary size-5" />
      </div>
      <p className="text-xs font-medium leading-tight">{label}</p>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type DrawerState =
  | 'company'
  | 'brand'
  | 'business-account'
  | 'channel'
  | 'warehouse'
  | 'team'
  | null;

export function OrganizationWorkspace() {
  const [activeDrawer, setActiveDrawer] = useState<DrawerState>(null);

  // ── Aggregate KPI data ───────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } =
    useAdminDashboard();

  // ── Org tree data (separate from KPIs) ───────────────────────────────────
  const { data: allCompanies } = useCompaniesQuery({ page: 1, per_page: 50 });
  const { data: allBrands }    = useBrandsQuery({ page: 1, per_page: 200 });

  const treeCompanies = allCompanies?.items ?? [];
  const treeBrands    = allBrands?.items ?? [];

  // ── KPI definitions ───────────────────────────────────────────────────────

  const kpis = [
    {
      icon: Building2,
      label: 'Companies',
      value: stats?.companies,
      href: ROUTES.companies,
      onCreateNew: () => setActiveDrawer('company'),
    },
    {
      icon: Layers,
      label: 'Brands',
      value: stats?.brands,
      href: ROUTES.brands,
      onCreateNew: () => setActiveDrawer('brand'),
    },
    {
      icon: Briefcase,
      label: 'Business Accounts',
      value: stats?.business_accounts,
      href: ROUTES.businessAccounts,
      onCreateNew: () => setActiveDrawer('business-account'),
    },
    {
      icon: Globe,
      label: 'Sales Channels',
      value: stats?.channels,
      href: ROUTES.channels,
      onCreateNew: () => setActiveDrawer('channel'),
    },
    {
      icon: Warehouse,
      label: 'Warehouses',
      value: stats?.warehouses,
      href: ROUTES.warehouses,
      onCreateNew: () => setActiveDrawer('warehouse'),
    },
    {
      icon: Users,
      label: 'Teams',
      value: stats?.teams,
      href: ROUTES.teams,
      onCreateNew: () => setActiveDrawer('team'),
    },
    {
      icon: Shield,
      label: 'Users',
      value: stats?.users,
      href: ROUTES.users,
    },
    {
      icon: Zap,
      label: 'Pending Invitations',
      value: stats?.pending_invitations,
      href: ROUTES.userInvitations,
    },
  ];

  // ── Health data (all placeholders) ────────────────────────────────────────

  const healthItems = [
    { icon: Wifi,          label: 'Connected Accounts', value: '—', variant: 'neutral' as const },
    { icon: WifiOff,       label: 'Disconnected',        value: '—', variant: 'neutral' as const },
    { icon: Link2Off,      label: 'OAuth Expired',        value: '—', variant: 'neutral' as const },
    { icon: Webhook,       label: 'Webhook Errors',       value: '—', variant: 'neutral' as const },
    { icon: AlertTriangle, label: 'Sync Errors',          value: '—', variant: 'neutral' as const },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Organization"
        subtitle="Enterprise organization management — companies, brands, accounts, channels, warehouses, and teams."
        breadcrumbs={[{ label: 'Home', to: ROUTES.dashboard }, { label: 'Organization' }]}
      />

      {/* ── Section A: KPI Widgets ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Organization KPIs
          </h2>
          {statsError && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => refetchStats()}
            >
              <RefreshCw className="size-3" />
              Retry
            </Button>
          )}
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              icon={kpi.icon}
              label={kpi.label}
              value={statsError ? 0 : kpi.value}
              loading={statsLoading}
              href={kpi.href}
              onCreateNew={kpi.onCreateNew}
            />
          ))}
        </div>
      </section>

      {/* ── Section B: Platform Health ─────────────────────────────────────── */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
          Platform Health
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {healthItems.map((h) => (
            <HealthCard key={h.label} {...h} />
          ))}
        </div>
        <p className="text-muted-foreground/50 mt-2 text-xs">
          Live health metrics available once Business Account integration is complete.
        </p>
      </section>

      {/* ── Sections C + D: Structure + Activity ──────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section C: Org Structure */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="size-4" />
              Organization Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <OrgTree companies={treeCompanies} brands={treeBrands} />
          </CardContent>
        </Card>

        {/* Section D: Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="size-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ActivityTimeline />
          </CardContent>
        </Card>
      </div>

      {/* ── Section E: Quick Actions ───────────────────────────────────────── */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-6">
          <QuickAction icon={Building2} label="New Company"          onClick={() => setActiveDrawer('company')} />
          <QuickAction icon={Layers}    label="New Brand"             onClick={() => setActiveDrawer('brand')} />
          <QuickAction icon={Briefcase} label="New Business Account" onClick={() => setActiveDrawer('business-account')} />
          <QuickAction icon={Globe}     label="New Sales Channel"    onClick={() => setActiveDrawer('channel')} />
          <QuickAction icon={Warehouse} label="New Warehouse"        onClick={() => setActiveDrawer('warehouse')} />
          <QuickAction icon={Users}     label="New Team"             onClick={() => setActiveDrawer('team')} />
        </div>
      </section>

      {/* ── Form Drawers ──────────────────────────────────────────────────── */}
      <CompanyFormDrawer
        open={activeDrawer === 'company'}
        onOpenChange={(open) => { if (!open) setActiveDrawer(null); }}
      />
      <BrandFormDrawer
        open={activeDrawer === 'brand'}
        onOpenChange={(open) => { if (!open) setActiveDrawer(null); }}
      />
      <BusinessAccountFormDrawer
        open={activeDrawer === 'business-account'}
        onOpenChange={(open) => { if (!open) setActiveDrawer(null); }}
      />
      <ChannelFormDrawer
        open={activeDrawer === 'channel'}
        onOpenChange={(open) => { if (!open) setActiveDrawer(null); }}
      />
      <WarehouseFormDrawer
        open={activeDrawer === 'warehouse'}
        onOpenChange={(open) => { if (!open) setActiveDrawer(null); }}
      />
      <TeamFormDrawer
        open={activeDrawer === 'team'}
        onOpenChange={(open) => { if (!open) setActiveDrawer(null); }}
      />
    </div>
  );
}
