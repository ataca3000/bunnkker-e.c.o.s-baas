import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  compensationExplainabilityService,
  exitService,
  offerService,
  recruitmentEnhancementService,
} from '@/features/hr/services/recruitment-enhancement-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

/**
 * HR V1 enhancement hooks.
 *
 * ADR-024 keys: company-prefixed, mutations invalidating the whole HR prefix.
 * The breadth is deliberate — accepting an offer moves the offer, the candidacy,
 * the timeline and the hire-readiness of an application at once, and a narrower
 * invalidation would leave one of those stale on screen.
 */
const HR_KEY = 'hr';

function useCompanyKey() {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

function useInvalidateHr() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] });
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export function useTagCatalogueQuery(activeOnly = false) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'applicant-tags', activeOnly],
    queryFn: () => recruitmentEnhancementService.tagCatalogue(activeOnly),
  });
}

export function useTagSearchQuery(tags: string[], matchAll = false) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'tag-search', tags, matchAll],
    queryFn: () => recruitmentEnhancementService.searchByTag(tags, matchAll),
    enabled: tags.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useCreateTagMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => recruitmentEnhancementService.createTag(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateTagMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      recruitmentEnhancementService.updateTag(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteTagMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (id: string) => recruitmentEnhancementService.deleteTag(id),
    onSuccess: invalidate,
  });
}

export function useAssignTagMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ applicantId, tagId, note }: { applicantId: string; tagId: string; note?: string }) =>
      recruitmentEnhancementService.assignTag(applicantId, tagId, note),
    onSuccess: invalidate,
  });
}

export function useRemoveTagMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ applicantId, tagId }: { applicantId: string; tagId: string }) =>
      recruitmentEnhancementService.removeTag(applicantId, tagId),
    onSuccess: invalidate,
  });
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export function useApplicantTimelineQuery(applicantId: string | undefined, params: Record<string, unknown> = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'applicant-timeline', applicantId, params],
    queryFn: () => recruitmentEnhancementService.applicantTimeline(applicantId as string, params),
    enabled: Boolean(applicantId),
  });
}

export function useApplicationTimelineQuery(applicationId: string | undefined, params: Record<string, unknown> = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'application-timeline', applicationId, params],
    queryFn: () => recruitmentEnhancementService.applicationTimeline(applicationId as string, params),
    enabled: Boolean(applicationId),
  });
}

// ── Bulk ─────────────────────────────────────────────────────────────────────

export function useBulkActionsQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'bulk-actions'],
    queryFn: () => recruitmentEnhancementService.bulkActions(),
  });
}

export function useBulkPreviewMutation() {
  return useMutation({
    mutationFn: ({ action, ids }: { action: string; ids: string[] }) =>
      recruitmentEnhancementService.bulkPreview(action, ids),
  });
}

export function useBulkExecuteMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ action, ids, payload }: { action: string; ids: string[]; payload?: Record<string, unknown> }) =>
      recruitmentEnhancementService.bulkExecute(action, ids, payload ?? {}),
    onSuccess: invalidate,
  });
}

// ── Analytics ────────────────────────────────────────────────────────────────

export function useRecruitmentAnalyticsQuery(params: { from?: string; to?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'recruitment-analytics', params],
    queryFn: () => recruitmentEnhancementService.analytics(params),
    placeholderData: keepPreviousData,
  });
}

// ── Offers ───────────────────────────────────────────────────────────────────

export function useOffersQuery(params: { status?: string; application_id?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'offers', params],
    queryFn: () => offerService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useOfferQuery(id: string | undefined) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'offer', id],
    queryFn: () => offerService.detail(id as string),
    enabled: Boolean(id),
  });
}

export function useOfferDocumentQuery(id: string | undefined) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'offer-document', id],
    queryFn: () => offerService.document(id as string),
    enabled: Boolean(id),
  });
}

export function useDraftOfferMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ applicationId, payload }: { applicationId: string; payload: Record<string, unknown> }) =>
      offerService.draft(applicationId, payload),
    onSuccess: invalidate,
  });
}

export function useReviseOfferMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      offerService.revise(id, payload),
    onSuccess: invalidate,
  });
}

export function useOfferTransitionMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'send' | 'accept' | 'decline' | 'withdraw'; note?: string }) => {
      if (action === 'send') return offerService.send(id);
      if (action === 'accept') return offerService.accept(id, note);
      if (action === 'decline') return offerService.decline(id, note);
      return offerService.withdraw(id, note ?? 'Withdrawn');
    },
    onSuccess: invalidate,
  });
}

// ── Exit ─────────────────────────────────────────────────────────────────────

export function useOpenExitsQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'exits'],
    queryFn: () => exitService.open(),
  });
}

export function useExitQuery(id: string | undefined) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'exit', id],
    queryFn: () => exitService.detail(id as string),
    enabled: Boolean(id),
  });
}

export function useExitItemMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({
      itemId,
      action,
      reason,
    }: {
      itemId: string;
      action: 'complete' | 'waive' | 'not_applicable' | 'reopen';
      reason?: string;
    }) => {
      if (action === 'complete') return exitService.completeItem(itemId, { notes: reason });
      if (action === 'waive') return exitService.waiveItem(itemId, reason ?? '');
      if (action === 'not_applicable') return exitService.markNotApplicable(itemId, reason);
      return exitService.reopenItem(itemId);
    },
    onSuccess: invalidate,
  });
}

export function useCompleteExitMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: Record<string, unknown> }) =>
      exitService.complete(id, payload ?? {}),
    onSuccess: invalidate,
  });
}

// ── Compensation explainability ──────────────────────────────────────────────

export function useCommissionPreviewQuery(periodId: string | undefined, employeeId?: string) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'commission-preview', periodId, employeeId],
    queryFn: () => compensationExplainabilityService.commissionPreview(periodId as string, employeeId),
    enabled: Boolean(periodId),
  });
}

export function useExplainedPayslipQuery(payslipId: string | undefined) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'payslip-explained', payslipId],
    queryFn: () => compensationExplainabilityService.explainPayslip(payslipId as string),
    enabled: Boolean(payslipId),
  });
}

export function usePendingAdjustmentsQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'adjustments-pending'],
    queryFn: () => compensationExplainabilityService.pendingAdjustments(),
  });
}

export function useAdjustmentDecisionMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note?: string }) =>
      action === 'approve'
        ? compensationExplainabilityService.approveAdjustment(id, note)
        : compensationExplainabilityService.rejectAdjustment(id, note),
    onSuccess: invalidate,
  });
}

export function useRaiseAdjustmentMutation() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ employeeId, payload }: { employeeId: string; payload: Record<string, unknown> }) =>
      compensationExplainabilityService.raiseAdjustment(employeeId, payload),
    onSuccess: invalidate,
  });
}

export function useRuleVersionsQuery(ruleId: string | undefined) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'rule-versions', ruleId],
    queryFn: () => compensationExplainabilityService.ruleVersions(ruleId as string),
    enabled: Boolean(ruleId),
  });
}
