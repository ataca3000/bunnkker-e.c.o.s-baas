import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ds/use-toast';
import * as svc from '../services/driver-mobile-service';
import type { AddReturnPayload, CollectPaymentPayload, DeliveryActionPayload, RecordCustodyReturnPayload } from '../services/driver-mobile-service';

const K = {
  trips:       'driver-trips',
  trip:        (id: string) => ['driver-trip', id] as const,
  stops:       (id: string) => ['driver-stops', id] as const,
  stopDetail:  (tripId: string, stopId: string) => ['driver-stop-detail', tripId, stopId] as const,
  collections: (id: string) => ['driver-collections', id] as const,
  exceptions:  (id: string) => ['driver-exceptions', id] as const,
  returns:     (id: string) => ['driver-returns', id] as const,
  settlement:  (id: string) => ['driver-settlement', id] as const,
  custody:     (id: string) => ['driver-custody', id] as const,
  timeline:    (id: string) => ['driver-timeline', id] as const,
};

// ── Active trips ─────────────────────────────────────────────────────────────

export function useDriverTrips() {
  return useQuery({
    queryKey: [K.trips],
    queryFn:  () => svc.fetchActiveTrips(),
    refetchInterval: 30_000,
  });
}

// ── Trip dashboard ────────────────────────────────────────────────────────────

export function useDriverTrip(tripId: string) {
  return useQuery({
    queryKey: K.trip(tripId),
    queryFn:  () => svc.fetchTripDashboard(tripId),
    enabled:  Boolean(tripId),
    refetchInterval: 20_000,
  });
}

// ── Stop list ─────────────────────────────────────────────────────────────────

export function useDriverStops(tripId: string) {
  return useQuery({
    queryKey: K.stops(tripId),
    queryFn:  () => svc.fetchStopList(tripId),
    enabled:  Boolean(tripId),
    refetchInterval: 15_000,
  });
}

// ── Stop detail ───────────────────────────────────────────────────────────────

export function useDriverStopDetail(tripId: string, stopId: string) {
  return useQuery({
    queryKey: K.stopDetail(tripId, stopId),
    queryFn:  () => svc.fetchStopDetail(tripId, stopId),
    enabled:  Boolean(tripId) && Boolean(stopId),
  });
}

// ── Start trip ────────────────────────────────────────────────────────────────

export function useStartTrip(tripId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ lat, lng, odoStart }: { lat: number; lng: number; odoStart?: number }) =>
      svc.startTrip(tripId, lat, lng, odoStart),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.trip(tripId) });
      void qc.invalidateQueries({ queryKey: K.stops(tripId) });
      toast({ title: 'Trip started', description: 'Delivery stops are now active.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to start trip', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Finish trip ───────────────────────────────────────────────────────────────

export function useFinishTrip(tripId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ lat, lng, odoEnd }: { lat: number; lng: number; odoEnd?: number }) =>
      svc.finishTrip(tripId, lat, lng, odoEnd),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.trip(tripId) });
      void qc.invalidateQueries({ queryKey: [K.trips] });
      toast({ title: 'Trip finished', description: 'Proceed to settlement.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Cannot finish trip', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Submit delivery action ────────────────────────────────────────────────────

export function useSubmitDeliveryAction(stopId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: DeliveryActionPayload) => svc.submitDeliveryAction(stopId, payload),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [K.trips] });
      toast({
        title: 'Delivery recorded',
        description: `Action: ${variables.action_type}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to record delivery', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Collect payment ───────────────────────────────────────────────────────────

export function useCollectPayment(stopId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: CollectPaymentPayload) => svc.collectPayment(stopId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [K.trips] });
      toast({ title: 'Payment recorded' });
    },
    onError: (err: Error) => {
      toast({ title: 'Payment failed', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Trip collections ──────────────────────────────────────────────────────────

export function useTripCollections(tripId: string) {
  return useQuery({
    queryKey: K.collections(tripId),
    queryFn:  () => svc.fetchTripCollections(tripId),
    enabled:  Boolean(tripId),
  });
}

// ── Trip exceptions ───────────────────────────────────────────────────────────

export function useTripExceptions(tripId: string) {
  return useQuery({
    queryKey: K.exceptions(tripId),
    queryFn:  () => svc.fetchTripExceptions(tripId),
    enabled:  Boolean(tripId),
  });
}

// ── Trip returns ──────────────────────────────────────────────────────────────

export function useTripReturns(tripId: string) {
  return useQuery({
    queryKey: K.returns(tripId),
    queryFn:  () => svc.fetchTripReturns(tripId),
    enabled:  Boolean(tripId),
  });
}

// ── Add return ────────────────────────────────────────────────────────────────

export function useAddReturn(tripId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: AddReturnPayload) => svc.addReturn(tripId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.returns(tripId) });
      toast({ title: 'Return recorded' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to record return', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Trip settlement ───────────────────────────────────────────────────────────

export function useTripSettlement(tripId: string) {
  return useQuery({
    queryKey: K.settlement(tripId),
    queryFn:  () => svc.fetchSettlement(tripId),
    enabled:  Boolean(tripId),
  });
}

// ── Submit settlement ─────────────────────────────────────────────────────────

export function useSubmitSettlement(tripId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ cashSubmitted, notes }: { cashSubmitted: number; notes?: string }) =>
      svc.submitSettlement(tripId, cashSubmitted, notes),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.settlement(tripId) });
      toast({ title: 'Settlement submitted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Settlement failed', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Custody returns ───────────────────────────────────────────────────────────

export function useCustodyReturns(tripId: string) {
  return useQuery({
    queryKey: K.custody(tripId),
    queryFn:  () => svc.fetchCustodyReturns(tripId),
    enabled:  Boolean(tripId),
  });
}

export function useRecordCustodyReturn(tripId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: RecordCustodyReturnPayload) => svc.recordCustodyReturn(tripId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.custody(tripId) });
      toast({ title: 'Custody return recorded' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Close trip ────────────────────────────────────────────────────────────────

export function useCloseTrip(tripId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () => svc.closeTrip(tripId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.trip(tripId) });
      void qc.invalidateQueries({ queryKey: [K.trips] });
      toast({ title: 'Trip closed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Cannot close trip', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function useTripTimeline(tripId: string) {
  return useQuery({
    queryKey: K.timeline(tripId),
    queryFn:  () => svc.fetchTimeline(tripId),
    enabled:  Boolean(tripId),
  });
}

// ── Create exception ──────────────────────────────────────────────────────────

export function useCreateException(stopId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: { exception_type: string; description: string; photos?: string[] }) =>
      svc.createException(stopId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [K.trips] });
      toast({ title: 'Exception recorded' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Confirm return ────────────────────────────────────────────────────────────

export function useConfirmReturn(tripId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ returnId, confirmedQty }: { returnId: number; confirmedQty: number }) =>
      svc.confirmReturn(returnId, confirmedQty),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.returns(tripId) });
      toast({ title: 'Return confirmed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });
}
