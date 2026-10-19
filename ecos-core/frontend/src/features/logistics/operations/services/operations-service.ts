import { api } from '@/lib/axios';
import type {
  AlertRule,
  AlertSummary,
  AvailabilityMatrix,
  CapacityHealth,
  CapacityMonitoring,
  CapacityOptions,
  CapacityReservation,
  DispatchHealth,
  Escalation,
  ExceptionCategory,
  ExceptionNote,
  ExceptionOptions,
  ExceptionResolution,
  ExceptionSeverity,
  ExceptionSource,
  ExceptionStatus,
  ExceptionSummary,
  HealthOverview,
  NoteType,
  OperationalAlert,
  OperationalException,
  Paginated,
  PoolHealth,
  PoolHealthOverview,
  PoolMember,
  PoolMemberStatus,
  PoolMemberType,
  PoolOptions,
  PoolStatus,
  PoolType,
  RebalanceCandidate,
  ReservationAuditEntry,
  ResourcePool,
  UnassignedResources,
  UnifiedPoolView,
  UtilisationView,
} from '../types/operations';

const BASE = '/logistics/operations';

export const operationsService = {
  // ── A. Pools ───────────────────────────────────────────────────────────────

  async poolOptions(): Promise<PoolOptions> {
    const { data } = await api.get<PoolOptions>(`${BASE}/pools/options`);
    return data;
  },

  async pools(params?: {
    status?: PoolStatus;
    pool_type?: PoolType;
    page?: number;
    per_page?: number;
  }): Promise<Paginated<ResourcePool>> {
    const { data } = await api.get<Paginated<ResourcePool>>(`${BASE}/pools`, { params });
    return data;
  },

  async pool(id: string): Promise<ResourcePool> {
    const { data } = await api.get<{ data: ResourcePool }>(`${BASE}/pools/${id}`);
    return data.data;
  },

  async createPool(payload: {
    code: string;
    name: string;
    pool_type: PoolType;
    description?: string;
    dispatch_region_id?: number;
    service_area_id?: number;
    min_assignable?: number;
  }): Promise<ResourcePool> {
    const { data } = await api.post<{ data: ResourcePool }>(`${BASE}/pools`, payload);
    return data.data;
  },

  async setPoolStatus(id: string, status: PoolStatus, reason?: string): Promise<ResourcePool> {
    const { data } = await api.patch<{ data: ResourcePool }>(`${BASE}/pools/${id}/status`, {
      status,
      reason,
    });
    return data.data;
  },

  async addMember(
    poolId: string,
    memberType: PoolMemberType,
    memberId: number,
    reason?: string,
  ): Promise<PoolMember> {
    const { data } = await api.post<{ data: PoolMember }>(`${BASE}/pools/${poolId}/members`, {
      member_type: memberType,
      member_id: memberId,
      reason,
    });
    return data.data;
  },

  /** Withdrawal requires a reason; suspension and reinstatement do not. */
  async setMemberStatus(
    memberId: string,
    status: PoolMemberStatus,
    reason?: string,
  ): Promise<PoolMember> {
    const { data } = await api.patch<{ data: PoolMember }>(
      `${BASE}/pools/members/${memberId}/status`,
      { status, reason },
    );
    return data.data;
  },

  /** Membership joined to Fleet's and Drivers' current verdicts. */
  async unifiedPool(id: string): Promise<UnifiedPoolView> {
    const { data } = await api.get<{ data: UnifiedPoolView }>(`${BASE}/pools/${id}/unified`);
    return data.data;
  },

  async poolHealth(id: string): Promise<PoolHealth> {
    const { data } = await api.get<{ data: PoolHealth }>(`${BASE}/pools/${id}/health`);
    return data.data;
  },

  async poolHealthOverview(): Promise<PoolHealthOverview> {
    const { data } = await api.get<{ data: PoolHealthOverview }>(`${BASE}/pools/health`);
    return data.data;
  },

  /** Assignable resources in no pool — capacity nobody is planning with. */
  async unassigned(): Promise<UnassignedResources> {
    const { data } = await api.get<{ data: UnassignedResources }>(`${BASE}/pools/unassigned`);
    return data.data;
  },

  async availabilityMatrix(from?: string, days = 7): Promise<AvailabilityMatrix> {
    const { data } = await api.get<{ data: AvailabilityMatrix }>(
      `${BASE}/pools/availability-matrix`,
      { params: { from, days } },
    );
    return data.data;
  },

  // ── B. Capacity ────────────────────────────────────────────────────────────

  async capacityOptions(): Promise<CapacityOptions> {
    const { data } = await api.get<CapacityOptions>(`${BASE}/capacity/options`);
    return data;
  },

  async reservations(params?: {
    status?: string;
    holding_only?: boolean;
    page?: number;
  }): Promise<Paginated<CapacityReservation>> {
    const { data } = await api.get<Paginated<CapacityReservation>>(
      `${BASE}/capacity/reservations`,
      { params },
    );
    return data;
  },

  async reservation(id: string): Promise<CapacityReservation> {
    const { data } = await api.get<{ data: CapacityReservation }>(
      `${BASE}/capacity/reservations/${id}`,
    );
    return data.data;
  },

  /** A refusal is a 422 carrying Network's own words. */
  async reserve(payload: {
    capacity_slot_id: string;
    orders?: number;
    stops?: number;
    weight_kg?: number;
    volume_m3?: number;
    resource_pool_id?: string;
    reference_type?: string;
    reference_id?: string;
    purpose?: string;
    ttl_minutes?: number;
  }): Promise<CapacityReservation> {
    const { data } = await api.post<{ data: CapacityReservation }>(
      `${BASE}/capacity/reservations`,
      payload,
    );
    return data.data;
  },

  async confirmReservation(id: string): Promise<CapacityReservation> {
    const { data } = await api.patch<{ data: CapacityReservation }>(
      `${BASE}/capacity/reservations/${id}/confirm`,
    );
    return data.data;
  },

  /** Releasing confirmed capacity needs a reason. */
  async releaseReservation(id: string, reason?: string): Promise<CapacityReservation> {
    const { data } = await api.patch<{ data: CapacityReservation }>(
      `${BASE}/capacity/reservations/${id}/release`,
      { reason },
    );
    return data.data;
  },

  /** Advisory. Nothing is held, so two operators may see the same candidate. */
  async rebalanceCandidates(id: string, limit = 5): Promise<RebalanceCandidate[]> {
    const { data } = await api.get<{ data: RebalanceCandidate[] }>(
      `${BASE}/capacity/reservations/${id}/rebalance-candidates`,
      { params: { limit } },
    );
    return data.data;
  },

  async rebalance(
    id: string,
    destinationSlotId: string,
    reason?: string,
  ): Promise<CapacityReservation> {
    const { data } = await api.patch<{ data: CapacityReservation }>(
      `${BASE}/capacity/reservations/${id}/rebalance`,
      { destination_slot_id: destinationSlotId, reason },
    );
    return data.data;
  },

  async capacityMonitoring(date?: string): Promise<CapacityMonitoring> {
    const { data } = await api.get<{ data: CapacityMonitoring }>(`${BASE}/capacity/monitoring`, {
      params: { date },
    });
    return data.data;
  },

  async reservationAudit(id: string): Promise<ReservationAuditEntry[]> {
    const { data } = await api.get<{ data: ReservationAuditEntry[] }>(
      `${BASE}/capacity/reservations/${id}/audit`,
    );
    return data.data;
  },

  async reconcileCapacity(): Promise<{ holds_reclaimed: number }> {
    const { data } = await api.post<{ holds_reclaimed: number }>(
      `${BASE}/capacity/maintenance/reconcile`,
    );
    return data;
  },

  // ── C. Health ──────────────────────────────────────────────────────────────

  async healthOverview(date?: string): Promise<HealthOverview> {
    const { data } = await api.get<{ data: HealthOverview }>(`${BASE}/health/overview`, {
      params: { date },
    });
    return data.data;
  },

  async resourceHealth(): Promise<PoolHealthOverview> {
    const { data } = await api.get<{ data: PoolHealthOverview }>(`${BASE}/health/resources`);
    return data.data;
  },

  async capacityHealth(date?: string): Promise<CapacityHealth> {
    const { data } = await api.get<{ data: CapacityHealth }>(`${BASE}/health/capacity`, {
      params: { date },
    });
    return data.data;
  },

  /** Phase 3's own numbers, unchanged. */
  async dispatchHealth(): Promise<DispatchHealth> {
    const { data } = await api.get<{ data: DispatchHealth }>(`${BASE}/health/dispatch`);
    return data.data;
  },

  async utilisation(date?: string): Promise<UtilisationView> {
    const { data } = await api.get<{ data: UtilisationView }>(`${BASE}/health/utilisation`, {
      params: { date },
    });
    return data.data;
  },

  // ── D. Exceptions ──────────────────────────────────────────────────────────

  async exceptionOptions(): Promise<ExceptionOptions> {
    const { data } = await api.get<ExceptionOptions>(`${BASE}/exceptions/options`);
    return data;
  },

  async exceptions(params?: {
    status?: ExceptionStatus;
    outstanding_only?: boolean;
    source?: ExceptionSource;
    category?: ExceptionCategory;
    severity?: ExceptionSeverity;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<Paginated<OperationalException>> {
    const { data } = await api.get<Paginated<OperationalException>>(`${BASE}/exceptions`, {
      params,
    });
    return data;
  },

  async exception(id: string): Promise<OperationalException> {
    const { data } = await api.get<{ data: OperationalException }>(`${BASE}/exceptions/${id}`);
    return data.data;
  },

  async exceptionSummary(): Promise<ExceptionSummary> {
    const { data } = await api.get<{ data: ExceptionSummary }>(`${BASE}/exceptions/summary`);
    return data.data;
  },

  async acknowledge(id: string): Promise<OperationalException> {
    const { data } = await api.patch<{ data: OperationalException }>(
      `${BASE}/exceptions/${id}/acknowledge`,
    );
    return data.data;
  },

  /**
   * An exception owned by another module can only be closed as
   * 'handled_elsewhere' — the server refuses anything else.
   */
  async resolve(
    id: string,
    resolution: ExceptionResolution,
    reason: string,
  ): Promise<OperationalException> {
    const { data } = await api.patch<{ data: OperationalException }>(
      `${BASE}/exceptions/${id}/resolve`,
      { resolution, reason },
    );
    return data.data;
  },

  async suppress(id: string, reason: string): Promise<OperationalException> {
    const { data } = await api.patch<{ data: OperationalException }>(
      `${BASE}/exceptions/${id}/suppress`,
      { reason },
    );
    return data.data;
  },

  async notes(id: string): Promise<ExceptionNote[]> {
    const { data } = await api.get<{ data: ExceptionNote[] }>(`${BASE}/exceptions/${id}/notes`);
    return data.data;
  },

  async addNote(
    id: string,
    body: string,
    noteType: NoteType = 'note',
    isPinned = false,
  ): Promise<ExceptionNote> {
    const { data } = await api.post<{ data: ExceptionNote }>(`${BASE}/exceptions/${id}/notes`, {
      body,
      note_type: noteType,
      is_pinned: isPinned,
    });
    return data.data;
  },

  async escalate(
    id: string,
    reason: string,
    toRole?: string,
  ): Promise<Escalation> {
    const { data } = await api.post<{ data: Escalation }>(`${BASE}/exceptions/${id}/escalate`, {
      reason,
      to_role: toRole,
    });
    return data.data;
  },

  async escalations(id: string): Promise<Escalation[]> {
    const { data } = await api.get<{ data: Escalation[] }>(`${BASE}/exceptions/${id}/escalations`);
    return data.data;
  },

  /**
   * Housekeeping, both idempotent and both reporting a count rather than a
   * record: escalate every exception past its escalation deadline, and close
   * conflict records whose underlying conflict is already resolved.
   */
  async escalateOverdueExceptions(): Promise<number> {
    const { data } = await api.post<{ escalated: number }>(
      `${BASE}/exceptions/maintenance/escalate-overdue`,
    );
    return data.escalated;
  },

  async reconcileResolvedConflicts(): Promise<number> {
    const { data } = await api.post<{ closed: number }>(
      `${BASE}/exceptions/maintenance/reconcile`,
    );
    return data.closed;
  },

  async alerts(): Promise<OperationalAlert[]> {
    const { data } = await api.get<{ data: OperationalAlert[] }>(`${BASE}/exceptions/alerts`);
    return data.data;
  },

  async alertSummary(): Promise<AlertSummary> {
    const { data } = await api.get<{ data: AlertSummary }>(`${BASE}/exceptions/alerts/summary`);
    return data.data;
  },

  async alertRules(): Promise<AlertRule[]> {
    const { data } = await api.get<{ data: AlertRule[] }>(`${BASE}/exceptions/alerts/rules`);
    return data.data;
  },

  async createAlertRule(payload: {
    name: string;
    source?: ExceptionSource;
    category?: ExceptionCategory;
    exception_type?: string;
    min_severity: ExceptionSeverity;
    escalate_after_minutes?: number;
    escalate_to_role?: string;
    suppress?: boolean;
    suppress_reason?: string;
  }): Promise<{ id: string; name: string }> {
    const { data } = await api.post<{ data: { id: string; name: string } }>(
      `${BASE}/exceptions/alerts/rules`,
      payload,
    );
    return data.data;
  },
};
