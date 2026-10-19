import { useQuery } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { AutomationDashboard } from '../types/automation';
import { automationKeys } from './use-automation-workflows';

export function useAutomationDashboard(companyId?: string) {
  return useQuery({
    queryKey: automationKeys.dashboard(),
    queryFn:  async () => {
      const { data } = await axios.get<AutomationDashboard>(
        '/marketing/automation/dashboard',
        { params: companyId ? { company_id: companyId } : {} },
      );
      return data;
    },
    refetchInterval: 60_000,
  });
}
