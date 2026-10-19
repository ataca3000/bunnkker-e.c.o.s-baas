import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  AttendanceSheet,
  Department,
  DepartmentAvailability,
  DepartmentNode,
  Employee,
  Employee360,
  EmployeePayload,
  EmployeesQuery,
  EmployeesResult,
  EmploymentType,
  JobGrade,
  LeavePayrollFlag,
  LeaveRequest,
  OfficialHoliday,
  OrgChart,
  Position,
  Shift,
  WorkforceAvailability,
} from '@/features/hr/types/hr';

/** HR & Workforce OS — REST client. */
export const hrService = {
  // ── Employees (H1) ────────────────────────────────────────────────────────
  async listEmployees(params: EmployeesQuery): Promise<EmployeesResult> {
    const { data } = await api.get<ApiResponse<EmployeesResult>>('/hr/employees', { params });
    return data.data;
  },

  async getEmployee(id: string): Promise<Employee> {
    const { data } = await api.get<ApiResponse<Employee>>(`/hr/employees/${id}`);
    return data.data;
  },

  /** The Employee 360 workspace. */
  async getEmployee360(id: string): Promise<Employee360> {
    const { data } = await api.get<ApiResponse<Employee360>>(`/hr/employees/${id}/overview`);
    return data.data;
  },

  async createEmployee(payload: EmployeePayload): Promise<Employee> {
    const { data } = await api.post<ApiResponse<Employee>>('/hr/employees', payload);
    return data.data;
  },

  async updateEmployee(id: string, payload: Partial<EmployeePayload>): Promise<Employee> {
    const { data } = await api.put<ApiResponse<Employee>>(`/hr/employees/${id}`, payload);
    return data.data;
  },

  async transferEmployee(
    id: string,
    payload: { department_id?: string | null; branch_id?: string | null; position_id?: string | null },
  ): Promise<Employee> {
    const { data } = await api.patch<ApiResponse<Employee>>(`/hr/employees/${id}/transfer`, payload);
    return data.data;
  },

  async terminateEmployee(
    id: string,
    payload: { reason: string; termination_date?: string; resigned?: boolean },
  ): Promise<Employee> {
    const { data } = await api.patch<ApiResponse<Employee>>(`/hr/employees/${id}/terminate`, payload);
    return data.data;
  },

  // ── Structure (H1) ────────────────────────────────────────────────────────
  async listDepartments(): Promise<Department[]> {
    const { data } = await api.get<ApiResponse<Department[]>>('/hr/departments');
    return data.data;
  },

  async departmentTree(): Promise<DepartmentNode[]> {
    const { data } = await api.get<ApiResponse<DepartmentNode[]>>('/hr/departments/tree');
    return data.data;
  },

  async createDepartment(payload: {
    code: string;
    name: string;
    parent_id?: string | null;
    description?: string | null;
  }): Promise<Department> {
    const { data } = await api.post<ApiResponse<Department>>('/hr/departments', payload);
    return data.data;
  },

  async listPositions(): Promise<Position[]> {
    const { data } = await api.get<ApiResponse<Position[]>>('/hr/positions');
    return data.data;
  },

  async createPosition(payload: {
    code: string;
    title: string;
    department_id?: string | null;
    job_grade_id?: string | null;
    headcount_limit?: number | null;
  }): Promise<Position> {
    const { data } = await api.post<ApiResponse<Position>>('/hr/positions', payload);
    return data.data;
  },

  async listJobGrades(): Promise<JobGrade[]> {
    const { data } = await api.get<ApiResponse<JobGrade[]>>('/hr/job-grades');
    return data.data;
  },

  async createJobGrade(payload: { code: string; name: string; level?: number }): Promise<JobGrade> {
    const { data } = await api.post<ApiResponse<JobGrade>>('/hr/job-grades', payload);
    return data.data;
  },

  async listEmploymentTypes(): Promise<EmploymentType[]> {
    const { data } = await api.get<ApiResponse<EmploymentType[]>>('/hr/employment-types');
    return data.data;
  },

  // ── Organisation chart (H1) ───────────────────────────────────────────────
  async organizationChart(): Promise<OrgChart> {
    const { data } = await api.get<ApiResponse<OrgChart>>('/hr/organization-chart');
    return data.data;
  },

  async assignManager(
    employeeId: string,
    payload: { manager_employee_id: string; type?: string; effective_from?: string },
  ): Promise<unknown> {
    const { data } = await api.post<ApiResponse<unknown>>(
      `/hr/employees/${employeeId}/reporting-lines`,
      payload,
    );
    return data.data;
  },

  // ── Attendance (H2) ───────────────────────────────────────────────────────
  async attendanceSheet(params: { date?: string; department_id?: string }): Promise<AttendanceSheet> {
    const { data } = await api.get<ApiResponse<AttendanceSheet>>('/hr/attendance/sheet', { params });
    return data.data;
  },

  async registerMany(payload: {
    work_date: string;
    entries: Array<{ employee_id: string; status: string; check_in?: string; check_out?: string; notes?: string }>;
  }): Promise<{ work_date: string; registered: number; skipped: Array<{ employee_id: string | null; reason: string }> }> {
    const { data } = await api.post<
      ApiResponse<{ work_date: string; registered: number; skipped: Array<{ employee_id: string | null; reason: string }> }>
    >('/hr/attendance/register-many', payload);
    return data.data;
  },

  async availability(params: { date?: string }): Promise<WorkforceAvailability> {
    const { data } = await api.get<ApiResponse<WorkforceAvailability>>('/hr/attendance/availability', { params });
    return data.data;
  },

  async availabilityByDepartment(params: {
    date?: string;
  }): Promise<{ date: string; departments: DepartmentAvailability[] }> {
    const { data } = await api.get<ApiResponse<{ date: string; departments: DepartmentAvailability[] }>>(
      '/hr/attendance/availability/departments',
      { params },
    );
    return data.data;
  },

  async listShifts(): Promise<Shift[]> {
    const { data } = await api.get<ApiResponse<Shift[]>>('/hr/attendance/shifts');
    return data.data;
  },

  async listHolidays(): Promise<OfficialHoliday[]> {
    const { data } = await api.get<ApiResponse<OfficialHoliday[]>>('/hr/attendance/holidays');
    return data.data;
  },

  async createHoliday(payload: {
    name: string;
    start_date: string;
    end_date?: string;
    type?: string;
  }): Promise<OfficialHoliday> {
    const { data } = await api.post<ApiResponse<OfficialHoliday>>('/hr/attendance/holidays', payload);
    return data.data;
  },

  // ── Leave (H2) ────────────────────────────────────────────────────────────
  async listLeaveRequests(params: { status?: string; employee_id?: string }): Promise<LeaveRequest[]> {
    const { data } = await api.get<ApiResponse<LeaveRequest[]>>('/hr/leave/requests', { params });
    return data.data;
  },

  async submitLeave(payload: {
    employee_id: string;
    start_date: string;
    end_date: string;
    payroll_flag: LeavePayrollFlag;
    reason?: string;
  }): Promise<LeaveRequest> {
    const { data } = await api.post<ApiResponse<LeaveRequest>>('/hr/leave/requests', payload);
    return data.data;
  },

  async approveLeave(id: string, note?: string): Promise<LeaveRequest> {
    const { data } = await api.patch<ApiResponse<LeaveRequest>>(`/hr/leave/requests/${id}/approve`, { note });
    return data.data;
  },

  async rejectLeave(id: string, note?: string): Promise<LeaveRequest> {
    const { data } = await api.patch<ApiResponse<LeaveRequest>>(`/hr/leave/requests/${id}/reject`, { note });
    return data.data;
  },

  async cancelLeave(id: string, note?: string): Promise<LeaveRequest> {
    const { data } = await api.patch<ApiResponse<LeaveRequest>>(`/hr/leave/requests/${id}/cancel`, { note });
    return data.data;
  },
};
