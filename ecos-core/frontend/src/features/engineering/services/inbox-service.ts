import { api } from '@/lib/axios';
import type {
  EngineeringTask, TaskComment, TaskAttachment, TaskDependency,
  EngineeringReleaseCandidate, InboxKPIs, PaginatedResponse
} from '../types/engineering';

export const inboxService = {

  // Tasks
  async listTasks(params: {
    page?: number; perPage?: number; status?: string | string[]; priority?: number;
    assigned_agent_id?: string; search?: string; overdue?: boolean; label_id?: string;
  } = {}): Promise<PaginatedResponse<EngineeringTask>> {
    const res = await api.get('/system/engineering/inbox/tasks', { params: { ...params, per_page: params.perPage } });
    return { data: res.data.data.data, meta: res.data.data.meta };
  },

  async getTask(id: string): Promise<EngineeringTask> {
    const res = await api.get('/system/engineering/inbox/tasks/' + id);
    return res.data.data;
  },

  async createTask(data: { title: string; description?: string; priority?: number; source_type?: string; source_ref?: string; deadline?: string; label_ids?: string[] }): Promise<EngineeringTask> {
    const res = await api.post('/system/engineering/inbox/tasks', data);
    return res.data.data;
  },

  async updateTask(id: string, data: Partial<{ title: string; description: string; priority: number; deadline: string; max_retries: number }>): Promise<EngineeringTask> {
    const res = await api.put('/system/engineering/inbox/tasks/' + id, data);
    return res.data.data;
  },

  async deleteTask(id: string): Promise<void> {
    await api.delete('/system/engineering/inbox/tasks/' + id);
  },

  async transitionTask(id: string, status: string, reason?: string): Promise<EngineeringTask> {
    const res = await api.post('/system/engineering/inbox/tasks/' + id + '/transition', { status, reason });
    return res.data.data;
  },

  async getKPIs(): Promise<InboxKPIs> {
    const res = await api.get('/system/engineering/inbox/kpis');
    return res.data.data;
  },

  // Comments
  async listComments(taskId: string): Promise<TaskComment[]> {
    const res = await api.get('/system/engineering/inbox/tasks/' + taskId + '/comments');
    return res.data.data.data;
  },

  async createComment(taskId: string, body: string, isInternal?: boolean): Promise<TaskComment> {
    const res = await api.post('/system/engineering/inbox/tasks/' + taskId + '/comments', { body, is_internal: isInternal });
    return res.data.data;
  },

  async updateComment(commentId: string, body: string): Promise<TaskComment> {
    const res = await api.put('/system/engineering/inbox/comments/' + commentId, { body });
    return res.data.data;
  },

  async deleteComment(commentId: string): Promise<void> {
    await api.delete('/system/engineering/inbox/comments/' + commentId);
  },

  // Attachments
  async uploadAttachment(taskId: string, file: File): Promise<TaskAttachment> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post('/system/engineering/inbox/tasks/' + taskId + '/attachments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.data;
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    await api.delete('/system/engineering/inbox/attachments/' + attachmentId);
  },

  // Dependencies
  async listDependencies(taskId: string): Promise<TaskDependency[]> {
    const res = await api.get('/system/engineering/inbox/tasks/' + taskId + '/dependencies');
    return res.data.data.data;
  },

  async createDependency(taskId: string, dependsOnTaskId: string, type = 'blocks'): Promise<TaskDependency> {
    const res = await api.post('/system/engineering/inbox/tasks/' + taskId + '/dependencies', { depends_on_task_id: dependsOnTaskId, dependency_type: type });
    return res.data.data;
  },

  async deleteDependency(dependencyId: string): Promise<void> {
    await api.delete('/system/engineering/inbox/dependencies/' + dependencyId);
  },

  // Release Candidates
  async listReleaseCandidates(params: { page?: number; status?: string } = {}): Promise<PaginatedResponse<EngineeringReleaseCandidate>> {
    const res = await api.get('/system/engineering/inbox/release-candidates', { params });
    return { data: res.data.data.data, meta: res.data.data.meta };
  },

  async getReleaseCandidate(id: string): Promise<EngineeringReleaseCandidate> {
    const res = await api.get('/system/engineering/inbox/release-candidates/' + id);
    return res.data.data;
  },

  async createReleaseCandidate(data: { title: string; description?: string; task_ids?: string[] }): Promise<EngineeringReleaseCandidate> {
    const res = await api.post('/system/engineering/inbox/release-candidates', data);
    return res.data.data;
  },

  async transitionReleaseCandidate(id: string, status: string, reason?: string): Promise<EngineeringReleaseCandidate> {
    const res = await api.post('/system/engineering/inbox/release-candidates/' + id + '/transition', { status, reason });
    return res.data.data;
  },
};
