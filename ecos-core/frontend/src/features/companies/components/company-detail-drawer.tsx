import { useState } from 'react';
import { Building2, Globe, History, Pencil, Users, Warehouse } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { getMediaUrl } from '@/lib/media';
import type { Company } from '@/features/companies/types/company';
import { COMPANY_CURRENCIES, COMPANY_TIMEZONES } from '@/features/companies/types/company';
import { useBrandsQuery } from '@/features/brands/hooks/use-brands';
import { useWarehousesQuery } from '@/features/warehouses/hooks/use-warehouses';
import { useTeamsQuery } from '@/features/teams/hooks/use-teams';

type CompanyDetailDrawerProps = {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (company: Company) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function currencyLabel(code: string | null): string {
  if (!code) return '—';
  return COMPANY_CURRENCIES.find((c) => c.value === code)?.label ?? code;
}

function timezoneLabel(tz: string | null): string {
  if (!tz) return '—';
  return COMPANY_TIMEZONES.find((t) => t.value === tz)?.label ?? tz;
}

const TAB_CLS =
  'flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs';

// ── OrgLogo — resolves relative DB paths, falls back to icon on error ─────────

type OrgLogoProps = {
  path: string | null | undefined;
  name: string;
  size?: 'sm' | 'md';
};

function OrgLogo({ path, name, size = 'md' }: OrgLogoProps) {
  const [imgError, setImgError] = useState(false);
  const url = getMediaUrl(path);

  const dims = size === 'sm' ? 'size-7' : 'size-10';
  const icon = size === 'sm' ? 'size-3.5' : 'size-5';

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={name}
        className={`${dims} rounded-lg object-contain border bg-muted/20`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`bg-primary/10 flex ${dims} items-center justify-center rounded-lg shrink-0`}>
      <Building2 className={`text-primary ${icon}`} />
    </div>
  );
}

// ── Relationship list helpers ─────────────────────────────────────────────────

function RelationshipSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-md border bg-muted/20 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyRelationship({ icon: Icon, message }: { icon: typeof Globe; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted/50">
        <Icon className="text-muted-foreground/50 size-7" />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

type OverviewTabProps = {
  company: Company;
  brandsCount: number;
  warehousesCount: number;
  teamsCount: number;
};

function OverviewTab({ company, brandsCount, warehousesCount, teamsCount }: OverviewTabProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* KPI metrics strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Brands',     value: brandsCount },
          { label: 'Channels',   value: company.channels_count },
          { label: 'Warehouses', value: warehousesCount },
          { label: 'Teams',      value: teamsCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border bg-muted/30 p-2.5 text-center">
            <p className="text-lg font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Detail rows */}
      <dl className="grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Code</dt>
          <dd className="font-mono font-medium">{company.code}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{company.name}</dd>
        </div>
        {company.legal_name && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Legal Name</dt>
              <dd>{company.legal_name}</dd>
            </div>
          </>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Badge variant={company.is_active ? 'default' : 'secondary'}>
              {company.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Currency</dt>
          <dd>{currencyLabel(company.currency)}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Timezone</dt>
          <dd className="text-xs">{timezoneLabel(company.timezone)}</dd>
        </div>
        {company.email && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-xs">{company.email}</dd>
            </div>
          </>
        )}
        {company.phone && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{company.phone}</dd>
            </div>
          </>
        )}
        {(company.city ?? company.country) && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Location</dt>
              <dd>{[company.city, company.country].filter(Boolean).join(', ')}</dd>
            </div>
          </>
        )}
        {company.description && (
          <>
            <Separator />
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="text-sm text-muted-foreground/80">{company.description}</dd>
            </div>
          </>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Created</dt>
          <dd className="text-muted-foreground text-xs">
            {company.created_at ? new Date(company.created_at).toLocaleDateString() : '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Updated</dt>
          <dd className="text-muted-foreground text-xs">
            {company.updated_at ? new Date(company.updated_at).toLocaleDateString() : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export function CompanyDetailDrawer({
  company,
  open,
  onOpenChange,
  onEdit,
}: CompanyDetailDrawerProps) {
  if (!company) return null;

  // Fire all relationship queries when the drawer is open
  const brandsResult     = useBrandsQuery({ company_id: company.id, per_page: 50 }, { enabled: open });
  const warehousesResult = useWarehousesQuery({ company_id: company.id, per_page: 50 }, { enabled: open });
  const teamsResult      = useTeamsQuery({ company_id: company.id, per_page: 50 }, { enabled: open });

  const brands     = brandsResult.data?.items ?? [];
  const warehouses = warehousesResult.data?.items ?? [];
  const teams      = teamsResult.data?.items ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden p-0">
        <SheetTitle className="sr-only">{company.name} — Company Details</SheetTitle>

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 border-b px-6 py-5 flex-none pr-14">
          <div className="flex items-center gap-3 min-w-0">
            <OrgLogo path={company.logo} name={company.name} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold leading-none truncate">{company.name}</span>
                <Badge
                  variant={company.is_active ? 'default' : 'secondary'}
                  className="text-[10px] px-1.5 py-0 shrink-0"
                >
                  {company.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <SheetDescription className="font-mono text-xs mt-0.5">{company.code}</SheetDescription>
            </div>
          </div>
          {onEdit && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => onEdit(company)}>
              <Pencil className="size-3.5 mr-1" />
              Edit
            </Button>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="overview">
            <div className="sticky top-0 z-10 bg-background border-b">
              <TabsList className="w-full rounded-none border-0 bg-transparent h-10 gap-0 p-0">
                <TabsTrigger value="overview"   className={TAB_CLS}>Overview</TabsTrigger>
                <TabsTrigger value="brands"     className={TAB_CLS}>Brands</TabsTrigger>
                <TabsTrigger value="warehouses" className={TAB_CLS}>Warehouses</TabsTrigger>
                <TabsTrigger value="teams"      className={TAB_CLS}>Teams</TabsTrigger>
                <TabsTrigger value="activity"   className={TAB_CLS}>Activity</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="m-0 px-6 py-5">
              <OverviewTab
                company={company}
                brandsCount={brandsResult.data?.meta.total ?? company.brands_count}
                warehousesCount={warehousesResult.data?.meta.total ?? company.warehouses_count}
                teamsCount={teamsResult.data?.meta.total ?? company.teams_count}
              />
            </TabsContent>

            <TabsContent value="brands" className="m-0 px-6 py-5">
              {brandsResult.isLoading ? (
                <RelationshipSkeleton />
              ) : brands.length === 0 ? (
                <EmptyRelationship icon={Globe} message="No brands linked to this company." />
              ) : (
                <div className="flex flex-col gap-2">
                  {brands.map((brand) => (
                    <div
                      key={brand.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="bg-primary/10 flex size-7 items-center justify-center rounded shrink-0">
                        <Building2 className="text-primary size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{brand.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{brand.code}</p>
                      </div>
                      <Badge variant={brand.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {brand.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="warehouses" className="m-0 px-6 py-5">
              {warehousesResult.isLoading ? (
                <RelationshipSkeleton />
              ) : warehouses.length === 0 ? (
                <EmptyRelationship icon={Warehouse} message="No warehouses linked to this company." />
              ) : (
                <div className="flex flex-col gap-2">
                  {warehouses.map((wh) => (
                    <div
                      key={wh.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="bg-primary/10 flex size-7 items-center justify-center rounded shrink-0">
                        <Warehouse className="text-primary size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{wh.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {[wh.code, wh.city].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <Badge variant={wh.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {wh.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="teams" className="m-0 px-6 py-5">
              {teamsResult.isLoading ? (
                <RelationshipSkeleton />
              ) : teams.length === 0 ? (
                <EmptyRelationship icon={Users} message="No teams linked to this company." />
              ) : (
                <div className="flex flex-col gap-2">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="bg-primary/10 flex size-7 items-center justify-center rounded shrink-0">
                        <Users className="text-primary size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{team.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {[team.code, team.leader_name].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <Badge variant={team.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {team.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="m-0 px-6 py-5">
              <EmptyRelationship icon={History} message="Activity timeline will be available in a future update." />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
