import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store/auth-store';
import { useOrganizationContext } from '@/features/organization/context/organization-context';
import { executiveService } from '../services/executive-service';
import type { ExecutiveDomain, ExecutiveFilters } from '../types/executive';

/**
 * Executive Platform hooks.
 *
 * ADR-024 cache keys: company-prefixed, with the filter set folded into the key
 * so switching branch or date range is a distinct cache entry rather than a
 * silent overwrite of the previous board.
 *
 * ┌─ IAM DECIDES WHAT IS EVEN REQUESTED ────────────────────────────────────┐
 * │ A domain the viewer cannot see is not fetched at all — `enabled` is false │
 * │ — so an unauthorised executive never triggers a 403 they would then have  │
 * │ to be shown. The panel renders a restricted state instead.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const KEY = 'executive';

/** The permission each domain's source endpoint is gated by, server-side. */
const DOMAIN_PERMISSION: Record<ExecutiveDomain, string | null> = {
  // api/admin/executive-dashboard carries no permission middleware today.
  company: null,
  financial: 'finance.reports.view',
  sales: null,
  crm: 'crm.executive.view',
  logistics: 'operations.view',
  inventory: 'inventory.stock.view',
  procurement: 'purchasing.suppliers.view',
};

function useCompanyKey() {
  const { activeCompanyId } = useOrganizationContext();

  return activeCompanyId ?? 'global';
}

/**
 * What this viewer may see.
 *
 * A user with no `permissions` array is treated as unrestricted, matching the
 * server: `RequirePermissionMiddleware` lets system roles through without any
 * explicit grant, and those users arrive here with nothing enumerated.
 */
export function useExecutivePermissions() {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const granted = user?.permissions;

    const can = (permission: string | null): boolean => {
      if (permission === null) return true;
      if (granted === undefined || granted.length === 0) return true;

      return granted.includes(permission);
    };

    const permitted = {} as Record<ExecutiveDomain, boolean>;

    (Object.keys(DOMAIN_PERMISSION) as ExecutiveDomain[]).forEach((domain) => {
      permitted[domain] = can(DOMAIN_PERMISSION[domain]);
    });

    return { permitted, can };
  }, [user]);
}

/**
 * @param permission Overrides the domain's default gate for endpoints that sit
 *   behind a different one. `/finance/intelligence/trends` is grouped under
 *   `finance.analytics.view`, not the `finance.reports.view` that gates the
 *   executive KPI endpoint — gating both on the KPI permission would fetch
 *   trends for a user the server will refuse.
 */
function useDomainQuery<T>(
  domain: ExecutiveDomain,
  filters: ExecutiveFilters,
  queryFn: () => Promise<T>,
  permission?: string,
) {
  const companyId = useCompanyKey();
  const { permitted, can } = useExecutivePermissions();

  return useQuery({
    queryKey: ['company', companyId, KEY, domain, permission ?? null, filters],
    queryFn,
    enabled: permission === undefined ? permitted[domain] : can(permission),
    staleTime: 60_000,
    // Keeps the previous board on screen while a new filter loads, instead of
    // collapsing every card to a skeleton on each date change.
    placeholderData: (prev) => prev,
  });
}

export function useCompanyKpisQuery(filters: ExecutiveFilters) {
  return useDomainQuery('company', filters, () => executiveService.companyDashboard(filters));
}

export function useFinancialKpisQuery(filters: ExecutiveFilters) {
  return useDomainQuery('financial', filters, () => executiveService.financeKpis(filters));
}

export function useCrmKpisQuery(filters: ExecutiveFilters) {
  return useDomainQuery('crm', filters, () => executiveService.crmKpis(filters));
}

export function useLogisticsKpisQuery(filters: ExecutiveFilters) {
  return useDomainQuery('logistics', filters, () => executiveService.logisticsSummary(filters));
}

export function useInventoryKpisQuery(filters: ExecutiveFilters) {
  return useDomainQuery('inventory', filters, () => executiveService.inventoryDashboard(filters));
}

export function useProcurementKpisQuery(filters: ExecutiveFilters) {
  return useDomainQuery('procurement', filters, () => executiveService.procurementStats(filters));
}

// ── Insights / Alerts / Trends / Recommendations ────────────────────────────

export function useExecutiveInsightsQuery(filters: ExecutiveFilters) {
  return useDomainQuery('logistics', filters, () => executiveService.insights(filters));
}

export function useExecutiveAlertsQuery(filters: ExecutiveFilters) {
  return useDomainQuery('logistics', filters, () => executiveService.alerts(filters));
}

/** Gated by `finance.analytics.view` — see the route group in routes/api.php. */
export function useExecutiveTrendsQuery(filters: ExecutiveFilters) {
  return useDomainQuery(
    'financial',
    filters,
    () => executiveService.trends(filters),
    'finance.analytics.view',
  );
}

export function useExecutiveRecommendationsQuery(filters: ExecutiveFilters) {
  return useDomainQuery('logistics', filters, () => executiveService.recommendations(filters));
}
