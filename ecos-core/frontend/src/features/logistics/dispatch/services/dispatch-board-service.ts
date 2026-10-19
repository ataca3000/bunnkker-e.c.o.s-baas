import { api } from '@/lib/axios';
import type {
  DispatchBoard,
  DispatchBoardOptions,
  DispatchProposal,
  OverrideAssignmentPayload,
  ProposePayload,
  ResourcePool,
  SetBoardStatusPayload,
} from '../types/dispatch-board';

const BASE = '/logistics/dispatch';

/**
 * Dispatch boards and proposals.
 *
 * Four permissions guard this surface and they are not interchangeable:
 * dispatch.view reads, dispatch.manage opens and moves boards,
 * dispatch.propose generates and rejects proposals and overrides individual
 * assignments, dispatch.release accepts a proposal and commits it. Accepting
 * and releasing are deliberately separate — releasing puts vehicles and
 * drivers on trips.
 */
export const dispatchBoardService = {
  async options(): Promise<DispatchBoardOptions> {
    const { data } = await api.get<DispatchBoardOptions>(`${BASE}/options`);
    return data;
  },

  async board(id: string): Promise<DispatchBoard> {
    const { data } = await api.get<{ data: DispatchBoard }>(`${BASE}/boards/${id}`);
    return data.data;
  },

  async setBoardStatus(id: string, payload: SetBoardStatusPayload): Promise<DispatchBoard> {
    const { data } = await api.patch<{ data: DispatchBoard }>(
      `${BASE}/boards/${id}/status`,
      payload,
    );
    return data.data;
  },

  /** What is available to dispatch right now, with the backend's own counts. */
  async resourcePool(): Promise<ResourcePool> {
    const { data } = await api.get<{ data: ResourcePool }>(`${BASE}/resource-pool`);
    return data.data;
  },

  /**
   * Generates a proposal for the board. The policy is optional; omitted, the
   * backend applies its default rather than the client choosing one.
   */
  async propose(boardId: string, payload: ProposePayload): Promise<DispatchProposal> {
    const { data } = await api.post<{ data: DispatchProposal }>(
      `${BASE}/boards/${boardId}/propose`,
      payload,
    );
    return data.data;
  },

  async acceptProposal(id: string): Promise<DispatchProposal> {
    const { data } = await api.patch<{ data: DispatchProposal }>(`${BASE}/proposals/${id}/accept`);
    return data.data;
  },

  async rejectProposal(id: string, reason?: string): Promise<DispatchProposal> {
    const { data } = await api.patch<{ data: DispatchProposal }>(
      `${BASE}/proposals/${id}/reject`,
      { reason: reason ?? null },
    );
    return data.data;
  },

  /** Commits an accepted proposal. This is the step that moves resources. */
  async release(id: string): Promise<{ released: number } | DispatchProposal> {
    const { data } = await api.post<{ data: { released: number } | DispatchProposal }>(
      `${BASE}/proposals/${id}/release`,
    );
    return data.data;
  },

  /**
   * Replaces the vehicle or driver on one assignment. The reason is required
   * by the API: an override departs from the engine's ranking, and the record
   * of why is the only thing that makes that reviewable afterwards.
   */
  async overrideAssignment(id: string, payload: OverrideAssignmentPayload): Promise<unknown> {
    const { data } = await api.patch<{ data: unknown }>(
      `${BASE}/assignments/${id}/override`,
      payload,
    );
    return data.data;
  },
};
