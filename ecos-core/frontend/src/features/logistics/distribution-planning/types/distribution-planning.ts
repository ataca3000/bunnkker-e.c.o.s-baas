export type ZonePlanningStatus = 'ready' | 'in_planning' | 'planned';

export type ZonePlanCard = {
  zone_id: number;
  code: string;
  name_ar: string;
  name_en: string | null;
  color: string | null;
  orders_count: number;
  customers_count: number;
  estimated_stops: number;
  distinct_products: number;
  total_qty: number;
  total_collection: number;
  planning_status: ZonePlanningStatus;
};

export type DistributionPlanningStats = {
  ready_orders: number;
  active_zones: number;
  unassigned_orders: number;
  total_collection: number;
  distinct_products: number;
};

export type PlanningFilters = {
  date?: string;
  status?: ZonePlanningStatus;
  search?: string;
  show_empty?: boolean;
};

export type ZoneDetailTab = 'orders' | 'products' | 'customers';

export type ZoneDetailOrder = {
  id: number;
  order_number: string;
  customer_name: string | null;
  customer_id: number | null;
  city: string | null;
  governorate: string | null;
  status: string;
  total: number;
  requested_delivery_date: string | null;
  payment_method: string | null;
  billing_phone: string | null;
};

export type ZoneDetailProduct = {
  product_id: number;
  name: string;
  total_qty: number;
  order_count: number;
  total_value: number;
};

export type ZoneDetailCustomer = {
  customer_id: number | null;
  customer_name: string | null;
  order_count: number;
  total_value: number;
  city: string | null;
  billing_phone: string | null;
};

export type UnassignedOrder = {
  id: number;
  order_number: string;
  customer_name: string | null;
  city: string | null;
  governorate: string | null;
  status: string;
  total: number;
  requested_delivery_date: string | null;
  payment_method: string | null;
  billing_phone: string | null;
  missing_reason: string;
};
