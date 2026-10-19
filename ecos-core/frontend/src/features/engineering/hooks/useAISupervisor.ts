import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/ds/use-toast';
import { useOrganizationContext } from '@/features/organization/context/organization-context';
import { aiSupervisorService } from '../services/ai-supervisor-service';

/**
 * AI Supervisor data hooks.
 *
 * These used to hand-roll fetching with useState + useEffect while the rest of
 * Engineering (use-engineering.ts) already went through TanStack Query. Two
 * fetching stacks in one feature folder meant two caching stories, two retry
 * stories and two ways to be stale — and the hand-rolled one had none of them.
 *
 * The returned shapes are unchanged, so every consumer keeps working; what
 * changed underneath is that requests now dedupe, cache and cancel, and the
 * mount-time state writes that were forcing an extra render pass are gone.
 *
 * Cache keys follow ADR-024: company-prefixed, invalidated by prefix.
 */
const KEY = 'engineering-ai';

function useCompanyKey() {
  const { activeCompanyId } = useOrganizationContext();

  return activeCompanyId ?? 'global';
}

export function useAIDashboard(autoRefreshMs = 0) {
  const companyId = useCompanyKey();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['company', companyId, KEY, 'dashboard'],
    queryFn: () => aiSupervisorService.getDashboard(),
    staleTime: 30_000,
    // 0 disables polling, matching the previous "no interval" behaviour.
    refetchInterval: autoRefreshMs > 0 ? autoRefreshMs : false,
  });

  const refresh = useCallback(async () => {
    const result = await query.refetch();

    if (result.error) {
      toast({ title: 'Failed to load AI Supervisor dashboard', variant: 'destructive' });
    }
  }, [query, toast]);

  return { dashboard: query.data ?? null, loading: query.isPending, refresh };
}

export function useAIReviews() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Which review the detail panes are showing. The three detail queries key off
  // this, so selecting is a state change rather than three imperative fetches.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['company', companyId, KEY, 'reviews'],
    queryFn: () => aiSupervisorService.listReviews(),
    staleTime: 30_000,
  });

  const selectedQuery = useQuery({
    queryKey: ['company', companyId, KEY, 'review', selectedId],
    queryFn: () => aiSupervisorService.getReview(selectedId as string),
    enabled: selectedId !== null,
  });

  const risksQuery = useQuery({
    queryKey: ['company', companyId, KEY, 'review', selectedId, 'risks'],
    queryFn: () => aiSupervisorService.getRisks(selectedId as string),
    enabled: selectedId !== null,
  });

  const recsQuery = useQuery({
    queryKey: ['company', companyId, KEY, 'review', selectedId, 'recommendations'],
    queryFn: () => aiSupervisorService.getRecommendations(selectedId as string),
    enabled: selectedId !== null,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
    [queryClient, companyId],
  );

  const loadList = useCallback(async () => {
    await listQuery.refetch();
  }, [listQuery]);

  /** Kept async so existing `await selectReview(id)` call sites are unaffected. */
  const selectReview = useCallback(async (id: string) => {
    setSelectedId(id);
  }, []);

  const runMutation = useMutation({
    mutationFn: async () => {
      const created = await aiSupervisorService.createReview({ review_type: 'manual' });

      return aiSupervisorService.runReview(created.review.id);
    },
    onSuccess: async (result) => {
      toast({
        title: 'AI review completed',
        description: `Score: ${result.overall_score?.toFixed(1) ?? 'N/A'}%`,
      });
      setSelectedId(result.id);
      await invalidate();
    },
    onError: () => toast({ title: 'AI review failed', variant: 'destructive' }),
  });

  const createAndRun = useCallback(async () => {
    await runMutation.mutateAsync().catch(() => undefined);
  }, [runMutation]);

  // Acknowledging and resolving now refetch rather than patching local arrays,
  // so the panel reflects what the server actually recorded.
  const acknowledgeRisk = useCallback(
    async (reviewId: string, riskId: string) => {
      await aiSupervisorService.acknowledgeRisk(reviewId, riskId);
      await invalidate();
    },
    [invalidate],
  );

  const resolveRecommendation = useCallback(
    async (reviewId: string, recId: string) => {
      await aiSupervisorService.resolveRecommendation(reviewId, recId);
      await invalidate();
    },
    [invalidate],
  );

  return {
    reviews: listQuery.data?.data ?? [],
    selected: selectedQuery.data ?? null,
    risks: risksQuery.data ?? [],
    recs: recsQuery.data ?? [],
    running: runMutation.isPending,
    loadList,
    selectReview,
    createAndRun,
    acknowledgeRisk,
    resolveRecommendation,
  };
}

export function useAITrend() {
  const companyId = useCompanyKey();
  const [params, setParams] = useState({ period: 'daily', limit: 30 });

  const query = useQuery({
    queryKey: ['company', companyId, KEY, 'trend', params.period, params.limit],
    queryFn: () => aiSupervisorService.getScoreTrend(params.period, params.limit),
    staleTime: 60_000,
    // Keeps the previous series on screen while a new period loads, instead of
    // collapsing the chart to empty and back.
    placeholderData: (prev) => prev,
  });

  const loadTrend = useCallback(async (period = 'daily', limit = 30) => {
    setParams({ period, limit });
  }, []);

  return { trend: query.data ?? [], loading: query.isPending, loadTrend };
}
