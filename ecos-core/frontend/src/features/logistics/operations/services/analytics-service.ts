import { api } from '@/lib/axios';
import type { Paginated } from '../types/operations';
import type {
  ActivityFeed,
  ActivityOptions,
  ActivitySeverity,
  ActivitySource,
  AssignmentHistoryRow,
  AuditFeed,
  CapacityDashboard,
  CapacityHistoryRow,
  DispatchPerformance,
  DriverUtilisation,
  FleetUtilisation,
  OperationalKpi,
  SessionHistoryRow,
} from '../types/analytics';

const BASE = '/logistics/operations';

export const analyticsService = {
  // ── Dashboards ───────────────────────────────────────────────────────────

  async fleet(): Promise<FleetUtilisation> {
    const { data } = await api.get<{ data: FleetUtilisation }>(`${BASE}/dashboards/fleet`);
    return data.data;
  },

  async drivers(): Promise<DriverUtilisation> {
    const { data } = await api.get<{ data: DriverUtilisation }>(`${BASE}/dashboards/drivers`);
    return data.data;
  },

  async capacity(date?: string): Promise<CapacityDashboard> {
    const { data } = await api.get<{ data: CapacityDashboard }>(`${BASE}/dashboards/capacity`, {
      params: { date },
    });
    return data.data;
  },

  async dispatch(): Promise<DispatchPerformance> {
    const { data } = await api.get<{ data: DispatchPerformance }>(`${BASE}/dashboards/dispatch`);
    return data.data;
  },

  async kpi(date?: string): Promise<OperationalKpi> {
    const { data } = await api.get<{ data: OperationalKpi }>(`${BASE}/dashboards/kpi`, {
      params: { date },
    });
    return data.data;
  },

  // ── Activity & audit ───────────────────────────────────────────────────────

  async activityOptions(): Promise<ActivityOptions> {
    const { data } = await api.get<ActivityOptions>(`${BASE}/activity/options`);
    return data;
  },

  async timeline(params?: {
    from?: string;
    to?: string;
    source?: ActivitySource;
    severity?: ActivitySeverity;
    limit?: number;
  }): Promise<ActivityFeed> {
    const { data } = await api.get<{ data: ActivityFeed }>(`${BASE}/activity/timeline`, { params });
    return data.data;
  },

  async audit(params?: { from?: string; to?: string; limit?: number }): Promise<AuditFeed> {
    const { data } = await api.get<{ data: AuditFeed }>(`${BASE}/activity/audit`, { params });
    return data.data;
  },

  // ── History ──────────────────────────────────────────────────────────────

  async assignmentHistory(params?: {
    status?: string;
    mode?: string;
    page?: number;
  }): Promise<Paginated<AssignmentHistoryRow>> {
    const { data } = await api.get<Paginated<AssignmentHistoryRow>>(
      `${BASE}/activity/history/assignments`,
      { params },
    );
    return data;
  },

  async sessionHistory(params?: {
    status?: string;
    page?: number;
  }): Promise<Paginated<SessionHistoryRow>> {
    const { data } = await api.get<Paginated<SessionHistoryRow>>(
      `${BASE}/activity/history/sessions`,
      { params },
    );
    return data;
  },

  async capacityHistory(params?: {
    status?: string;
    page?: number;
  }): Promise<Paginated<CapacityHistoryRow>> {
    const { data } = await api.get<Paginated<CapacityHistoryRow>>(
      `${BASE}/activity/history/capacity`,
      { params },
    );
    return data;
  },
};
