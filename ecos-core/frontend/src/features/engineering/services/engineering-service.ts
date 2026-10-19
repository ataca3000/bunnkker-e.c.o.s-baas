import { api } from '@/lib/axios';
import type {
  EngineeringDashboard,
  EngineeringFinding,
  EngineeringPipeline,
  EngineeringPipelineNotification,
  EngineeringRun,
  NotificationListResponse,
  PaginatedResponse,
  PipelineAnalytics,
  PipelineTemplate,
} from '../types/engineering';

export const engineeringService = {
  async getDashboard(): Promise<EngineeringDashboard> {
    const res = await api.get<{ data: EngineeringDashboard }>('/system/engineering/dashboard');
    return res.data.data;
  },

  async getRuns(page = 1, perPage = 15): Promise<PaginatedResponse<EngineeringRun>> {
    const res = await api.get<{ data: { data: EngineeringRun[]; meta: PaginatedResponse<EngineeringRun>['meta'] } }>(
      '/system/engineering/runs',
      { params: { page, per_page: perPage } },
    );
    return { data: res.data.data.data, meta: res.data.data.meta };
  },

  async getRun(id: string): Promise<EngineeringRun> {
    const res = await api.get<{ data: EngineeringRun }>(`/system/engineering/runs/${id}`);
    return res.data.data;
  },

  async getFindings(params: {
    page?: number;
    perPage?: number;
    severity?: string;
    runId?: string;
  } = {}): Promise<PaginatedResponse<EngineeringFinding>> {
    const res = await api.get<{ data: { data: EngineeringFinding[]; meta: PaginatedResponse<EngineeringFinding>['meta'] } }>(
      '/system/engineering/findings',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.perPage ?? 25,
          severity: params.severity,
          run_id: params.runId,
        },
      },
    );
    return { data: res.data.data.data, meta: res.data.data.meta };
  },

  // ── Release Manager ─────────────────────────────────────────────────────

  async getActivePipeline(): Promise<EngineeringPipeline | null> {
    const res = await api.get<{ data: EngineeringPipeline | null }>('/system/engineering/pipelines/active');
    return res.data.data;
  },

  async getPipelines(page = 1, perPage = 15): Promise<PaginatedResponse<EngineeringPipeline>> {
    const res = await api.get<{ data: { data: EngineeringPipeline[]; meta: PaginatedResponse<EngineeringPipeline>['meta'] } }>(
      '/system/engineering/pipelines',
      { params: { page, per_page: perPage } },
    );
    return { data: res.data.data.data, meta: res.data.data.meta };
  },

  async createPipeline(params: { task_name?: string; branch?: string; template?: string }): Promise<EngineeringPipeline> {
    const res = await api.post<{ data: EngineeringPipeline }>('/system/engineering/pipelines', params);
    return res.data.data;
  },

  async getPipeline(id: string): Promise<EngineeringPipeline> {
    const res = await api.get<{ data: EngineeringPipeline }>(`/system/engineering/pipelines/${id}`);
    return res.data.data;
  },

  async cancelPipeline(id: string): Promise<EngineeringPipeline> {
    const res = await api.post<{ data: EngineeringPipeline }>(`/system/engineering/pipelines/${id}/cancel`);
    return res.data.data;
  },

  async retryPipeline(id: string): Promise<EngineeringPipeline> {
    const res = await api.post<{ data: EngineeringPipeline }>(`/system/engineering/pipelines/${id}/retry`);
    return res.data.data;
  },

  // ── Recovery (ENG-007) ──────────────────────────────────────────────────

  async resumePipeline(id: string): Promise<EngineeringPipeline> {
    const res = await api.post<{ data: EngineeringPipeline }>(`/system/engineering/pipelines/${id}/resume`);
    return res.data.data;
  },

  async restartPipeline(id: string): Promise<EngineeringPipeline> {
    const res = await api.post<{ data: EngineeringPipeline }>(`/system/engineering/pipelines/${id}/restart`);
    return res.data.data;
  },

  async restartStage(id: string, stage: string): Promise<EngineeringPipeline> {
    const res = await api.post<{ data: EngineeringPipeline }>(`/system/engineering/pipelines/${id}/restart-stage`, { stage });
    return res.data.data;
  },

  async skipStage(id: string, stage: string): Promise<EngineeringPipeline> {
    const res = await api.post<{ data: EngineeringPipeline }>(`/system/engineering/pipelines/${id}/skip-stage`, { stage });
    return res.data.data;
  },

  // ── Templates (ENG-007) ─────────────────────────────────────────────────

  async getTemplates(): Promise<PipelineTemplate[]> {
    const res = await api.get<{ data: PipelineTemplate[] }>('/system/engineering/templates');
    return res.data.data;
  },

  async getTemplate(slug: string): Promise<PipelineTemplate> {
    const res = await api.get<{ data: PipelineTemplate }>(`/system/engineering/templates/${slug}`);
    return res.data.data;
  },

  // ── Analytics (ENG-007) ─────────────────────────────────────────────────

  async getAnalytics(): Promise<PipelineAnalytics> {
    const res = await api.get<{ data: PipelineAnalytics }>('/system/engineering/analytics');
    return res.data.data;
  },

  // ── Notifications ────────────────────────────────────────────────────────

  async getNotifications(params: { page?: number; unread?: boolean } = {}): Promise<NotificationListResponse> {
    const res = await api.get<{ data: NotificationListResponse }>('/system/engineering/notifications', {
      params: { page: params.page ?? 1, unread: params.unread ? 1 : undefined },
    });
    return res.data.data;
  },

  async markNotificationRead(id: string): Promise<EngineeringPipelineNotification> {
    const res = await api.patch<{ data: EngineeringPipelineNotification }>(`/system/engineering/notifications/${id}/read`);
    return res.data.data;
  },

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    const res = await api.post<{ data: { updated: number } }>('/system/engineering/notifications/mark-all-read');
    return res.data.data;
  },
};
