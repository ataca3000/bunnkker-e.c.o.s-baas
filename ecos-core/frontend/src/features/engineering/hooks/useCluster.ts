import { useCallback, useEffect, useRef, useState } from 'react';
import { clusterService } from '../services/cluster-service';
import type { ClusterDashboard, ClusterHealthReport } from '../types/engineering';
import { useToast } from '@/components/ds/use-toast';

export function useClusterDashboard(autoRefreshSeconds = 30) {
  const [dashboard, setDashboard]     = useState<ClusterDashboard | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const { toast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await clusterService.getDashboard();
      setDashboard(data);
      setError(null);
      setLastRefreshed(new Date());
    } catch {
      setError('Failed to load cluster dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch();
    intervalRef.current = setInterval(fetch, autoRefreshSeconds * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetch, autoRefreshSeconds]);

  const tick = useCallback(async () => {
    try {
      const result = await clusterService.tick();
      toast({ title: 'Tick complete', description: `Assigned: ${result.assigned}, Recovered: ${result.recovered}` });
      await fetch();
    } catch {
      toast({ title: 'Tick failed', variant: 'destructive' });
    }
  }, [fetch, toast]);

  const recoverStale = useCallback(async () => {
    try {
      const result = await clusterService.recoverStaleWorkers();
      toast({ title: `Recovered ${result.recovered} workers` });
      await fetch();
    } catch {
      toast({ title: 'Recovery failed', variant: 'destructive' });
    }
  }, [fetch, toast]);

  const purgeLocks = useCallback(async () => {
    try {
      await clusterService.purgeExpiredLocks();
      toast({ title: 'Expired locks purged' });
      await fetch();
    } catch {
      toast({ title: 'Purge failed', variant: 'destructive' });
    }
  }, [fetch, toast]);

  return { dashboard, loading, error, lastRefreshed, refresh: fetch, tick, recoverStale, purgeLocks };
}

export function useClusterHealth() {
  const [report, setReport] = useState<ClusterHealthReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clusterService.getHealthReport().then(setReport).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return { report, loading };
}
