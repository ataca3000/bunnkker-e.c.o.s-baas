import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  AdjustmentAudit,
  ApplicantTag,
  AssignedTag,
  BonusDecisionAudit,
  BulkActionDefinition,
  BulkPreview,
  BulkResult,
  CommissionPreview,
  ExitDetail,
  ExitListItem,
  ExplainedPayslip,
  KpiTraceability,
  LockStatus,
  OfferDetail,
  OfferDocument,
  OfferListItem,
  PendingAdjustment,
  RecruitmentAnalytics,
  RuleVersionHistory,
  TaggedApplicant,
  TimelineResult,
  RuleVersionHistory as RuleHistory,
} from '@/features/hr/types/recruitment-enhancements';

/** Tags, the applicant timeline, bulk actions and recruitment analytics. */
export const recruitmentEnhancementService = {
  // ── Tags ───────────────────────────────────────────────────────────────────
  async tagCatalogue(activeOnly = false): Promise<ApplicantTag[]> {
    const { data } = await api.get<ApiResponse<ApplicantTag[]>>('/hr/recruitment/tags', {
      params: { active_only: activeOnly ? 1 : undefined },
    });
    return data.data;
  },

  async createTag(payload: Record<string, unknown>): Promise<{ id: string; key: string }> {
    const { data } = await api.post<ApiResponse<{ id: string; key: string }>>('/hr/recruitment/tags', payload);
    return data.data;
  },

  async updateTag(id: string, payload: Record<string, unknown>): Promise<{ id: string; name: string }> {
    const { data } = await api.put<ApiResponse<{ id: string; name: string }>>(`/hr/recruitment/tags/${id}`, payload);
    return data.data;
  },

  async deleteTag(id: string): Promise<void> {
    await api.delete(`/hr/recruitment/tags/${id}`);
  },

  async applicantTags(applicantId: string): Promise<AssignedTag[]> {
    const { data } = await api.get<ApiResponse<AssignedTag[]>>(`/hr/recruitment/applicants/${applicantId}/tags`);
    return data.data;
  },

  async assignTag(applicantId: string, tagId: string, note?: string): Promise<AssignedTag[]> {
    const { data } = await api.post<ApiResponse<AssignedTag[]>>(`/hr/recruitment/applicants/${applicantId}/tags`, {
      tag_id: tagId,
      note,
    });
    return data.data;
  },

  async removeTag(applicantId: string, tagId: string): Promise<AssignedTag[]> {
    const { data } = await api.delete<ApiResponse<AssignedTag[]>>(
      `/hr/recruitment/applicants/${applicantId}/tags/${tagId}`,
    );
    return data.data;
  },

  /** `matchAll` turns "urgent OR referred" into "urgent AND referred". */
  async searchByTag(tags: string[], matchAll = false): Promise<{ total: number; items: TaggedApplicant[] }> {
    const { data } = await api.get<ApiResponse<{ total: number; items: TaggedApplicant[] }>>(
      '/hr/recruitment/tags/search',
      { params: { tags, match_all: matchAll ? 1 : undefined } },
    );
    return data.data;
  },

  // ── Timeline ───────────────────────────────────────────────────────────────
  async applicantTimeline(applicantId: string, params: Record<string, unknown> = {}): Promise<TimelineResult> {
    const { data } = await api.get<ApiResponse<TimelineResult>>(
      `/hr/recruitment/applicants/${applicantId}/timeline`,
      { params },
    );
    return data.data;
  },

  async applicationTimeline(applicationId: string, params: Record<string, unknown> = {}): Promise<TimelineResult> {
    const { data } = await api.get<ApiResponse<TimelineResult>>(
      `/hr/recruitment/applications/${applicationId}/timeline`,
      { params },
    );
    return data.data;
  },

  // ── Bulk ───────────────────────────────────────────────────────────────────
  async bulkActions(): Promise<{ max_selection: number; actions: BulkActionDefinition[] }> {
    const { data } = await api.get<ApiResponse<{ max_selection: number; actions: BulkActionDefinition[] }>>(
      '/hr/recruitment/bulk/actions',
    );
    return data.data;
  },

  async bulkPreview(action: string, applicationIds: string[]): Promise<BulkPreview> {
    const { data } = await api.post<ApiResponse<BulkPreview>>('/hr/recruitment/bulk/preview', {
      action,
      application_ids: applicationIds,
    });
    return data.data;
  },

  async bulkExecute(
    action: string,
    applicationIds: string[],
    payload: Record<string, unknown> = {},
  ): Promise<BulkResult> {
    const { data } = await api.post<ApiResponse<BulkResult>>('/hr/recruitment/bulk/execute', {
      action,
      application_ids: applicationIds,
      payload,
    });
    return data.data;
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  async analytics(params: { from?: string; to?: string } = {}): Promise<RecruitmentAnalytics> {
    const { data } = await api.get<ApiResponse<RecruitmentAnalytics>>('/hr/recruitment/analytics', { params });
    return data.data;
  },
};

/** Offer letters. */
export const offerService = {
  async list(params: { status?: string; application_id?: string } = {}): Promise<OfferListItem[]> {
    const { data } = await api.get<ApiResponse<OfferListItem[]>>('/hr/offers', { params });
    return data.data;
  },

  async detail(id: string): Promise<OfferDetail> {
    const { data } = await api.get<ApiResponse<OfferDetail>>(`/hr/offers/${id}`);
    return data.data;
  },

  async document(id: string): Promise<OfferDocument> {
    const { data } = await api.get<ApiResponse<OfferDocument>>(`/hr/offers/${id}/document`);
    return data.data;
  },

  async draft(applicationId: string, payload: Record<string, unknown>): Promise<OfferDetail> {
    const { data } = await api.post<ApiResponse<OfferDetail>>(`/hr/offers/applications/${applicationId}`, payload);
    return data.data;
  },

  async revise(id: string, payload: Record<string, unknown>): Promise<OfferDetail> {
    const { data } = await api.post<ApiResponse<OfferDetail>>(`/hr/offers/${id}/revise`, payload);
    return data.data;
  },

  async send(id: string): Promise<OfferDetail> {
    const { data } = await api.patch<ApiResponse<OfferDetail>>(`/hr/offers/${id}/send`);
    return data.data;
  },

  async accept(id: string, note?: string): Promise<OfferDetail> {
    const { data } = await api.patch<ApiResponse<OfferDetail>>(`/hr/offers/${id}/accept`, { note });
    return data.data;
  },

  async decline(id: string, note?: string): Promise<OfferDetail> {
    const { data } = await api.patch<ApiResponse<OfferDetail>>(`/hr/offers/${id}/decline`, { note });
    return data.data;
  },

  async withdraw(id: string, reason: string): Promise<OfferDetail> {
    const { data } = await api.patch<ApiResponse<OfferDetail>>(`/hr/offers/${id}/withdraw`, { reason });
    return data.data;
  },
};

/** Employee exit and clearance. */
export const exitService = {
  async open(): Promise<ExitListItem[]> {
    const { data } = await api.get<ApiResponse<ExitListItem[]>>('/hr/exits');
    return data.data;
  },

  async detail(id: string): Promise<ExitDetail> {
    const { data } = await api.get<ApiResponse<ExitDetail>>(`/hr/exits/${id}`);
    return data.data;
  },

  async types(): Promise<Array<{ value: string; label: string; is_voluntary: boolean }>> {
    const { data } = await api.get<ApiResponse<Array<{ value: string; label: string; is_voluntary: boolean }>>>(
      '/hr/exits/types',
    );
    return data.data;
  },

  async initiate(employeeId: string, payload: Record<string, unknown>): Promise<ExitDetail> {
    const { data } = await api.post<ApiResponse<ExitDetail>>(`/hr/exits/employees/${employeeId}`, payload);
    return data.data;
  },

  async complete(id: string, payload: Record<string, unknown> = {}): Promise<ExitDetail> {
    const { data } = await api.patch<ApiResponse<ExitDetail>>(`/hr/exits/${id}/complete`, payload);
    return data.data;
  },

  async completeItem(itemId: string, payload: Record<string, unknown> = {}): Promise<ExitDetail> {
    const { data } = await api.patch<ApiResponse<ExitDetail>>(`/hr/exits/items/${itemId}/complete`, payload);
    return data.data;
  },

  async waiveItem(itemId: string, reason: string): Promise<ExitDetail> {
    const { data } = await api.patch<ApiResponse<ExitDetail>>(`/hr/exits/items/${itemId}/waive`, { reason });
    return data.data;
  },

  async markNotApplicable(itemId: string, note?: string): Promise<ExitDetail> {
    const { data } = await api.patch<ApiResponse<ExitDetail>>(`/hr/exits/items/${itemId}/not-applicable`, { note });
    return data.data;
  },

  async reopenItem(itemId: string): Promise<ExitDetail> {
    const { data } = await api.patch<ApiResponse<ExitDetail>>(`/hr/exits/items/${itemId}/reopen`);
    return data.data;
  },
};

/** Showing the working behind every compensation figure. */
export const compensationExplainabilityService = {
  async commissionPreview(periodId: string, employeeId?: string): Promise<CommissionPreview> {
    const { data } = await api.get<ApiResponse<CommissionPreview>>(
      `/hr/compensation/periods/${periodId}/commission-preview`,
      { params: { employee_id: employeeId } },
    );
    return data.data;
  },

  async explainPayslip(payslipId: string): Promise<ExplainedPayslip> {
    const { data } = await api.get<ApiResponse<ExplainedPayslip>>(`/hr/compensation/payslips/${payslipId}/explain`);
    return data.data;
  },

  async kpiTraceability(
    employeeId: string,
    params: { metric_key: string; from: string; to: string },
  ): Promise<KpiTraceability> {
    const { data } = await api.get<ApiResponse<KpiTraceability>>(
      `/hr/compensation/employees/${employeeId}/kpi-traceability`,
      { params },
    );
    return data.data;
  },

  async bonusDecisionAudit(bonusId: string): Promise<BonusDecisionAudit> {
    const { data } = await api.get<ApiResponse<BonusDecisionAudit>>(
      `/hr/compensation/bonuses/${bonusId}/decision-audit`,
    );
    return data.data;
  },

  async lockStatus(params: { on_date?: string; period_id?: string } = {}): Promise<LockStatus> {
    const { data } = await api.get<ApiResponse<LockStatus>>('/hr/compensation/lock-status', { params });
    return data.data;
  },

  async pendingAdjustments(): Promise<PendingAdjustment[]> {
    const { data } = await api.get<ApiResponse<PendingAdjustment[]>>('/hr/compensation/adjustments/pending');
    return data.data;
  },

  async employeeAdjustments(employeeId: string): Promise<AdjustmentAudit[]> {
    const { data } = await api.get<ApiResponse<AdjustmentAudit[]>>(
      `/hr/compensation/employees/${employeeId}/adjustments`,
    );
    return data.data;
  },

  async raiseAdjustment(employeeId: string, payload: Record<string, unknown>): Promise<AdjustmentAudit> {
    const { data } = await api.post<ApiResponse<AdjustmentAudit>>(
      `/hr/compensation/employees/${employeeId}/adjustments`,
      payload,
    );
    return data.data;
  },

  async approveAdjustment(id: string, note?: string): Promise<AdjustmentAudit> {
    const { data } = await api.patch<ApiResponse<AdjustmentAudit>>(
      `/hr/compensation/adjustments/${id}/approve`,
      { note },
    );
    return data.data;
  },

  async rejectAdjustment(id: string, note?: string): Promise<AdjustmentAudit> {
    const { data } = await api.patch<ApiResponse<AdjustmentAudit>>(
      `/hr/compensation/adjustments/${id}/reject`,
      { note },
    );
    return data.data;
  },

  async ruleVersions(ruleId: string): Promise<RuleVersionHistory> {
    const { data } = await api.get<ApiResponse<RuleHistory>>(`/hr/compensation/commission-rules/${ruleId}/versions`);
    return data.data;
  },

  async newRuleVersion(ruleId: string, payload: Record<string, unknown>): Promise<RuleVersionHistory> {
    const { data } = await api.post<ApiResponse<RuleHistory>>(
      `/hr/compensation/commission-rules/${ruleId}/versions`,
      payload,
    );
    return data.data;
  },
};
