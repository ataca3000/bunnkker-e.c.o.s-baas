import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { geographyService } from '@/features/logistics/geography/services/geography-service';
import type {
  CityAliasPayload,
  CityPayload,
  GovernoratePayload,
  GovernoratesQuery,
  ReorderItem,
} from '@/features/logistics/geography/types/geography';

const GOV_KEY  = 'logistics-governorates';
const STAT_KEY = 'logistics-geography-stats';

// ── Stats ─────────────────────────────────────────────────────────────────────

export function useGeographyStats() {
  return useQuery({
    queryKey: [STAT_KEY],
    queryFn: () => geographyService.stats(),
    staleTime: 60_000,
  });
}

// ── Governorates ──────────────────────────────────────────────────────────────

export function useGovernorates(params?: GovernoratesQuery) {
  return useQuery({
    queryKey: [GOV_KEY, 'list', params],
    queryFn: () => geographyService.listGovernorates(params),
    placeholderData: keepPreviousData,
  });
}

export function useGovernorate(id: number | null) {
  return useQuery({
    queryKey: [GOV_KEY, 'detail', id],
    queryFn: () => geographyService.getGovernorate(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateGovernorate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GovernoratePayload) => geographyService.createGovernorate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GOV_KEY] });
      qc.invalidateQueries({ queryKey: [STAT_KEY] });
    },
  });
}

export function useUpdateGovernorate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<GovernoratePayload> }) =>
      geographyService.updateGovernorate(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [GOV_KEY] }),
  });
}

export function useDeleteGovernorate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => geographyService.deleteGovernorate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GOV_KEY] });
      qc.invalidateQueries({ queryKey: [STAT_KEY] });
    },
  });
}

export function useReorderGovernorates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) => geographyService.reorderGovernorates(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: [GOV_KEY] }),
  });
}

export function useToggleGovernorateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => geographyService.toggleGovernorateStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [GOV_KEY] }),
  });
}

// ── Cities ────────────────────────────────────────────────────────────────────

const CITY_KEY = 'logistics-cities';

export function useCities(
  governorateId: number | null,
  params?: { search?: string; page?: number; per_page?: number },
) {
  return useQuery({
    queryKey: [CITY_KEY, governorateId, params],
    queryFn: () => geographyService.listCities(governorateId!, params),
    enabled: Boolean(governorateId),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ governorateId, payload }: { governorateId: number; payload: CityPayload }) =>
      geographyService.createCity(governorateId, payload),
    onSuccess: (_data, { governorateId }) => {
      qc.invalidateQueries({ queryKey: [CITY_KEY, governorateId] });
      qc.invalidateQueries({ queryKey: [GOV_KEY] });
      qc.invalidateQueries({ queryKey: [STAT_KEY] });
    },
  });
}

export function useUpdateCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      governorateId,
      cityId,
      payload,
    }: {
      governorateId: number;
      cityId: number;
      payload: Partial<CityPayload>;
    }) => geographyService.updateCity(governorateId, cityId, payload),
    onSuccess: (_data, { governorateId }) =>
      qc.invalidateQueries({ queryKey: [CITY_KEY, governorateId] }),
  });
}

export function useDeleteCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ governorateId, cityId }: { governorateId: number; cityId: number }) =>
      geographyService.deleteCity(governorateId, cityId),
    onSuccess: (_data, { governorateId }) => {
      qc.invalidateQueries({ queryKey: [CITY_KEY, governorateId] });
      qc.invalidateQueries({ queryKey: [GOV_KEY] });
      qc.invalidateQueries({ queryKey: [STAT_KEY] });
    },
  });
}

export function useToggleCityStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ governorateId, cityId }: { governorateId: number; cityId: number }) =>
      geographyService.toggleCityStatus(governorateId, cityId),
    onSuccess: (_data, { governorateId }) =>
      qc.invalidateQueries({ queryKey: [CITY_KEY, governorateId] }),
  });
}

// ── Aliases ───────────────────────────────────────────────────────────────────

const ALIAS_KEY = 'logistics-city-aliases';

export function useCityAliases(cityId: number | null) {
  return useQuery({
    queryKey: [ALIAS_KEY, cityId],
    queryFn: () => geographyService.listAliases(cityId!),
    enabled: Boolean(cityId),
    staleTime: 30_000,
  });
}

export function useCreateAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, payload }: { cityId: number; payload: CityAliasPayload }) =>
      geographyService.createAlias(cityId, payload),
    onSuccess: (_data, { cityId }) => qc.invalidateQueries({ queryKey: [ALIAS_KEY, cityId] }),
  });
}

export function useUpdateAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cityId,
      aliasId,
      payload,
    }: {
      cityId: number;
      aliasId: number;
      payload: Partial<CityAliasPayload>;
    }) => geographyService.updateAlias(cityId, aliasId, payload),
    onSuccess: (_data, { cityId }) => qc.invalidateQueries({ queryKey: [ALIAS_KEY, cityId] }),
  });
}

export function useDeleteAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, aliasId }: { cityId: number; aliasId: number }) =>
      geographyService.deleteAlias(cityId, aliasId),
    onSuccess: (_data, { cityId }) => qc.invalidateQueries({ queryKey: [ALIAS_KEY, cityId] }),
  });
}
