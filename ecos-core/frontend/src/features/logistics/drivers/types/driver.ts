export type DriverStatus = 'active' | 'inactive' | 'archived';
export type LicenseStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing';
export type VehicleStatus = 'active' | 'inactive' | 'archived';
export type VehicleType = 'van' | 'truck' | 'motorcycle' | 'pickup' | 'car';

export type DriverDocumentType =
  | 'license'
  | 'national_id'
  | 'employment_contract'
  | 'medical_certificate'
  | 'other';

export type Vehicle = {
  id: number;
  plate_number: string;
  type: VehicleType;
  make: string | null;
  model: string | null;
  year: number | null;
  capacity_orders: number;
  shipping_company_id: number | null;
  shipping_company_name?: string | null;
  status: VehicleStatus;
  notes: string | null;
  label: string;
  is_assigned?: boolean;
  assigned_driver_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type DriverDocument = {
  id: number;
  driver_id: number;
  type: DriverDocumentType;
  title: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  issued_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
  notes: string | null;
  uploaded_by: string | null;
  download_url: string;
  created_at: string;
};

export type DriverVehicleAssignment = {
  id: number;
  driver_id: number;
  vehicle_id: number;
  vehicle?: Vehicle;
  vehicle_plate?: string | null;
  vehicle_label?: string | null;
  assigned_at: string;
  released_at: string | null;
  is_active: boolean;
  duration_days: number;
  assigned_by: string | null;
  released_by: string | null;
  release_reason: string | null;
  notes: string | null;
  created_at: string;
};

export type CurrentVehicle = {
  assignment_id: number;
  vehicle_id: number;
  plate_number: string;
  label: string;
  assigned_at: string;
};

export type Driver = {
  id: number;
  driver_code: string;
  full_name: string;
  mobile: string;
  national_id: string;
  date_of_birth: string | null;
  address: string | null;
  employment_date: string | null;
  shipping_company_id: number | null;
  shipping_company_name?: string | null;
  license_number: string | null;
  license_type: string | null;
  license_issue_date: string | null;
  license_expiry_date: string | null;
  license_issuing_authority: string | null;
  license_status: LicenseStatus;
  license_days_remaining: number | null;
  status: DriverStatus;
  notes: string | null;
  current_vehicle?: CurrentVehicle | null;
  has_vehicle?: boolean;
  can_start_deliveries?: boolean;
  documents_count?: number;
  assignments_count?: number;
  documents?: DriverDocument[];
  assignments?: DriverVehicleAssignment[];
  created_at: string;
  updated_at: string;
};

export type DriverStats = {
  total_drivers: number;
  active_drivers: number;
  inactive_drivers: number;
  archived_drivers: number;
  expired_license_drivers: number;
  expiring_license_drivers: number;
  drivers_without_vehicle: number;
};

export type DriverPayload = {
  driver_code: string;
  full_name: string;
  mobile: string;
  national_id: string;
  date_of_birth?: string | null;
  address?: string | null;
  employment_date?: string | null;
  shipping_company_id?: number | null;
  license_number?: string | null;
  license_type?: string | null;
  license_issue_date?: string | null;
  license_expiry_date?: string | null;
  license_issuing_authority?: string | null;
  status?: Exclude<DriverStatus, 'archived'>;
  notes?: string | null;
};

export type VehiclePayload = {
  plate_number: string;
  type: VehicleType;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  capacity_orders?: number | null;
  shipping_company_id?: number | null;
  status?: VehicleStatus;
  notes?: string | null;
};

export type DriversQuery = {
  search?: string;
  status?: DriverStatus | 'all';
  license_status?: LicenseStatus;
  vehicle?: 'assigned' | 'unassigned';
  shipping_company_id?: number;
  page?: number;
  per_page?: number;
};

export type VehiclesQuery = {
  search?: string;
  type?: VehicleType;
  status?: VehicleStatus | 'all';
  available?: boolean | number;
  page?: number;
  per_page?: number;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

export type DriversResult = Paginated<Driver>;
export type VehiclesResult = Paginated<Vehicle>;
