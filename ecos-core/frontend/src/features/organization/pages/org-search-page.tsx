import { useState, useCallback } from 'react';
import { Building2, Briefcase, Globe, Search, Users, Warehouse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/crud';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganizationContext } from '@/features/organization/context/organization-context';
import { useCompaniesQuery } from '@/features/companies/hooks/use-companies';
import { useBrandsQuery } from '@/features/brands/hooks/use-brands';
import { useBusinessAccountsQuery } from '@/features/business-accounts/hooks/use-business-accounts';
import { useChannelsQuery } from '@/features/channels/hooks/use-channels';
import { useWarehousesQuery } from '@/features/warehouses/hooks/use-warehouses';
import { useTeamsQuery } from '@/features/teams/hooks/use-teams';
import { ROUTES } from '@/router/routes';

const SEARCH_LIMIT = 5;

type ResultItem = {
  id: string;
  code?: string;
  name: string;
  meta?: string;
};

type ResultGroup = {
  label: string;
  icon: React.ElementType;
  route: string;
  items: ResultItem[];
  isLoading: boolean;
};

function ResultGroupCard({ group }: { group: ResultGroup }) {
  const navigate = useNavigate();

  if (group.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <group.icon className="size-4 text-muted-foreground" />
            {group.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (group.items.length === 0) {
    return (
      <Card className="opacity-60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <group.icon className="size-4 text-muted-foreground" />
            {group.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-2">No results</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            <group.icon className="size-4 text-muted-foreground" />
            {group.label}
          </span>
          <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {group.items.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(group.route)}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-start hover:bg-muted/50 transition-colors w-full"
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.code && (
                <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                  {item.code}
                </Badge>
              )}
              <span className="text-sm font-medium truncate">{item.name}</span>
            </div>
            {item.meta && (
              <span className="text-xs text-muted-foreground ml-2 shrink-0">{item.meta}</span>
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export function OrgSearchPage() {
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const { activeCompanyId } = useOrganizationContext();

  const enabled = query.trim().length >= 2;
  const companyId = activeCompanyId ?? undefined;

  const companiesResult = useCompaniesQuery(
    { search: query, per_page: SEARCH_LIMIT },
    { enabled },
  );
  const brandsResult = useBrandsQuery(
    { search: query, company_id: companyId, per_page: SEARCH_LIMIT },
    { enabled },
  );
  const businessAccountsResult = useBusinessAccountsQuery(
    { search: query, company_id: companyId, per_page: SEARCH_LIMIT },
    { enabled },
  );
  const channelsResult = useChannelsQuery(
    { search: query, company_id: companyId, per_page: SEARCH_LIMIT },
    { enabled },
  );
  const warehousesResult = useWarehousesQuery(
    { search: query, company_id: companyId, per_page: SEARCH_LIMIT },
    { enabled },
  );
  const teamsResult = useTeamsQuery(
    { search: query, company_id: companyId, per_page: SEARCH_LIMIT },
    { enabled },
  );

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    // Debounce-like: only set query after 2+ chars
    if (val.trim().length >= 2) {
      setQuery(val.trim());
    } else {
      setQuery('');
    }
  }, []);

  const groups: ResultGroup[] = [
    {
      label: 'Companies',
      icon: Building2,
      route: ROUTES.companies,
      items: (companiesResult.data?.items ?? []).map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        meta: c.country ?? undefined,
      })),
      isLoading: enabled && companiesResult.isLoading,
    },
    {
      label: 'Brands',
      icon: Globe,
      route: ROUTES.brands,
      items: (brandsResult.data?.items ?? []).map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        meta: b.company?.name,
      })),
      isLoading: enabled && brandsResult.isLoading,
    },
    {
      label: 'Business Accounts',
      icon: Briefcase,
      route: ROUTES.businessAccounts,
      items: (businessAccountsResult.data?.items ?? []).map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        meta: a.provider,
      })),
      isLoading: enabled && businessAccountsResult.isLoading,
    },
    {
      label: 'Sales Channels',
      icon: Globe,
      route: ROUTES.channels,
      items: (channelsResult.data?.items ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        meta: c.platform_label,
      })),
      isLoading: enabled && channelsResult.isLoading,
    },
    {
      label: 'Warehouses',
      icon: Warehouse,
      route: ROUTES.warehouses,
      items: (warehousesResult.data?.items ?? []).map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name,
        meta: w.city ?? w.country ?? undefined,
      })),
      isLoading: enabled && warehousesResult.isLoading,
    },
    {
      label: 'Teams',
      icon: Users,
      route: ROUTES.teams,
      items: (teamsResult.data?.items ?? []).map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        meta: t.leader_name ?? undefined,
      })),
      isLoading: enabled && teamsResult.isLoading,
    },
  ];

  const hasAnyResults = enabled && groups.some((g) => g.items.length > 0);
  const isAnyLoading = groups.some((g) => g.isLoading);
  const hasResults = groups.filter((g) => g.items.length > 0);
  const noResults = enabled && !isAnyLoading && !hasAnyResults;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Organization Search"
        subtitle="Search across companies, brands, business accounts, channels, warehouses, and teams."
        breadcrumbs={[
          { label: 'Home', to: ROUTES.dashboard },
          { label: 'Organization', to: ROUTES.organization },
          { label: 'Search' },
        ]}
      />

      {/* Search bar */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={handleInput}
          placeholder="Type at least 2 characters to search…"
          className="pl-9 h-11 text-base"
          autoFocus
        />
        {activeCompanyId && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70">
            Filtered by active company
          </span>
        )}
      </div>

      {/* Empty / prompt state */}
      {!enabled && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Search className="size-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">Start typing to search</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            Enter at least 2 characters to search across all organization entities simultaneously.
          </p>
        </div>
      )}

      {/* No results state */}
      {noResults && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Search className="size-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">No results found</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            No organization entities matched &ldquo;{query}&rdquo;. Try a different search term.
          </p>
        </div>
      )}

      {/* Results grid */}
      {enabled && (isAnyLoading || hasAnyResults) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(isAnyLoading ? groups : hasResults).map((group) => (
            <ResultGroupCard key={group.label} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
