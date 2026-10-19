import { useQuery } from '@tanstack/react-query';

import { intelligenceService } from '../services/intelligence-service';
import type { OptimizationKind } from '../types/intelligence';

const KEY = 'logistics-intelligence';

/** Everything here is a live operational read, so nothing is cached for long. */
const LIVE = 30_000;

export function useDecisionSummary() {
  return useQuery({
    queryKey: [KEY, 'decisions'],
    queryFn: () => intelligenceService.decide(),
    staleTime: LIVE,
  });
}

export function useDecisionPriorities() {
  return useQuery({
    queryKey: [KEY, 'priorities'],
    queryFn: () => intelligenceService.priorities(),
    staleTime: LIVE,
  });
}

export function useConflictRecommendations() {
  return useQuery({
    queryKey: [KEY, 'conflicts'],
    queryFn: () => intelligenceService.conflicts(),
    staleTime: LIVE,
  });
}

export function useSmartSuggestions(limit = 5) {
  return useQuery({
    queryKey: [KEY, 'suggestions', limit],
    queryFn: () => intelligenceService.suggestions(limit),
    staleTime: LIVE,
  });
}

export function useBottlenecks() {
  return useQuery({
    queryKey: [KEY, 'bottlenecks'],
    queryFn: () => intelligenceService.bottlenecks(),
    staleTime: LIVE,
  });
}

export function useCapacityWarnings() {
  return useQuery({
    queryKey: [KEY, 'warnings'],
    queryFn: () => intelligenceService.warnings(),
    staleTime: LIVE,
  });
}

export function useOperationalInsights() {
  return useQuery({
    queryKey: [KEY, 'insights'],
    queryFn: () => intelligenceService.insights(),
    staleTime: LIVE,
  });
}

export function useCapacityForecast() {
  return useQuery({
    queryKey: [KEY, 'forecast', 'capacity'],
    queryFn: () => intelligenceService.capacityForecast(),
    staleTime: LIVE,
  });
}

export function useDispatchForecast() {
  return useQuery({
    queryKey: [KEY, 'forecast', 'dispatch'],
    queryFn: () => intelligenceService.dispatchForecast(),
    staleTime: LIVE,
  });
}

export function useWorkloadForecast() {
  return useQuery({
    queryKey: [KEY, 'forecast', 'workload'],
    queryFn: () => intelligenceService.workloadForecast(),
    staleTime: LIVE,
  });
}

export function useOptimization(kind: OptimizationKind) {
  return useQuery({
    queryKey: [KEY, 'optimization', kind],
    queryFn: () => intelligenceService.optimization(kind),
    staleTime: LIVE,
  });
}
