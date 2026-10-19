import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ds/use-toast';
import type {
  AddCustodyPayload,
  AssignDriverPayload,
  CreateTripPayload,
  UpdateTripPayload,
} from '../types/distribution-board';
import * as svc from '../services/distribution-board-service';

const EXCEPTIONS_KEY = ['distribution-wave-exceptions'] as const;

const BOARD_KEY   = ['distribution-board'] as const;
const FLEET_KEY   = ['distribution-fleet'] as const;

// ─── Board ───────────────────────────────────────────────────────────────────

export function useDistributionBoard() {
  return useQuery({
    queryKey: BOARD_KEY,
    queryFn: svc.fetchBoard,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useZoneOrders(zoneId: number | null) {
  return useQuery({
    queryKey: ['distribution-zone-orders', zoneId],
    queryFn: () => svc.fetchZoneOrders(zoneId!),
    enabled: zoneId !== null,
    staleTime: 10_000,
  });
}

/**
 * Canonical finalize-readiness validation — served by the backend (POST /board/validate),
 * the single source of truth. Replaces the client-side computeValidation() reimplementation.
 */
export function useValidateBoard(enabled = true) {
  return useQuery({
    queryKey: ['distribution-board-validation'],
    queryFn: svc.validateBoard,
    enabled,
    staleTime: 15_000,
  });
}

export function useTripOrders(tripId: string | null) {
  return useQuery({
    queryKey: ['distribution-trip-orders', tripId],
    queryFn: () => svc.fetchTripOrders(tripId!),
    enabled: tripId !== null,
    staleTime: 10_000,
  });
}

export function useFleetResources() {
  const vehicles = useQuery({
    queryKey: [...FLEET_KEY, 'vehicles'],
    queryFn: async () => (await svc.fetchFleetVehicles()).vehicles,
    staleTime: 120_000,
  });
  const drivers = useQuery({
    queryKey: [...FLEET_KEY, 'drivers'],
    queryFn: async () => (await svc.fetchFleetDrivers()).drivers,
    staleTime: 120_000,
  });
  const carriers = useQuery({
    queryKey: [...FLEET_KEY, 'carriers'],
    queryFn: async () => (await svc.fetchExternalCarriers()).carriers,
    staleTime: 120_000,
  });
  return { vehicles, drivers, carriers };
}

// ─── Trip mutations ───────────────────────────────────────────────────────────

function useInvalidateBoard() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: BOARD_KEY });
}


export function useCreateTrip() {
  const { toast } = useToast();
  const invalidate  = useInvalidateBoard();

  return useMutation({
    mutationFn: (payload: CreateTripPayload) => svc.createTrip(payload),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Trip created.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useUpdateTrip() {
  const { toast } = useToast();
  const invalidate  = useInvalidateBoard();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTripPayload }) =>
      svc.updateTrip(id, payload),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Trip updated.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useDeleteTrip() {
  const { toast } = useToast();
  const invalidate  = useInvalidateBoard();

  return useMutation({
    mutationFn: (id: string) => svc.deleteTrip(id),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Trip deleted.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useAutoFillTrip() {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => svc.autoFillTrip(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: BOARD_KEY });
      qc.invalidateQueries({ queryKey: ['distribution-zone-orders'] });
      qc.invalidateQueries({ queryKey: ['distribution-trip-orders', data.trip.id] });
      toast({ title: `${data.assigned_count} orders auto-assigned.` });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useAddOrderToTrip() {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, orderId }: { tripId: string; orderId: string }) =>
      svc.addOrderToTrip(tripId, orderId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: BOARD_KEY });
      qc.invalidateQueries({ queryKey: ['distribution-zone-orders'] });
      qc.invalidateQueries({ queryKey: ['distribution-trip-orders', vars.tripId] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useRemoveOrderFromTrip() {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, orderId }: { tripId: string; orderId: string }) =>
      svc.removeOrderFromTrip(tripId, orderId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: BOARD_KEY });
      qc.invalidateQueries({ queryKey: ['distribution-zone-orders'] });
      qc.invalidateQueries({ queryKey: ['distribution-trip-orders', vars.tripId] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useMoveOrder() {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      fromTripId,
      toTripId,
      orderId,
    }: {
      fromTripId: string;
      toTripId: string;
      orderId: string;
    }) => svc.moveOrderBetweenTrips(fromTripId, toTripId, orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOARD_KEY });
      qc.invalidateQueries({ queryKey: ['distribution-trip-orders'] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useAssignDriver() {
  const { toast } = useToast();
  const invalidate  = useInvalidateBoard();

  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: AssignDriverPayload }) =>
      svc.assignTripDriver(tripId, payload),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Driver assigned.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useAssignVehicle() {
  const { toast } = useToast();
  const invalidate  = useInvalidateBoard();

  return useMutation({
    mutationFn: ({ tripId, vehicleId }: { tripId: string; vehicleId: number | null }) =>
      svc.assignTripVehicle(tripId, vehicleId),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Vehicle assigned.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useAssignCarrier() {
  const { toast } = useToast();
  const invalidate  = useInvalidateBoard();

  return useMutation({
    mutationFn: ({ tripId, carrierId }: { tripId: string; carrierId: number | null }) =>
      svc.assignTripCarrier(tripId, carrierId),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Carrier assigned.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useAddCustodyItem() {
  const { toast } = useToast();
  const invalidate  = useInvalidateBoard();

  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: AddCustodyPayload }) =>
      svc.addCustodyItem(tripId, payload),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Custody item added.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useRemoveCustodyItem() {
  const { toast } = useToast();
  const invalidate  = useInvalidateBoard();

  return useMutation({
    mutationFn: ({ tripId, custodyId }: { tripId: string; custodyId: number }) =>
      svc.removeCustodyItem(tripId, custodyId),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Custody item removed.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useFinalizeBoard() {
  const { toast } = useToast();
  const invalidate  = useInvalidateBoard();

  return useMutation({
    mutationFn: svc.finalizeBoard,
    onSuccess: (data) => {
      invalidate();
      toast({ title: data.message });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

// ─── Trip approval + wave exceptions ─────────────────────────────────────────

export function useApproveTrip() {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (tripId: string) => svc.approveTrip(tripId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: BOARD_KEY });
      toast({ title: data.message });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useReturnToWave() {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      tripId,
      orderId,
      reason,
      notes,
    }: {
      tripId: string;
      orderId: string;
      reason?: string;
      notes?: string;
    }) => svc.returnOrderToWave(tripId, orderId, { reason, notes }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: BOARD_KEY });
      qc.invalidateQueries({ queryKey: ['distribution-trip-orders', vars.tripId] });
      qc.invalidateQueries({ queryKey: EXCEPTIONS_KEY });
      toast({ title: 'Order returned to wave exception list.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useWaveExceptions() {
  return useQuery({
    queryKey: EXCEPTIONS_KEY,
    queryFn: svc.fetchWaveExceptions,
    staleTime: 30_000,
  });
}

export function useCoverageMap(tripId: string | null) {
  return useQuery({
    queryKey: ['distribution-coverage', tripId],
    queryFn: () => svc.fetchCoverageMap(tripId!),
    enabled: tripId !== null,
    staleTime: 60_000,
  });
}
