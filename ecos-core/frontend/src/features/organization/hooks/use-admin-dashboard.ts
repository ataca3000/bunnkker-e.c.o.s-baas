import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/axios';

export type AdminDashboardStats = {
  companies: number;
  brands: number;
  business_accounts: number;
  channels: number;
  warehouses: number;
  teams: number;
  users: number;
  pending_invitations: number;
};

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async (): Promise<AdminDashboardStats> => {
      const { data } = await api.get<{ data: AdminDashboardStats }>('/admin/dashboard');
      return data.data;
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}
