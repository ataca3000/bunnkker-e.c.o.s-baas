import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { careersService, recruitmentService } from '@/features/hr/services/recruitment-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

/**
 * Recruitment and executive query hooks.
 *
 * ADR-024 keys: company-prefixed, with mutations invalidating the whole HR
 * prefix — hiring changes an applicant, an employee, a contract, a salary and a
 * job opening at once, so nothing narrower would be honest.
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

// ── Public careers portal (no session) ──────────────────────────────────────

export function usePublicJobsQuery(params: { company_id?: string; search?: string } = {}) {
  return useQuery({
    // Not company-scoped: a visitor has no company context.
    queryKey: ['careers', 'jobs', params],
    queryFn: () => careersService.jobs(params),
    placeholderData: keepPreviousData,
  });
}

export function usePublicJobQuery(slug: string) {
  return useQuery({
    queryKey: ['careers', 'job', slug],
    queryFn: () => careersService.job(slug),
    enabled: !!slug,
    retry: false,
  });
}

export function useSubmitApplication() {
  return useMutation({
    mutationFn: ({ slug, form }: { slug: string; form: FormData }) => careersService.apply(slug, form),
  });
}

// ── ATS ─────────────────────────────────────────────────────────────────────

export function useJobOpeningsQuery(params: { status?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'job-openings', params],
    queryFn: () => recruitmentService.jobs(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateJobOpening() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => recruitmentService.createJob(payload),
    onSuccess: invalidate,
  });
}

export function useTransitionJob() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'hold' | 'close' }) =>
      recruitmentService.transitionJob(id, action),
    onSuccess: invalidate,
  });
}

export function useStagesQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'recruitment-stages'],
    queryFn: () => recruitmentService.stages(),
  });
}

export function useBoardQuery(params: { job_opening_id?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'recruitment-board', params],
    queryFn: () => recruitmentService.board(params),
    placeholderData: keepPreviousData,
  });
}

export function useApplicationsQuery(params: Record<string, unknown> = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'applications', params],
    queryFn: () => recruitmentService.applications(params),
    placeholderData: keepPreviousData,
  });
}

export function useApplicationQuery(id: string) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'application', id],
    queryFn: () => recruitmentService.application(id),
    enabled: !!id,
  });
}

export function useMoveStage() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; stage_id?: string; note?: string }) =>
      recruitmentService.moveStage(id, payload),
    onSuccess: invalidate,
  });
}

export function useDecideApplication() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; status: string; reason?: string }) =>
      recruitmentService.decide(id, payload),
    onSuccess: invalidate,
  });
}

export function useEvaluateApplication() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; rating?: string; score?: number; comments?: string }) =>
      recruitmentService.evaluate(id, payload),
    onSuccess: invalidate,
  });
}

export function useUpcomingInterviewsQuery(days = 14) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'interviews-upcoming', days],
    queryFn: () => recruitmentService.upcomingInterviews(days),
  });
}

export function useScheduleInterview() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ applicationId, ...payload }: { applicationId: string } & Record<string, unknown>) =>
      recruitmentService.scheduleInterview(applicationId, payload),
    onSuccess: invalidate,
  });
}

export function useApplicantsQuery(params: { search?: string; talent_pool?: boolean } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'applicants', params],
    queryFn: () => recruitmentService.applicants(params),
    placeholderData: keepPreviousData,
  });
}

export function useTalentPool() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; action: 'add' | 'remove'; note?: string; tags?: string[] }) =>
      recruitmentService.talentPool(id, payload),
    onSuccess: invalidate,
  });
}

export function useMergeApplicants() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: (payload: { duplicate_id: string; survivor_id: string }) => recruitmentService.merge(payload),
    onSuccess: invalidate,
  });
}

// ── Hiring & lifecycle ──────────────────────────────────────────────────────

export function useHirePrefillQuery(applicationId: string, enabled: boolean) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'hire-prefill', applicationId],
    queryFn: () => recruitmentService.hirePrefill(applicationId),
    enabled: enabled && !!applicationId,
  });
}

export function useHireApplicant() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ applicationId, ...payload }: { applicationId: string } & Record<string, unknown>) =>
      recruitmentService.hire(applicationId, payload),
    onSuccess: invalidate,
  });
}

export function useLifecycleHistoryQuery(employeeId: string) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'lifecycle', employeeId],
    queryFn: () => recruitmentService.lifecycleHistory(employeeId),
    enabled: !!employeeId,
  });
}

// ── H6 Executive ────────────────────────────────────────────────────────────

export function useHrExecutiveDashboardQuery(params: { date?: string } = {}) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'executive-dashboard', params],
    queryFn: () => recruitmentService.executiveDashboard(params),
    placeholderData: keepPreviousData,
  });
}

export function useHrTrendsQuery(months = 12) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'trends', months],
    queryFn: () => recruitmentService.trends(months),
    placeholderData: keepPreviousData,
  });
}
