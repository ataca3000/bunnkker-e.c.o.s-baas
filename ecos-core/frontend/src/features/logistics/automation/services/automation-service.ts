import { api } from '@/lib/axios';
import type {
  AutomationMetrics,
  AutomationMonitoring,
  AutomationPolicy,
} from '../types/automation';

const BASE = '/logistics/automation';

/** Read-only. The API exposes no write for any of these. */
export const automationService = {
  async policies(): Promise<AutomationPolicy[]> {
    const { data } = await api.get<{ data: AutomationPolicy[] }>(`${BASE}/policies`);
    return data.data;
  },

  async monitoring(): Promise<AutomationMonitoring> {
    const { data } = await api.get<{ data: AutomationMonitoring }>(`${BASE}/monitoring`);
    return data.data;
  },

  async metrics(): Promise<AutomationMetrics> {
    const { data } = await api.get<{ data: AutomationMetrics }>(`${BASE}/metrics`);
    return data.data;
  },
};
