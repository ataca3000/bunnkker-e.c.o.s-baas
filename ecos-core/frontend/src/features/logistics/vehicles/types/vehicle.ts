export type VehicleType =
  | 'motorcycle'
  | 'car'
  | 'van'
  | 'pickup'
  | 'small_truck'
  | 'medium_truck'
  | 'large_truck';

export type VehicleStatus =
  | 'available'
  | 'assigned'
  | 'in_delivery'
  | 'maintenance'
  | 'out_of_service'
  | 'archived';

export type FuelType = 'petrol' | 'diesel' | 'natural_gas' | 'hybrid' | 'electric';

export type MaintenanceType =
  | 'routine'
  | 'oil_change'
  | 'tyre_change'
  | 'repair'
  | 'inspection'
  | 'accident'
  | 'other';

export type VehicleDocumentType = 'license' | 'insurance' | 'inspection' | 'other';

export type EnumOption = { value: string; label: string };

export type VehicleTypeOption = EnumOption & { default_capacity_orders: number };

export type VehicleOptions = {
  types: VehicleTypeOption[];
  statuses: EnumOption[];
  operator_settable_statuses: EnumOption[];
  fuel_types: EnumOption[];
  maintenance_types: EnumOption[];
  document_types: EnumOption[];
};

export type VehicleDocument = {
  id: number;
  uuid: string;
  vehicle_id: number;
  type: VehicleDocumentType;
  type_label: string;
  title: string | null;
  reference_number: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  issued_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
  is_expiring_soon: boolean;
  days_until_expiry: number | null;
  blocks_dispatch: boolean;
  notes: string | null;
  uploaded_by: string | null;
  download_url: string;
  created_at: string;
};

export type VehicleMaintenanceRecord = {
  id: number;
  uuid: string;
  vehicle_id: number;
  performed_on: string;
  type: MaintenanceType;
  type_label: string;
  description: string | null;
  cost: number;
  currency: string;
  vendor: string | null;
  next_maintenance_date: string | null;
  is_next_service_due: boolean;
  notes: string | null;
  recorded_by: string | null;
  was_amended: boolean;
  amended_by: string | null;
  amended_at: string | null;
  created_at: string;
};

export type CurrentDriver = {
  assignment_id: number;
  driver_id: number;
  driver_code: string;
  full_name: string;
  assigned_at: string;
};

export type BlockingDocument = { type: VehicleDocumentType; expired_on: string | null };

export type Vehicle = {
  id: number;
  uuid: string;
  vehicle_code: string;
  plate_number: string;
  name: string | null;
  label: string;
  type: VehicleType;
  type_label: string;
  shipping_company_id: number | null;
  shipping_company_name?: string | null;
  company_id: string | null;
  branch_id: string | null;
  capacity_orders: number;
  capacity_weight_kg: number | null;
  capacity_volume_m3: number | null;
  fuel_type: FuelType | null;
  fuel_type_label: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vin: string | null;
  status: VehicleStatus;
  status_label: string;
  allowed_transitions: EnumOption[];
  notes: string | null;
  current_driver?: CurrentDriver | null;
  has_driver?: boolean;
  can_be_dispatched?: boolean;
  blocking_expired_documents?: BlockingDocument[];
  next_document_expiry?: string | null;
  maintenance_records_count?: number;
  documents_count?: number;
  documents?: VehicleDocument[];
  maintenance_records?: VehicleMaintenanceRecord[];
  created_at: string;
  updated_at: string;
};

export type VehicleStats = {
  total_vehicles: number;
  available: number;
  assigned: number;
  in_delivery: number;
  maintenance: number;
  out_of_service: number;
  archived: number;
  expiring_licenses: number;
  expired_licenses: number;
};

export type VehiclePayload = {
  vehicle_code: string;
  plate_number: string;
  name?: string | null;
  type: VehicleType;
  shipping_company_id?: number | null;
  company_id?: string | null;
  branch_id?: string | null;
  capacity_orders: number;
  capacity_weight_kg?: number | null;
  capacity_volume_m3?: number | null;
  fuel_type?: FuelType | null;
  manufacturer?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  vin?: string | null;
  notes?: string | null;
};

export type MaintenancePayload = {
  performed_on: string;
  type: MaintenanceType;
  description?: string | null;
  cost?: number | null;
  currency?: string | null;
  vendor?: string | null;
  next_maintenance_date?: string | null;
  notes?: string | null;
};

export type VehiclesQuery = {
  search?: string;
  status?: VehicleStatus | 'all';
  type?: VehicleType;
  expiry?: 'expired' | 'expiring';
  driver?: 'assigned' | 'unassigned';
  available?: boolean | number;
  shipping_company_id?: number;
  page?: number;
  per_page?: number;
};

export type VehiclesResult = {
  data: Vehicle[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};
