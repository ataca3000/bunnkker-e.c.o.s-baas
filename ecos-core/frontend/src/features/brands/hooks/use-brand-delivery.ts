import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { brandsService } from '@/features/brands/services/brands-service';
import type { BrandDeliveryTimeSlotPayload, BrandGovernorateSettings } from '@/features/brands/types/brand';

export function useBrandDeliveryGeography(brandId: string | null) {
  return useQuery({
    queryKey: ['brand-delivery-geography', brandId ?? ''],
    queryFn: () => brandsService.getDeliveryGeography(brandId!),
    enabled: Boolean(brandId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBrandDeliveryWindows(brandId: string | null) {
  return useQuery({
    queryKey: ['brand-delivery-windows', brandId ?? ''],
    queryFn: () => brandsService.getDeliveryWindows(brandId!),
    enabled: Boolean(brandId),
    staleTime: 10 * 60 * 1000,
    select: (d) => (Array.isArray(d) ? d : []),
  });
}

export function useBrandConfigHealth(brandId: string | null) {
  return useQuery({
    queryKey: ['brand-config-health', brandId ?? ''],
    queryFn: () => brandsService.getBrandConfigHealth(brandId!),
    enabled: Boolean(brandId),
    staleTime: 60 * 1000,
  });
}

export function useBrandShippingGovernorates(brandId: string | null) {
  return useQuery<BrandGovernorateSettings[]>({
    queryKey: ['brand-shipping-governorates', brandId ?? ''],
    queryFn: () => brandsService.getShippingGovernorates(brandId!),
    enabled: Boolean(brandId),
    staleTime: 5 * 60_000,
  });
}

// ── Delivery Time Slots ────────────────────────────────────────────────────────

const SLOTS_KEY = (brandId: string) => ['brand-delivery-time-slots', brandId];

export function useDeliveryTimeSlots(brandId: string | null) {
  return useQuery({
    queryKey: SLOTS_KEY(brandId ?? ''),
    queryFn: () => brandsService.listDeliveryTimeSlots(brandId!),
    enabled: Boolean(brandId),
    staleTime: 2 * 60_000,
  });
}

export function useCreateDeliveryTimeSlot(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BrandDeliveryTimeSlotPayload) =>
      brandsService.createDeliveryTimeSlot(brandId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: SLOTS_KEY(brandId) }),
  });
}

export function useUpdateDeliveryTimeSlot(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, payload }: { slotId: string; payload: BrandDeliveryTimeSlotPayload }) =>
      brandsService.updateDeliveryTimeSlot(brandId, slotId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: SLOTS_KEY(brandId) }),
  });
}

export function useDeleteDeliveryTimeSlot(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId: string) => brandsService.deleteDeliveryTimeSlot(brandId, slotId),
    onSuccess: () => qc.invalidateQueries({ queryKey: SLOTS_KEY(brandId) }),
  });
}

export function useSeedDeliveryTimeSlots(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => brandsService.seedDeliveryTimeSlots(brandId),
    onSuccess: () => qc.invalidateQueries({ queryKey: SLOTS_KEY(brandId) }),
  });
}

export function useReorderDeliveryTimeSlots(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => brandsService.reorderDeliveryTimeSlots(brandId, orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: SLOTS_KEY(brandId) }),
  });
}
