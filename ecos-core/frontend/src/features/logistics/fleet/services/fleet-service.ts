import { api } from '@/lib/axios';
import type {
  CompleteWorkOrderPayload,
  CostSummary,
  Defect,
  FitnessVerdict,
  FleetOptions,
  FleetStats,
  FleetUnit,
  FleetUnitLifecycle,
  FleetUnitsQuery,
  FleetUnitsResult,
  FuelCapturePayload,
  FuelEfficiency,
  FuelTransaction,
  HealthScore,
  Inspection,
  InspectionAnswer,
  InspectionKind,
  InspectionTemplate,
  MaintenancePlan,
  MaintenancePlanPayload,
  OdometerReadingRow,
  OdometerSource,
  Paginated,
  RegisterUnitPayload,
  WorkOrder,
} from '../types/fleet';

const BASE = '/logistics/fleet';

/** Units, work orders, inspections, defects and fuel are addressed by UUID. */
export const fleetService = {
  // ── Reference data ─────────────────────────────────────────────────────────

  async options(): Promise<FleetOptions> {
    const { data } = await api.get<FleetOptions>(`${BASE}/options`);
    return data;
  },

  async stats(): Promise<FleetStats> {
    const { data } = await api.get<FleetStats>(`${BASE}/stats`);
    return data;
  },

  // ── Units ──────────────────────────────────────────────────────────────────

  async list(params?: FleetUnitsQuery): Promise<FleetUnitsResult> {
    const { data } = await api.get<FleetUnitsResult>(`${BASE}/units`, { params });
    return data;
  },

  async get(id: string): Promise<FleetUnit> {
    const { data } = await api.get<{ data: FleetUnit }>(`${BASE}/units/${id}`);
    return data.data;
  },

  /** Registers the operational shadow of an existing V1 vehicle. */
  async register(payload: RegisterUnitPayload): Promise<FleetUnit> {
    const { data } = await api.post<{ data: FleetUnit }>(`${BASE}/units`, payload);
    return data.data;
  },

  async setLifecycle(
    id: string,
    lifecycle_state: FleetUnitLifecycle,
    reason?: string,
  ): Promise<FleetUnit> {
    const { data } = await api.patch<{ data: FleetUnit }>(`${BASE}/units/${id}/lifecycle`, {
      lifecycle_state,
      reason,
    });
    return data.data;
  },

  async moveGroup(id: string, fleet_group_id: number, reason?: string): Promise<FleetUnit> {
    const { data } = await api.patch<{ data: FleetUnit }>(`${BASE}/units/${id}/group`, {
      fleet_group_id,
      reason,
    });
    return data.data;
  },

  /** The verdict Dispatch will consume in Phase 4, with its ordered blockers. */
  async fitness(id: string): Promise<FitnessVerdict> {
    const { data } = await api.get<{ data: FitnessVerdict }>(`${BASE}/units/${id}/fitness`);
    return data.data;
  },

  async health(id: string): Promise<HealthScore> {
    const { data } = await api.get<{ data: HealthScore }>(`${BASE}/units/${id}/health`);
    return data.data;
  },

  // ── Odometer ───────────────────────────────────────────────────────────────

  async odometerHistory(
    id: string,
  ): Promise<{ data: OdometerReadingRow[]; meta: { current_odometer_km: number | null; is_stale: boolean } }> {
    const { data } = await api.get<{
      data: OdometerReadingRow[];
      meta: { current_odometer_km: number | null; is_stale: boolean };
    }>(`${BASE}/units/${id}/odometer`);
    return data;
  },

  /**
   * A reading below the current accepted value is recorded but NOT accepted —
   * the response says which happened rather than silently discarding it.
   */
  async recordOdometer(
    id: string,
    reading_km: number,
    source?: OdometerSource,
  ): Promise<OdometerReadingRow & { current_odometer_km: number | null }> {
    const { data } = await api.post<{
      data: OdometerReadingRow & { current_odometer_km: number | null };
    }>(`${BASE}/units/${id}/odometer`, { reading_km, source });
    return data.data;
  },

  // ── Maintenance ────────────────────────────────────────────────────────────

  /**
   * Recomputes when a plan is next due from the unit's current odometer and
   * service history. It takes no payload: the projection is the domain's, and
   * letting the client supply a date would make the schedule an opinion.
   */
  async reprojectMaintenancePlan(unitId: string, planId: string): Promise<MaintenancePlan> {
    const { data } = await api.patch<{ data: MaintenancePlan }>(
      `${BASE}/units/${unitId}/maintenance-plans/${planId}/reproject`,
    );
    return data.data;
  },

  async plans(unitId: string): Promise<MaintenancePlan[]> {
    const { data } = await api.get<{ data: MaintenancePlan[] }>(
      `${BASE}/units/${unitId}/maintenance-plans`,
    );
    return data.data;
  },

  async createPlan(unitId: string, payload: MaintenancePlanPayload): Promise<MaintenancePlan> {
    const { data } = await api.post<{ data: MaintenancePlan }>(
      `${BASE}/units/${unitId}/maintenance-plans`,
      payload,
    );
    return data.data;
  },

  async evaluatePlans(unitId: string): Promise<{ due: MaintenancePlan[]; overdue: MaintenancePlan[] }> {
    const { data } = await api.get<{ due: MaintenancePlan[]; overdue: MaintenancePlan[] }>(
      `${BASE}/units/${unitId}/maintenance-plans/evaluate`,
    );
    return data;
  },

  async workOrders(params?: {
    status?: string;
    open_only?: boolean;
    page?: number;
  }): Promise<Paginated<WorkOrder>> {
    const { data } = await api.get<Paginated<WorkOrder>>(`${BASE}/work-orders`, { params });
    return data;
  },

  async createWorkOrder(
    unitId: string,
    payload: {
      maintenance_plan_id?: number;
      maintenance_type?: string;
      kind?: string;
      description?: string;
      vendor?: string;
      is_immobilising?: boolean;
    },
  ): Promise<WorkOrder> {
    const { data } = await api.post<{ data: WorkOrder }>(
      `${BASE}/units/${unitId}/work-orders`,
      payload,
    );
    return data.data;
  },

  async scheduleWorkOrder(id: string, scheduled_for: string, vendor?: string): Promise<WorkOrder> {
    const { data } = await api.patch<{ data: WorkOrder }>(`${BASE}/work-orders/${id}/schedule`, {
      scheduled_for,
      vendor,
    });
    return data.data;
  },

  async startWorkOrder(id: string, odometer_km: number): Promise<WorkOrder> {
    const { data } = await api.patch<{ data: WorkOrder }>(`${BASE}/work-orders/${id}/start`, {
      odometer_km,
    });
    return data.data;
  },

  /** Writes the V1 maintenance record; the response carries the receipt id. */
  async completeWorkOrder(id: string, payload: CompleteWorkOrderPayload): Promise<WorkOrder> {
    const { data } = await api.patch<{ data: WorkOrder }>(
      `${BASE}/work-orders/${id}/complete`,
      payload,
    );
    return data.data;
  },

  async cancelWorkOrder(id: string, reason: string): Promise<WorkOrder> {
    const { data } = await api.patch<{ data: WorkOrder }>(`${BASE}/work-orders/${id}/cancel`, {
      reason,
    });
    return data.data;
  },

  // ── Inspections ────────────────────────────────────────────────────────────

  async templates(kind?: InspectionKind): Promise<InspectionTemplate[]> {
    const { data } = await api.get<{ data: InspectionTemplate[] }>(`${BASE}/inspection-templates`, {
      params: { kind },
    });
    return data.data;
  },

  /** One inspection in full, with its per-item results. The list omits them. */
  async inspection(unitId: string, id: string): Promise<Inspection> {
    const { data } = await api.get<{ data: Inspection }>(
      `${BASE}/units/${unitId}/inspections/${id}`,
    );
    return data.data;
  },

  async inspections(unitId: string): Promise<Inspection[]> {
    const { data } = await api.get<{ data: Inspection[] }>(`${BASE}/units/${unitId}/inspections`);
    return data.data;
  },

  async startInspection(
    unitId: string,
    template_id: string,
    kind: InspectionKind,
    odometer_km?: number,
  ): Promise<Inspection> {
    const { data } = await api.post<{ data: Inspection }>(`${BASE}/units/${unitId}/inspections`, {
      template_id,
      kind,
      odometer_km,
    });
    return data.data;
  },

  async submitInspection(
    unitId: string,
    id: string,
    answers: Record<string, InspectionAnswer>,
  ): Promise<Inspection> {
    const { data } = await api.patch<{ data: Inspection }>(
      `${BASE}/units/${unitId}/inspections/${id}/submit`,
      { answers },
    );
    return data.data;
  },

  async approveInspection(unitId: string, id: string): Promise<Inspection> {
    const { data } = await api.patch<{ data: Inspection }>(
      `${BASE}/units/${unitId}/inspections/${id}/approve`,
    );
    return data.data;
  },

  async rejectInspection(unitId: string, id: string, reason: string): Promise<Inspection> {
    const { data } = await api.patch<{ data: Inspection }>(
      `${BASE}/units/${unitId}/inspections/${id}/reject`,
      { reason },
    );
    return data.data;
  },

  // ── Defects ────────────────────────────────────────────────────────────────

  async defects(params?: {
    severity?: string;
    outstanding_only?: boolean;
    page?: number;
  }): Promise<Paginated<Defect>> {
    const { data } = await api.get<Paginated<Defect>>(`${BASE}/defects`, { params });
    return data;
  },

  async reportDefect(
    unitId: string,
    payload: { title: string; description?: string; severity: string; photos?: string[] },
  ): Promise<Defect> {
    const { data } = await api.post<{ data: Defect }>(`${BASE}/units/${unitId}/defects`, payload);
    return data.data;
  },

  async acknowledgeDefect(id: string): Promise<Defect> {
    const { data } = await api.patch<{ data: Defect }>(`${BASE}/defects/${id}/acknowledge`);
    return data.data;
  },

  async repairDefect(id: string): Promise<Defect> {
    const { data } = await api.patch<{ data: Defect }>(`${BASE}/defects/${id}/repair`);
    return data.data;
  },

  async resolveDefect(id: string): Promise<Defect> {
    const { data } = await api.patch<{ data: Defect }>(`${BASE}/defects/${id}/resolve`);
    return data.data;
  },

  /** A critical defect additionally requires fleet.health.override. */
  async dismissDefect(id: string, reason: string): Promise<Defect> {
    const { data } = await api.patch<{ data: Defect }>(`${BASE}/defects/${id}/dismiss`, { reason });
    return data.data;
  },

  // ── Fuel (operational expense only — D8) ───────────────────────────────────

  async fuelTransactions(params?: {
    status?: string;
    anomalies_only?: boolean;
    page?: number;
  }): Promise<Paginated<FuelTransaction>> {
    const { data } = await api.get<Paginated<FuelTransaction>>(`${BASE}/fuel-transactions`, {
      params,
    });
    return data;
  },

  async captureFuel(unitId: string, payload: FuelCapturePayload): Promise<FuelTransaction> {
    const { data } = await api.post<{ data: FuelTransaction }>(
      `${BASE}/units/${unitId}/fuel-transactions`,
      payload,
    );
    return data.data;
  },

  /** One transaction in full, with its anomaly flags and photos. */
  async fuelTransaction(id: string): Promise<FuelTransaction> {
    const { data } = await api.get<{ data: FuelTransaction }>(`${BASE}/fuel-transactions/${id}`);
    return data.data;
  },

  /**
   * Reject and write-off are distinct outcomes, not synonyms. Rejecting says
   * the transaction should not have been recorded; writing off accepts it and
   * absorbs the cost. Both require a reason, and the API enforces that.
   */
  async rejectFuel(id: string, reason: string): Promise<FuelTransaction> {
    const { data } = await api.patch<{ data: FuelTransaction }>(
      `${BASE}/fuel-transactions/${id}/reject`,
      { reason },
    );
    return data.data;
  },

  async writeOffFuel(id: string, reason: string): Promise<FuelTransaction> {
    const { data } = await api.patch<{ data: FuelTransaction }>(
      `${BASE}/fuel-transactions/${id}/write-off`,
      { reason },
    );
    return data.data;
  },

  async reconcileFuel(id: string): Promise<FuelTransaction> {
    const { data } = await api.patch<{ data: FuelTransaction }>(
      `${BASE}/fuel-transactions/${id}/reconcile`,
    );
    return data.data;
  },

  async disputeFuel(id: string, reason: string): Promise<FuelTransaction> {
    const { data } = await api.patch<{ data: FuelTransaction }>(
      `${BASE}/fuel-transactions/${id}/dispute`,
      { reason },
    );
    return data.data;
  },

  async efficiency(unitId: string, from?: string, to?: string): Promise<FuelEfficiency> {
    const { data } = await api.get<{ data: FuelEfficiency }>(
      `${BASE}/units/${unitId}/fuel/efficiency`,
      { params: { from, to } },
    );
    return data.data;
  },

  // ── Cost ───────────────────────────────────────────────────────────────────

  async costs(unitId: string, from?: string, to?: string): Promise<CostSummary> {
    const { data } = await api.get<{ data: CostSummary }>(`${BASE}/units/${unitId}/costs`, {
      params: { from, to },
    });
    return data.data;
  },
};
