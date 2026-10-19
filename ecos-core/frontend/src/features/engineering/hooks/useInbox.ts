import { useState, useEffect, useCallback } from 'react';
import { inboxService } from '../services/inbox-service';
import type { EngineeringTask, InboxKPIs, PaginatedResponse } from '../types/engineering';
import { useToast } from '@/components/ds/use-toast';

interface InboxFilters {
  status?: string;
  priority?: number;
  search?: string;
  overdue?: boolean;
}

export function useInbox() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<EngineeringTask[]>([]);
  const [kpis, setKpis] = useState<InboxKPIs | null>(null);
  const [meta, setMeta] = useState<PaginatedResponse<EngineeringTask>['meta'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<InboxFilters>({});
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<EngineeringTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await inboxService.listTasks({ ...filters, page, perPage: 25 });
      setTasks(result.data);
      setMeta(result.meta);
    } catch { toast({ title: 'Failed to load tasks', variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [filters, page, toast]);

  const loadKpis = useCallback(async () => {
    try { setKpis(await inboxService.getKPIs()); } catch { /* silent */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTasks(); }, [loadTasks]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadKpis(); }, [loadKpis]);

  const openTask = useCallback(async (taskOrId: EngineeringTask | string) => {
    const id = typeof taskOrId === 'string' ? taskOrId : taskOrId.id;
    try {
      const task = await inboxService.getTask(id);
      setSelectedTask(task);
      setDrawerOpen(true);
    } catch { toast({ title: 'Failed to load task', variant: 'destructive' }); }
  }, [toast]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const createTask = useCallback(async (data: Parameters<typeof inboxService.createTask>[0]) => {
    const task = await inboxService.createTask(data);
    await loadTasks();
    await loadKpis();
    return task;
  }, [loadTasks, loadKpis]);

  const transition = useCallback(async (taskId: string, status: string, reason?: string) => {
    await inboxService.transitionTask(taskId, status, reason);
    await loadTasks();
    if (selectedTask?.id === taskId) {
      const updated = await inboxService.getTask(taskId);
      setSelectedTask(updated);
    }
    await loadKpis();
  }, [loadTasks, loadKpis, selectedTask]);

  return {
    tasks, kpis, meta, loading, filters, page,
    selectedTask, drawerOpen,
    setFilters, setPage,
    openTask, createTask, transition,
    closeDrawer: () => setDrawerOpen(false),
    refresh: () => { loadTasks(); loadKpis(); },
  };
}
