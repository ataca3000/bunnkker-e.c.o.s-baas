import { useState, useEffect, useCallback, useRef } from 'react';
import { agentService } from '../services/agent-service';
import type { EngineeringAgent, AgentDashboard, ExecutionSession } from '../types/engineering';
import { useToast } from '@/components/ds/use-toast';

export function useAgentDashboard(autoRefreshSeconds = 15) {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<AgentDashboard | null>(null);
  const [agents, setAgents] = useState<EngineeringAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, agentResult] = await Promise.all([
        agentService.getDashboard(),
        agentService.listAgents({ page: 1 }),
      ]);
      setDashboard(dash);
      setAgents(agentResult.data);
    } catch { toast({ title: 'Failed to load agent data', variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    intervalRef.current = setInterval(load, autoRefreshSeconds * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load, autoRefreshSeconds]);

  return { dashboard, agents, loading, refresh: load };
}

export function useExecutionSession(sessionId: string | null, autoRefreshSeconds = 5) {
  const [session, setSession] = useState<ExecutionSession | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await agentService.getSession(sessionId);
      setSession(s);
      if (s.status === 'completed' || s.status === 'failed' || s.status === 'aborted') {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch { /* silent */ }
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    if (sessionId) {
      intervalRef.current = setInterval(load, autoRefreshSeconds * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load, sessionId, autoRefreshSeconds]);

  return { session, refresh: load };
}
