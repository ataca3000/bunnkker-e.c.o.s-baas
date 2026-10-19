import { api } from '@/lib/axios';
import type {
  Driver,
  DriverDocument,
  DriverPayload,
  DriverStats,
  DriverStatus,
  DriverVehicleAssignment,
  DriversQuery,
  DriversResult,
  Vehicle,
  VehiclePayload,
  VehiclesQuery,
  VehiclesResult,
} from '../types/driver';

const BASE = '/logistics/drivers';
const VEHICLES = '/logistics/vehicles';

export const driverService = {
  // ── Dashboard ──────────────────────────────────────────────────────────────

  async stats(): Promise<DriverStats> {
    const { data } = await api.get<DriverStats>(`${BASE}/stats`);
    return data;
  },

  async nextCode(): Promise<string> {
    const { data } = await api.get<{ code: string }>(`${BASE}/next-code`);
    return data.code;
  },

  // ── Drivers ────────────────────────────────────────────────────────────────

  async list(params?: DriversQuery): Promise<DriversResult> {
    const { data } = await api.get<DriversResult>(BASE, { params });
    return data;
  },

  async get(id: number): Promise<Driver> {
    const { data } = await api.get<{ data: Driver }>(`${BASE}/${id}`);
    return data.data;
  },

  async create(payload: DriverPayload): Promise<Driver> {
    const { data } = await api.post<{ data: Driver }>(BASE, payload);
    return data.data;
  },

  async update(id: number, payload: Partial<DriverPayload>): Promise<Driver> {
    const { data } = await api.put<{ data: Driver }>(`${BASE}/${id}`, payload);
    return data.data;
  },

  async setStatus(id: number, status: DriverStatus, reason?: string): Promise<Driver> {
    const { data } = await api.patch<{ data: Driver }>(`${BASE}/${id}/status`, { status, reason });
    return data.data;
  },

  // ── Documents ──────────────────────────────────────────────────────────────

  async documents(driverId: number): Promise<DriverDocument[]> {
    const { data } = await api.get<{ data: DriverDocument[] }>(`${BASE}/${driverId}/documents`);
    return data.data;
  },

  async uploadDocument(driverId: number, form: FormData): Promise<DriverDocument> {
    const { data } = await api.post<{ data: DriverDocument }>(
      `${BASE}/${driverId}/documents`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  async deleteDocument(driverId: number, documentId: number): Promise<void> {
    await api.delete(`${BASE}/${driverId}/documents/${documentId}`);
  },

  /** Streams the file through the authenticated endpoint and saves it locally. */
  async downloadDocument(driverId: number, doc: DriverDocument): Promise<void> {
    const { data } = await api.get<Blob>(
      `${BASE}/${driverId}/documents/${doc.id}/download`,
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

  // ── Vehicle assignment ─────────────────────────────────────────────────────

  async assignments(driverId: number): Promise<DriverVehicleAssignment[]> {
    const { data } = await api.get<{ data: DriverVehicleAssignment[] }>(`${BASE}/${driverId}/assignments`);
    return data.data;
  },

  /** Assign or change the driver's vehicle — the API releases any previous one. */
  async assignVehicle(driverId: number, vehicleId: number, notes?: string): Promise<DriverVehicleAssignment> {
    const { data } = await api.post<{ data: DriverVehicleAssignment }>(
      `${BASE}/${driverId}/vehicle`,
      { vehicle_id: vehicleId, notes },
    );
    return data.data;
  },

  async releaseVehicle(driverId: number, reason?: string): Promise<DriverVehicleAssignment> {
    const { data } = await api.delete<{ data: DriverVehicleAssignment }>(
      `${BASE}/${driverId}/vehicle`,
      { data: { reason } },
    );
    return data.data;
  },

  // ── Vehicle registry ───────────────────────────────────────────────────────

  async vehicles(params?: VehiclesQuery): Promise<VehiclesResult> {
    const { data } = await api.get<VehiclesResult>(VEHICLES, { params });
    return data;
  },

  async createVehicle(payload: VehiclePayload): Promise<Vehicle> {
    const { data } = await api.post<{ data: Vehicle }>(VEHICLES, payload);
    return data.data;
  },

  async updateVehicle(id: number, payload: Partial<VehiclePayload>): Promise<Vehicle> {
    const { data } = await api.put<{ data: Vehicle }>(`${VEHICLES}/${id}`, payload);
    return data.data;
  },
};
