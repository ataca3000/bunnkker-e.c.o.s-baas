import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { PaginatedResponse, WorkflowExecution } from '../types/automation';
import { automationKeys } from './use-automation-workflows';

const executionKeys = {
  list: (workflowId: string, filters?: Record<string, unknown>) =>
    [...automationKeys.workflow(workflowId), 'executions', filters] as const,
  one: (workflowId: string, execId: string) =>
    [...automationKeys.workflow(workflowId), 'executions', execId] as const,
  stats: (workflowId: string) =>
    [...automationKeys.workflow(workflowId), 'execution-stats'] as const,
};

export function useWorkflowExecutions(workflowId: string, filters?: { status?: string; per_page?: number }) {
  return useQuery({
    queryKey: executionKeys.list(workflowId, filters),
    queryFn:  async () => {
      const { data } = await axios.get<PaginatedResponse<WorkflowExecution>>(
        `/marketing/automation/workflows/${workflowId}/executions`,
        { params: filters },
      );
      return data;
    },
    enabled: !!workflowId,
  });
}

export function useWorkflowExecution(workflowId: string, executionId: string) {
  return useQuery({
    queryKey: executionKeys.one(workflowId, executionId),
    queryFn:  async () => {
      const { data } = await axios.get<{ data: WorkflowExecution }>(
        `/marketing/automation/workflows/${workflowId}/executions/${executionId}`,
      );
      return data.data ?? data;
    },
    enabled: !!workflowId && !!executionId,
  });
}

export function useExecutionStats(workflowId: string) {
  return useQuery({
    queryKey: executionKeys.stats(workflowId),
    queryFn:  async () => {
      const { data } = await axios.get(
        `/marketing/automation/workflows/${workflowId}/executions/stats`,
      );
      return data;
    },
    enabled: !!workflowId,
  });
}

export function useCancelExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowId, executionId }: { workflowId: string; executionId: string }) => {
      const { data } = await axios.post(
        `/marketing/automation/workflows/${workflowId}/executions/${executionId}/cancel`,
      );
      return data.data ?? data;
    },
    onSuccess: (_data, { workflowId }) => {
      qc.invalidateQueries({ queryKey: executionKeys.list(workflowId) });
    },
  });
}

export function useRetryExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowId, executionId }: { workflowId: string; executionId: string }) => {
      const { data } = await axios.post(
        `/marketing/automation/workflows/${workflowId}/executions/${executionId}/retry`,
      );
      return data.data ?? data;
    },
    onSuccess: (_data, { workflowId }) => {
      qc.invalidateQueries({ queryKey: executionKeys.list(workflowId) });
    },
  });
}
