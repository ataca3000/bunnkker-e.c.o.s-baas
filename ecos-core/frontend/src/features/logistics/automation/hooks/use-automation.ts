import { useQuery } from '@tanstack/react-query';

import { automationService } from '../services/automation-service';

const KEY = 'logistics-automation';

export function useAutomationPolicies() {
  return useQuery({
    queryKey: [KEY, 'policies'],
    queryFn: () => automationService.policies(),
    staleTime: 5 * 60_000,
  });
}

export function useAutomationMonitoring() {
  return useQuery({
    queryKey: [KEY, 'monitoring'],
    queryFn: () => automationService.monitoring(),
  });
}

/** Metrics are company-scoped from the token and change with operations. */
export function useAutomationMetrics() {
  return useQuery({
    queryKey: [KEY, 'metrics'],
    queryFn: () => automationService.metrics(),
    staleTime: 30_000,
  });
}
