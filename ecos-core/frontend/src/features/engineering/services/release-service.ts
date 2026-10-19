import { api } from '@/lib/axios';
import type {
  EngineeringRelease, ReleaseValidationCheck, ReleaseApproval,
  ReleasePipelineRun, ReleaseReport, ReleaseRisk, ReleaseNote,
  ReleaseDashboard, ReleaseReadinessScore,
} from '../types/engineering';

interface PaginatedResponse<T> { data: T[]; meta: { page: number; per_page: number; total: number; last_page: number }; }

const BASE = '/system/engineering';

export const releaseService = {
  // Dashboard
  async getDashboard(): Promise<ReleaseDashboard> {
    const res = await api.get(BASE + '/releases/dashboard');
    return res.data.data;
  },

  // CRUD
  async list(params?: { status?: string | string[]; risk_level?: string; search?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<EngineeringRelease>> {
    const res = await api.get(BASE + '/releases', { params });
    return res.data.data;
  },

  async create(data: { name: string; version?: string; description?: string; release_type?: string; task_ids?: string[]; target_environment?: string; scheduled_at?: string; is_breaking_change?: boolean }): Promise<EngineeringRelease> {
    const res = await api.post(BASE + '/releases', data);
    return res.data.data.release;
  },

  async get(id: string): Promise<EngineeringRelease> {
    const res = await api.get(BASE + '/releases/' + id);
    return res.data.data.release;
  },

  async update(id: string, data: Partial<EngineeringRelease>): Promise<EngineeringRelease> {
    const res = await api.put(BASE + '/releases/' + id, data);
    return res.data.data.release;
  },

  async delete(id: string): Promise<void> {
    await api.delete(BASE + '/releases/' + id);
  },

  async transition(id: string, status: string, reason?: string): Promise<EngineeringRelease> {
    const res = await api.post(BASE + '/releases/' + id + '/transition', { status, reason });
    return res.data.data.release;
  },

  async clone(id: string, name: string): Promise<EngineeringRelease> {
    const res = await api.post(BASE + '/releases/' + id + '/clone', { name });
    return res.data.data.release;
  },

  async archive(id: string): Promise<EngineeringRelease> {
    const res = await api.post(BASE + '/releases/' + id + '/archive');
    return res.data.data.release;
  },

  async addTasks(id: string, taskIds: string[]): Promise<EngineeringRelease> {
    const res = await api.post(BASE + '/releases/' + id + '/tasks/add', { task_ids: taskIds });
    return res.data.data.release;
  },

  async removeTasks(id: string, taskIds: string[]): Promise<EngineeringRelease> {
    const res = await api.post(BASE + '/releases/' + id + '/tasks/remove', { task_ids: taskIds });
    return res.data.data.release;
  },

  // Validation & Readiness
  async validate(id: string): Promise<{ validation: ReleaseValidationCheck[]; readiness: ReleaseReadinessScore }> {
    const res = await api.post(BASE + '/releases/' + id + '/validate');
    return res.data.data;
  },

  async getReadiness(id: string): Promise<ReleaseReadinessScore> {
    const res = await api.get(BASE + '/releases/' + id + '/readiness');
    return res.data.data;
  },

  async analyzeRisks(id: string): Promise<{ risks: ReleaseRisk[]; risk_level: string; risk_count: number }> {
    const res = await api.post(BASE + '/releases/' + id + '/analyze-risks');
    return res.data.data;
  },

  async analyzeDependencies(id: string): Promise<{ dependencies: unknown[]; summary: Record<string, number> }> {
    const res = await api.post(BASE + '/releases/' + id + '/analyze-dependencies');
    return res.data.data;
  },

  async getAudit(id: string): Promise<unknown[]> {
    const res = await api.get(BASE + '/releases/' + id + '/audit');
    return res.data.data.audit;
  },

  // Reports
  async listReports(id: string): Promise<ReleaseReport[]> {
    const res = await api.get(BASE + '/releases/' + id + '/reports');
    return res.data.data.reports;
  },

  async generateReports(id: string, reportType?: string): Promise<ReleaseReport[]> {
    const res = await api.post(BASE + '/releases/' + id + '/reports/generate', reportType ? { report_type: reportType } : {});
    return res.data.data.reports ?? [res.data.data.report];
  },

  async listRisks(id: string): Promise<ReleaseRisk[]> {
    const res = await api.get(BASE + '/releases/' + id + '/risks');
    return res.data.data.risks;
  },

  async acceptRisk(releaseId: string, riskId: string): Promise<void> {
    await api.post(BASE + '/releases/' + releaseId + '/risks/' + riskId + '/accept');
  },

  async listNotes(id: string): Promise<ReleaseNote[]> {
    const res = await api.get(BASE + '/releases/' + id + '/notes');
    return res.data.data.notes;
  },

  async addNote(id: string, data: { content: string; note_type?: string; section?: string; is_public?: boolean }): Promise<ReleaseNote> {
    const res = await api.post(BASE + '/releases/' + id + '/notes', data);
    return res.data.data.note;
  },

  // Approvals
  async initiateApprovals(id: string): Promise<ReleaseApproval[]> {
    const res = await api.post(BASE + '/releases/' + id + '/approvals/initiate');
    return res.data.data.approvals;
  },

  async getApprovalStatus(id: string): Promise<{ approvals: ReleaseApproval[]; all_granted: boolean; pending_count: number; rejected_any: boolean }> {
    const res = await api.get(BASE + '/releases/' + id + '/approvals/status');
    return res.data.data;
  },

  async decideApproval(releaseId: string, approvalId: string, decision: 'approved' | 'rejected', comment?: string): Promise<ReleaseApproval> {
    const res = await api.post(BASE + '/releases/' + releaseId + '/approvals/' + approvalId + '/decide', { decision, comment });
    return res.data.data.approval;
  },

  // Pipeline
  async buildPackage(id: string): Promise<unknown> {
    const res = await api.post(BASE + '/releases/' + id + '/pipeline/build');
    return res.data.data.package;
  },

  async triggerPipeline(id: string, triggerType?: string): Promise<ReleasePipelineRun> {
    const res = await api.post(BASE + '/releases/' + id + '/pipeline/trigger', { trigger_type: triggerType ?? 'manual' });
    return res.data.data.run;
  },

  async getPipelineHistory(id: string): Promise<ReleasePipelineRun[]> {
    const res = await api.get(BASE + '/releases/' + id + '/pipeline/history');
    return res.data.data.runs;
  },
};

export default releaseService;
