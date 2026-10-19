export type CountSessionStatus = 'draft' | 'in_progress' | 'completed' | 'approved' | 'cancelled';

export type CountProduct = {
  id: string;
  sku: string;
  name: string;
  image_url: string | null;
};

export type CountLineAttachment = {
  id: string;
  count_line_id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

export type CountLine = {
  id: string;
  product_id: string;
  product: CountProduct | null;
  system_qty: number | undefined;
  counted_qty: number | null;
  damaged_qty: number;
  damage_reason: string | null;
  shortage_qty: number | null;
  variance_qty: number | null;
  variance_value: number | null;
  unit_cost_snapshot: number | null;
  notes: string | null;
  attachments: CountLineAttachment[];
};

export type VarianceSummary = {
  total_lines: number;
  counted_lines: number;
  positive_lines: number;
  negative_lines: number;
  total_variance_value: number;
  inventory_accuracy_pct: number | null;
};

export type CountSession = {
  id: string;
  count_number: string;
  company_id: string;
  warehouse_id: string;
  warehouse: { id: string; name: string } | null;
  status: CountSessionStatus;
  status_label: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Financial summary (populated in list from aggregate queries; in detail from loaded lines)
  shortage_value: number | null;
  waste_value: number | null;
  attachment_count: number;
  lines?: CountLine[];
  variance_summary?: VarianceSummary;
};

export type CountSessionsQuery = {
  warehouse_id?: string;
  status?: CountSessionStatus;
  per_page?: number;
  page?: number;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type CountSessionsResult = {
  items: CountSession[];
  meta: PaginationMeta;
};

export type CreateCountSessionPayload = {
  company_id: string;
  warehouse_id: string;
  notes?: string;
  product_ids?: string[];
};

export type UpdateCountSessionPayload = {
  notes?: string;
  lines?: {
    id: string;
    counted_qty?: number | null;
    damaged_qty?: number;
    damage_reason?: string | null;
    damage_notes?: string | null;
    notes?: string | null;
  }[];
};

export type CountReportData = {
  session: {
    id: string;
    count_number: string;
    warehouse: { id: string; name: string } | null;
    started_at: string | null;
    completed_at: string | null;
    approved_at: string | null;
    approved_by: string | null;
    notes: string | null;
  };
  inventory_summary: {
    total_lines: number;
    counted_lines: number;
    system_qty: number;
    counted_qty: number;
    damaged_qty: number;
    shortage_qty: number;
    inventory_accuracy: number | null;
  };
  financial_summary: {
    shortage_value: number;
    waste_value: number;
    total_adjustment: number;
  };
  investigation_summary: {
    pending: number;
    resolved: number;
    pending_value: number;
  };
  liability_summary: {
    pending: number;
    approved: number;
    pending_value: number;
  };
  product_details: Array<{
    id: string;
    product_id: string;
    product: CountProduct | null;
    system_qty: number;
    counted_qty: number;
    damaged_qty: number;
    shortage_qty: number | null;
    variance_qty: number | null;
    unit_cost_snapshot: number | null;
    total_value: number | null;
    damage_reason: string | null;
    notes: string | null;
    attachments: CountLineAttachment[];
    decision: 'match' | 'overstock' | 'shortage' | 'waste' | 'shortage_and_waste';
  }>;
};

// ─── Waste Investigations ───────────────────────────────────────────────────

export type WasteInvestigationStatus = 'pending_investigation' | 'resolved';

export type WasteInvestigationOutcome =
  | 'operational_waste'
  | 'warehouse_responsibility'
  | 'supplier_responsibility'
  | 'preparation_responsibility';

export type WasteInvestigationAttachment = {
  id: string;
  investigation_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

export type WasteInvestigationEvent = {
  id: string;
  investigation_id: string;
  event_type: string;
  performed_by: string | null;
  description: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  occurred_at: string;
};

export type WasteInvestigation = {
  id: string;
  company_id: string;
  warehouse_id: string;
  count_session_id: string | null;
  count_line_id: string | null;
  product_id: string;
  product: CountProduct | null;
  warehouse: { id: string; name: string } | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  damage_reason: string | null;
  status: WasteInvestigationStatus;
  outcome: WasteInvestigationOutcome | null;
  investigator_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  month: string;
  created_at: string | null;
  // Immutable cost snapshot (set at resolution time from FIFO engine)
  cost_snapshot_unit_cost: number | null;
  cost_snapshot_total_value: number | null;
  cost_method: string | null;
  currency: string | null;
  cost_snapshot_at: string | null;
  // Future-integration extension point
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  // Computed
  days_pending?: number;
  is_overdue_3?: boolean;
  is_overdue_7?: boolean;
  // Relations (loaded in show)
  attachments?: WasteInvestigationAttachment[];
  events?: WasteInvestigationEvent[];
};

export type WasteInvestigationsQuery = {
  status?: WasteInvestigationStatus;
  warehouse_id?: string;
  product_id?: string;
  month?: string;
  search?: string;
  per_page?: number;
  page?: number;
};

export type ResolveWasteInvestigationPayload = {
  outcome: WasteInvestigationOutcome;
  resolved_by: string;
  investigator_notes?: string | null;
};

// ─── Warehouse Liabilities ───────────────────────────────────────────────────

export type WarehouseLiabilityStatus = 'pending' | 'approved' | 'rejected';
export type WarehouseLiabilityType = 'inventory_shortage' | 'waste_transferred';

export type WarehouseLiability = {
  id: string;
  company_id: string;
  warehouse_id: string;
  product_id: string;
  count_session_id: string | null;
  count_line_id: string | null;
  waste_investigation_id: string | null;
  warehouse_manager: string | null;
  liability_type: WarehouseLiabilityType;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  status: WarehouseLiabilityStatus;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  month: string;
  product: CountProduct | null;
  warehouse: { id: string; name: string } | null;
  created_at: string | null;
  // Immutable cost snapshot (set at approval time from FIFO engine)
  cost_snapshot_unit_cost: number | null;
  cost_snapshot_total_value: number | null;
  cost_method: string | null;
  currency: string | null;
  // Future-integration extension point
  metadata: Record<string, unknown> | null;
};

export type WarehouseLiabilitiesQuery = {
  status?: WarehouseLiabilityStatus;
  warehouse_id?: string;
  liability_type?: WarehouseLiabilityType;
  month?: string;
  per_page?: number;
  page?: number;
};
