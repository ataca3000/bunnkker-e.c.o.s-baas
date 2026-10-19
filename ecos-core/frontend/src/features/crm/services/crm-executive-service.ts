import { api } from '@/lib/axios';
import type {
  CrmExecutiveGrowth,
  CrmExecutiveKpis,
  CrmExecutiveLifetimeValue,
  CrmExecutiveQuery,
  CrmExecutiveRetention,
  CrmExecutiveSatisfaction,
} from '@/features/crm/types/crm-executive';
import type { ApiResponse } from '@/types';

/**
 * The CRM executive read API. Every route is a GET report — there are no
 * executive actions, which is why the workspace offers views and export rather
 * than operations.
 *
 * Retention and lifetime value are company-wide by design: their controllers
 * call forCompany(), not forPeriod(), so the period filter does not apply to
 * them and they are not re-fetched when it changes.
 */
export const crmExecutiveService = {
  async kpis(params: CrmExecutiveQuery): Promise<CrmExecutiveKpis> {
    const { data } = await api.get<ApiResponse<CrmExecutiveKpis>>('/crm/executive/kpis', {
      params,
    });
    return data.data;
  },

  async growth(params: CrmExecutiveQuery): Promise<CrmExecutiveGrowth> {
    const { data } = await api.get<ApiResponse<CrmExecutiveGrowth>>('/crm/executive/growth', {
      params,
    });
    return data.data;
  },

  async satisfaction(params: CrmExecutiveQuery): Promise<CrmExecutiveSatisfaction> {
    const { data } = await api.get<ApiResponse<CrmExecutiveSatisfaction>>(
      '/crm/executive/satisfaction',
      { params },
    );
    return data.data;
  },

  /** Company-wide: takes no period. */
  async retention(): Promise<CrmExecutiveRetention> {
    const { data } = await api.get<ApiResponse<CrmExecutiveRetention>>('/crm/executive/retention');
    return data.data;
  },

  /** Company-wide: takes no period. */
  async lifetimeValue(): Promise<CrmExecutiveLifetimeValue> {
    const { data } = await api.get<ApiResponse<CrmExecutiveLifetimeValue>>(
      '/crm/executive/lifetime-value',
    );
    return data.data;
  },
};
