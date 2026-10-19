import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type { Team, TeamPayload, TeamsQuery, TeamsResult } from '@/features/teams/types/team';

export const teamsService = {
  async list(params: TeamsQuery): Promise<TeamsResult> {
    const { data } = await api.get<ApiResponse<TeamsResult>>('/teams', { params });
    return data.data;
  },

  async get(id: string): Promise<Team> {
    const { data } = await api.get<ApiResponse<Team>>(`/teams/${id}`);
    return data.data;
  },

  async create(payload: TeamPayload): Promise<Team> {
    const { data } = await api.post<ApiResponse<Team>>('/teams', payload);
    return data.data;
  },

  async update(id: string, payload: Omit<TeamPayload, 'company_id'>): Promise<Team> {
    const { data } = await api.put<ApiResponse<Team>>(`/teams/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/teams/${id}`);
  },
};
