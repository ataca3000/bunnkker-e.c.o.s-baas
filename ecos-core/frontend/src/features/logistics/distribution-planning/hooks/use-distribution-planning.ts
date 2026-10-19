import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { distributionPlanningService } from '../services/distribution-planning-service';
import type { PlanningFilters, ZoneDetailTab } from '../types/distribution-planning';

const KEYS = {
  all:        ['logistics-distribution-planning'] as const,
  stats:      (f: PlanningFilters) => [...KEYS.all, 'stats', f] as const,
  zones:      (f: PlanningFilters) => [...KEYS.all, 'zones', f] as const,
  unassigned: (f: PlanningFilters) => [...KEYS.all, 'unassigned', f] as const,
  detail:     (zoneId: number, tab: ZoneDetailTab, f: PlanningFilters) =>
    [...KEYS.all, 'detail', zoneId, tab, f] as const,
};

export function usePlanningStats(filters: PlanningFilters = {}) {
  return useQuery({
    queryKey: KEYS.stats(filters),
    queryFn:  () => distributionPlanningService.getStats(filters),
  });
}

export function usePlanningZones(filters: PlanningFilters = {}) {
  return useQuery({
    queryKey: KEYS.zones(filters),
    queryFn:  () => distributionPlanningService.getZones(filters),
  });
}

export function usePlanningUnassigned(filters: PlanningFilters = {}, enabled = false) {
  return useQuery({
    queryKey: KEYS.unassigned(filters),
    queryFn:  () => distributionPlanningService.getUnassigned(filters),
    enabled,
  });
}

export function useZoneDetail(
  zoneId: number | null,
  tab: ZoneDetailTab,
  filters: PlanningFilters = {},
) {
  return useQuery({
    queryKey: KEYS.detail(zoneId ?? 0, tab, filters),
    queryFn:  () => distributionPlanningService.getZoneDetail(zoneId!, tab, filters),
    enabled:  zoneId !== null,
  });
}

export function useStartPlanning(filters: PlanningFilters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zoneId, date }: { zoneId: number; date?: string }) =>
      distributionPlanningService.startPlanning(zoneId, date),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.zones(filters) });
      void qc.invalidateQueries({ queryKey: KEYS.stats(filters) });
    },
  });
}

export function useMarkPlanned(filters: PlanningFilters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zoneId, date }: { zoneId: number; date?: string }) =>
      distributionPlanningService.markPlanned(zoneId, date),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.zones(filters) });
      void qc.invalidateQueries({ queryKey: KEYS.stats(filters) });
    },
  });
}
