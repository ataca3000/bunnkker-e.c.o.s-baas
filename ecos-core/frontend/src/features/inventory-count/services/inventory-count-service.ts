import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  CountLineAttachment,
  CountReportData,
  CountSession,
  CountSessionsQuery,
  CountSessionsResult,
  CreateCountSessionPayload,
  UpdateCountSessionPayload,
  WasteInvestigation,
  WasteInvestigationAttachment,
  WasteInvestigationsQuery,
  ResolveWasteInvestigationPayload,
  WarehouseLiability,
  WarehouseLiabilitiesQuery,
} from '../types/inventory-count';

type ListEnvelope = { data: CountSession[]; meta: CountSessionsResult['meta'] };

type WasteListEnvelope = {
  data: WasteInvestigation[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
  summary: { pending: number; resolved: number; pending_over_3?: number; pending_over_7?: number };
};

type LiabilityListEnvelope = {
  data: WarehouseLiability[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
  summary: {
    pending: number;
    approved: number;
    rejected: number;
    total_pending_value: number;
    total_approved_value: number;
  };
};

export const inventoryCountService = {
  async list(params: CountSessionsQuery = {}): Promise<CountSessionsResult> {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
    );
    const { data } = await api.get<ApiResponse<ListEnvelope>>('/inventory-counts', { params: filtered });
    return { items: data.data.data, meta: data.data.meta };
  },

  async get(id: string): Promise<CountSession> {
    const { data } = await api.get<ApiResponse<CountSession>>(`/inventory-counts/${id}`);
    return data.data;
  },

  async create(payload: CreateCountSessionPayload): Promise<CountSession> {
    const { data } = await api.post<ApiResponse<CountSession>>('/inventory-counts', payload);
    return data.data;
  },

  async update(id: string, payload: UpdateCountSessionPayload): Promise<CountSession> {
    const { data } = await api.put<ApiResponse<CountSession>>(`/inventory-counts/${id}`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/inventory-counts/${id}`);
  },

  async start(id: string): Promise<CountSession> {
    const { data } = await api.post<ApiResponse<CountSession>>(`/inventory-counts/${id}/start`);
    return data.data;
  },

  async complete(id: string): Promise<CountSession> {
    const { data } = await api.post<ApiResponse<CountSession>>(`/inventory-counts/${id}/complete`);
    return data.data;
  },

  async approve(id: string, approvedBy?: string): Promise<CountSession> {
    const { data } = await api.post<ApiResponse<CountSession>>(`/inventory-counts/${id}/approve`, {
      approved_by: approvedBy,
    });
    return data.data;
  },

  async cancel(id: string): Promise<CountSession> {
    const { data } = await api.post<ApiResponse<CountSession>>(`/inventory-counts/${id}/cancel`);
    return data.data;
  },

  async report(id: string): Promise<CountReportData> {
    const { data } = await api.get<ApiResponse<CountReportData>>(`/inventory-counts/${id}/report`);
    return data.data;
  },

  async uploadLineAttachment(sessionId: string, lineId: string, file: File, description?: string): Promise<CountLineAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    const { data } = await api.post<{ data: CountLineAttachment }>(
      `/inventory-counts/${sessionId}/lines/${lineId}/attachments`,
      formData,
    );
    return data.data;
  },

  async deleteLineAttachment(sessionId: string, lineId: string, attachmentId: string): Promise<void> {
    await api.delete(`/inventory-counts/${sessionId}/lines/${lineId}/attachments/${attachmentId}`);
  },
};

// ─── Waste Investigations ────────────────────────────────────────────────────

export const wasteInvestigationService = {
  async list(params: WasteInvestigationsQuery = {}): Promise<WasteListEnvelope> {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
    );
    const { data } = await api.get<WasteListEnvelope>('/inventory/waste-investigations', { params: filtered });
    return data;
  },

  async get(id: string): Promise<WasteInvestigation> {
    const { data } = await api.get<{ data: WasteInvestigation }>(`/inventory/waste-investigations/${id}`);
    return data.data;
  },

  async resolve(id: string, payload: ResolveWasteInvestigationPayload): Promise<WasteInvestigation> {
    const { data } = await api.post<{ data: WasteInvestigation }>(
      `/inventory/waste-investigations/${id}/resolve`,
      payload,
    );
    return data.data;
  },

  async report(params: { month?: string; warehouse_id?: string } = {}): Promise<unknown> {
    const { data } = await api.get('/inventory/waste-investigations/report', { params });
    return data;
  },

  async getAttachments(id: string): Promise<WasteInvestigationAttachment[]> {
    const { data } = await api.get<{ data: WasteInvestigationAttachment[] }>(
      `/inventory/waste-investigations/${id}/attachments`,
    );
    return data.data;
  },

  async uploadAttachment(
    id: string,
    file: File,
    description?: string,
    uploadedBy?: string,
  ): Promise<WasteInvestigationAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    if (uploadedBy) formData.append('uploaded_by', uploadedBy);
    const { data } = await api.post<{ data: WasteInvestigationAttachment }>(
      `/inventory/waste-investigations/${id}/attachments`,
      formData,
    );
    return data.data;
  },

  async deleteAttachment(id: string, attachmentId: string): Promise<void> {
    await api.delete(`/inventory/waste-investigations/${id}/attachments/${attachmentId}`);
  },
};

// ─── Warehouse Liabilities ───────────────────────────────────────────────────

export const warehouseLiabilityService = {
  async list(params: WarehouseLiabilitiesQuery = {}): Promise<LiabilityListEnvelope> {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
    );
    const { data } = await api.get<LiabilityListEnvelope>('/inventory/warehouse-liabilities', { params: filtered });
    return data;
  },

  async get(id: string): Promise<WarehouseLiability> {
    const { data } = await api.get<{ data: WarehouseLiability }>(`/inventory/warehouse-liabilities/${id}`);
    return data.data;
  },

  async approve(id: string, payload: { approved_by: string; notes?: string | null }): Promise<WarehouseLiability> {
    const { data } = await api.post<{ data: WarehouseLiability }>(
      `/inventory/warehouse-liabilities/${id}/approve`,
      payload,
    );
    return data.data;
  },

  async reject(id: string, payload: { rejected_by: string; reason?: string | null }): Promise<WarehouseLiability> {
    const { data } = await api.post<{ data: WarehouseLiability }>(
      `/inventory/warehouse-liabilities/${id}/reject`,
      payload,
    );
    return data.data;
  },

  async report(params: { month?: string; warehouse_id?: string } = {}): Promise<unknown> {
    const { data } = await api.get('/inventory/warehouse-liabilities/report', { params });
    return data;
  },
};
