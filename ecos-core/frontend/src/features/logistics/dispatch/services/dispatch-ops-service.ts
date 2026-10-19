import { api } from '@/lib/axios';
import type {
  AssignmentHealth,
  AssignmentReview,
  AuditEntry,
  CapacityUtilisation,
  DispatchBoardSummary,
  DispatchConflict,
  DispatchExceptions,
  DispatchKpis,
  DispatchOpsOptions,
  DispatchSession,
  HeldLock,
  Paginated,
  QueueItem,
  QueuePriority,
  QueueStatistics,
  ResourceAllocation,
  SessionMode,
  SessionStatus,
  TimelineEvent,
} from '../types/dispatch-ops';

const BASE = '/logistics/dispatch/ops';

/** Phase 2's board surface, read only — Phase 3 never creates or advances a board. */
const BOARDS = '/logistics/dispatch/boards';

export const dispatchOpsService = {
  async options(): Promise<DispatchOpsOptions> {
    const { data } = await api.get<DispatchOpsOptions>(`${BASE}/options`);
    return data;
  },

  async boards(): Promise<DispatchBoardSummary[]> {
    const { data } = await api.get<Paginated<DispatchBoardSummary>>(BOARDS, {
      params: { per_page: 30 },
    });
    return data.data;
  },

  // ── Sessions ───────────────────────────────────────────────────────────────

  async sessions(params?: { status?: SessionStatus; page?: number }): Promise<Paginated<DispatchSession>> {
    const { data } = await api.get<Paginated<DispatchSession>>(`${BASE}/sessions`, { params });
    return data;
  },

  async openSession(boardId: string, mode: SessionMode = 'manual'): Promise<DispatchSession> {
    const { data } = await api.post<{ data: DispatchSession }>(
      `${BASE}/boards/${boardId}/sessions`,
      { mode },
    );
    return data.data;
  },

  async setSessionStatus(
    id: string,
    status: SessionStatus,
    reason?: string,
  ): Promise<DispatchSession> {
    const { data } = await api.patch<{ data: DispatchSession }>(`${BASE}/sessions/${id}/status`, {
      status,
      reason,
    });
    return data.data;
  },

  /** Closing always releases the session's locks. */
  async closeSession(id: string, reason?: string): Promise<DispatchSession> {
    const { data } = await api.patch<{ data: DispatchSession }>(`${BASE}/sessions/${id}/close`, {
      reason,
    });
    return data.data;
  },

  // ── Queue ──────────────────────────────────────────────────────────────────

  async queue(boardId: string): Promise<QueueItem[]> {
    const { data } = await api.get<{ data: QueueItem[] }>(`${BASE}/boards/${boardId}/queue`);
    return data.data;
  },

  async buildQueue(boardId: string): Promise<{ added: number; message: string }> {
    const { data } = await api.post<{ added: number; message: string }>(
      `${BASE}/boards/${boardId}/queue/build`,
    );
    return data;
  },

  async claimNext(sessionId: string): Promise<QueueItem | null> {
    const { data } = await api.post<{ data: QueueItem | null }>(
      `${BASE}/sessions/${sessionId}/queue/claim-next`,
    );
    return data.data;
  },

  async claimItem(sessionId: string, itemId: string): Promise<QueueItem> {
    const { data } = await api.post<{ data: QueueItem }>(
      `${BASE}/sessions/${sessionId}/queue/${itemId}/claim`,
    );
    return data.data;
  },

  /** The reason is mandatory — ordering must stay explainable. */
  async prioritise(itemId: string, priority: QueuePriority, reason: string): Promise<QueueItem> {
    const { data } = await api.patch<{ data: QueueItem }>(`${BASE}/queue/${itemId}/priority`, {
      priority,
      reason,
    });
    return data.data;
  },

  async deferItem(itemId: string, reason?: string): Promise<QueueItem> {
    const { data } = await api.patch<{ data: QueueItem }>(`${BASE}/queue/${itemId}/defer`, {
      reason,
    });
    return data.data;
  },

  // ── Allocation ─────────────────────────────────────────────────────────────

  async allocate(
    sessionId: string,
    payload: {
      trip_id: string;
      vehicle_id: number;
      driver_id: number;
      assignment_id?: string;
      mode?: 'manual' | 'automatic';
    },
  ): Promise<ResourceAllocation> {
    const { data } = await api.post<{ data: ResourceAllocation }>(
      `${BASE}/sessions/${sessionId}/allocate`,
      payload,
    );
    return data.data;
  },

  /** Refused while a blocking conflict stands. */
  async confirmAllocation(id: string): Promise<ResourceAllocation> {
    const { data } = await api.patch<{ data: ResourceAllocation }>(
      `${BASE}/allocations/${id}/confirm`,
    );
    return data.data;
  },

  async releaseAllocation(id: string, reason?: string): Promise<ResourceAllocation> {
    const { data } = await api.patch<{ data: ResourceAllocation }>(
      `${BASE}/allocations/${id}/release`,
      { reason },
    );
    return data.data;
  },

  // ── Conflicts ──────────────────────────────────────────────────────────────

  async conflicts(outstandingOnly = true): Promise<DispatchConflict[]> {
    const { data } = await api.get<{ data: DispatchConflict[] }>(`${BASE}/conflicts`, {
      params: { outstanding_only: outstandingOnly },
    });
    return data.data;
  },

  async resolveConflict(
    id: string,
    resolution: string,
    reason?: string,
  ): Promise<DispatchConflict> {
    const { data } = await api.patch<{ data: DispatchConflict }>(
      `${BASE}/conflicts/${id}/resolve`,
      { resolution, reason },
    );
    return data.data;
  },

  /** Refused for conflicts owned by another module. */
  async overrideConflict(id: string, reason: string): Promise<DispatchConflict> {
    const { data } = await api.patch<{ data: DispatchConflict }>(
      `${BASE}/conflicts/${id}/override`,
      { reason },
    );
    return data.data;
  },

  // ── Reviews ────────────────────────────────────────────────────────────────

  async pendingReviews(): Promise<AssignmentReview[]> {
    const { data } = await api.get<{ data: AssignmentReview[] }>(`${BASE}/reviews/pending`);
    return data.data;
  },

  async requestReview(
    assignmentId: string,
    trigger: string,
    triggerReason?: string,
    sessionId?: string,
  ): Promise<AssignmentReview> {
    const { data } = await api.post<{ data: AssignmentReview }>(
      `${BASE}/assignments/${assignmentId}/review`,
      { trigger, trigger_reason: triggerReason, session_id: sessionId },
    );
    return data.data;
  },

  async approveReview(id: string, reason?: string): Promise<AssignmentReview> {
    const { data } = await api.patch<{ data: AssignmentReview }>(`${BASE}/reviews/${id}/approve`, {
      reason,
    });
    return data.data;
  },

  async rejectReview(id: string, reason: string): Promise<AssignmentReview> {
    const { data } = await api.patch<{ data: AssignmentReview }>(`${BASE}/reviews/${id}/reject`, {
      reason,
    });
    return data.data;
  },

  // ── Locks ──────────────────────────────────────────────────────────────────

  async locks(): Promise<HeldLock[]> {
    const { data } = await api.get<{ data: HeldLock[] }>(`${BASE}/locks`);
    return data.data;
  },

  /** Takes a resource from a colleague mid-decision. Always audited. */
  async breakLock(id: string, reason: string): Promise<{ id: string; status: string }> {
    const { data } = await api.patch<{ data: { id: string; status: string } }>(
      `${BASE}/locks/${id}/break`,
      { reason },
    );
    return data.data;
  },

  async sweep(): Promise<{ locks_reclaimed: number; sessions_abandoned: number }> {
    const { data } = await api.post<{ locks_reclaimed: number; sessions_abandoned: number }>(
      `${BASE}/maintenance/sweep`,
    );
    return data;
  },

  // ── Monitoring ─────────────────────────────────────────────────────────────

  async kpis(from?: string, to?: string): Promise<DispatchKpis> {
    const { data } = await api.get<{ data: DispatchKpis }>(`${BASE}/monitoring/kpis`, {
      params: { from, to },
    });
    return data.data;
  },

  async queueStatistics(): Promise<QueueStatistics> {
    const { data } = await api.get<{ data: QueueStatistics }>(`${BASE}/monitoring/queue`);
    return data.data;
  },

  async assignmentHealth(): Promise<AssignmentHealth> {
    const { data } = await api.get<{ data: AssignmentHealth }>(`${BASE}/monitoring/health`);
    return data.data;
  },

  async capacityUtilisation(date?: string): Promise<CapacityUtilisation> {
    const { data } = await api.get<{ data: CapacityUtilisation }>(`${BASE}/monitoring/capacity`, {
      params: { date },
    });
    return data.data;
  },

  async exceptions(): Promise<DispatchExceptions> {
    const { data } = await api.get<{ data: DispatchExceptions }>(`${BASE}/monitoring/exceptions`);
    return data.data;
  },

  // ── Timeline and audit ─────────────────────────────────────────────────────

  async boardTimeline(boardId: string): Promise<TimelineEvent[]> {
    const { data } = await api.get<{ data: TimelineEvent[] }>(
      `${BASE}/boards/${boardId}/timeline`,
    );
    return data.data;
  },

  async audit(overridesOnly = false): Promise<AuditEntry[]> {
    const { data } = await api.get<{ data: AuditEntry[] }>(`${BASE}/audit`, {
      params: { overrides_only: overridesOnly },
    });
    return data.data;
  },
};
