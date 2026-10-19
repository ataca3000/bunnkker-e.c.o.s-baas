import { api } from '@/lib/axios';
import type { ExecutiveDashboard, OperationsDashboard } from '../types/enterprise';

const BASE = '/logistics/intelligence/dashboard';

export const enterpriseService = {
  async executive(): Promise<ExecutiveDashboard> {
    const { data } = await api.get<{ data: ExecutiveDashboard }>(`${BASE}/executive`);
    return data.data;
  },

  async operations(): Promise<OperationsDashboard> {
    const { data } = await api.get<{ data: OperationsDashboard }>(`${BASE}/operations`);
    return data.data;
  },
};
