import { api } from '@/lib/axios';
import type {
  CapacityCommitment,
  CapacityAvailability,
  CapacityPlanRow,
  CoverageAnswer,
  CoverageMemberType,
  DispatchRegionRow,
  NetworkOptions,
  ServiceArea,
  ServiceAreaPayload,
  ServiceAreaStatus,
  ServiceAreasQuery,
  ServiceAreasResult,
  ServiceLevelRow,
  ReserveCapacityPayload,
} from '../types/network';

const BASE = '/logistics/network';

export const networkService = {
  async options(): Promise<NetworkOptions> {
    const { data } = await api.get<NetworkOptions>(`${BASE}/options`);
    return data;
  },

  async list(params?: ServiceAreasQuery): Promise<ServiceAreasResult> {
    const { data } = await api.get<ServiceAreasResult>(`${BASE}/service-areas`, { params });
    return data;
  },

  async get(id: string): Promise<ServiceArea> {
    const { data } = await api.get<{ data: ServiceArea }>(`${BASE}/service-areas/${id}`);
    return data.data;
  },

  async create(payload: ServiceAreaPayload): Promise<ServiceArea> {
    const { data } = await api.post<{ data: ServiceArea }>(`${BASE}/service-areas`, payload);
    return data.data;
  },

  async setStatus(id: string, status: ServiceAreaStatus, reason?: string): Promise<ServiceArea> {
    const { data } = await api.patch<{ data: ServiceArea }>(
      `${BASE}/service-areas/${id}/status`,
      { status, reason },
    );
    return data.data;
  },

  /** Attaches EXISTING geography. Nothing is created (Directive 8). */
  async attachMember(
    id: string,
    member_type: CoverageMemberType,
    member_id: string,
    is_excluded = false,
  ): Promise<ServiceArea> {
    const { data } = await api.post<{ data: ServiceArea }>(
      `${BASE}/service-areas/${id}/members`,
      { member_type, member_id, is_excluded },
    );
    return data.data;
  },

  async detachMember(id: string, memberId: number): Promise<ServiceArea> {
    const { data } = await api.delete<{ data: ServiceArea }>(
      `${BASE}/service-areas/${id}/members/${memberId}`,
    );
    return data.data;
  },

  /** A no-coverage result is a normal answer, not an error. */
  async resolveCoverage(cityId: string): Promise<CoverageAnswer> {
    const { data } = await api.post<{ data: CoverageAnswer }>(`${BASE}/coverage/resolve`, {
      city_id: cityId,
    });
    return data.data;
  },

  /** ADVISORY — reports remaining and shortfall, never rejects. */
  async availability(
    slotId: string,
    requested: Partial<Record<'orders' | 'stops' | 'weight_kg' | 'volume_m3', number>> = {},
  ): Promise<CapacityAvailability> {
    const { data } = await api.post<{ data: CapacityAvailability }>(
      `${BASE}/capacity/availability`,
      { slot_id: slotId, ...requested },
    );
    return data.data;
  },

  async capacityPlans(areaId: string): Promise<CapacityPlanRow[]> {
    const { data } = await api.get<{ data: CapacityPlanRow[] }>(
      `${BASE}/service-areas/${areaId}/capacity-plans`,
    );
    return data.data;
  },

  async regions(): Promise<DispatchRegionRow[]> {
    const { data } = await api.get<{ data: DispatchRegionRow[] }>(`${BASE}/dispatch-regions`);
    return data.data;
  },

  // ── Capacity commitments (network primitive) ───────────────────────────────

  /** Places a hold on a slot. The hold expires unless it is committed. */
  async reserveCapacity(payload: ReserveCapacityPayload): Promise<CapacityCommitment> {
    const { data } = await api.post<{ data: CapacityCommitment }>(
      `${BASE}/capacity/reserve`,
      payload,
    );
    return data.data;
  },

  async commitCapacity(id: string): Promise<CapacityCommitment> {
    const { data } = await api.patch<{ data: CapacityCommitment }>(`${BASE}/capacity/${id}/commit`);
    return data.data;
  },

  async releaseCapacity(id: string, reason?: string): Promise<CapacityCommitment> {
    const { data } = await api.patch<{ data: CapacityCommitment }>(
      `${BASE}/capacity/${id}/release`,
      { reason: reason ?? null },
    );
    return data.data;
  },

  /** Housekeeping: releases holds whose TTL has lapsed. Reports how many. */
  async sweepExpiredCapacity(): Promise<number> {
    const { data } = await api.post<{ data: { released?: number } }>(
      `${BASE}/capacity/sweep-expired`,
    );
    return data.data.released ?? 0;
  },

  async serviceLevels(): Promise<ServiceLevelRow[]> {
    const { data } = await api.get<{ data: ServiceLevelRow[] }>(`${BASE}/service-levels`);
    return data.data;
  },
};
