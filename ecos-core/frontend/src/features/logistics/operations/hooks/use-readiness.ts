import { useQuery } from '@tanstack/react-query';

import { readinessService } from '../services/readiness-service';

/**
 * Phase 6 read surfaces — all queries, nothing mutates. The enterprise readiness
 * layer is a window onto Phases 1-5.
 */
const KEY = 'logistics-operations-readiness';

export function useReadinessDashboard() {
  return useQuery({
    queryKey: [KEY, 'dashboard'],
    queryFn: () => readinessService.dashboard(),
    refetchInterval: 30_000,
  });
}

export function useHealthScore() {
  return useQuery({
    queryKey: [KEY, 'health-score'],
    queryFn: () => readinessService.healthScore(),
    refetchInterval: 30_000,
  });
}

export function useReadinessChecklist() {
  return useQuery({
    queryKey: [KEY, 'checklist'],
    queryFn: () => readinessService.checklist(),
    refetchInterval: 30_000,
  });
}

export function useValidationReport() {
  return useQuery({
    queryKey: [KEY, 'validate'],
    queryFn: () => readinessService.validate(),
    refetchInterval: 30_000,
  });
}

export function useDiagnostics() {
  return useQuery({
    queryKey: [KEY, 'diagnostics'],
    queryFn: () => readinessService.diagnostics(),
    refetchInterval: 30_000,
  });
}

export function useExecutiveSummary() {
  return useQuery({
    queryKey: [KEY, 'executive'],
    queryFn: () => readinessService.executive(),
    refetchInterval: 30_000,
  });
}

export function useTodaySummary() {
  return useQuery({
    queryKey: [KEY, 'today'],
    queryFn: () => readinessService.today(),
    staleTime: 30_000,
  });
}

export function useFleetSummary() {
  return useQuery({
    queryKey: [KEY, 'fleet-summary'],
    queryFn: () => readinessService.fleetSummary(),
    staleTime: 30_000,
  });
}

/**
 * The six granular diagnostics endpoints are deliberately not called.
 *
 * `GET /diagnostics` returns all six sections and computes the validation
 * report once; the standalone system/dependency endpoints each recompute it,
 * and the backend notes that doing so fires ReadinessValidated a second time.
 * Six extra calls would mean duplicate domain events on a read-only screen for
 * data the centre already returns.
 */
export function useReadinessModules() {
  return useQuery({
    queryKey: [KEY, 'modules'],
    queryFn: () => readinessService.modules(),
    refetchInterval: 60_000,
  });
}

export function useCapacitySummary() {
  return useQuery({
    queryKey: [KEY, 'summary', 'capacity'],
    queryFn: () => readinessService.capacitySummary(),
    refetchInterval: 60_000,
  });
}

export function useDispatchSummary() {
  return useQuery({
    queryKey: [KEY, 'summary', 'dispatch'],
    queryFn: () => readinessService.dispatchSummary(),
    refetchInterval: 60_000,
  });
}

export function useExceptionsSummary() {
  return useQuery({
    queryKey: [KEY, 'summary', 'exceptions'],
    queryFn: () => readinessService.exceptionsSummary(),
    refetchInterval: 60_000,
  });
}
