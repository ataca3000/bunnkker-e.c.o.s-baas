import { api } from '@/lib/axios';
import type {
  Trip,
  TripDispatchReadiness,
  TripDriverAcceptancePayload,
  TripOptions,
  TripPayload,
  TripStats,
  TripStatus,
  TripsQuery,
  TripsResult,
} from '../types/trip';

const BASE = '/logistics/distribution/trips';

/**
 * Trip management — the back-office side of the distribution lifecycle.
 *
 * Single-trip reads return a bare TripResource (`{ data: Trip }`); the list
 * returns a paginated collection with `data` and `meta` as siblings. Both
 * shapes are unwrapped here so callers only ever see domain objects.
 */
export const tripService = {
  // ── Reference data ─────────────────────────────────────────────────────────

  async options(): Promise<TripOptions> {
    const { data } = await api.get<TripOptions>(`${BASE}/options`);
    return data;
  },

  async stats(companyId?: string): Promise<TripStats> {
    const { data } = await api.get<TripStats>(`${BASE}/stats`, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return data;
  },

  async nextNumber(companyId?: string): Promise<string> {
    const { data } = await api.get<{ trip_number: string }>(`${BASE}/next-number`, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return data.trip_number;
  },

  // ── Trips ──────────────────────────────────────────────────────────────────

  async list(params?: TripsQuery): Promise<TripsResult> {
    const { data } = await api.get<TripsResult>(BASE, { params });
    return data;
  },

  async get(id: string): Promise<Trip> {
    const { data } = await api.get<{ data: Trip }>(`${BASE}/${id}`);
    return data.data;
  },

  async create(payload: TripPayload): Promise<Trip> {
    const { data } = await api.post<{ data: Trip }>(BASE, payload);
    return data.data;
  },

  async update(id: string, payload: Partial<TripPayload>): Promise<Trip> {
    const { data } = await api.put<{ data: Trip }>(`${BASE}/${id}`, payload);
    return data.data;
  },

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Only transitions the trip itself declares in `allowed_transitions` are
   * legal. An illegal one is refused by the domain with a 422 carrying the
   * reason, which the caller surfaces rather than swallowing.
   */
  async setStatus(id: string, status: TripStatus, reason?: string): Promise<Trip> {
    const { data } = await api.patch<{ data: Trip }>(`${BASE}/${id}/status`, { status, reason });
    return data.data;
  },

  async dispatchReadiness(id: string): Promise<TripDispatchReadiness> {
    const { data } = await api.get<TripDispatchReadiness>(`${BASE}/${id}/dispatch-readiness`);
    return data;
  },

  async assign(id: string, driverVehicleAssignmentId: number): Promise<Trip> {
    const { data } = await api.patch<{ data: Trip }>(`${BASE}/${id}/assignment`, {
      driver_vehicle_assignment_id: driverVehicleAssignmentId,
    });
    return data.data;
  },

  async recordDriverAcceptance(id: string, payload: TripDriverAcceptancePayload): Promise<Trip> {
    const { data } = await api.patch<{ data: Trip }>(`${BASE}/${id}/driver-acceptance`, payload);
    return data.data;
  },
};
