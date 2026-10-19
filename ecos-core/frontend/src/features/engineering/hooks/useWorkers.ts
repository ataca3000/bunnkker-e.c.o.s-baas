import { useCallback, useEffect, useState } from 'react';
import { clusterService } from '../services/cluster-service';
import type { EngineeringWorker, WorkerSession } from '../types/engineering';
import { useToast } from '@/components/ds/use-toast';

interface WorkersState {
  workers: EngineeringWorker[];
  total: number;
  page: number;
  lastPage: number;
  loading: boolean;
  error: string | null;
  selectedWorker: EngineeringWorker | null;
  workerSessions: WorkerSession[];
}

export function useWorkers() {
  const [state, setState] = useState<WorkersState>({
    workers: [], total: 0, page: 1, lastPage: 1,
    loading: true, error: null, selectedWorker: null, workerSessions: [],
  });
  const [filters, setFilters] = useState<{ status?: string; worker_type?: string }>({});
  const { toast } = useToast();

  const load = useCallback(async (page = 1) => {
    setState(s => ({ ...s, loading: true }));
    try {
      const res = await clusterService.listWorkers({ ...filters, page, per_page: 25 });
      setState(s => ({ ...s, workers: res.data, total: res.meta.total, page: res.meta.page, lastPage: res.meta.last_page, loading: false, error: null }));
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Failed to load workers' }));
    }
  }, [filters]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const selectWorker = useCallback(async (worker: EngineeringWorker | null) => {
    setState(s => ({ ...s, selectedWorker: worker, workerSessions: [] }));
    if (!worker) return;
    try {
      const res = await clusterService.getWorkerSessions(worker.id);
      setState(s => ({ ...s, workerSessions: res.data }));
    } catch { /* expected: worker may not have sessions yet */ }
  }, []);

  const startWorker = useCallback(async (id: string) => {
    try {
      const w = await clusterService.startWorker(id);
      setState(s => ({ ...s, workers: s.workers.map(x => x.id === id ? w : x), selectedWorker: s.selectedWorker?.id === id ? w : s.selectedWorker }));
      toast({ title: 'Worker started' });
    } catch { toast({ title: 'Failed to start worker', variant: 'destructive' }); }
  }, [toast]);

  const stopWorker = useCallback(async (id: string) => {
    try {
      await clusterService.stopWorker(id);
      await load(state.page);
      toast({ title: 'Worker stopped' });
    } catch { toast({ title: 'Failed to stop worker', variant: 'destructive' }); }
  }, [load, state.page, toast]);

  const drainWorker = useCallback(async (id: string) => {
    try {
      await clusterService.drainWorker(id);
      await load(state.page);
      toast({ title: 'Worker draining' });
    } catch { toast({ title: 'Failed to drain worker', variant: 'destructive' }); }
  }, [load, state.page, toast]);

  const destroyWorker = useCallback(async (id: string) => {
    try {
      await clusterService.destroyWorker(id);
      setState(s => ({ ...s, workers: s.workers.filter(x => x.id !== id), selectedWorker: s.selectedWorker?.id === id ? null : s.selectedWorker }));
      toast({ title: 'Worker destroyed' });
    } catch { toast({ title: 'Failed to destroy worker', variant: 'destructive' }); }
  }, [toast]);

  const recoverWorker = useCallback(async (id: string) => {
    try {
      await clusterService.recoverWorker(id);
      await load(state.page);
      toast({ title: 'Worker recovered' });
    } catch { toast({ title: 'Failed to recover worker', variant: 'destructive' }); }
  }, [load, state.page, toast]);

  return {
    ...state,
    filters, setFilters,
    load, selectWorker,
    startWorker, stopWorker, drainWorker, destroyWorker, recoverWorker,
  };
}
