import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  Brand,
  BrandConfigHealth,
  BrandDeliveryGeography,
  BrandDeliveryTimeSlot,
  BrandDeliveryTimeSlotPayload,
  BrandDeliveryWindow,
  BrandGovernorateSettings,
  BrandPayload,
  BrandsQuery,
  BrandsResult,
  BrandTransferPayload,
  BrandTransferResult,
  TransferAnalyzePayload,
  TransferImpactReport,
} from '@/features/brands/types/brand';

export const brandsService = {
  async list(params: BrandsQuery): Promise<BrandsResult> {
    const { data } = await api.get<ApiResponse<BrandsResult>>('/brands', { params });
    return data.data;
  },

  async get(id: string): Promise<Brand> {
    const { data } = await api.get<ApiResponse<Brand>>(`/brands/${id}`);
    return data.data;
  },

  async create(payload: BrandPayload): Promise<Brand> {
    const { data } = await api.post<ApiResponse<Brand>>('/brands', payload);
    return data.data;
  },

  async update(id: string, payload: Omit<BrandPayload, 'company_id'>): Promise<Brand> {
    const { data } = await api.put<ApiResponse<Brand>>(`/brands/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/brands/${id}`);
  },

  async analyzeTransfer(id: string, payload: TransferAnalyzePayload): Promise<TransferImpactReport> {
    const { data } = await api.post<ApiResponse<TransferImpactReport>>(`/brands/${id}/transfer/analyze`, payload);
    return data.data;
  },

  async transfer(id: string, payload: BrandTransferPayload): Promise<BrandTransferResult> {
    const { data } = await api.post<ApiResponse<BrandTransferResult>>(`/brands/${id}/transfer`, payload);
    return data.data;
  },

  async getDeliveryGeography(brandId: string): Promise<BrandDeliveryGeography> {
    const { data } = await api.get<ApiResponse<BrandDeliveryGeography>>(`/brands/${brandId}/delivery-geography`);
    return data.data;
  },

  async getDeliveryWindows(brandId: string): Promise<BrandDeliveryWindow[]> {
    const { data } = await api.get<ApiResponse<unknown>>(`/brands/${brandId}/delivery-windows`);
    const raw = data.data;
    // Normalize: backend may return array directly or legacy { windows: [...] } shape
    if (Array.isArray(raw)) return raw as BrandDeliveryWindow[];
    if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).windows)) {
      return (raw as { windows: BrandDeliveryWindow[] }).windows;
    }
    return [];
  },

  async getBrandConfigHealth(brandId: string): Promise<BrandConfigHealth> {
    const { data } = await api.get<ApiResponse<BrandConfigHealth>>(`/brands/${brandId}/config-health`);
    return data.data;
  },

  async getShippingGovernorates(brandId: string): Promise<BrandGovernorateSettings[]> {
    const { data } = await api.get<ApiResponse<BrandGovernorateSettings[]>>(`/brands/${brandId}/shipping/governorates`);
    return data.data;
  },

  // ── Delivery Time Slots ────────────────────────────────────────────────────

  async listDeliveryTimeSlots(brandId: string): Promise<BrandDeliveryTimeSlot[]> {
    const { data } = await api.get<ApiResponse<BrandDeliveryTimeSlot[]>>(`/brands/${brandId}/delivery-time-slots`);
    return data.data;
  },

  async createDeliveryTimeSlot(brandId: string, payload: BrandDeliveryTimeSlotPayload): Promise<BrandDeliveryTimeSlot> {
    const { data } = await api.post<ApiResponse<BrandDeliveryTimeSlot>>(`/brands/${brandId}/delivery-time-slots`, payload);
    return data.data;
  },

  async updateDeliveryTimeSlot(brandId: string, slotId: string, payload: BrandDeliveryTimeSlotPayload): Promise<BrandDeliveryTimeSlot> {
    const { data } = await api.put<ApiResponse<BrandDeliveryTimeSlot>>(`/brands/${brandId}/delivery-time-slots/${slotId}`, payload);
    return data.data;
  },

  async deleteDeliveryTimeSlot(brandId: string, slotId: string): Promise<void> {
    await api.delete(`/brands/${brandId}/delivery-time-slots/${slotId}`);
  },

  async seedDeliveryTimeSlots(brandId: string): Promise<BrandDeliveryTimeSlot[]> {
    const { data } = await api.post<ApiResponse<BrandDeliveryTimeSlot[]>>(`/brands/${brandId}/delivery-time-slots/seed-defaults`);
    return data.data;
  },

  async reorderDeliveryTimeSlots(brandId: string, orderedIds: string[]): Promise<BrandDeliveryTimeSlot[]> {
    const { data } = await api.patch<ApiResponse<BrandDeliveryTimeSlot[]>>(`/brands/${brandId}/delivery-time-slots/reorder`, { ordered_ids: orderedIds });
    return data.data;
  },
};
