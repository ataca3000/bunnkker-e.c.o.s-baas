/** HR & Workforce OS — EPIC H1 + H2. Shared types. */

export type EmployeeStatus =
  | 'probation'
  | 'active'
  | 'on_leave'
  | 'suspended'
  | 'resigned'
  | 'terminated';

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday' | 'rest_day';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** The only payroll concern HR owns: whether leave costs the employee salary. */
export type LeavePayrollFlag = 'deduct_salary' | 'do_not_deduct_salary';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export type Ref = { id: string; name?: string; title?: string } | null;

export type Employee = {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  name: string;
  status: EmployeeStatus;
  status_label: string;
  work_email: string | null;
  mobile: string | null;
  branch_id: string | null;
  department_id: string | null;
  department: Ref;
  position_id: string | null;
  position: Ref;
  job_grade: Ref;
  employment_type: Ref;
  hire_date: string | null;
  termination_date: string | null;
  user_id: number | null;
};

export type EmployeesQuery = {
  search?: string;
  department_id?: string;
  branch_id?: string;
  status?: string;
  page?: number;
  per_page?: number;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type EmployeesResult = { items: Employee[]; meta: PaginationMeta };

export type EmployeePayload = Partial<Omit<Employee, 'id' | 'name' | 'status_label' | 'department' | 'position' | 'job_grade' | 'employment_type'>> & {
  first_name: string;
  last_name: string;
};

/** The Employee 360 workspace payload. */
export type Employee360 = {
  identity: {
    id: string;
    employee_number: string;
    name: string;
    first_name: string;
    last_name: string;
    status: EmployeeStatus;
    status_label: string;
    gender: string | null;
    date_of_birth: string | null;
    national_id: string | null;
    photo_path: string | null;
    user_id: number | null;
  };
  contact: {
    work_email: string | null;
    personal_email: string | null;
    phone: string | null;
    mobile: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  };
  placement: {
    company_id: string;
    branch_id: string | null;
    department: { id: string; code: string; name: string } | null;
    position: { id: string; code: string; title: string } | null;
    job_grade: { id: string; code: string; name: string; level: number } | null;
    employment_type: { id: string; code: string; name: string } | null;
    hire_date: string | null;
    tenure_days: number | null;
    termination_date: string | null;
    termination_reason: string | null;
  };
  contract: {
    id: string;
    contract_number: string;
    type: string;
    status: ContractStatus;
    start_date: string | null;
    end_date: string | null;
    probation_end_date: string | null;
    weekly_hours: string | null;
    days_until_expiry: number | null;
  } | null;
  contracts_history: Array<{
    id: string;
    contract_number: string;
    type: string;
    status: ContractStatus;
    start_date: string | null;
    end_date: string | null;
  }>;
  reporting: {
    manager: { id: string; name: string; employee_number: string } | null;
    management_chain: Array<{ id: string; name: string }>;
    direct_reports: Array<{ id: string; name: string; employee_number: string; status: EmployeeStatus }>;
  };
  documents: Array<{
    id: string;
    type: string;
    title: string;
    file_name: string | null;
    issued_at: string | null;
    expires_at: string | null;
    is_expired: boolean;
    days_until_expiry: number | null;
  }>;
  /** Owned by the Attendance context, fetched through the H1 port. */
  attendance: {
    from: string;
    to: string;
    registered_days: number;
    present: number;
    absent: number;
    on_leave: number;
    holiday: number;
    rest_day: number;
    attendance_rate_percent: number;
  };
};

export type Department = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  branch_id: string | null;
  manager_employee_id: string | null;
  description: string | null;
  is_active: boolean;
  employees_count: number;
};

export type DepartmentNode = {
  id: string;
  code: string;
  name: string;
  branch_id: string | null;
  manager_employee_id: string | null;
  is_active: boolean;
  employees_count: number;
  children: DepartmentNode[];
};

export type Position = {
  id: string;
  code: string;
  title: string;
  department_id: string | null;
  department: Ref;
  job_grade_id: string | null;
  job_grade: Ref;
  headcount_limit: number | null;
  filled_headcount: number;
  has_vacancy: boolean;
  is_active: boolean;
};

export type JobGrade = {
  id: string;
  code: string;
  name: string;
  level: number;
  description: string | null;
  is_active: boolean;
};

export type EmploymentType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type OrgChartNode = {
  id: string;
  employee_number: string;
  name: string;
  position: string | null;
  department: string | null;
  status: EmployeeStatus;
  direct_reports: number;
  children: OrgChartNode[];
};

export type OrgChart = {
  company_id: string;
  employees: number;
  roots: OrgChartNode[];
  unassigned: number;
};

export type AttendanceSheetRow = {
  employee_id: string;
  employee_number: string;
  name: string;
  department: string | null;
  position: string | null;
  registered: boolean;
  status: AttendanceStatus | null;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
};

export type AttendanceSheet = {
  work_date: string;
  is_working_day: boolean;
  holiday: { id: string; name: string; type: string } | null;
  suggested_status: AttendanceStatus;
  employees: AttendanceSheetRow[];
};

export type WorkforceAvailability = {
  date: string;
  headcount: number;
  registered: number;
  unregistered: number;
  present: number;
  absent: number;
  on_leave: number;
  holiday: number;
  rest_day: number;
  availability_percent: number;
  registration_percent: number;
  official_holiday: { id: string; name: string; type: string } | null;
};

export type DepartmentAvailability = {
  department_id: string | null;
  department: string;
  headcount: number;
  present: number;
  absent: number;
  on_leave: number;
  holiday: number;
  rest_day: number;
  unregistered: number;
  availability_percent: number;
};

export type LeaveRequest = {
  id: string;
  request_number: string;
  employee_id: string;
  employee: { id: string; name: string; employee_number: string; department_id: string | null } | null;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  payroll_flag: LeavePayrollFlag;
  payroll_flag_label: string;
  deducts_salary: boolean;
  status: LeaveStatus;
  status_label: string;
  decided_at: string | null;
  decision_note: string | null;
};

export type OfficialHoliday = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  days: number;
  type: string;
  type_label: string;
  moves_annually: boolean;
  notes: string | null;
  is_active: boolean;
};

export type Shift = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  crosses_midnight: boolean;
  is_active: boolean;
};
