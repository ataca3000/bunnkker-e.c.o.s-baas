import { api } from '@/lib/axios';
import type {
  CitiesResult,
  City,
  CityAlias,
  CityAliasPayload,
  CityPayload,
  GeographyStats,
  Governorate,
  GovernoratePayload,
  GovernoratesQuery,
  GovernoratesResult,
  ReorderItem,
} from '@/features/logistics/geography/types/geography';

const BASE = '/logistics/geography';

export const geographyService = {
  async stats(): Promise<GeographyStats> {
    const { data } = await api.get<GeographyStats>(`${BASE}/stats`);
    return data;
  },

  async listGovernorates(params?: GovernoratesQuery): Promise<GovernoratesResult> {
    const { data } = await api.get<GovernoratesResult>(`${BASE}/governorates`, { params });
    return data;
  },

  async getGovernorate(id: number): Promise<Governorate> {
    const { data } = await api.get<{ data: Governorate }>(`${BASE}/governorates/${id}`);
    return data.data;
  },

  async createGovernorate(payload: GovernoratePayload): Promise<Governorate> {
    const { data } = await api.post<{ data: Governorate }>(`${BASE}/governorates`, payload);
    return data.data;
  },

  async updateGovernorate(id: number, payload: Partial<GovernoratePayload>): Promise<Governorate> {
    const { data } = await api.put<{ data: Governorate }>(`${BASE}/governorates/${id}`, payload);
    return data.data;
  },

  async deleteGovernorate(id: number): Promise<void> {
    await api.delete(`${BASE}/governorates/${id}`);
  },

  async reorderGovernorates(items: ReorderItem[]): Promise<void> {
    await api.patch(`${BASE}/governorates/reorder`, { items });
  },

  async toggleGovernorateStatus(id: number): Promise<Governorate> {
    const { data } = await api.patch<{ data: Governorate }>(`${BASE}/governorates/${id}/status`);
    return data.data;
  },

  async listCities(governorateId: number, params?: { search?: string; page?: number; per_page?: number }): Promise<CitiesResult> {
    const { data } = await api.get<CitiesResult>(`${BASE}/governorates/${governorateId}/cities`, { params });
    return data;
  },

  async getCity(governorateId: number, cityId: number): Promise<City> {
    const { data } = await api.get<{ data: City }>(`${BASE}/governorates/${governorateId}/cities/${cityId}`);
    return data.data;
  },

  async createCity(governorateId: number, payload: CityPayload): Promise<City> {
    const { data } = await api.post<{ data: City }>(`${BASE}/governorates/${governorateId}/cities`, payload);
    return data.data;
  },

  async updateCity(governorateId: number, cityId: number, payload: Partial<CityPayload>): Promise<City> {
    const { data } = await api.put<{ data: City }>(`${BASE}/governorates/${governorateId}/cities/${cityId}`, payload);
    return data.data;
  },

  async deleteCity(governorateId: number, cityId: number): Promise<void> {
    await api.delete(`${BASE}/governorates/${governorateId}/cities/${cityId}`);
  },

  async toggleCityStatus(governorateId: number, cityId: number): Promise<City> {
    const { data } = await api.patch<{ data: City }>(`${BASE}/governorates/${governorateId}/cities/${cityId}/status`);
    return data.data;
  },

  async listAliases(cityId: number): Promise<CityAlias[]> {
    const { data } = await api.get<{ data: CityAlias[] }>(`${BASE}/cities/${cityId}/aliases`);
    return data.data;
  },

  async createAlias(cityId: number, payload: CityAliasPayload): Promise<CityAlias> {
    const { data } = await api.post<{ data: CityAlias }>(`${BASE}/cities/${cityId}/aliases`, payload);
    return data.data;
  },

  async updateAlias(cityId: number, aliasId: number, payload: Partial<CityAliasPayload>): Promise<CityAlias> {
    const { data } = await api.put<{ data: CityAlias }>(`${BASE}/cities/${cityId}/aliases/${aliasId}`, payload);
    return data.data;
  },

  async deleteAlias(cityId: number, aliasId: number): Promise<void> {
    await api.delete(`${BASE}/cities/${cityId}/aliases/${aliasId}`);
  },
};
