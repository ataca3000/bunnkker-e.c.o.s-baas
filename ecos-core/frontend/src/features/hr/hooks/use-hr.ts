import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hrService } from '@/features/hr/services/hr-service';
import type { EmployeePayload, EmployeesQuery, LeavePayrollFlag } from '@/features/hr/types/hr';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

/**
 * HR query hooks.
 *
 * Cache keys follow ADR-024: every key is prefixed with the active company, and
 * a mutation invalidates the broad HR prefix so list and detail views can never
 * disagree about the same employee.
 */
const HR_KEY = 'hr';

function useCompanyKey() {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

// ── Employees ───────────────────────────────────────────────────────────────

export function useEmployeesQuery(params: EmployeesQuery, options?: { enabled?: boolean }) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'employees', params],
    queryFn: () => hrService.listEmployees(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useEmployee360Query(id: string) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'employee-360', id],
    queryFn: () => hrService.getEmployee360(id),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeePayload) => hrService.createEmployee(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] }),
  });
}

export function useUpdateEmployee() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EmployeePayload> }) =>
      hrService.updateEmployee(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] }),
  });
}

export function useTerminateEmployee() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, resigned }: { id: string; reason: string; resigned?: boolean }) =>
      hrService.terminateEmployee(id, { reason, resigned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] }),
  });
}

// ── Structure ───────────────────────────────────────────────────────────────

export function useDepartmentsQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'departments'],
    queryFn: () => hrService.listDepartments(),
  });
}

export function useDepartmentTreeQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'department-tree'],
    queryFn: () => hrService.departmentTree(),
  });
}

export function useCreateDepartment() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { code: string; name: string; parent_id?: string | null; description?: string | null }) =>
      hrService.createDepartment(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] }),
  });
}

export function usePositionsQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'positions'],
    queryFn: () => hrService.listPositions(),
  });
}

export function useCreatePosition() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      code: string;
      title: string;
      department_id?: string | null;
      job_grade_id?: string | null;
      headcount_limit?: number | null;
    }) => hrService.createPosition(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] }),
  });
}

export function useJobGradesQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'job-grades'],
    queryFn: () => hrService.listJobGrades(),
  });
}

export function useCreateJobGrade() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { code: string; name: string; level?: number }) => hrService.createJobGrade(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] }),
  });
}

export function useEmploymentTypesQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'employment-types'],
    queryFn: () => hrService.listEmploymentTypes(),
  });
}

// ── Organisation chart ──────────────────────────────────────────────────────

export function useOrganizationChartQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'org-chart'],
    queryFn: () => hrService.organizationChart(),
  });
}

// ── Attendance ──────────────────────────────────────────────────────────────

export function useAttendanceSheetQuery(params: { date?: string; department_id?: string }) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'attendance-sheet', params],
    queryFn: () => hrService.attendanceSheet(params),
    placeholderData: keepPreviousData,
  });
}

export function useRegisterAttendance() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      work_date: string;
      entries: Array<{ employee_id: string; status: string; check_in?: string; notes?: string }>;
    }) => hrService.registerMany(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] }),
  });
}

export function useAvailabilityQuery(params: { date?: string }) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'availability', params],
    queryFn: () => hrService.availability(params),
    placeholderData: keepPreviousData,
  });
}

export function useDepartmentAvailabilityQuery(params: { date?: string }) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'availability-departments', params],
    queryFn: () => hrService.availabilityByDepartment(params),
    placeholderData: keepPreviousData,
  });
}

export function useHolidaysQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'holidays'],
    queryFn: () => hrService.listHolidays(),
  });
}

export function useShiftsQuery() {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'shifts'],
    queryFn: () => hrService.listShifts(),
  });
}

// ── Leave ───────────────────────────────────────────────────────────────────

export function useLeaveRequestsQuery(params: { status?: string; employee_id?: string }) {
  const companyId = useCompanyKey();
  return useQuery({
    queryKey: ['company', companyId, HR_KEY, 'leave', params],
    queryFn: () => hrService.listLeaveRequests(params),
    placeholderData: keepPreviousData,
  });
}

export function useSubmitLeave() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      employee_id: string;
      start_date: string;
      end_date: string;
      payroll_flag: LeavePayrollFlag;
      reason?: string;
    }) => hrService.submitLeave(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] }),
  });
}

/** Approving writes the covered days onto attendance, so the whole HR prefix goes. */
export function useDecideLeave() {
  const companyId = useCompanyKey();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'approve' | 'reject' | 'cancel'; note?: string }) => {
      if (decision === 'approve') return hrService.approveLeave(id, note);
      if (decision === 'reject') return hrService.rejectLeave(id, note);
      return hrService.cancelLeave(id, note);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, HR_KEY] }),
  });
}
