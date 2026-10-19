import { api } from '@/lib/axios';
import type {
  EngineeringWorker,
  WorkerSession,
  QueueEntry,
  ClusterDashboard,
  ClusterHealthReport,
  ResourceUsageSnapshot,
  SchedulerStatus,
} from '../types/engineering';

interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number; last_page: number };
}

const BASE = '/system/engineering';

export const clusterService = {
  // Workers
  async listWorkers(params?: { status?: string; worker_type?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<EngineeringWorker>> {
    const res = await api.get(BASE + '/workers', { params });
    return res.data.data;
  },

  async createWorker(data: { name: string; worker_type: string; repository_path?: string; workspace_base?: string; max_concurrent_tasks?: number; priority?: number }): Promise<EngineeringWorker> {
    const res = await api.post(BASE + '/workers', data);
    return res.data.data.worker;
  },

  async getWorker(id: string): Promise<EngineeringWorker> {
    const res = await api.get(BASE + '/workers/' + id);
    return res.data.data.worker;
  },

  async startWorker(id: string): Promise<EngineeringWorker> {
    const res = await api.post(BASE + '/workers/' + id + '/start');
    return res.data.data.worker;
  },

  async stopWorker(id: string): Promise<void> {
    await api.post(BASE + '/workers/' + id + '/stop');
  },

  async drainWorker(id: string): Promise<void> {
    await api.post(BASE + '/workers/' + id + '/drain');
  },

  async destroyWorker(id: string): Promise<void> {
    await api.delete(BASE + '/workers/' + id);
  },

  async heartbeat(id: string, metrics?: { status?: string; progress?: number; message?: string }): Promise<void> {
    await api.post(BASE + '/workers/' + id + '/heartbeat', metrics ?? {});
  },

  async getWorkerSessions(id: string, page = 1): Promise<PaginatedResponse<WorkerSession>> {
    const res = await api.get(BASE + '/workers/' + id + '/sessions', { params: { page } });
    return res.data.data;
  },

  async recoverWorker(id: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post(BASE + '/cluster/workers/' + id + '/recover');
    return res.data.data;
  },

  async checkWorkerHealth(id: string): Promise<Record<string, unknown>> {
    const res = await api.get(BASE + '/cluster/workers/' + id + '/health');
    return res.data.data;
  },

  // Queue
  async listQueue(params?: { status?: string; policy?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<QueueEntry>> {
    const res = await api.get(BASE + '/queue', { params });
    return res.data.data;
  },

  async enqueue(data: { task_id: string; priority?: number; scheduling_policy?: string; reserved_worker_id?: string; earliest_start_at?: string }): Promise<QueueEntry> {
    const res = await api.post(BASE + '/queue/enqueue', data);
    return res.data.data.entry;
  },

  async cancelQueueEntry(entryId: string, reason?: string): Promise<void> {
    await api.post(BASE + '/queue/' + entryId + '/cancel', { reason });
  },

  async prioritizeQueueEntry(entryId: string, priority: number): Promise<void> {
    await api.post(BASE + '/queue/' + entryId + '/prioritize', { priority });
  },

  async getSchedulerStatus(): Promise<SchedulerStatus> {
    const res = await api.get(BASE + '/queue/status');
    return res.data.data;
  },

  async pauseScheduler(): Promise<void> {
    await api.post(BASE + '/queue/pause');
  },

  async resumeScheduler(): Promise<void> {
    await api.post(BASE + '/queue/resume');
  },

  async drainQueue(reason?: string): Promise<{ count: number }> {
    const res = await api.post(BASE + '/queue/drain', { reason });
    return res.data.data;
  },

  // Cluster
  async getDashboard(): Promise<ClusterDashboard> {
    const res = await api.get(BASE + '/cluster/dashboard');
    return res.data.data;
  },

  async tick(): Promise<{ assigned: number; skipped: number; recovered: number }> {
    const res = await api.post(BASE + '/cluster/tick');
    return res.data.data;
  },

  async purgeExpiredLocks(): Promise<Record<string, number>> {
    const res = await api.post(BASE + '/cluster/purge-locks');
    return res.data.data;
  },

  async recoverStaleWorkers(): Promise<{ recovered: number }> {
    const res = await api.post(BASE + '/cluster/recover-stale');
    return res.data.data;
  },

  // Health
  async getHealthReport(): Promise<ClusterHealthReport> {
    const res = await api.get(BASE + '/cluster/health');
    return res.data.data;
  },

  // Metrics
  async collectSnapshot(): Promise<ResourceUsageSnapshot> {
    const res = await api.get(BASE + '/cluster/metrics/snapshot');
    return res.data.data.snapshot;
  },

  async getTrend(limit?: number): Promise<ResourceUsageSnapshot[]> {
    const res = await api.get(BASE + '/cluster/metrics/trend', { params: { limit } });
    return res.data.data.trend;
  },

  async getTimeseries(metricType: string, minutes?: number): Promise<unknown[]> {
    const res = await api.get(BASE + '/cluster/metrics/timeseries', { params: { metric_type: metricType, minutes } });
    return res.data.data.series;
  },
};

export default clusterService;
