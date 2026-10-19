import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { metaConnectionService } from '../services/meta-connection-service';

// ── Query keys ────────────────────────────────────────────────────────────────

const keys = {
  dashboard:   (id: string) => ['meta-connection', id, 'dashboard'] as const,
  businesses:  (id: string) => ['meta-connection', id, 'businesses'] as const,
  permissions: (id: string) => ['meta-connection', id, 'permissions'] as const,
  recovery:    (id: string) => ['meta-connection', id, 'recovery'] as const,
  syncStatus:  (id: string) => ['meta-connection', id, 'sync-status'] as const,
  webhooks:    (id: string) => ['meta-connection', id, 'webhooks'] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useMetaConnectionDashboard(connectionId: string | undefined) {
  return useQuery({
    queryKey:        keys.dashboard(connectionId ?? ''),
    queryFn:         () => metaConnectionService.getDashboard(connectionId!),
    enabled:         !!connectionId,
    staleTime:       30_000,
    refetchInterval: 30_000,
  });
}

/**
 * Polls the lightweight sync-status endpoint with exponential backoff.
 *
 * While a sync is running, intervals follow: 2s → 3s → 4.5s → 6.75s → … → 30s.
 * When idle (no sync running), polls every 30s to detect scheduler-triggered syncs.
 *
 * On transition running → complete, automatically invalidates the businesses
 * and dashboard queries so the UI reflects the newly discovered assets.
 */
export function useSyncStatus(connectionId: string | undefined) {
  const qc              = useQueryClient();
  const pollAttemptRef  = useRef(0);
  const prevRunningRef  = useRef<boolean | undefined>(undefined);

  const query = useQuery({
    queryKey:  keys.syncStatus(connectionId ?? ''),
    queryFn:   () => metaConnectionService.getSyncStatus(connectionId!),
    enabled:   !!connectionId,
    staleTime: 5_000,
    refetchInterval: (q) => {
      const isRunning = q.state.data?.is_running ?? false;

      if (!isRunning) {
        pollAttemptRef.current = 0;
        return 30_000; // idle — slow check for scheduler-triggered syncs
      }

      // Sync is running — exponential backoff: 2s → 3s → 4.5s → … → 30s cap
      const delay = Math.min(2_000 * Math.pow(1.5, pollAttemptRef.current), 30_000);
      pollAttemptRef.current += 1;
      return delay;
    },
  });

  // Detect running → complete transition and refresh all data-dependent queries
  useEffect(() => {
    if (query.data === undefined || !connectionId) return;

    const isRunning = query.data.is_running;

    if (prevRunningRef.current === true && !isRunning) {
      qc.invalidateQueries({ queryKey: keys.businesses(connectionId) });
      qc.invalidateQueries({ queryKey: keys.dashboard(connectionId) });
      qc.invalidateQueries({ queryKey: keys.webhooks(connectionId) });
    }

    prevRunningRef.current = isRunning;
  }, [query.data?.is_running, connectionId, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}

/**
 * Returns discovered business accounts for this connection.
 *
 * No internal polling — the useSyncStatus hook drives invalidation when a
 * sync completes. Use useSyncStatus alongside this hook on any page that
 * shows businesses.
 */
export function useMetaBusinesses(connectionId: string | undefined) {
  return useQuery({
    queryKey:  keys.businesses(connectionId ?? ''),
    queryFn:   () => metaConnectionService.getBusinesses(connectionId!),
    enabled:   !!connectionId,
    staleTime: 10_000,
  });
}

export function useMetaPermissions(connectionId: string | undefined, enabled = false) {
  return useQuery({
    queryKey:  keys.permissions(connectionId ?? ''),
    queryFn:   () => metaConnectionService.getPermissions(connectionId!),
    enabled:   !!connectionId && enabled,
    staleTime: 60_000,
  });
}

export function useMetaRecovery(connectionId: string | undefined) {
  return useQuery({
    queryKey:  keys.recovery(connectionId ?? ''),
    queryFn:   () => metaConnectionService.getRecovery(connectionId!),
    enabled:   !!connectionId,
    staleTime: 30_000,
  });
}

export function useMetaTriggerSync(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => metaConnectionService.triggerSync(connectionId),
    onSuccess: () => {
      // Reset sync-status polling immediately so the new job is detected fast
      qc.invalidateQueries({ queryKey: keys.syncStatus(connectionId) });
      qc.invalidateQueries({ queryKey: keys.dashboard(connectionId) });
    },
  });
}

export function useMetaSelectBusinesses(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (businessIds: string[]) =>
      metaConnectionService.selectBusinesses(connectionId, businessIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.businesses(connectionId) });
    },
  });
}

export function useMetaDisconnect(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => metaConnectionService.disconnect(connectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-connections'] });
      qc.invalidateQueries({ queryKey: ['marketing-dashboard'] });
    },
  });
}

export function useVerifyMetaPermissions(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => metaConnectionService.getPermissions(connectionId),
    onSuccess: (data) => {
      qc.setQueryData(keys.permissions(connectionId), data);
    },
  });
}

export function useMetaWebhooks(connectionId: string | undefined) {
  return useQuery({
    queryKey:  keys.webhooks(connectionId ?? ''),
    queryFn:   () => metaConnectionService.getWebhooks(connectionId!),
    enabled:   !!connectionId,
    staleTime: 30_000,
  });
}

export function useRegisterAllWebhooks(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => metaConnectionService.registerAllWebhooks(connectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.webhooks(connectionId) });
      qc.invalidateQueries({ queryKey: keys.dashboard(connectionId) });
    },
  });
}

export function useRemoveWebhook(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => metaConnectionService.removeWebhook(webhookId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.webhooks(connectionId) });
      qc.invalidateQueries({ queryKey: keys.dashboard(connectionId) });
    },
  });
}

export function useReRegisterWebhook(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => metaConnectionService.reRegisterWebhook(webhookId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.webhooks(connectionId) });
    },
  });
}
