export type CityArea = {
  id: number;
  name_ar: string;
  name_en: string | null;
  governorate_id: number;
  governorate_name_ar: string | null;
  governorate_name_en: string | null;
  is_active: boolean;
  distribution_zone_id: number | null;
  distribution_zone_name?: string | null;
};

export type GovernorateGroup = {
  governorate_id: number;
  governorate_name_ar: string | null;
  governorate_name_en: string | null;
  cities: CityArea[];
};

export type AreasResult = {
  data: GovernorateGroup[];
  total: number;
};

export type AreasParams = {
  zone_id?: number;
  include_all?: boolean;
};

export type DistributionZone = {
  id: number;
  code: string;
  name_ar: string;
  name_en: string | null;
  description: string | null;
  color: string | null;
  is_active: boolean;
  areas_count: number;
  areas?: CityArea[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DistributionZoneStats = {
  total_zones: number;
  active_zones: number;
  assigned_areas: number;
  unassigned_areas: number;
};

export type DistributionZonePayload = {
  code?: string;
  name_ar: string;
  name_en?: string | null;
  description?: string | null;
  color?: string | null;
  is_active?: boolean;
  area_ids: number[];
  force_move?: boolean;
};

export type DistributionZonesQuery = {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  per_page?: number;
};

export type DistributionZonesResult = {
  data: DistributionZone[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};
