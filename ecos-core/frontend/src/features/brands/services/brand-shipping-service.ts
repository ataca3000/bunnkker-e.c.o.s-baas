import { api } from '@/lib/axios';
import type {
  BrandCitySetting,
  BrandCitySettingPayload,
  BrandGovernorateSettings,
  BrandGovernorateSettingsPayload,
  BrandShippingSettings,
  BrandShippingSettingsPayload,
  ShippingCalculation,
} from '@/features/brands/types/brand';

const base = (brandId: string) => `/brands/${brandId}`;

export const brandShippingService = {
  async getSettings(brandId: string): Promise<BrandShippingSettings> {
    const { data } = await api.get<{ data: BrandShippingSettings }>(`${base(brandId)}/shipping-settings`);
    return data.data;
  },

  async updateSettings(brandId: string, payload: BrandShippingSettingsPayload): Promise<BrandShippingSettings> {
    const { data } = await api.put<{ data: BrandShippingSettings }>(`${base(brandId)}/shipping-settings`, payload);
    return data.data;
  },

  async listGovernorates(brandId: string): Promise<BrandGovernorateSettings[]> {
    const { data } = await api.get<{ data: BrandGovernorateSettings[] }>(`${base(brandId)}/shipping/governorates`);
    return data.data;
  },

  async updateGovernorate(
    brandId: string,
    governorateId: number,
    payload: BrandGovernorateSettingsPayload,
  ): Promise<BrandGovernorateSettings> {
    const { data } = await api.put<{ data: BrandGovernorateSettings }>(
      `${base(brandId)}/shipping/governorates/${governorateId}`,
      payload,
    );
    return data.data;
  },

  async listCities(brandId: string, governorateId?: number): Promise<BrandCitySetting[]> {
    const { data } = await api.get<{ data: BrandCitySetting[] }>(`${base(brandId)}/shipping/cities`, {
      params: governorateId ? { governorate_id: governorateId } : undefined,
    });
    return data.data;
  },

  async updateCity(
    brandId: string,
    cityId: number,
    payload: BrandCitySettingPayload,
  ): Promise<BrandCitySetting> {
    const { data } = await api.put<{ data: BrandCitySetting }>(
      `${base(brandId)}/shipping/cities/${cityId}`,
      payload,
    );
    return data.data;
  },

  async calculatePrice(brandId: string, governorateId: number, cityId?: number): Promise<ShippingCalculation> {
    const { data } = await api.get<ShippingCalculation>(`${base(brandId)}/shipping/calculate`, {
      params: { governorate_id: governorateId, city_id: cityId },
    });
    return data;
  },
};
