export type BomProduct = {
  id: string;
  sku: string;
  name: string;
  image_url: string | null;
};

export type BomUnit = {
  id: string;
  name: string;
  symbol: string;
};

export type BomRawMaterial = {
  id: string;
  sku: string;
  name: string;
  unit: BomUnit | null;
};

export type BomLine = {
  id: string;
  raw_material_id: string;
  raw_material: BomRawMaterial | null;
  quantity: number;
  waste_percentage: number;
};

export type Bom = {
  id: string;
  bom_number: string;
  product_id: string;
  product: BomProduct | null;
  version: string;
  is_active: boolean;
  notes: string | null;
  lines: BomLine[];
  created_at: string | null;
  updated_at: string | null;
};

export type BomLinePayload = {
  raw_material_id: string;
  quantity: number;
  waste_percentage: number;
};

export type BomPayload = {
  product_id: string;
  version: string;
  is_active: boolean;
  notes?: string | null;
  lines: BomLinePayload[];
};

export type BomSortField = 'bom_number' | 'version' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export type BomsQuery = {
  search?: string;
  is_active?: 'all' | 'true' | 'false';
  page?: number;
  per_page?: number;
  sort_by?: BomSortField;
  sort_dir?: SortDirection;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type BomsResult = {
  items: Bom[];
  meta: PaginationMeta;
};
