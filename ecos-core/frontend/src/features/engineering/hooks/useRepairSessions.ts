import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useOrganizationContext } from '@/features/organization/context/organization-context';
import { repairService } from '../services/repair-service';

/**
 * Self-healing repair session hooks.
 *
 * Converted from hand-rolled useState + useEffect fetching to TanStack Query,
 * matching use-engineering.ts and the rest of the application. The returned
 * shapes are unchanged.
 *
 * What this fixes beyond consistency: the previous version raised `loading` and
 * wrote state synchronously inside the mount effect (an extra render pass every
 * time), had no request cancellation (a slow response could overwrite a newer
 * one), and re-fetched on every filter object identity change rather than on the
 * filter VALUES.
 *
 * Cache keys follow ADR-024: company-prefixed.
 */
const KEY = 'engineering-repair';

function useCompanyKey() {
  const { activeCompanyId } = useOrganizationContext();

  return activeCompanyId ?? 'global';
}

export function useRepairDashboard(autoRefreshMs = 0) {
  const companyId = useCompanyKey();

  const query = useQuery({
    queryKey: ['company', companyId, KEY, 'dashboard'],
    queryFn: () => repairService.getDashboard(),
    staleTime: 30_000,
    refetchInterval: autoRefreshMs > 0 ? autoRefreshMs : false,
  });

  return {
    dashboard: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export function useRepairSessions(filters: Record<string, unknown> = {}) {
  const companyId = useCompanyKey();

  // Serialised so a fresh object literal with identical values does not look
  // like a new filter set and trigger a redundant request on every render.
  const filtersKey = JSON.stringify(filters);
  const params = useMemo(() => JSON.parse(filtersKey) as Record<string, unknown>, [filtersKey]);

  const query = useQuery({
    queryKey: ['company', companyId, KEY, 'sessions', filtersKey],
    queryFn: () => repairService.getSessions(params),
    staleTime: 15_000,
    // Keeps the current page on screen while the next filter loads, rather than
    // blanking the table between results.
    placeholderData: (prev) => prev,
  });

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export function useRepairSession(id: string | null) {
  const companyId = useCompanyKey();

  const query = useQuery({
    queryKey: ['company', companyId, KEY, 'session', id],
    queryFn: () => repairService.getSession(id as string),
    enabled: id !== null,
  });

  return {
    session: query.data ?? null,
    // With no id there is nothing to wait for, which the old hook expressed by
    // forcing loading false in an effect.
    loading: id === null ? false : query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
