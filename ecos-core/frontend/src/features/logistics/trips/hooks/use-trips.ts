import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { tripService } from '../services/trip-service';
import type {
  TripDriverAcceptancePayload,
  TripPayload,
  TripStatus,
  TripsQuery,
} from '../types/trip';

const KEY = 'logistics-trips';

// ── Queries ──────────────────────────────────────────────────────────────────

export function useTripOptions() {
  return useQuery({
    queryKey: [KEY, 'options'],
    queryFn: () => tripService.options(),
    staleTime: 5 * 60_000,
  });
}

export function useTripStats(companyId?: string) {
  return useQuery({
    queryKey: [KEY, 'stats', companyId],
    queryFn: () => tripService.stats(companyId),
    staleTime: 30_000,
  });
}

export function useNextTripNumber(enabled: boolean, companyId?: string) {
  return useQuery({
    queryKey: [KEY, 'next-number', companyId],
    queryFn: () => tripService.nextNumber(companyId),
    enabled,
    staleTime: 0,
  });
}

export function useTrips(params?: TripsQuery) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => tripService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useTrip(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => tripService.get(id as string),
    enabled: id !== null,
  });
}

/**
 * Readiness is recomputed by the domain on every read, so it is deliberately
 * not cached beyond the moment it is shown — a stale "ready" would be worse
 * than a refetch.
 */
export function useTripDispatchReadiness(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'readiness', id],
    queryFn: () => tripService.dispatchReadiness(id as string),
    enabled: id !== null,
    staleTime: 0,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Every write invalidates the whole trip prefix: lists, stats and readiness
 *  all derive from the same aggregate, and a partial invalidation would leave
 *  one of them contradicting the others. */
function useTripInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateTrip() {
  const invalidate = useTripInvalidation();

  return useMutation({
    mutationFn: (payload: TripPayload) => tripService.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateTrip() {
  const invalidate = useTripInvalidation();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TripPayload> }) =>
      tripService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetTripStatus() {
  const invalidate = useTripInvalidation();

  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: TripStatus; reason?: string }) =>
      tripService.setStatus(id, status, reason),
    onSuccess: invalidate,
  });
}

export function useAssignTripResources() {
  const invalidate = useTripInvalidation();

  return useMutation({
    mutationFn: ({ id, assignmentId }: { id: string; assignmentId: number }) =>
      tripService.assign(id, assignmentId),
    onSuccess: invalidate,
  });
}

export function useRecordDriverAcceptance() {
  const invalidate = useTripInvalidation();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TripDriverAcceptancePayload }) =>
      tripService.recordDriverAcceptance(id, payload),
    onSuccess: invalidate,
  });
}
