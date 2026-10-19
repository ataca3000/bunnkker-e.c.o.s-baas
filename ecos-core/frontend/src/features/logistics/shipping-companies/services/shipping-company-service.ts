import { api } from '@/lib/axios';
import type {
  ShippingCompaniesQuery,
  ShippingCompaniesResult,
  ShippingCompany,
  ShippingCompanyMapping,
  ShippingCompanyPayload,
  ShippingCompanyStats,
  ShippingCompanyStatus,
  ShippingContract,
  ShippingContractPayload,
} from '../types/shipping-company';

const BASE = '/logistics/shipping-companies';

export const shippingCompanyService = {
  // ── Dashboard ──────────────────────────────────────────────────────────────

  async stats(): Promise<ShippingCompanyStats> {
    const { data } = await api.get<ShippingCompanyStats>(`${BASE}/stats`);
    return data;
  },

  async nextCode(): Promise<string> {
    const { data } = await api.get<{ code: string }>(`${BASE}/next-code`);
    return data.code;
  },

  // ── Shipping Companies ─────────────────────────────────────────────────────

  async list(params?: ShippingCompaniesQuery): Promise<ShippingCompaniesResult> {
    const { data } = await api.get<ShippingCompaniesResult>(BASE, { params });
    return data;
  },

  async get(id: number): Promise<ShippingCompany> {
    const { data } = await api.get<{ data: ShippingCompany }>(`${BASE}/${id}`);
    return data.data;
  },

  async create(payload: ShippingCompanyPayload): Promise<ShippingCompany> {
    const { data } = await api.post<{ data: ShippingCompany }>(BASE, payload);
    return data.data;
  },

  async update(id: number, payload: Partial<ShippingCompanyPayload>): Promise<ShippingCompany> {
    const { data } = await api.put<{ data: ShippingCompany }>(`${BASE}/${id}`, payload);
    return data.data;
  },

  async setStatus(id: number, status: ShippingCompanyStatus): Promise<ShippingCompany> {
    const { data } = await api.patch<{ data: ShippingCompany }>(`${BASE}/${id}/status`, { status });
    return data.data;
  },

  // ── Contracts ──────────────────────────────────────────────────────────────

  async contracts(companyId: number): Promise<ShippingContract[]> {
    const { data } = await api.get<{ data: ShippingContract[] }>(`${BASE}/${companyId}/contracts`);
    return data.data;
  },

  async createContract(companyId: number, payload: ShippingContractPayload): Promise<ShippingContract> {
    const { data } = await api.post<{ data: ShippingContract }>(`${BASE}/${companyId}/contracts`, payload);
    return data.data;
  },

  async updateContract(
    companyId: number,
    contractId: number,
    payload: Partial<ShippingContractPayload>,
  ): Promise<ShippingContract> {
    const { data } = await api.put<{ data: ShippingContract }>(
      `${BASE}/${companyId}/contracts/${contractId}`,
      payload,
    );
    return data.data;
  },

  async deleteContract(companyId: number, contractId: number): Promise<void> {
    await api.delete(`${BASE}/${companyId}/contracts/${contractId}`);
  },

  async activateContract(companyId: number, contractId: number): Promise<ShippingContract> {
    const { data } = await api.patch<{ data: ShippingContract }>(
      `${BASE}/${companyId}/contracts/${contractId}/activate`,
    );
    return data.data;
  },

  // ── ECOS Company Mappings ──────────────────────────────────────────────────

  async mappings(companyId: number): Promise<ShippingCompanyMapping[]> {
    const { data } = await api.get<{ data: ShippingCompanyMapping[] }>(`${BASE}/${companyId}/companies`);
    return data.data;
  },

  async createMapping(companyId: number, ecosCompanyId: string): Promise<ShippingCompanyMapping> {
    const { data } = await api.post<{ data: ShippingCompanyMapping }>(
      `${BASE}/${companyId}/companies`,
      { company_id: ecosCompanyId },
    );
    return data.data;
  },

  async deleteMapping(companyId: number, mappingId: number): Promise<void> {
    await api.delete(`${BASE}/${companyId}/companies/${mappingId}`);
  },
};
