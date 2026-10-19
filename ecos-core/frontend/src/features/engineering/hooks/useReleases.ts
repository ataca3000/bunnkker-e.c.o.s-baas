import { useCallback, useEffect, useState } from 'react';
import { releaseService } from '../services/release-service';
import type { EngineeringRelease, ReleaseDashboard } from '../types/engineering';
import { useToast } from '@/components/ds/use-toast';

interface ReleasesState {
  releases: EngineeringRelease[];
  total: number;
  page: number;
  lastPage: number;
  loading: boolean;
  error: string | null;
  dashboard: ReleaseDashboard | null;
  dashboardLoading: boolean;
  selectedRelease: EngineeringRelease | null;
}

export function useReleases() {
  const [state, setState] = useState<ReleasesState>({
    releases: [], total: 0, page: 1, lastPage: 1,
    loading: true, error: null,
    dashboard: null, dashboardLoading: true,
    selectedRelease: null,
  });
  const [filters, setFilters] = useState<{ status?: string; search?: string }>({});
  const { toast } = useToast();

  const loadDashboard = useCallback(async () => {
    try {
      const data = await releaseService.getDashboard();
      setState(s => ({ ...s, dashboard: data, dashboardLoading: false }));
    } catch {
      setState(s => ({ ...s, dashboardLoading: false }));
    }
  }, []);

  const load = useCallback(async (page = 1) => {
    setState(s => ({ ...s, loading: true }));
    try {
      const res = await releaseService.list({ ...filters, page, per_page: 20 });
      setState(s => ({ ...s, releases: res.data, total: res.meta.total, page: res.meta.page, lastPage: res.meta.last_page, loading: false, error: null }));
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Failed to load releases' }));
    }
  }, [filters]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); loadDashboard(); }, [load, loadDashboard]);

  const selectRelease = useCallback(async (release: EngineeringRelease | null) => {
    if (!release) { setState(s => ({ ...s, selectedRelease: null })); return; }
    try {
      const full = await releaseService.get(release.id);
      setState(s => ({ ...s, selectedRelease: full }));
    } catch {
      setState(s => ({ ...s, selectedRelease: release }));
    }
  }, []);

  const createRelease = useCallback(async (data: Parameters<typeof releaseService.create>[0]) => {
    try {
      const r = await releaseService.create(data);
      await load(state.page);
      await loadDashboard();
      toast({ title: 'Release created', description: r.name });
      return r;
    } catch { toast({ title: 'Failed to create release', variant: 'destructive' }); return null; }
  }, [load, loadDashboard, state.page, toast]);

  const transition = useCallback(async (id: string, status: string, reason?: string) => {
    try {
      const r = await releaseService.transition(id, status, reason);
      setState(s => ({
        ...s,
        releases: s.releases.map(x => x.id === id ? r : x),
        selectedRelease: s.selectedRelease?.id === id ? r : s.selectedRelease,
      }));
      toast({ title: 'Status updated', description: status });
      await loadDashboard();
      return r;
    } catch { toast({ title: 'Transition failed', variant: 'destructive' }); return null; }
  }, [loadDashboard, toast]);

  const runValidation = useCallback(async (id: string) => {
    try {
      const result = await releaseService.validate(id);
      toast({ title: 'Validation complete', description: `Score: ${result.readiness.overall}%` });
      return result;
    } catch { toast({ title: 'Validation failed', variant: 'destructive' }); return null; }
  }, [toast]);

  const generateReports = useCallback(async (id: string) => {
    try {
      const reports = await releaseService.generateReports(id);
      toast({ title: `${reports.length} reports generated` });
      return reports;
    } catch { toast({ title: 'Report generation failed', variant: 'destructive' }); return null; }
  }, [toast]);

  const triggerPipeline = useCallback(async (id: string) => {
    try {
      const run = await releaseService.triggerPipeline(id);
      toast({ title: 'Pipeline triggered', description: run.pipeline_run_id ?? '' });
      await load(state.page);
      return run;
    } catch { toast({ title: 'Pipeline trigger failed', variant: 'destructive' }); return null; }
  }, [load, state.page, toast]);

  return {
    ...state,
    filters, setFilters,
    load, loadDashboard, selectRelease,
    createRelease, transition, runValidation, generateReports, triggerPipeline,
  };
}
