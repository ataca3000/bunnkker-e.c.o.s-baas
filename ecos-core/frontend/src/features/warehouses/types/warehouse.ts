/**
 * Warehouses feature types. Branch dependency removed — warehouses belong to Company only.
 */
export type WarehouseRef = {
  id: string;
  code: string;
  name: string;
};

export type Warehouse = {
  id: string;
  company_id: string;
  company?: WarehouseRef;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type WarehousePayload = {
  company_id: string;
  code?: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  is_active: boolean;
};

export type WarehouseSortField = 'code' | 'name' | 'city' | 'is_active' | 'created_at';
export type SortDirection = 'asc' | 'desc';
export type WarehouseStatusFilter = 'all' | 'active' | 'inactive';

export type WarehousesQuery = {
  search?: string;
  company_id?: string;
  page?: number;
  per_page?: number;
  sort_by?: WarehouseSortField;
  sort_dir?: SortDirection;
  status?: WarehouseStatusFilter;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type WarehousesResult = {
  items: Warehouse[];
  meta: PaginationMeta;
};
