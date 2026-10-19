import { api as axios } from '@/lib/axios';

const API_BASE = '/system/engineering/workspace';

export interface WorkspaceHealth {
  repair_success_rate: number;
  validation_accept_rate: number;
  guardian_allow_rate: number;
  supervisor_score: number | null;
  debt_score: number;
  debt_level: string;
}

export interface ReleaseReadinessRow {
  id: string;
  name: string;
  version: string;
  status: string;
  can_proceed: boolean;
  blocking_issues: number;
  passed_checks: number;
  failed_checks: number;
  total_score: number;
  risk_count: number;
  created_at: string | null;
}

export interface TimelineEvent {
  source: 'repair' | 'validation' | 'guardian';
  event_type: string;
  subject_id: string;
  data: Record<string, unknown> | null;
  actor_id: string | null;
  occurred_at: string | null;
}

export interface WorkspaceExecutive {
  health: WorkspaceHealth;
  repairs: Record<string, unknown>;
  guardian: Record<string, unknown>;
  validations: Record<string, unknown>;
  releases: ReleaseReadinessRow[];
  insights: Array<Record<string, unknown>>;
  debt: { debt_score: number; debt_level: string; breakdown: Array<Record<string, unknown>> };
}

export interface WorkspaceLive {
  active_repairs: Array<Record<string, unknown>>;
  running_validations: Array<Record<string, unknown>>;
  active_guardian_runs: Array<Record<string, unknown>>;
  recent_events: TimelineEvent[];
}

export interface WorkspaceSearchResults {
  repair_sessions: Array<Record<string, unknown>>;
  guardian_runs: Array<Record<string, unknown>>;
  releases: Array<Record<string, unknown>>;
  insights: Array<Record<string, unknown>>;
}

export interface SavedView {
  id: string;
  name: string;
  context: string;
  filters: Record<string, unknown> | null;
  is_shared: boolean;
}

export const workspaceService = {
  async getExecutive(): Promise<WorkspaceExecutive> {
    const r = await axios.get(`${API_BASE}/executive`);
    return r.data.data;
  },

  async getLive(): Promise<WorkspaceLive> {
    const r = await axios.get(`${API_BASE}/live`);
    return r.data.data;
  },

  async getTimeline(type?: string, limit = 50): Promise<{ events: TimelineEvent[]; has_more: boolean }> {
    const r = await axios.get(`${API_BASE}/timeline`, { params: { type, limit } });
    return r.data.data;
  },

  async search(q: string): Promise<WorkspaceSearchResults> {
    const r = await axios.get(`${API_BASE}/search`, { params: { q } });
    return r.data.data;
  },

  async getReleaseReadiness(limit = 10): Promise<ReleaseReadinessRow[]> {
    const r = await axios.get(`${API_BASE}/release-readiness`, { params: { limit } });
    return r.data.data;
  },

  async downloadExport(dataset: 'repair_sessions' | 'validations' | 'guardian_runs'): Promise<void> {
    const r = await axios.get(`${API_BASE}/export`, {
      params: { dataset },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `engineering-${dataset}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  async getViews(context?: string): Promise<SavedView[]> {
    const r = await axios.get(`${API_BASE}/views`, { params: { context } });
    return r.data.data;
  },

  async createView(data: { name: string; context: string; filters?: Record<string, unknown>; is_shared?: boolean }): Promise<SavedView> {
    const r = await axios.post(`${API_BASE}/views`, data);
    return r.data.data;
  },

  async deleteView(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/views/${id}`);
  },
};
