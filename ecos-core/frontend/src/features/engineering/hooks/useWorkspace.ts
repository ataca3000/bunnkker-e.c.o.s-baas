import { useQuery } from '@tanstack/react-query';

import { useOrganizationContext } from '@/features/organization/context/organization-context';
import { workspaceService } from '../services/workspace-service';

/**
 * Engineering workspace data hooks.
 *
 * Converted from hand-rolled useState + useEffect fetching to TanStack Query,
 * matching use-engineering.ts and the rest of the application. The returned
 * shapes are unchanged.
 *
 * Beyond consistency this removes three real defects the hand-rolled version
 * carried: state written synchronously inside the mount effect (an extra render
 * pass every mount), no request cancellation (a slow response could land after a
 * newer one and overwrite fresh data with stale data), and a timeline refresh
 * that blanked the list it was refreshing.
 *
 * Cache keys follow ADR-024: company-prefixed.
 */
const KEY = 'engineering-workspace';

function useCompanyKey() {
  const { activeCompanyId } = useOrganizationContext();

  return activeCompanyId ?? 'global';
}

export function useWorkspaceExecutive(autoRefreshMs = 0) {
  const companyId = useCompanyKey();

  const query = useQuery({
    queryKey: ['company', companyId, KEY, 'executive'],
    queryFn: () => workspaceService.getExecutive(),
    staleTime: 30_000,
    refetchInterval: autoRefreshMs > 0 ? autoRefreshMs : false,
  });

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export function useWorkspaceLive(autoRefreshMs = 15000) {
  const companyId = useCompanyKey();

  const query = useQuery({
    queryKey: ['company', companyId, KEY, 'live'],
    queryFn: () => workspaceService.getLive(),
    staleTime: 10_000,
    refetchInterval: autoRefreshMs > 0 ? autoRefreshMs : false,
  });

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export function useWorkspaceTimeline(type?: string, limit = 50) {
  const companyId = useCompanyKey();

  const query = useQuery({
    queryKey: ['company', companyId, KEY, 'timeline', type ?? null, limit],
    queryFn: () => workspaceService.getTimeline(type, limit),
    staleTime: 15_000,
    // Keeps the current events visible while a different filter loads.
    placeholderData: (prev) => prev,
  });

  return {
    events: query.data?.events ?? [],
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
