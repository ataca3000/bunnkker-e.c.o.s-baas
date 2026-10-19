import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { analyticsService } from '../services/analytics-service';
import type { ActivitySeverity, ActivitySource } from '../types/analytics';

/**
 * Phase 5 read surfaces. All queries; nothing here mutates — the whole phase is
 * a window onto state Phases 1-4 own.
 */
const KEY = 'logistics-operations-analytics';

// ── Dashboards ───────────────────────────────────────────────────────────────

export function useFleetDashboard() {
  return useQuery({
    queryKey: [KEY, 'fleet'],
    queryFn: () => analyticsService.fleet(),
    refetchInterval: 30_000,
  });
}

export function useDriverDashboard() {
  return useQuery({
    queryKey: [KEY, 'drivers'],
    queryFn: () => analyticsService.drivers(),
    refetchInterval: 30_000,
  });
}

export function useCapacityDashboard(date?: string) {
  return useQuery({
    queryKey: [KEY, 'capacity', date],
    queryFn: () => analyticsService.capacity(date),
    staleTime: 30_000,
  });
}

export function useDispatchDashboard() {
  return useQuery({
    queryKey: [KEY, 'dispatch'],
    queryFn: () => analyticsService.dispatch(),
    refetchInterval: 30_000,
  });
}

export function useKpiDashboard(date?: string) {
  return useQuery({
    queryKey: [KEY, 'kpi', date],
    queryFn: () => analyticsService.kpi(date),
    refetchInterval: 30_000,
  });
}

// ── Activity & audit ─────────────────────────────────────────────────────────

export function useActivityOptions() {
  return useQuery({
    queryKey: [KEY, 'activity-options'],
    queryFn: () => analyticsService.activityOptions(),
    staleTime: Infinity,
  });
}

export function useActivityTimeline(params?: {
  source?: ActivitySource;
  severity?: ActivitySeverity;
  limit?: number;
}) {
  return useQuery({
    queryKey: [KEY, 'timeline', params],
    queryFn: () => analyticsService.timeline(params),
    placeholderData: keepPreviousData,
    // Activity moves while an operator watches it.
    refetchInterval: 30_000,
  });
}

export function useAuditExplorer(params?: { limit?: number }) {
  return useQuery({
    queryKey: [KEY, 'audit', params],
    queryFn: () => analyticsService.audit(params),
    placeholderData: keepPreviousData,
  });
}

// ── History ──────────────────────────────────────────────────────────────────

export function useAssignmentHistory(params?: { status?: string; mode?: string; page?: number }) {
  return useQuery({
    queryKey: [KEY, 'history-assignments', params],
    queryFn: () => analyticsService.assignmentHistory(params),
    placeholderData: keepPreviousData,
  });
}

export function useSessionHistory(params?: { status?: string; page?: number }) {
  return useQuery({
    queryKey: [KEY, 'history-sessions', params],
    queryFn: () => analyticsService.sessionHistory(params),
    placeholderData: keepPreviousData,
  });
}

export function useCapacityHistory(params?: { status?: string; page?: number }) {
  return useQuery({
    queryKey: [KEY, 'history-capacity', params],
    queryFn: () => analyticsService.capacityHistory(params),
    placeholderData: keepPreviousData,
  });
}
