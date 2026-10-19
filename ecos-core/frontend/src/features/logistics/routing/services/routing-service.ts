import { api } from '@/lib/axios';
import type {
  EtaProjection,
  PlanTripPayload,
  RoutePlan,
  RoutingStrategy,
} from '../types/routing';

const BASE = '/logistics/routing';

/**
 * Route planning for a trip.
 *
 * `currentPlan` returns `{ data: null }` when a trip has never been planned —
 * a normal state, not an error, so it surfaces as null rather than a failure.
 *
 * Planning and re-planning are the same call: the backend freezes stops that
 * were already attempted and re-sequences only the remainder.
 */
export const routingService = {
  async strategies(): Promise<RoutingStrategy[]> {
    const { data } = await api.get<{ data: RoutingStrategy[] }>(`${BASE}/strategies`);
    return data.data;
  },

  async currentPlan(tripId: string): Promise<RoutePlan | null> {
    const { data } = await api.get<{ data: RoutePlan | null }>(`${BASE}/trips/${tripId}/plan`);
    return data.data;
  },

  async planHistory(tripId: string): Promise<RoutePlan[]> {
    const { data } = await api.get<{ data: RoutePlan[] }>(`${BASE}/trips/${tripId}/plans`);
    return data.data;
  },

  async plan(tripId: string, payload: PlanTripPayload): Promise<RoutePlan> {
    const { data } = await api.post<{ data: RoutePlan }>(`${BASE}/trips/${tripId}/plan`, payload);
    return data.data;
  },

  async activate(tripId: string, planId: string): Promise<RoutePlan> {
    const { data } = await api.patch<{ data: RoutePlan }>(
      `${BASE}/trips/${tripId}/plans/${planId}/activate`,
    );
    return data.data;
  },

  async complete(tripId: string, planId: string): Promise<RoutePlan> {
    const { data } = await api.patch<{ data: RoutePlan }>(
      `${BASE}/trips/${tripId}/plans/${planId}/complete`,
    );
    return data.data;
  },

  async projectEta(tripId: string, planId: string): Promise<EtaProjection> {
    const { data } = await api.post<{ data: EtaProjection }>(
      `${BASE}/trips/${tripId}/plans/${planId}/eta`,
    );
    return data.data;
  },
};
