import axios from 'axios';

import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  Applicant,
  Application,
  ApplicationDetail,
  ApplicationReceipt,
  ApplicationsResult,
  BoardColumn,
  DuplicateMatch,
  HirePrefill,
  HrExecutiveDashboard,
  HrTrends,
  JobOpening,
  LifecycleEvent,
  PublicJob,
  PublicJobDetail,
  RecruitmentStage,
  UpcomingInterview,
} from '@/features/hr/types/recruitment';

/**
 * The public careers client.
 *
 * Deliberately a bare axios instance rather than the app's `api`: the portal is
 * reached by visitors who have no session, and the shared client attaches auth
 * headers and redirects to login on a 401. Nothing here should ever do either.
 */
const publicApi = axios.create({ baseURL: api.defaults.baseURL });

export const careersService = {
  async jobs(params: { company_id?: string; department_id?: string; search?: string } = {}): Promise<PublicJob[]> {
    const { data } = await publicApi.get<ApiResponse<PublicJob[]>>('/careers/jobs', { params });
    return data.data;
  },

  async job(slug: string): Promise<PublicJobDetail> {
    const { data } = await publicApi.get<ApiResponse<PublicJobDetail>>(`/careers/jobs/${slug}`);
    return data.data;
  },

  /** Multipart, because the form carries a CV. */
  async apply(slug: string, form: FormData): Promise<ApplicationReceipt> {
    const { data } = await publicApi.post<ApiResponse<ApplicationReceipt>>(`/careers/jobs/${slug}/apply`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },
};

/** The authenticated ATS + executive client. */
export const recruitmentService = {
  // ── Job openings ──────────────────────────────────────────────────────────
  async jobs(params: { status?: string; department_id?: string } = {}): Promise<JobOpening[]> {
    const { data } = await api.get<ApiResponse<JobOpening[]>>('/hr/recruitment/jobs', { params });
    return data.data;
  },

  async createJob(payload: Record<string, unknown>): Promise<JobOpening> {
    const { data } = await api.post<ApiResponse<JobOpening>>('/hr/recruitment/jobs', payload);
    return data.data;
  },

  async transitionJob(id: string, action: 'publish' | 'hold' | 'close'): Promise<JobOpening> {
    const { data } = await api.patch<ApiResponse<JobOpening>>(`/hr/recruitment/jobs/${id}/transition`, { action });
    return data.data;
  },

  // ── Pipeline ──────────────────────────────────────────────────────────────
  async stages(): Promise<RecruitmentStage[]> {
    const { data } = await api.get<ApiResponse<RecruitmentStage[]>>('/hr/recruitment/stages');
    return data.data;
  },

  async board(params: { job_opening_id?: string } = {}): Promise<BoardColumn[]> {
    const { data } = await api.get<ApiResponse<BoardColumn[]>>('/hr/recruitment/board', { params });
    return data.data;
  },

  // ── Applications ──────────────────────────────────────────────────────────
  async applications(params: Record<string, unknown> = {}): Promise<ApplicationsResult> {
    const { data } = await api.get<ApiResponse<ApplicationsResult>>('/hr/recruitment/applications', { params });
    return data.data;
  },

  async application(id: string): Promise<ApplicationDetail> {
    const { data } = await api.get<ApiResponse<ApplicationDetail>>(`/hr/recruitment/applications/${id}`);
    return data.data;
  },

  async moveStage(id: string, payload: { stage_id?: string; note?: string }): Promise<Application> {
    const { data } = await api.patch<ApiResponse<Application>>(`/hr/recruitment/applications/${id}/stage`, payload);
    return data.data;
  },

  async decide(id: string, payload: { status: string; reason?: string }): Promise<Application> {
    const { data } = await api.patch<ApiResponse<Application>>(`/hr/recruitment/applications/${id}/decide`, payload);
    return data.data;
  },

  async evaluate(
    id: string,
    payload: { rating?: string; score?: number; comments?: string },
  ): Promise<unknown> {
    const { data } = await api.post<ApiResponse<unknown>>(`/hr/recruitment/applications/${id}/evaluations`, payload);
    return data.data;
  },

  // ── Interviews ────────────────────────────────────────────────────────────
  async upcomingInterviews(days = 14): Promise<{ days: number; items: UpcomingInterview[] }> {
    const { data } = await api.get<ApiResponse<{ days: number; items: UpcomingInterview[] }>>(
      '/hr/recruitment/interviews/upcoming',
      { params: { days } },
    );
    return data.data;
  },

  async scheduleInterview(applicationId: string, payload: Record<string, unknown>): Promise<UpcomingInterview> {
    const { data } = await api.post<ApiResponse<UpcomingInterview>>(
      `/hr/recruitment/applications/${applicationId}/interviews`,
      payload,
    );
    return data.data;
  },

  async completeInterview(id: string, payload: { decision?: string; notes?: string }): Promise<UpcomingInterview> {
    const { data } = await api.patch<ApiResponse<UpcomingInterview>>(
      `/hr/recruitment/interviews/${id}/complete`,
      payload,
    );
    return data.data;
  },

  // ── Applicants & talent pool ──────────────────────────────────────────────
  async applicants(params: { search?: string; talent_pool?: boolean } = {}): Promise<Applicant[]> {
    const { data } = await api.get<ApiResponse<Applicant[]>>('/hr/recruitment/applicants', { params });
    return data.data;
  },

  async duplicates(params: { mobile?: string; email?: string }): Promise<DuplicateMatch[]> {
    const { data } = await api.get<ApiResponse<DuplicateMatch[]>>('/hr/recruitment/applicants/duplicates', { params });
    return data.data;
  },

  async merge(payload: { duplicate_id: string; survivor_id: string }): Promise<Applicant> {
    const { data } = await api.post<ApiResponse<Applicant>>('/hr/recruitment/applicants/merge', payload);
    return data.data;
  },

  async talentPool(
    id: string,
    payload: { action: 'add' | 'remove'; note?: string; tags?: string[] },
  ): Promise<Applicant> {
    const { data } = await api.patch<ApiResponse<Applicant>>(`/hr/recruitment/applicants/${id}/talent-pool`, payload);
    return data.data;
  },

  // ── Hiring ────────────────────────────────────────────────────────────────
  async hirePrefill(applicationId: string): Promise<HirePrefill> {
    const { data } = await api.get<ApiResponse<HirePrefill>>(
      `/hr/recruitment/applications/${applicationId}/hire-prefill`,
    );
    return data.data;
  },

  async hire(applicationId: string, payload: Record<string, unknown>): Promise<{ employee_id: string; employee_number: string; name: string }> {
    const { data } = await api.post<ApiResponse<{ employee_id: string; employee_number: string; name: string }>>(
      `/hr/recruitment/applications/${applicationId}/hire`,
      payload,
    );
    return data.data;
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async lifecycleHistory(employeeId: string): Promise<{ employee_id: string; events: LifecycleEvent[] }> {
    const { data } = await api.get<ApiResponse<{ employee_id: string; events: LifecycleEvent[] }>>(
      `/hr/lifecycle/employees/${employeeId}/history`,
    );
    return data.data;
  },

  async move(employeeId: string, payload: Record<string, unknown>): Promise<unknown> {
    const { data } = await api.post<ApiResponse<unknown>>(`/hr/lifecycle/employees/${employeeId}/move`, payload);
    return data.data;
  },

  async separate(
    employeeId: string,
    payload: { reason: string; resigned?: boolean; effective_date?: string },
  ): Promise<unknown> {
    const { data } = await api.post<ApiResponse<unknown>>(`/hr/lifecycle/employees/${employeeId}/separate`, payload);
    return data.data;
  },

  // ── H6 Executive ──────────────────────────────────────────────────────────
  async executiveDashboard(params: { date?: string } = {}): Promise<HrExecutiveDashboard> {
    const { data } = await api.get<ApiResponse<HrExecutiveDashboard>>('/hr/executive/dashboard', { params });
    return data.data;
  },

  async trends(months = 12): Promise<HrTrends> {
    const { data } = await api.get<ApiResponse<HrTrends>>('/hr/executive/analytics/trends', { params: { months } });
    return data.data;
  },

  async departmentDrilldown(departmentId: string, periodMonth: string): Promise<Record<string, unknown>> {
    const { data } = await api.get<ApiResponse<Record<string, unknown>>>(
      `/hr/executive/departments/${departmentId}`,
      { params: { period_month: periodMonth } },
    );
    return data.data;
  },
};
