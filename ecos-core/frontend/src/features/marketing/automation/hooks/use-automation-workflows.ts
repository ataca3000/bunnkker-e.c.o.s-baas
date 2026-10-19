import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type {
  AutomationWorkflow,
  PaginatedResponse,
  WorkflowFilters,
  WorkflowKpis,
} from '../types/automation';

export const automationKeys = {
  all:       ['automation'] as const,
  workflows: () => [...automationKeys.all, 'workflows'] as const,
  workflow:  (id: string) => [...automationKeys.workflows(), id] as const,
  kpis:      () => [...automationKeys.all, 'kpis'] as const,
  dashboard: () => [...automationKeys.all, 'dashboard'] as const,
};

// ── List ───────────────────────────────────────────────────────────────────────

export function useAutomationWorkflows(filters: WorkflowFilters = {}) {
  return useQuery({
    queryKey: [...automationKeys.workflows(), filters],
    queryFn:  async () => {
      const { data } = await axios.get<PaginatedResponse<AutomationWorkflow>>(
        '/marketing/automation/workflows',
        { params: filters },
      );
      return data;
    },
  });
}

export function useAutomationWorkflow(id: string) {
  return useQuery({
    queryKey: automationKeys.workflow(id),
    queryFn:  async () => {
      const { data } = await axios.get<{ data: AutomationWorkflow }>(
        `/marketing/automation/workflows/${id}`,
      );
      return data.data ?? data;
    },
    enabled: !!id,
  });
}

export function useWorkflowKpis(companyId?: string) {
  return useQuery({
    queryKey: automationKeys.kpis(),
    queryFn:  async () => {
      const { data } = await axios.get<WorkflowKpis>(
        '/marketing/automation/kpis',
        { params: companyId ? { company_id: companyId } : {} },
      );
      return data;
    },
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AutomationWorkflow> & { name: string; trigger_type: string; event_type?: string }) => {
      const { data } = await axios.post<{ data: AutomationWorkflow }>('/marketing/automation/workflows', payload);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: automationKeys.workflows() }),
  });
}

export function useUpdateWorkflow(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AutomationWorkflow>) => {
      const { data } = await axios.patch<{ data: AutomationWorkflow }>(
        `/marketing/automation/workflows/${id}`,
        payload,
      );
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.workflow(id) });
      qc.invalidateQueries({ queryKey: automationKeys.workflows() });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/marketing/automation/workflows/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: automationKeys.workflows() }),
  });
}

export function useDuplicateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<{ data: AutomationWorkflow }>(
        `/marketing/automation/workflows/${id}/duplicate`,
      );
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: automationKeys.workflows() }),
  });
}

export function useActivateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<{ data: AutomationWorkflow }>(
        `/marketing/automation/workflows/${id}/activate`,
      );
      return data.data ?? data;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: automationKeys.workflow(id) });
      qc.invalidateQueries({ queryKey: automationKeys.workflows() });
      qc.invalidateQueries({ queryKey: automationKeys.kpis() });
    },
  });
}

export function usePauseWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<{ data: AutomationWorkflow }>(
        `/marketing/automation/workflows/${id}/pause`,
      );
      return data.data ?? data;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: automationKeys.workflow(id) });
      qc.invalidateQueries({ queryKey: automationKeys.workflows() });
    },
  });
}

export function useArchiveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<{ data: AutomationWorkflow }>(
        `/marketing/automation/workflows/${id}/archive`,
      );
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.workflows() });
      qc.invalidateQueries({ queryKey: automationKeys.kpis() });
    },
  });
}

export function useSaveCanvas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nodes_graph }: { id: string; nodes_graph: AutomationWorkflow['nodes_graph'] }) => {
      const { data } = await axios.put<{ data: AutomationWorkflow }>(
        `/marketing/automation/workflows/${id}/canvas`,
        { nodes_graph },
      );
      return data.data ?? data;
    },
    onSuccess: (_data, { id }) => qc.invalidateQueries({ queryKey: automationKeys.workflow(id) }),
  });
}
