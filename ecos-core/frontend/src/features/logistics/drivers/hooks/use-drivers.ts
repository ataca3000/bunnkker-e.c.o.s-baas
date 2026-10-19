import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { driverService } from '../services/driver-service';
import type {
  DriverPayload,
  DriverStatus,
  DriversQuery,
  VehiclePayload,
  VehiclesQuery,
} from '../types/driver';

const KEY = 'logistics-drivers';
const VEHICLE_KEY = 'logistics-vehicles';

// ── Queries ──────────────────────────────────────────────────────────────────

export function useDriverStats() {
  return useQuery({
    queryKey: [KEY, 'stats'],
    queryFn: () => driverService.stats(),
    staleTime: 30_000,
  });
}

export function useNextDriverCode(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'next-code'],
    queryFn: () => driverService.nextCode(),
    enabled,
    staleTime: 0,
  });
}

export function useDrivers(params?: DriversQuery) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => driverService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useDriver(id: number | null) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => driverService.get(id!),
    enabled: id !== null,
  });
}

export function useDriverAssignments(driverId: number | null) {
  return useQuery({
    queryKey: [KEY, 'assignments', driverId],
    queryFn: () => driverService.assignments(driverId!),
    enabled: driverId !== null,
  });
}

export function useVehicles(params?: VehiclesQuery, enabled = true) {
  return useQuery({
    queryKey: [VEHICLE_KEY, 'list', params],
    queryFn: () => driverService.vehicles(params),
    enabled,
    staleTime: 30_000,
  });
}

// ── Driver mutations ─────────────────────────────────────────────────────────

/** Every mutation invalidates the broad driver prefix so list + detail + stats refresh together (ADR-024). */
function useDriverMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [VEHICLE_KEY] });
    },
  });
}

export function useCreateDriver() {
  return useDriverMutation((payload: DriverPayload) => driverService.create(payload));
}

export function useUpdateDriver() {
  return useDriverMutation(({ id, payload }: { id: number; payload: Partial<DriverPayload> }) =>
    driverService.update(id, payload),
  );
}

export function useSetDriverStatus() {
  return useDriverMutation(({ id, status, reason }: { id: number; status: DriverStatus; reason?: string }) =>
    driverService.setStatus(id, status, reason),
  );
}

// ── Document mutations ───────────────────────────────────────────────────────

export function useUploadDriverDocument() {
  return useDriverMutation(({ driverId, form }: { driverId: number; form: FormData }) =>
    driverService.uploadDocument(driverId, form),
  );
}

export function useDeleteDriverDocument() {
  return useDriverMutation(({ driverId, documentId }: { driverId: number; documentId: number }) =>
    driverService.deleteDocument(driverId, documentId),
  );
}

// ── Assignment mutations ─────────────────────────────────────────────────────

export function useAssignVehicle() {
  return useDriverMutation(({ driverId, vehicleId, notes }: { driverId: number; vehicleId: number; notes?: string }) =>
    driverService.assignVehicle(driverId, vehicleId, notes),
  );
}

export function useReleaseVehicle() {
  return useDriverMutation(({ driverId, reason }: { driverId: number; reason?: string }) =>
    driverService.releaseVehicle(driverId, reason),
  );
}

// ── Vehicle registry mutations ───────────────────────────────────────────────

export function useCreateVehicle() {
  return useDriverMutation((payload: VehiclePayload) => driverService.createVehicle(payload));
}
