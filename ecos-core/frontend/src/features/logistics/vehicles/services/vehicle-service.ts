import { api } from '@/lib/axios';
import type {
  MaintenancePayload,
  Vehicle,
  VehicleDocument,
  VehicleMaintenanceRecord,
  VehicleOptions,
  VehiclePayload,
  VehicleStats,
  VehicleStatus,
  VehiclesQuery,
  VehiclesResult,
} from '../types/vehicle';

const BASE = '/logistics/vehicles';

export const vehicleService = {
  // ── Reference data ─────────────────────────────────────────────────────────

  async options(): Promise<VehicleOptions> {
    const { data } = await api.get<VehicleOptions>(`${BASE}/options`);
    return data;
  },

  async stats(): Promise<VehicleStats> {
    const { data } = await api.get<VehicleStats>(`${BASE}/stats`);
    return data;
  },

  async nextCode(): Promise<string> {
    const { data } = await api.get<{ code: string }>(`${BASE}/next-code`);
    return data.code;
  },

  async maintenancePermissions(): Promise<boolean> {
    const { data } = await api.get<{ can_manage_maintenance: boolean }>(`${BASE}/maintenance-permissions`);
    return data.can_manage_maintenance;
  },

  // ── Vehicles ───────────────────────────────────────────────────────────────

  async list(params?: VehiclesQuery): Promise<VehiclesResult> {
    const { data } = await api.get<VehiclesResult>(BASE, { params });
    return data;
  },

  async get(id: number): Promise<Vehicle> {
    const { data } = await api.get<{ data: Vehicle }>(`${BASE}/${id}`);
    return data.data;
  },

  async create(payload: VehiclePayload): Promise<Vehicle> {
    const { data } = await api.post<{ data: Vehicle }>(BASE, payload);
    return data.data;
  },

  async update(id: number, payload: Partial<VehiclePayload>): Promise<Vehicle> {
    const { data } = await api.put<{ data: Vehicle }>(`${BASE}/${id}`, payload);
    return data.data;
  },

  async setStatus(id: number, status: VehicleStatus, reason?: string): Promise<Vehicle> {
    const { data } = await api.patch<{ data: Vehicle }>(`${BASE}/${id}/status`, { status, reason });
    return data.data;
  },

  // ── Documents ──────────────────────────────────────────────────────────────

  async documents(vehicleId: number): Promise<VehicleDocument[]> {
    const { data } = await api.get<{ data: VehicleDocument[] }>(`${BASE}/${vehicleId}/documents`);
    return data.data;
  },

  async uploadDocument(vehicleId: number, form: FormData): Promise<VehicleDocument> {
    const { data } = await api.post<{ data: VehicleDocument }>(
      `${BASE}/${vehicleId}/documents`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  async deleteDocument(vehicleId: number, documentId: number): Promise<void> {
    await api.delete(`${BASE}/${vehicleId}/documents/${documentId}`);
  },

  /** Streams the file through the authenticated endpoint and saves it locally. */
  async downloadDocument(vehicleId: number, doc: VehicleDocument): Promise<void> {
    const { data } = await api.get<Blob>(
      `${BASE}/${vehicleId}/documents/${doc.id}/download`,
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.file_name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  // ── Maintenance ────────────────────────────────────────────────────────────

  async maintenance(vehicleId: number): Promise<VehicleMaintenanceRecord[]> {
    const { data } = await api.get<{ data: VehicleMaintenanceRecord[] }>(`${BASE}/${vehicleId}/maintenance`);
    return data.data;
  },

  async recordMaintenance(vehicleId: number, payload: MaintenancePayload): Promise<VehicleMaintenanceRecord> {
    const { data } = await api.post<{ data: VehicleMaintenanceRecord }>(
      `${BASE}/${vehicleId}/maintenance`,
      payload,
    );
    return data.data;
  },

  async amendMaintenance(
    vehicleId: number,
    recordId: number,
    payload: Partial<MaintenancePayload>,
  ): Promise<VehicleMaintenanceRecord> {
    const { data } = await api.put<{ data: VehicleMaintenanceRecord }>(
      `${BASE}/${vehicleId}/maintenance/${recordId}`,
      payload,
    );
    return data.data;
  },

  async deleteMaintenance(vehicleId: number, recordId: number): Promise<void> {
    await api.delete(`${BASE}/${vehicleId}/maintenance/${recordId}`);
  },
};
