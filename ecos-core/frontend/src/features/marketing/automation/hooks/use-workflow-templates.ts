import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { AutomationWorkflow, AutomationWorkflowTemplate, PaginatedResponse, WorkflowTemplateCategory } from '../types/automation';
import { automationKeys } from './use-automation-workflows';

const templateKeys = {
  all:  () => [...automationKeys.all, 'templates'] as const,
  list: (filters?: Record<string, unknown>) => [...templateKeys.all(), filters] as const,
  one:  (id: string) => [...templateKeys.all(), id] as const,
};

export function useWorkflowTemplates(filters?: { category?: WorkflowTemplateCategory; search?: string; company_id?: string }) {
  return useQuery({
    queryKey: templateKeys.list(filters),
    queryFn:  async () => {
      const { data } = await axios.get<PaginatedResponse<AutomationWorkflowTemplate>>(
        '/marketing/automation/templates',
        { params: filters },
      );
      return data;
    },
  });
}

export function useCreateWorkflowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AutomationWorkflowTemplate> & { name: string; category: string; trigger_type: string; nodes_graph: unknown }) => {
      const { data } = await axios.post<{ data: AutomationWorkflowTemplate }>('/marketing/automation/templates', payload);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all() }),
  });
}

export function useCreateWorkflowFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, overrides }: { templateId: string; overrides: { name?: string; company_id?: string; brand_id?: string } }) => {
      const { data } = await axios.post<{ data: AutomationWorkflow }>(
        `/marketing/automation/templates/${templateId}/create-workflow`,
        overrides,
      );
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: automationKeys.workflows() }),
  });
}
