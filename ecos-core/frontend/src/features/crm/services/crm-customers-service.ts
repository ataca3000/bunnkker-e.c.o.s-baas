import { api } from '@/lib/axios';
import type {
  CrmCustomer,
  CrmCustomerGroup,
  CrmCustomerProfile,
  CrmCustomersMeta,
  CrmCustomersQuery,
  CrmCustomersResult,
  CrmCustomerIntelligence,
  CrmTimelineEntry,
} from '@/features/crm/types/crm-customer';
import type {
  CrmCustomerCreateValues,
  CrmCustomerUpdateValues,
} from '@/features/crm/components/crm-customer-form-schema';
import type { ApiResponse } from '@/types';

/**
 * The CRM customer API.
 *
 * Note the response shape: GET /crm/customers returns `data` and `meta` as
 * SIBLINGS at the top level, not a result object nested under `data`. That
 * differs from the Sales `/customers` endpoint, so the envelope is unwrapped
 * here rather than assumed to match.
 */
export const crmCustomersService = {
  async list(params: CrmCustomersQuery): Promise<CrmCustomersResult> {
    const { data } = await api.get<{ data: CrmCustomer[]; meta: CrmCustomersMeta }>(
      '/crm/customers',
      { params },
    );

    return { data: data.data, meta: data.meta };
  },

  async get(id: string): Promise<CrmCustomer> {
    const { data } = await api.get<ApiResponse<CrmCustomer>>(`/crm/customers/${id}`);
    return data.data;
  },

  async groups(): Promise<CrmCustomerGroup[]> {
    const { data } = await api.get<ApiResponse<CrmCustomerGroup[]>>('/crm/customers/groups');
    return data.data;
  },

  async create(payload: CrmCustomerCreateValues): Promise<CrmCustomer> {
    const { data } = await api.post<ApiResponse<CrmCustomer>>('/crm/customers', payload);
    return data.data;
  },

  /** PATCH accepts profile fields only — see the form schema for why. */
  async update(id: string, payload: CrmCustomerUpdateValues): Promise<CrmCustomer> {
    const { data } = await api.patch<ApiResponse<CrmCustomer>>(`/crm/customers/${id}`, payload);
    return data.data;
  },

  /**
   * The Customer 360 payload. Phones, emails, addresses, tags, notes and
   * documents have no list endpoints of their own — this is the only read.
   */
  async profile(id: string): Promise<CrmCustomerProfile> {
    const { data } = await api.get<ApiResponse<CrmCustomerProfile>>(`/crm/customers/${id}/profile`);
    return data.data;
  },

  async timeline(id: string): Promise<CrmTimelineEntry[]> {
    const { data } = await api.get<ApiResponse<CrmTimelineEntry[]>>(`/crm/customers/${id}/timeline`);
    return data.data;
  },

  async activities(id: string): Promise<CrmTimelineEntry[]> {
    const { data } = await api.get<ApiResponse<CrmTimelineEntry[]>>(
      `/crm/customers/${id}/activities`,
    );
    return data.data;
  },

  /**
   * Customer intelligence. Lives under its own namespace, so it is a separate
   * call from /profile rather than part of it.
   */
  async intelligence(id: string): Promise<CrmCustomerIntelligence> {
    const { data } = await api.get<ApiResponse<CrmCustomerIntelligence>>(
      `/crm/intelligence/customers/${id}`,
    );
    return data.data;
  },

  /** Archive is a state change, not a delete — the record stays for history. */
  async archive(id: string): Promise<void> {
    await api.patch(`/crm/customers/${id}/archive`);
  },
};
