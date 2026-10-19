/**
 * Branches feature types.
 */
export type BranchCompany = {
  id: string;
  code: string;
  name: string;
};

export type BranchWarehouse = {
  id: string;
  code: string;
  name: string;
};

export type CoverageGovernorate = {
  id: string;
  name: string;
  name_ar: string;
};

export type CoverageZone = {
  id: string;
  name: string;
};

export type CoverageArea = {
  id: string;
  branch_id: string;
  master_governorate_id: string;
  master_zone_id: string | null;
  priority: number;
  is_active: boolean;
  governorate: CoverageGovernorate | null;
  zone: CoverageZone | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CoverageAreaPayload = {
  master_governorate_id: string;
  master_zone_id?: string | null;
  priority?: number;
  is_active?: boolean;
};

export type Branch = {
  id: string;
  company_id: string;
  company?: BranchCompany;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  manager_name: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  is_head_office: boolean;
  is_active: boolean;
  default_warehouse_id: string | null;
  default_warehouse: BranchWarehouse | null;
  latitude: number | null;
  longitude: number | null;
  coverage_areas?: CoverageArea[];
  created_at: string | null;
  updated_at: string | null;
};

export type BranchPayload = {
  company_id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  manager_name?: string;
  address?: string;
  city?: string;
  country?: string;
  is_head_office: boolean;
  is_active: boolean;
  default_warehouse_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type BranchSortField =
  | 'code'
  | 'name'
  | 'city'
  | 'is_head_office'
  | 'is_active'
  | 'created_at';
export type SortDirection = 'asc' | 'desc';
export type BranchStatusFilter = 'all' | 'active' | 'inactive';

export type BranchesQuery = {
  search?: string;
  company_id?: string;
  page?: number;
  per_page?: number;
  sort_by?: BranchSortField;
  sort_dir?: SortDirection;
  status?: BranchStatusFilter;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type BranchesResult = {
  items: Branch[];
  meta: PaginationMeta;
};
