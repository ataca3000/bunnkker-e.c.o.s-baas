export type GeographyStats = {
  total_governorates: number;
  active_governorates: number;
  total_cities: number;
  active_cities: number;
  avg_shipping_price: number;
  shipping_providers: number;
};

export type Governorate = {
  id: number;
  country_id: number;
  name_ar: string;
  name_en: string;
  default_shipping_price: number;
  estimated_delivery_days: number | null;
  same_day_supported: boolean;
  display_order: number;
  is_active: boolean;
  is_system: boolean;
  cities_count?: number;
  active_cities_count?: number;
  created_at: string;
  updated_at: string;
};

export type City = {
  id: number;
  governorate_id: number;
  name_ar: string;
  name_en: string;
  shipping_price: number | null;
  effective_shipping_price: number;
  uses_governorate_price: boolean;
  supports_cod: boolean;
  is_remote_area: boolean;
  display_order: number;
  is_active: boolean;
  is_system: boolean;
  aliases_count: number;
  aliases?: CityAlias[];
  created_at: string;
  updated_at: string;
};

export type CityAlias = {
  id: number;
  city_id: number;
  provider: string | null;
  alias: string;
  code: string | null;
  created_at: string;
};

export type GovernoratesResult = {
  data: Governorate[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

export type CitiesResult = {
  data: City[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

export type GovernoratePayload = {
  name_ar: string;
  name_en: string;
  default_shipping_price: number;
  estimated_delivery_days?: number | null;
  same_day_supported?: boolean;
  display_order?: number;
  is_active?: boolean;
};

export type ReorderItem = { id: number; display_order: number };

export type CityPayload = {
  name_ar: string;
  name_en: string;
  shipping_price?: number | null;
  display_order?: number;
  is_active?: boolean;
};

export type CityAliasPayload = {
  provider?: string | null;
  alias: string;
  code?: string | null;
};

export type GovernoratesQuery = {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  price_min?: number;
  price_max?: number;
  page?: number;
  per_page?: number;
};
