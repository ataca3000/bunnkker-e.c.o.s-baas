import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleService } from '../services/vehicle-service';
import type {
  MaintenancePayload,
  VehiclePayload,
  VehicleStatus,
  VehiclesQuery,
} from '../types/vehicle';

const KEY = 'logistics-vehicles';
const DRIVER_KEY = 'logistics-drivers';

// ── Queries ──────────────────────────────────────────────────────────────────

/** Enum catalogue — cached hard, it only changes on deploy. */
export function useVehicleOptions() {
  return useQuery({
    queryKey: [KEY, 'options'],
    queryFn: () => vehicleService.options(),
    staleTime: Infinity,
  });
}

export function useVehicleStats() {
  return useQuery({
    queryKey: [KEY, 'stats'],
    queryFn: () => vehicleService.stats(),
    staleTime: 30_000,
  });
}

export function useNextVehicleCode(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'next-code'],
    queryFn: () => vehicleService.nextCode(),
    enabled,
    staleTime: 0,
  });
}

export function useCanManageMaintenance() {
  return useQuery({
    queryKey: [KEY, 'maintenance-permissions'],
    queryFn: () => vehicleService.maintenancePermissions(),
    staleTime: 5 * 60_000,
  });
}

export function useVehicles(params?: VehiclesQuery) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => vehicleService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useVehicle(id: number | null) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => vehicleService.get(id!),
    enabled: id !== null,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Every mutation invalidates the broad vehicle prefix so list, detail and stats
 * refresh together, plus the driver prefix because the pairing is shared state
 * (ADR-024 — one canonical key per entity, invalidate the covering prefix).
 */
function useVehicleMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [DRIVER_KEY] });
    },
  });
}

export function useCreateVehicle() {
  return useVehicleMutation((payload: VehiclePayload) => vehicleService.create(payload));
}

export function useUpdateVehicle() {
  return useVehicleMutation(({ id, payload }: { id: number; payload: Partial<VehiclePayload> }) =>
    vehicleService.update(id, payload),
  );
}

export function useSetVehicleStatus() {
  return useVehicleMutation(({ id, status, reason }: { id: number; status: VehicleStatus; reason?: string }) =>
    vehicleService.setStatus(id, status, reason),
  );
}

export function useUploadVehicleDocument() {
  return useVehicleMutation(({ vehicleId, form }: { vehicleId: number; form: FormData }) =>
    vehicleService.uploadDocument(vehicleId, form),
  );
}

export function useDeleteVehicleDocument() {
  return useVehicleMutation(({ vehicleId, documentId }: { vehicleId: number; documentId: number }) =>
    vehicleService.deleteDocument(vehicleId, documentId),
  );
}

export function useRecordMaintenance() {
  return useVehicleMutation(({ vehicleId, payload }: { vehicleId: number; payload: MaintenancePayload }) =>
    vehicleService.recordMaintenance(vehicleId, payload),
  );
}

export function useAmendMaintenance() {
  return useVehicleMutation(
    ({ vehicleId, recordId, payload }: { vehicleId: number; recordId: number; payload: Partial<MaintenancePayload> }) =>
      vehicleService.amendMaintenance(vehicleId, recordId, payload),
  );
}

export function useDeleteMaintenance() {
  return useVehicleMutation(({ vehicleId, recordId }: { vehicleId: number; recordId: number }) =>
    vehicleService.deleteMaintenance(vehicleId, recordId),
  );
}
