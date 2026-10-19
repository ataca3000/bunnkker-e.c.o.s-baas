import { api as axios } from "@/lib/axios";
import type {
  RepairSession,
  RepairDashboard,
  RepairPrompt,
  RepairResponse,
  RepairPatch,
  RepairClaudePackage,
  RepairSessionPage,
  RepairHistory,
} from "../types/engineering";

const API_BASE = "/system/engineering/repair";

export const repairService = {
  async getDashboard(): Promise<RepairDashboard> {
    const r = await axios.get(`${API_BASE}/dashboard`);
    return r.data.data;
  },

  async getSessions(params?: {
    status?: string;
    failure_type?: string;
    search?: string;
    per_page?: number;
  }): Promise<RepairSessionPage> {
    const r = await axios.get(`${API_BASE}/sessions`, { params });
    return r.data.data;
  },

  async createSession(data: {
    source_type: string;
    source_id?: string;
    failure_type: string;
    failure_summary: string;
    failure_context?: Record<string, unknown>;
  }): Promise<RepairSession> {
    const r = await axios.post(`${API_BASE}/sessions`, data);
    return r.data.data;
  },

  async getSession(id: string): Promise<RepairSession> {
    const r = await axios.get(`${API_BASE}/sessions/${id}`);
    return r.data.data;
  },

  async deleteSession(id: string): Promise<{ deleted: boolean }> {
    const r = await axios.delete(`${API_BASE}/sessions/${id}`);
    return r.data.data;
  },

  async analyzeSession(id: string): Promise<RepairSession> {
    const r = await axios.post(`${API_BASE}/sessions/${id}/analyze`);
    return r.data.data;
  },

  async generatePrompt(id: string): Promise<RepairClaudePackage> {
    const r = await axios.post(`${API_BASE}/sessions/${id}/generate-prompt`);
    return r.data.data;
  },

  async getPromptPackage(id: string): Promise<RepairClaudePackage> {
    const r = await axios.get(`${API_BASE}/sessions/${id}/prompt-package`);
    return r.data.data;
  },

  async submitResponse(
    id: string,
    data: { response_content: string; response_type: string },
  ): Promise<RepairSession> {
    const r = await axios.post(`${API_BASE}/sessions/${id}/response`, data);
    return r.data.data;
  },

  async applyPatch(id: string, patchId: string): Promise<RepairSession> {
    const r = await axios.post(
      `${API_BASE}/sessions/${id}/patches/${patchId}/apply`,
    );
    return r.data.data;
  },

  async completeSession(id: string): Promise<RepairSession> {
    const r = await axios.post(`${API_BASE}/sessions/${id}/complete`);
    return r.data.data;
  },

  async failSession(id: string, reason: string): Promise<RepairSession> {
    const r = await axios.post(`${API_BASE}/sessions/${id}/fail`, { reason });
    return r.data.data;
  },

  async cancelSession(id: string): Promise<RepairSession> {
    const r = await axios.post(`${API_BASE}/sessions/${id}/cancel`);
    return r.data.data;
  },

  async retrySession(
    id: string,
  ): Promise<{ retried: boolean; retry_count: number }> {
    const r = await axios.post(`${API_BASE}/sessions/${id}/retry`);
    return r.data.data;
  },

  async getHistory(id: string): Promise<RepairHistory[]> {
    const r = await axios.get(`${API_BASE}/sessions/${id}/history`);
    return r.data.data;
  },

  async getActivePrompt(sessionId: string): Promise<RepairPrompt> {
    const r = await axios.get(
      `${API_BASE}/sessions/${sessionId}/prompts/active`,
    );
    return r.data.data;
  },

  async markPromptSent(
    sessionId: string,
    promptId: string,
  ): Promise<RepairPrompt> {
    const r = await axios.post(
      `${API_BASE}/sessions/${sessionId}/prompts/${promptId}/mark-sent`,
    );
    return r.data.data;
  },

  async getResponses(sessionId: string): Promise<RepairResponse[]> {
    const r = await axios.get(`${API_BASE}/sessions/${sessionId}/responses`);
    return r.data.data;
  },

  async reviewResponse(
    sessionId: string,
    responseId: number,
    decision: string,
  ): Promise<RepairResponse> {
    const r = await axios.post(
      `${API_BASE}/sessions/${sessionId}/responses/${responseId}/review`,
      { decision },
    );
    return r.data.data;
  },

  async getPatches(sessionId: string): Promise<RepairPatch[]> {
    const r = await axios.get(`${API_BASE}/sessions/${sessionId}/patches`);
    return r.data.data;
  },
};
