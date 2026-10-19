import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { distributionZoneService } from '../services/distribution-zone-service';
import type { AreasParams, DistributionZonePayload, DistributionZonesQuery } from '../types/distribution-zone';

const KEY = 'logistics-distribution-zones';

export function useDistributionZoneStats() {
  return useQuery({
    queryKey: [KEY, 'stats'],
    queryFn: () => distributionZoneService.stats(),
    staleTime: 30_000,
  });
}

export function useNextZoneCode(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'next-code'],
    queryFn: () => distributionZoneService.nextCode(),
    enabled,
    staleTime: 0,
  });
}

export function useDistributionZones(params?: DistributionZonesQuery) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => distributionZoneService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useDistributionZone(id: number | null) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => distributionZoneService.get(id!),
    enabled: id !== null,
  });
}

export function useAreas(params?: AreasParams) {
  return useQuery({
    queryKey: [KEY, 'areas', params ?? null],
    queryFn: () => distributionZoneService.areas(params),
    staleTime: 60_000,
  });
}

export function useCreateDistributionZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DistributionZonePayload) => distributionZoneService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateDistributionZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: DistributionZonePayload }) =>
      distributionZoneService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteDistributionZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => distributionZoneService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useToggleDistributionZoneStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => distributionZoneService.toggleStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
