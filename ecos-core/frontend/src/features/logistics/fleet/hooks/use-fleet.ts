import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fleetService } from '../services/fleet-service';
import type {
  CompleteWorkOrderPayload,
  FleetUnitLifecycle,
  FleetUnitsQuery,
  FuelCapturePayload,
  InspectionAnswer,
  InspectionKind,
  MaintenancePlanPayload,
  OdometerSource,
  RegisterUnitPayload,
} from '../types/fleet';

const KEY = 'logistics-fleet';
/**
 * LOG-003 owns vehicle identity and status. Fleet mutations can move a vehicle
 * off the road through VehicleService, so the vehicle prefix goes stale too
 * (ADR-024 — invalidate the covering prefix).
 */
const VEHICLE_KEY = 'logistics-vehicles';

// ── Queries ──────────────────────────────────────────────────────────────────

/** Enum catalogue — cached hard, it only changes on deploy. */
export function useFleetOptions() {
  return useQuery({
    queryKey: [KEY, 'options'],
    queryFn: () => fleetService.options(),
    staleTime: Infinity,
  });
}

export function useFleetStats() {
  return useQuery({
    queryKey: [KEY, 'stats'],
    queryFn: () => fleetService.stats(),
    staleTime: 30_000,
  });
}

export function useFleetUnits(params?: FleetUnitsQuery) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => fleetService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useFleetUnit(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => fleetService.get(id!),
    enabled: id !== null,
  });
}

export function useFitness(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'fitness', id],
    queryFn: () => fleetService.fitness(id!),
    enabled: id !== null,
  });
}

export function useHealth(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'health', id],
    queryFn: () => fleetService.health(id!),
    enabled: id !== null,
  });
}

export function useOdometerHistory(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'odometer', id],
    queryFn: () => fleetService.odometerHistory(id!),
    enabled: id !== null,
  });
}

export function useMaintenancePlans(unitId: string | null) {
  return useQuery({
    queryKey: [KEY, 'plans', unitId],
    queryFn: () => fleetService.plans(unitId!),
    enabled: unitId !== null,
  });
}

export function useWorkOrders(params?: { status?: string; open_only?: boolean; page?: number }) {
  return useQuery({
    queryKey: [KEY, 'work-orders', params],
    queryFn: () => fleetService.workOrders(params),
    placeholderData: keepPreviousData,
  });
}

export function useInspections(unitId: string | null) {
  return useQuery({
    queryKey: [KEY, 'inspections', unitId],
    queryFn: () => fleetService.inspections(unitId!),
    enabled: unitId !== null,
  });
}

export function useInspectionTemplates(kind?: InspectionKind) {
  return useQuery({
    queryKey: [KEY, 'templates', kind],
    queryFn: () => fleetService.templates(kind),
    staleTime: 5 * 60_000,
  });
}

export function useDefects(params?: {
  severity?: string;
  outstanding_only?: boolean;
  page?: number;
}) {
  return useQuery({
    queryKey: [KEY, 'defects', params],
    queryFn: () => fleetService.defects(params),
    placeholderData: keepPreviousData,
  });
}

export function useFuelTransactions(params?: {
  status?: string;
  anomalies_only?: boolean;
  page?: number;
}) {
  return useQuery({
    queryKey: [KEY, 'fuel', params],
    queryFn: () => fleetService.fuelTransactions(params),
    placeholderData: keepPreviousData,
  });
}

export function useFuelEfficiency(unitId: string | null) {
  return useQuery({
    queryKey: [KEY, 'efficiency', unitId],
    queryFn: () => fleetService.efficiency(unitId!),
    enabled: unitId !== null,
  });
}

export function useUnitCosts(unitId: string | null) {
  return useQuery({
    queryKey: [KEY, 'costs', unitId],
    queryFn: () => fleetService.costs(unitId!),
    enabled: unitId !== null,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Every mutation invalidates the broad fleet prefix so list, detail, fitness,
 * health and stats refresh together (ADR-024), plus the vehicle prefix because
 * completing immobilising work moves VehicleStatus through LOG-003's service.
 */
function useFleetMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [VEHICLE_KEY] });
    },
  });
}

export function useRegisterUnit() {
  return useFleetMutation((payload: RegisterUnitPayload) => fleetService.register(payload));
}

export function useSetLifecycle() {
  return useFleetMutation(
    ({ id, state, reason }: { id: string; state: FleetUnitLifecycle; reason?: string }) =>
      fleetService.setLifecycle(id, state, reason),
  );
}

