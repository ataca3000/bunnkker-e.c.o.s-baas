import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { ConversationKpis } from '../types/conversation';

export function useConversationKpis(companyId?: string) {
  return useQuery<ConversationKpis>({
    queryKey: ['conversation-kpis', companyId],
    queryFn: () =>
      axios.get('/api/omnichannel/commerce/kpis', { params: { company_id: companyId } }).then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useCepDashboard() {
  return useQuery({
    queryKey: ['cep-dashboard'],
    queryFn: () => axios.get('/api/cep/dashboard/kpis').then((r) => r.data),
    refetchInterval: 60_000,
  });
}
