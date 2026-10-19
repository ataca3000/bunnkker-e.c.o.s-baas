import { api } from '@/lib/axios';
import type { EngineeringAgent, ExecutionSession, ExecutionArtifact, AgentDashboard, PaginatedResponse } from '../types/engineering';

export const agentService = {

  // Agents
  async getDashboard(): Promise<AgentDashboard> {
    const res = await api.get('/system/engineering/agents/dashboard');
    return res.data.data;
  },

  async listAgents(params: { page?: number; status?: string } = {}): Promise<PaginatedResponse<EngineeringAgent>> {
    const res = await api.get('/system/engineering/agents', { params });
    return { data: res.data.data.data, meta: res.data.data.meta };
  },

  async getAgent(id: string): Promise<EngineeringAgent> {
    const res = await api.get('/system/engineering/agents/' + id);
    return res.data.data;
  },

  async deregisterAgent(id: string): Promise<void> {
    await api.post('/system/engineering/agents/' + id + '/deregister');
  },

  // Sessions
  async listSessions(params: { page?: number; status?: string; agent_id?: string; task_id?: string } = {}): Promise<PaginatedResponse<ExecutionSession>> {
    const res = await api.get('/system/engineering/sessions', { params });
    return { data: res.data.data.data, meta: res.data.data.meta };
  },

  async getSession(id: string): Promise<ExecutionSession> {
    const res = await api.get('/system/engineering/sessions/' + id);
    return res.data.data;
  },

  async getSessionArtifacts(sessionId: string): Promise<ExecutionArtifact[]> {
    const res = await api.get('/system/engineering/sessions/' + sessionId + '/artifacts');
    return res.data.data.data;
  },

  async abortSession(sessionId: string): Promise<ExecutionSession> {
    const res = await api.post('/system/engineering/sessions/' + sessionId + '/abort');
    return res.data.data;
  },
};