export function useRecordOdometer() {
  return useFleetMutation(
    ({ id, readingKm, source }: { id: string; readingKm: number; source?: OdometerSource }) =>
      fleetService.recordOdometer(id, readingKm, source),
  );
}

export function useCreatePlan() {
  return useFleetMutation(({ unitId, payload }: { unitId: string; payload: MaintenancePlanPayload }) =>
    fleetService.createPlan(unitId, payload),
  );
}

export function useCreateWorkOrder() {
  return useFleetMutation(
    ({ unitId, payload }: { unitId: string; payload: Record<string, unknown> }) =>
      fleetService.createWorkOrder(unitId, payload),
  );
}

export function useScheduleWorkOrder() {
  return useFleetMutation(
    ({ id, scheduledFor, vendor }: { id: string; scheduledFor: string; vendor?: string }) =>
      fleetService.scheduleWorkOrder(id, scheduledFor, vendor),
  );
}

export function useStartWorkOrder() {
  return useFleetMutation(({ id, odometerKm }: { id: string; odometerKm: number }) =>
    fleetService.startWorkOrder(id, odometerKm),
  );
}

/** Writes the V1 maintenance record through LOG-003's service. */
export function useCompleteWorkOrder() {
  return useFleetMutation(({ id, payload }: { id: string; payload: CompleteWorkOrderPayload }) =>
    fleetService.completeWorkOrder(id, payload),
  );
}

export function useCancelWorkOrder() {
  return useFleetMutation(({ id, reason }: { id: string; reason: string }) =>
    fleetService.cancelWorkOrder(id, reason),
  );
}

export function useStartInspection() {
  return useFleetMutation(
    ({
      unitId,
      templateId,
      kind,
      odometerKm,
    }: {
      unitId: string;
      templateId: string;
      kind: InspectionKind;
      odometerKm?: number;
    }) => fleetService.startInspection(unitId, templateId, kind, odometerKm),
  );
}

export function useSubmitInspection() {
  return useFleetMutation(
    ({
      unitId,
      id,
      answers,
    }: {
      unitId: string;
      id: string;
      answers: Record<string, InspectionAnswer>;
    }) => fleetService.submitInspection(unitId, id, answers),
  );
}

export function useApproveInspection() {
  return useFleetMutation(({ unitId, id }: { unitId: string; id: string }) =>
    fleetService.approveInspection(unitId, id),
  );
}

export function useRejectInspection() {
  return useFleetMutation(({ unitId, id, reason }: { unitId: string; id: string; reason: string }) =>
    fleetService.rejectInspection(unitId, id, reason),
  );
}

export function useReportDefect() {
  return useFleetMutation(
    ({ unitId, payload }: { unitId: string; payload: { title: string; severity: string; description?: string } }) =>
      fleetService.reportDefect(unitId, payload),
  );
}

export function useResolveDefect() {
  return useFleetMutation((id: string) => fleetService.resolveDefect(id));
}

export function useAcknowledgeDefect() {
  return useFleetMutation((id: string) => fleetService.acknowledgeDefect(id));
}

export function useCaptureFuel() {
  return useFleetMutation(({ unitId, payload }: { unitId: string; payload: FuelCapturePayload }) =>
    fleetService.captureFuel(unitId, payload),
  );
}

export function useReconcileFuel() {
  return useFleetMutation((id: string) => fleetService.reconcileFuel(id));
}

// ── Fuel review, inspection detail and plan reprojection ─────────────────────

export function useFuelTransaction(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'fuel-transaction', id],
    queryFn: () => fleetService.fuelTransaction(id as string),
    enabled: id !== null,
  });
}

export function useInspection(unitId: string | null, id: string | null) {
  return useQuery({
    queryKey: [KEY, 'inspection', unitId, id],
    queryFn: () => fleetService.inspection(unitId as string, id as string),
    enabled: unitId !== null && id !== null,
  });
}

export function useDisputeFuel() {
  return useFleetMutation(({ id, reason }: { id: string; reason: string }) =>
    fleetService.disputeFuel(id, reason),
  );
}

export function useRejectFuel() {
  return useFleetMutation(({ id, reason }: { id: string; reason: string }) =>
    fleetService.rejectFuel(id, reason),
  );
}

export function useWriteOffFuel() {
  return useFleetMutation(({ id, reason }: { id: string; reason: string }) =>
    fleetService.writeOffFuel(id, reason),
  );
}

export function useReprojectMaintenancePlan() {
  return useFleetMutation(({ unitId, planId }: { unitId: string; planId: string }) =>
    fleetService.reprojectMaintenancePlan(unitId, planId),
  );
}
