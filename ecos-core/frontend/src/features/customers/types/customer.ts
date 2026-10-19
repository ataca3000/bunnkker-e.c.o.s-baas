export type CustomerBrand = {
  id: string;
  brand_id: string;
  brand_name: string | null;
  brand_code: string | null;
  is_primary: boolean;
  status: string;
  orders_count: number;
  lifetime_value: string;
  first_order_at: string | null;
  last_order_at: string | null;
  created_at: string | null;
};

export type Customer = {
  id: string;
  company_id: string | null;
  code: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  brands: CustomerBrand[];
  created_at: string | null;
  updated_at: string | null;
};

export type CustomerPayload = {
  brand_id: string;
  code: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  country?: string;
  city?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
};

export type CustomerStatusFilter = 'all' | 'active' | 'inactive';
export type CustomerSortField = 'code' | 'name' | 'country' | 'city' | 'is_active' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export type CustomersQuery = {
  search?: string;
  status?: CustomerStatusFilter;
  brand_id?: string;
  country?: string;
  city?: string;
  page?: number;
  per_page?: number;
  sort_by?: CustomerSortField;
  sort_dir?: SortDirection;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type CustomersResult = {
  items: Customer[];
  meta: PaginationMeta;
};
