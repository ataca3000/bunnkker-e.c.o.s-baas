/**
 * Units of measure feature types.
 */
export type Unit = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type UnitPayload = {
  code: string;
  name: string;
  symbol?: string;
  description?: string;
  is_active: boolean;
};

export type UnitSortField = 'code' | 'name' | 'symbol' | 'is_active' | 'created_at';
export type SortDirection = 'asc' | 'desc';
export type UnitStatusFilter = 'all' | 'active' | 'inactive';

export type UnitsQuery = {
  search?: string;
  page?: number;
  per_page?: number;
  sort_by?: UnitSortField;
  sort_dir?: SortDirection;
  status?: UnitStatusFilter;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type UnitsResult = {
  items: Unit[];
  meta: PaginationMeta;
};
