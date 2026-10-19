import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ds/use-toast';
import * as svc from '../services/distribution-board-service';

function manifestKey(id: number) {
  return ['distribution-manifest', id] as const;
}

export function useLoadingManifest(id: number | null) {
  return useQuery({
    queryKey: ['distribution-manifest', id],
    queryFn: () => svc.fetchManifest(id!),
    enabled: id !== null,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useStartManifest(manifestId: number) {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => svc.startManifest(manifestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: manifestKey(manifestId) });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useConfirmManifestItem(manifestId: number) {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, loadedQty }: { itemId: number; loadedQty: number }) =>
      svc.confirmManifestItem(manifestId, itemId, loadedQty),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: manifestKey(manifestId) });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useResolveShortage(manifestId: number) {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      resolution,
      notes,
    }: {
      itemId: number;
      resolution: string;
      notes?: string;
    }) => svc.resolveManifestShortage(manifestId, itemId, { resolution, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: manifestKey(manifestId) });
      toast({ title: 'Shortage resolution recorded.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useCompleteManifest(manifestId: number) {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => svc.completeManifest(manifestId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: manifestKey(manifestId) });
      qc.invalidateQueries({ queryKey: ['distribution-board'] });
      toast({ title: data.message });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useProductBreakdown(manifestId: number, itemId: number | null) {
  return useQuery({
    queryKey: ['distribution-product-breakdown', manifestId, itemId],
    queryFn: () => svc.fetchProductBreakdown(manifestId, itemId!),
    enabled: itemId !== null,
    staleTime: 60_000,
  });
}

// ─── Driver Handover hooks ────────────────────────────────────────────────────

const HANDOVER_KEY = (tripId: string) => ['distribution-handover-status', tripId] as const;

export function useHandoverStatus(tripId: string | null) {
  return useQuery({
    queryKey: ['distribution-handover-status', tripId],
    queryFn: () => svc.fetchHandoverStatus(tripId!),
    enabled: !!tripId,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useDriverConfirmProduct(manifestId: number, tripId: string) {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, receivedQty }: { itemId: number; receivedQty: number }) =>
      svc.driverConfirmProduct(manifestId, itemId, receivedQty),
    onSuccess: (data) => {
      qc.setQueryData(HANDOVER_KEY(tripId), data.status);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useAcceptDiscrepancy(manifestId: number, tripId: string) {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, notes }: { itemId: number; notes?: string }) =>
      svc.acceptProductDiscrepancy(manifestId, itemId, notes),
    onSuccess: (data) => {
      qc.setQueryData(HANDOVER_KEY(tripId), data.status);
      toast({ title: 'Discrepancy accepted.' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useDriverConfirmCustody(tripId: string) {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ custodyId, receivedQty }: { custodyId: number; receivedQty: number }) =>
      svc.driverConfirmCustody(tripId, custodyId, receivedQty),
    onSuccess: (data) => {
      qc.setQueryData(HANDOVER_KEY(tripId), data.status);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

export function useDispatchTrip(tripId: string) {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => svc.dispatchTrip(tripId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['distribution-board'] });
      qc.invalidateQueries({ queryKey: ['distribution-loading-trips'] });
      qc.invalidateQueries({ queryKey: HANDOVER_KEY(tripId) });
      toast({ title: data.message });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
}

// ─── Loading OS Dashboard hook ────────────────────────────────────────────────

export function useLoadingDashboard() {
  return useQuery({
    queryKey: ['distribution-loading-trips'],
    queryFn: () => svc.fetchLoadingTrips(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
