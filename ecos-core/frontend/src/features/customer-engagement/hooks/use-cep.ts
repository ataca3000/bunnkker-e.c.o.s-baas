import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type {
  Conversation,
  Message,
  Lead,
  PrivateNote,
  AssignmentLog,
  SlaViolation,
  SlaPolicy,
  DashboardKpis,
  PaginatedCepResponse,
} from '../types/cep';

const BASE = '/api/cep';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useCepKpis(companyId?: string) {
  return useQuery({
    queryKey: ['cep-kpis', companyId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: DashboardKpis }>(`${BASE}/dashboard/kpis`,
        { params: companyId ? { company_id: companyId } : undefined });
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useCepProviderDistribution(companyId?: string) {
  return useQuery({
    queryKey: ['cep-providers', companyId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: Array<{ provider: string; count: number }> }>(
        `${BASE}/dashboard/providers`,
        { params: companyId ? { company_id: companyId } : undefined });
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useCepStatusDistribution(companyId?: string) {
  return useQuery({
    queryKey: ['cep-statuses', companyId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: Array<{ status: string; count: number }> }>(
        `${BASE}/dashboard/statuses`,
        { params: companyId ? { company_id: companyId } : undefined });
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useCepUnreadCount(companyId?: string) {
  return useQuery({
    queryKey: ['cep-unread', companyId],
    queryFn: async () => {
      const { data } = await axios.get<{ count: number }>(`${BASE}/dashboard/unread-count`,
        { params: companyId ? { company_id: companyId } : undefined });
      return data.count;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

// ─── Conversations ────────────────────────────────────────────────────────────

export function useConversations(params?: {
  status?: string;
  provider?: string;
  priority?: string;
  search?: string;
  assigned_employee_id?: string;
  unread_only?: boolean;
  company_id?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['cep-conversations', params],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedCepResponse<Conversation>>(
        `${BASE}/conversations`, { params });
      return data;
    },
    staleTime: 15_000,
  });
}

export function useConversation(id: string | null | undefined) {
  return useQuery({
    queryKey: ['cep-conversation', id],
    queryFn: async () => {
      const { data } = await axios.get<{ data: Conversation }>(`${BASE}/conversations/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await axios.post<{ data: Conversation }>(`${BASE}/conversations`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cep-conversations'] }),
  });
}

export function useUpdateConversation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await axios.patch<{ data: Conversation }>(`${BASE}/conversations/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cep-conversation', id] });
      qc.invalidateQueries({ queryKey: ['cep-conversations'] });
    },
  });
}

export function useCloseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<{ data: Conversation }>(`${BASE}/conversations/${id}/close`);
      return data.data;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['cep-conversation', id] });
      qc.invalidateQueries({ queryKey: ['cep-conversations'] });
    },
  });
}

export function useResolveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<{ data: Conversation }>(`${BASE}/conversations/${id}/resolve`);
      return data.data;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['cep-conversation', id] });
      qc.invalidateQueries({ queryKey: ['cep-conversations'] });
    },
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function useMessageThread(conversationId: string | null | undefined, perPage = 50) {
  return useQuery({
    queryKey: ['cep-thread', conversationId, perPage],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedCepResponse<Message>>(
        `${BASE}/conversations/${conversationId}/messages`,
        { params: { per_page: perPage } },
      );
      return data;
    },
    enabled: !!conversationId,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { content?: string; media_url?: string; message_type?: string }) => {
      const { data } = await axios.post<{ data: Message }>(
        `${BASE}/conversations/${conversationId}/messages`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cep-thread', conversationId] });
      qc.invalidateQueries({ queryKey: ['cep-conversation', conversationId] });
    },
  });
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export function useLeads(params?: {
  status?: string;
  assigned_to?: string;
  company_id?: string;
  search?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['cep-leads', params],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedCepResponse<Lead>>(`${BASE}/leads`, { params });
      return data;
    },
  });
}

export function useCreateLead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await axios.post<{ data: Lead }>(
        `${BASE}/conversations/${conversationId}/leads`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cep-leads'] });
      qc.invalidateQueries({ queryKey: ['cep-conversation', conversationId] });
    },
  });
}

export function useQualifyLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, notes }: { leadId: string; notes?: string }) => {
      const { data } = await axios.post<{ data: Lead }>(`${BASE}/leads/${leadId}/qualify`, { notes });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cep-leads'] }),
  });
}

export function useDisqualifyLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, reason }: { leadId: string; reason: string }) => {
      const { data } = await axios.post<{ data: Lead }>(`${BASE}/leads/${leadId}/disqualify`, { reason });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cep-leads'] }),
  });
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export function usePrivateNotes(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['cep-notes', conversationId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: PrivateNote[] }>(
        `${BASE}/conversations/${conversationId}/notes`);
      return data.data;
    },
    enabled: !!conversationId,
  });
}

export function useAddNote(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { content: string; author_id: string }) => {
      const { data } = await axios.post<{ data: PrivateNote }>(
        `${BASE}/conversations/${conversationId}/notes`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cep-notes', conversationId] }),
  });
}

// ─── Assignment ───────────────────────────────────────────────────────────────

export function useAssignConversation(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { assignee_id: string; assignee_type?: string; notes?: string }) => {
      const { data } = await axios.post<{ data: AssignmentLog }>(
        `${BASE}/conversations/${conversationId}/assign`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cep-conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['cep-conversations'] });
    },
  });
}

// ─── SLA ──────────────────────────────────────────────────────────────────────

export function useSlaViolations(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['cep-sla', conversationId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: SlaViolation[] }>(
        `${BASE}/conversations/${conversationId}/sla`);
      return data.data;
    },
    enabled: !!conversationId,
  });
}

export function useSlaPolicies(companyId?: string) {
  return useQuery({
    queryKey: ['cep-sla-policies', companyId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: SlaPolicy[] }>(`${BASE}/sla/policies`,
        { params: companyId ? { company_id: companyId } : undefined });
      return data.data;
    },
    staleTime: 120_000,
  });
}
