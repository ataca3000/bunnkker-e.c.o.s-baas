import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  PreparationWave,
  PreparationDashboard,
  PreparationAnalytics,
  PreparationStation,
  PreparedPoolEntry,
  WorkerStatus,
  WavesQuery,
  WavesResult,
  PoolQuery,
  PoolResult,
  CreateWavePayload,
  StartPreparationPayload,
  CompleteProductPayload,
  CancelWavePayload,
  RecalculateWavePayload,
  TimelineEntry,
  DocumentEntry,
  ApproveWavePayload,
  AssignWorkerPayload,
  ResolveShortagePayload,
  UpdatePoolQualityPayload,
  PreparationSession,
  SessionsQuery,
  SessionsResult,
  CreateSessionPayload,
  CancelSessionPayload,
  AddWaveToSessionPayload,
  ReportIssuePayload,
  CreateAssignmentPolicyPayload,
  OverrideWarehousePayload,
  TodaySessionsResponse,
  SessionProduct,
  SessionConsolidation,
  SessionOrdersResult,
  AssignmentPolicy,
  ProductWorkspace,
  EnterpriseQueueResult,
  CapacityPlanningResult,
  OptimizationSuggestion,
  EnterpriseDashboardResult,
  WaveKpiReadModel,
  WaveProductDemandItem,
  WaveMaterialDemandItem,
  WaveMissingMaterialItem,
  WaveManufacturingDemandItem,
  WaveOrderEntry,
} from '../types/preparation';

const BASE = '/preparation';

