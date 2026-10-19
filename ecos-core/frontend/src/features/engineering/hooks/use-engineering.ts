import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganizationContext } from '@/features/organization/context/organization-context';
import { engineeringService } from '../services/engineering-service';

export function useEngineeringDashboard() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'engineering', 'dashboard'],
    queryFn: () => engineeringService.getDashboard(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useEngineeringRuns(page = 1, perPage = 15) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'engineering', 'runs', page, perPage],
    queryFn: () => engineeringService.getRuns(page, perPage),
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useEngineeringRun(id: string | null) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'engineering', 'run', id],
    queryFn: () => engineeringService.getRun(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useEngineeringFindings(params: {
  page?: number;
  perPage?: number;
  severity?: string;
  runId?: string;
} = {}) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'engineering', 'findings', params],
    queryFn: () => engineeringService.getFindings(params),
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
}

// ── Release Manager hooks ─────────────────────────────────────────────────

export function useActivePipeline() {
  return useQuery({
    queryKey: ['engineering', 'pipeline', 'active'],
    queryFn: () => engineeringService.getActivePipeline(),
    refetchInterval: 3_000, // poll every 3s for live updates
    staleTime: 0,
  });
}

export function useEngineeringPipeline(id: string | null) {
  return useQuery({
    queryKey: ['engineering', 'pipeline', id],
    queryFn: () => engineeringService.getPipeline(id!),
    enabled: !!id,
    refetchInterval: 3_000,
    staleTime: 0,
  });
}

export function useEngineeringPipelines(page = 1) {
  return useQuery({
    queryKey: ['engineering', 'pipelines', page],
    queryFn: () => engineeringService.getPipelines(page),
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { task_name?: string; branch?: string; template?: string }) =>
      engineeringService.createPipeline(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipeline', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['engineering', 'analytics'] });
    },
  });
}

export function useCancelPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => engineeringService.cancelPipeline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipelines'] });
    },
  });
}

export function useRetryPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => engineeringService.retryPipeline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipelines'] });
    },
  });
}

// ── Recovery hooks (ENG-007) ──────────────────────────────────────────────

export function useResumePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => engineeringService.resumePipeline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipelines'] });
    },
  });
}

export function useRestartPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => engineeringService.restartPipeline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipelines'] });
    },
  });
}

export function useSkipStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      engineeringService.skipStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineering', 'pipeline'] });
    },
  });
}

// ── Template hooks (ENG-007) ──────────────────────────────────────────────

export function usePipelineTemplates() {
  return useQuery({
    queryKey: ['engineering', 'templates'],
    queryFn: () => engineeringService.getTemplates(),
    staleTime: 60_000,
  });
}

// ── Analytics hooks (ENG-007) ─────────────────────────────────────────────

export function usePipelineAnalytics() {
  return useQuery({
    queryKey: ['engineering', 'analytics'],
    queryFn: () => engineeringService.getAnalytics(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ── Notification hooks ────────────────────────────────────────────────────

export function useEngineeringNotifications(page = 1) {
  return useQuery({
    queryKey: ['engineering', 'notifications', page],
    queryFn: () => engineeringService.getNotifications({ page }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['engineering', 'notifications', 'unread-count'],
    queryFn: async () => {
      const res = await engineeringService.getNotifications({ unread: true, page: 1 });
      return res.unread_count;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => engineeringService.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineering', 'notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => engineeringService.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineering', 'notifications'] });
    },
  });
}
