import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ds/use-toast';
import {
  driverAcceptTrip,
  dispatchVehicle,
  fetchDispatchGate,
  fetchDispatchGateWorkspace,
} from '../services/distribution-board-service';
import type { DeparturePayload, DriverAcceptancePayload } from '../types/distribution-board';

const GATE_KEY        = ['dispatch-gate'] as const;
const WORKSPACE_KEY   = (id: string) => ['dispatch-gate-workspace', id] as const;

export function useDispatchGate() {
  return useQuery({
    queryKey: GATE_KEY,
    queryFn:  fetchDispatchGate,
    refetchInterval: 30_000,
  });
}

export function useDispatchGateWorkspace(tripId: string | null) {
  return useQuery({
    queryKey: WORKSPACE_KEY(tripId ?? ''),
    queryFn:  () => fetchDispatchGateWorkspace(tripId!),
    enabled:  !!tripId,
  });
}

export function useDriverAcceptTrip(tripId: string) {
  const qc    = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: DriverAcceptancePayload) => driverAcceptTrip(tripId, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: WORKSPACE_KEY(tripId) });
      qc.invalidateQueries({ queryKey: GATE_KEY });
      toast.toast({
        title:       data.trip.has_discrepancy ? 'Dispatch Blocked' : 'Driver Accepted',
        description: data.message,
        variant:     data.trip.has_discrepancy ? 'destructive' : 'default',
      });
    },
    onError: (err: Error) => {
      toast.toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useDispatchVehicle(tripId: string) {
  const qc    = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: DeparturePayload) => dispatchVehicle(tripId, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: WORKSPACE_KEY(tripId) });
      qc.invalidateQueries({ queryKey: GATE_KEY });
      toast.toast({ title: 'Vehicle Dispatched', description: data.message });
    },
    onError: (err: Error) => {
      toast.toast({ title: 'Dispatch Failed', description: err.message, variant: 'destructive' });
    },
  });
}
