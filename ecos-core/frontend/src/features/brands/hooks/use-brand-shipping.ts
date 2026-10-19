import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { brandShippingService } from '@/features/brands/services/brand-shipping-service';
import type {
  BrandCitySettingPayload,
  BrandGovernorateSettingsPayload,
  BrandShippingSettingsPayload,
} from '@/features/brands/types/brand';

const SETTINGS_KEY  = (brandId: string) => ['brand-shipping-settings',  brandId] as const;
const GOV_KEY       = (brandId: string) => ['brand-shipping-governorates', brandId] as const;
const CITIES_KEY    = (brandId: string, govId?: number) =>
  ['brand-shipping-cities', brandId, govId] as const;

// ── Settings ──────────────────────────────────────────────────────────────────

export function useBrandShippingSettings(brandId: string | null) {
  return useQuery({
    queryKey: SETTINGS_KEY(brandId ?? ''),
    queryFn: () => brandShippingService.getSettings(brandId!),
    enabled: Boolean(brandId),
    staleTime: 30_000,
  });
}

export function useUpdateBrandShippingSettings(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BrandShippingSettingsPayload) =>
      brandShippingService.updateSettings(brandId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY(brandId) }),
  });
}

// ── Governorates ──────────────────────────────────────────────────────────────

export function useBrandShippingGovernorates(brandId: string | null) {
  return useQuery({
    queryKey: GOV_KEY(brandId ?? ''),
    queryFn: () => brandShippingService.listGovernorates(brandId!),
    enabled: Boolean(brandId),
    staleTime: 30_000,
  });
}

export function useUpdateBrandGovernorateSettings(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ governorateId, payload }: { governorateId: number; payload: BrandGovernorateSettingsPayload }) =>
      brandShippingService.updateGovernorate(brandId, governorateId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: GOV_KEY(brandId) }),
  });
}

// ── Cities ────────────────────────────────────────────────────────────────────

export function useBrandShippingCities(brandId: string | null, governorateId: number | null) {
  return useQuery({
    queryKey: CITIES_KEY(brandId ?? '', governorateId ?? undefined),
    queryFn: () => brandShippingService.listCities(brandId!, governorateId ?? undefined),
    enabled: Boolean(brandId) && Boolean(governorateId),
    staleTime: 30_000,
  });
}

export function useUpdateBrandCitySetting(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, payload }: { cityId: number; payload: BrandCitySettingPayload }) =>
      brandShippingService.updateCity(brandId, cityId, payload),
    onSuccess: () => {
      // Invalidate all city caches for this brand (any governorate filter)
      qc.invalidateQueries({ queryKey: ['brand-shipping-cities', brandId] });
    },
  });
}
