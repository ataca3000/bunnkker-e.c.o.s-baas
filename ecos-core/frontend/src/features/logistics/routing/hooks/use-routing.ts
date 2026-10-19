import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { routingService } from '../services/routing-service';
import type { PlanTripPayload } from '../types/routing';

const KEY = 'logistics-routing';

export function useRoutingStrategies() {
  return useQuery({
    queryKey: [KEY, 'strategies'],
    queryFn: () => routingService.strategies(),
    staleTime: 5 * 60_000,
  });
}

export function useCurrentRoutePlan(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'current', tripId],
    queryFn: () => routingService.currentPlan(tripId as string),
    enabled: tripId !== null,
  });
}

export function useRoutePlanHistory(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'history', tripId],
    queryFn: () => routingService.planHistory(tripId as string),
    enabled: tripId !== null,
  });
}

/**
 * Planning supersedes the previous plan and re-sequences the trip's stops, so
 * both the routing prefix and the trip prefix are invalidated — the stop list
 * shown elsewhere is now stale.
 */
function useRoutingInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [KEY] });
    void queryClient.invalidateQueries({ queryKey: ['logistics-trips'] });
  };
}

export function usePlanTrip(tripId: string) {
  const invalidate = useRoutingInvalidation();

  return useMutation({
    mutationFn: (payload: PlanTripPayload) => routingService.plan(tripId, payload),
    onSuccess: invalidate,
  });
}

export function useActivateRoutePlan(tripId: string) {
  const invalidate = useRoutingInvalidation();

  return useMutation({
    mutationFn: (planId: string) => routingService.activate(tripId, planId),
    onSuccess: invalidate,
  });
}

export function useCompleteRoutePlan(tripId: string) {
  const invalidate = useRoutingInvalidation();

  return useMutation({
    mutationFn: (planId: string) => routingService.complete(tripId, planId),
    onSuccess: invalidate,
  });
}

export function useProjectEta(tripId: string) {
  const invalidate = useRoutingInvalidation();

  return useMutation({
    mutationFn: (planId: string) => routingService.projectEta(tripId, planId),
    onSuccess: invalidate,
  });
}
