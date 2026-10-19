import { api } from '@/lib/axios';
import type {
  CarrierAccount,
  CarrierAccountsQuery,
  CarrierAccountsResult,
  CarrierCapabilitiesResult,
  CarrierConnectionTest,
  CarrierOptions,
  CarrierStatusMapping,
  CreateCarrierAccountPayload,
  UpsertStatusMappingPayload,
} from '../types/carrier';

const BASE = '/logistics/carriers';

/**
 * Carrier accounts — the integration side of a carrier.
 *
 * There is no update or delete endpoint. An account is created, tested and its
 * status mappings maintained; the API offers nothing else, so neither does the
 * UI.
 */
export const carrierService = {
  async options(): Promise<CarrierOptions> {
    const { data } = await api.get<CarrierOptions>(`${BASE}/options`);
    return data;
  },

  async list(params?: CarrierAccountsQuery): Promise<CarrierAccountsResult> {
    const { data } = await api.get<CarrierAccountsResult>(`${BASE}/accounts`, { params });
    return data;
  },

  async get(id: string): Promise<CarrierAccount> {
    const { data } = await api.get<{ data: CarrierAccount }>(`${BASE}/accounts/${id}`);
    return data.data;
  },

  async create(payload: CreateCarrierAccountPayload): Promise<CarrierAccount> {
    const { data } = await api.post<{ data: CarrierAccount }>(`${BASE}/accounts`, payload);
    return data.data;
  },

  async capabilities(id: string): Promise<CarrierCapabilitiesResult> {
    const { data } = await api.get<{ data: CarrierCapabilitiesResult }>(
      `${BASE}/accounts/${id}/capabilities`,
    );
    return data.data;
  },

  async statusMappings(id: string): Promise<CarrierStatusMapping[]> {
    const { data } = await api.get<{ data: CarrierStatusMapping[] }>(
      `${BASE}/accounts/${id}/status-mappings`,
    );
    return data.data;
  },

  async upsertStatusMapping(
    id: string,
    payload: UpsertStatusMappingPayload,
  ): Promise<CarrierStatusMapping> {
    const { data } = await api.put<{ data: CarrierStatusMapping }>(
      `${BASE}/accounts/${id}/status-mappings`,
      payload,
    );
    return data.data;
  },

  /** Adapter-specific probe. A failure is a result, not an exception here. */
  async testConnection(id: string): Promise<CarrierConnectionTest> {
    const { data } = await api.post<{ data: CarrierConnectionTest }>(
      `${BASE}/accounts/${id}/test-connection`,
    );
    return data.data;
  },
};