export const preparationService = {
  // ── Dashboard ───────────────────────────────────────────────────────────────

  async getDashboard(params: { warehouse_id?: string; planning_date?: string } = {}): Promise<PreparationDashboard> {
    const filtered = clean(params);
    const { data } = await api.get<ApiResponse<PreparationDashboard>>(`${BASE}/dashboard`, { params: filtered });
    return data.data;
  },

  // ── Analytics ───────────────────────────────────────────────────────────────

  async getAnalytics(params: {
    from_date: string;
    to_date: string;
    warehouse_id?: string;
  }): Promise<PreparationAnalytics> {
    const { data } = await api.get<ApiResponse<PreparationAnalytics>>(`${BASE}/analytics`, { params: clean(params) });
    return data.data;
  },

  // ── Waves ───────────────────────────────────────────────────────────────────

  async listWaves(params: WavesQuery = {}): Promise<WavesResult> {
    const filtered = clean(params);
    const { data } = await api.get<ApiResponse<WavesResult>>(`${BASE}/waves`, { params: filtered });
    return data.data;
  },

  async getWave(id: string): Promise<PreparationWave> {
    const { data } = await api.get<ApiResponse<PreparationWave>>(`${BASE}/waves/${id}`);
    return data.data;
  },

  async createWave(payload: CreateWavePayload): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves`, payload);
    return data.data;
  },

  async generateDemand(id: string): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${id}/generate-demand`);
    return data.data;
  },

  async analyzeMaterials(id: string): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${id}/analyze-materials`);
    return data.data;
  },

  async startPreparation(id: string, payload: StartPreparationPayload): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${id}/start`, payload);
    return data.data;
  },

  async advanceWave(id: string): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${id}/advance`);
    return data.data;
  },

  async completeItem(waveId: string, itemId: string, payload: CompleteProductPayload): Promise<PreparationWave> {
    const { data } = await api.patch<ApiResponse<PreparationWave>>(
      `${BASE}/waves/${waveId}/items/${itemId}/complete`,
      payload,
    );
    return data.data;
  },

  async completeWave(id: string): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${id}/complete`);
    return data.data;
  },

  async cancelWave(id: string, payload: CancelWavePayload): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${id}/cancel`, payload);
    return data.data;
  },

  async recalculateWave(id: string, payload: RecalculateWavePayload): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${id}/recalculate`, payload);
    return data.data;
  },

  // ── Wave enterprise actions ──────────────────────────────────────────────────

  async approveWave(id: string, payload: ApproveWavePayload = {}): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${id}/approve`, payload);
    return data.data;
  },

  async assignWorker(waveId: string, payload: AssignWorkerPayload): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${waveId}/workers`, payload);
    return data.data;
  },

  async releaseWorker(waveId: string, userId: string): Promise<PreparationWave> {
    const { data } = await api.delete<ApiResponse<PreparationWave>>(`${BASE}/waves/${waveId}/workers/${userId}`);
    return data.data;
  },

  async resolveShortage(waveId: string, payload: ResolveShortagePayload): Promise<PreparationWave> {
    const { data } = await api.post<ApiResponse<PreparationWave>>(`${BASE}/waves/${waveId}/resolve-shortage`, payload);
    return data.data;
  },

  async updatePoolQuality(poolId: string, payload: UpdatePoolQualityPayload): Promise<PreparedPoolEntry> {
    const { data } = await api.patch<ApiResponse<PreparedPoolEntry>>(`${BASE}/pool/${poolId}/quality`, payload);
    return data.data;
  },

  // ── Wave timeline / documents ────────────────────────────────────────────────

  async getWaveTimeline(waveId: string): Promise<TimelineEntry[]> {
    const { data } = await api.get<ApiResponse<TimelineEntry[]>>(`${BASE}/waves/${waveId}/timeline`);
    return data.data;
  },

  async listWaveDocuments(waveId: string): Promise<DocumentEntry[]> {
    const { data } = await api.get<ApiResponse<DocumentEntry[]>>(`${BASE}/waves/${waveId}/documents`);
    return data.data;
  },

  // ── Pool ────────────────────────────────────────────────────────────────────

  async listPool(params: PoolQuery): Promise<PoolResult> {
    const { data } = await api.get<ApiResponse<PoolResult>>(`${BASE}/pool`, { params: clean(params) });
    return data.data;
  },

  // ── Workers ─────────────────────────────────────────────────────────────────

  async listWorkers(params: { warehouse_id: string; planning_date?: string }): Promise<WorkerStatus[]> {
    const { data } = await api.get<ApiResponse<WorkerStatus[]>>(`${BASE}/workers`, { params: clean(params) });
    return data.data;
  },

  // ── Stations ────────────────────────────────────────────────────────────────

  async listStations(params: { warehouse_id: string; status?: string }): Promise<PreparationStation[]> {
    const { data } = await api.get<ApiResponse<PreparationStation[]>>(`${BASE}/stations`, { params: clean(params) });
    return data.data;
  },

  // ── Product Workspace ────────────────────────────────────────────────────────

  async getProductQueue(waveId: string, params: { status?: string } = {}): Promise<{ items: unknown[] }> {
    const { data } = await api.get<ApiResponse<{ items: unknown[] }>>(`${BASE}/waves/${waveId}/product-queue`, { params: clean(params) });
    return data.data;
  },

  async getProductWorkspace(waveId: string, itemId: string): Promise<ProductWorkspace> {
    const { data } = await api.get<ApiResponse<ProductWorkspace>>(`${BASE}/waves/${waveId}/items/${itemId}/workspace`);
    return data.data;
  },

  async reportIssue(waveId: string, payload: ReportIssuePayload): Promise<void> {
    await api.post(`${BASE}/waves/${waveId}/issues`, payload);
  },

  // ── Sessions (CR-PREP-001) ───────────────────────────────────────────────────

  async listSessions(params: SessionsQuery = {}): Promise<SessionsResult> {
    const { data } = await api.get<ApiResponse<SessionsResult>>(`${BASE}/sessions`, { params: clean(params) });
    return data.data;
  },

  async getSession(id: string): Promise<PreparationSession> {
    const { data } = await api.get<ApiResponse<PreparationSession>>(`${BASE}/sessions/${id}`);
    return data.data;
  },

  async createSession(payload: CreateSessionPayload): Promise<PreparationSession> {
    const { data } = await api.post<ApiResponse<PreparationSession>>(`${BASE}/sessions`, payload);
    return data.data;
  },

  async startSession(id: string): Promise<PreparationSession> {
    const { data } = await api.post<ApiResponse<PreparationSession>>(`${BASE}/sessions/${id}/start`);
    return data.data;
  },

  async planSession(id: string): Promise<PreparationSession> {
    const { data } = await api.post<ApiResponse<PreparationSession>>(`${BASE}/sessions/${id}/plan`);
    return data.data;
  },

  async completeSession(id: string): Promise<PreparationSession> {
    const { data } = await api.post<ApiResponse<PreparationSession>>(`${BASE}/sessions/${id}/complete`);
    return data.data;
  },

  async approveSession(id: string): Promise<PreparationSession> {
    const { data } = await api.post<ApiResponse<PreparationSession>>(`${BASE}/sessions/${id}/approve`);
    return data.data;
  },

  async closeSession(id: string): Promise<PreparationSession> {
    const { data } = await api.post<ApiResponse<PreparationSession>>(`${BASE}/sessions/${id}/close`);
    return data.data;
  },

  async cancelSession(id: string, payload: CancelSessionPayload): Promise<PreparationSession> {
    const { data } = await api.post<ApiResponse<PreparationSession>>(`${BASE}/sessions/${id}/cancel`, payload);
    return data.data;
  },

  async freezeSession(id: string): Promise<PreparationSession> {
    const { data } = await api.post<ApiResponse<PreparationSession>>(`${BASE}/sessions/${id}/freeze`);
    return data.data;
  },

  async addWaveToSession(sessionId: string, payload: AddWaveToSessionPayload): Promise<PreparationSession> {
    const { data } = await api.post<ApiResponse<PreparationSession>>(`${BASE}/sessions/${sessionId}/waves`, payload);
    return data.data;
  },

  async getConsolidation(sessionId: string): Promise<SessionConsolidation> {
    const { data } = await api.get<ApiResponse<SessionConsolidation>>(`${BASE}/sessions/${sessionId}/consolidation`);
    return data.data;
  },

  async getSessionProducts(sessionId: string): Promise<SessionProduct[]> {
    const { data } = await api.get<ApiResponse<SessionProduct[]>>(`${BASE}/sessions/${sessionId}/products`);
    return data.data;
  },

  async getSessionOrders(sessionId: string, params: { per_page?: number; page?: number } = {}): Promise<SessionOrdersResult> {
    const { data } = await api.get<ApiResponse<SessionOrdersResult>>(`${BASE}/sessions/${sessionId}/orders`, { params: clean(params) });
    return data.data;
  },

  async attachOrderToSession(sessionId: string, orderId: string): Promise<void> {
    await api.post(`${BASE}/sessions/${sessionId}/orders`, { order_id: orderId });
  },

  async detachOrderFromSession(sessionId: string, sessionOrderId: string, reason: string): Promise<void> {
    await api.delete(`${BASE}/sessions/${sessionId}/orders/${sessionOrderId}`, { data: { reason } });
  },

  // ── Today Sessions ───────────────────────────────────────────────────────────

  async getTodaySessions(params: { date?: string } = {}): Promise<TodaySessionsResponse> {
    const { data } = await api.get<ApiResponse<TodaySessionsResponse>>(`${BASE}/today`, { params: clean(params) });
    return data.data;
  },

  // ── Assignment Policies ──────────────────────────────────────────────────────

  async listAssignmentPolicies(params: { warehouse_id?: string; is_active?: boolean } = {}): Promise<AssignmentPolicy[]> {
    const { data } = await api.get<ApiResponse<AssignmentPolicy[]>>(`${BASE}/assignment-policies`, { params: clean(params) });
    return data.data;
  },

  async createAssignmentPolicy(payload: CreateAssignmentPolicyPayload): Promise<AssignmentPolicy> {
    const { data } = await api.post<ApiResponse<AssignmentPolicy>>(`${BASE}/assignment-policies`, payload);
    return data.data;
  },

  async deleteAssignmentPolicy(id: string): Promise<void> {
    await api.delete(`${BASE}/assignment-policies/${id}`);
  },

  async overrideWarehouse(orderId: string, payload: OverrideWarehousePayload): Promise<void> {
    await api.post(`${BASE}/orders/${orderId}/override-warehouse`, payload);
  },

  // ── Enterprise (Phases 6, 8, 9, 13) ─────────────────────────────────────────

  async getEnterpriseQueue(params: { planning_date?: string; warehouse_id?: string; wave_id?: string } = {}): Promise<EnterpriseQueueResult> {
    const { data } = await api.get<ApiResponse<EnterpriseQueueResult>>(`${BASE}/enterprise/queue`, { params: clean(params) });
    return data.data;
  },

  async getCapacityPlanning(params: { planning_date?: string; warehouse_id?: string } = {}): Promise<CapacityPlanningResult> {
    const { data } = await api.get<ApiResponse<CapacityPlanningResult>>(`${BASE}/enterprise/capacity`, { params: clean(params) });
    return data.data;
  },

  async getOptimizationSuggestions(params: { planning_date?: string; warehouse_id?: string } = {}): Promise<OptimizationSuggestion[]> {
    const { data } = await api.get<ApiResponse<OptimizationSuggestion[]>>(`${BASE}/enterprise/optimization`, { params: clean(params) });
    return data.data;
  },

  async getEnterpriseDashboard(params: { planning_date?: string; warehouse_id?: string } = {}): Promise<EnterpriseDashboardResult> {
    const { data } = await api.get<ApiResponse<EnterpriseDashboardResult>>(`${BASE}/enterprise/dashboard`, { params: clean(params) });
    return data.data;
  },

  // ── Demand Engine read models (TASK-PREP-INTEGRATION-001) ────────────────────

  async getWaveKpis(waveId: string): Promise<WaveKpiReadModel> {
    const { data } = await api.get<ApiResponse<WaveKpiReadModel>>(`${BASE}/waves/${waveId}/kpis`);
    return data.data;
  },

  async getWaveProductDemand(waveId: string): Promise<WaveProductDemandItem[]> {
    const { data } = await api.get<ApiResponse<WaveProductDemandItem[]>>(`${BASE}/waves/${waveId}/product-demand`);
    return data.data;
  },

  async getWaveMaterialDemand(waveId: string): Promise<WaveMaterialDemandItem[]> {
    const { data } = await api.get<ApiResponse<WaveMaterialDemandItem[]>>(`${BASE}/waves/${waveId}/material-demand`);
    return data.data;
  },

  async getWaveMissingMaterials(waveId: string): Promise<WaveMissingMaterialItem[]> {
    const { data } = await api.get<ApiResponse<WaveMissingMaterialItem[]>>(`${BASE}/waves/${waveId}/missing-materials`);
    return data.data;
  },

  async getWaveManufacturingDemand(waveId: string): Promise<WaveManufacturingDemandItem[]> {
    const { data } = await api.get<ApiResponse<WaveManufacturingDemandItem[]>>(`${BASE}/waves/${waveId}/manufacturing-demand`);
    return data.data;
  },

  async getWaveOrders(waveId: string): Promise<WaveOrderEntry[]> {
    const { data } = await api.get<ApiResponse<WaveOrderEntry[]>>(`${BASE}/waves/${waveId}/orders`);
    return data.data;
  },
};

function clean(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
  );
}
