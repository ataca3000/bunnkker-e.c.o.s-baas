import { api as axios } from '@/lib/axios';
import type { MarketingAsset } from '../types/marketing';

const BASE = '/marketing';

// ── Response shapes ───────────────────────────────────────────────────────────

export interface MetaConnectionDashboard {
  connection: {
    id: string;
    label: string;
    status: string;
    connected_at: string | null;
    last_synced_at: string | null;
    token_expires_at: string | null;
    external_account_id: string | null;
    connector_meta: Record<string, unknown> | null;
  };
  health: {
    status: string;
    checks: Record<string, unknown>;
  } | null;
  assets: {
    total: number;
    by_type: Record<string, number>;
  };
  webhooks: MetaWebhookSummary[];
  recent_syncs: MetaSyncSummary[];
  recent_events: MetaProviderEvent[];
  recent_errors: MetaSyncError[];
}

export interface MetaWebhookSummary {
  id: string;
  object_type: string;
  object_id: string | null;
  status: string;
  subscribed_fields: string[];
  verified_at: string | null;
  last_delivery_at: string | null;
  last_error: string | null;
  retry_count: number;
}

export interface MetaSyncSummary {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  assets_discovered: number | null;
  error_message: string | null;
}

export interface MetaProviderEvent {
  event_name: string;
  current_status: string | null;
  previous_status: string | null;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
}

export interface MetaSyncError {
  started_at: string;
  error_message: string;
  sync_type: string;
}

export interface MetaPermissionsResult {
  valid: boolean;
  granted: string[];
  missing: string[];
  optional_granted: string[];
}

export interface MetaRecoveryAction {
  key: string;
  label: string;
  description: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  can_auto: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const metaConnectionService = {
  getDashboard: (connectionId: string) =>
    axios
      .get<MetaConnectionDashboard>(`${BASE}/meta/connections/${connectionId}/dashboard`)
      .then((r) => r.data),

  getBusinesses: (connectionId: string) =>
    axios
      .get<{ businesses: MarketingAsset[]; selected_ids: string[] | null }>(
        `${BASE}/meta/connections/${connectionId}/businesses`,
      )
      .then((r) => r.data),

  selectBusinesses: (connectionId: string, businessIds: string[]) =>
    axios
      .post<{ message: string; selected_ids: string[] }>(
        `${BASE}/meta/connections/${connectionId}/businesses/select`,
        { business_ids: businessIds },
      )
      .then((r) => r.data),

  getPermissions: (connectionId: string) =>
    axios
      .get<MetaPermissionsResult>(`${BASE}/meta/connections/${connectionId}/permissions`)
      .then((r) => r.data),

  getSyncStatus: (connectionId: string) =>
    axios
      .get<{ is_running: boolean; last_sync: MetaSyncSummary | null }>(
        `${BASE}/meta/connections/${connectionId}/sync-status`,
      )
      .then((r) => r.data),

  triggerSync: (connectionId: string) =>
    axios
      .post<{ message: string }>(`${BASE}/meta/connections/${connectionId}/sync`)
      .then((r) => r.data),

  getRecovery: (connectionId: string) =>
    axios
      .get<{ status: string; actions: MetaRecoveryAction[] }>(
        `${BASE}/meta/connections/${connectionId}/recovery`,
      )
      .then((r) => r.data),

  disconnect: (connectionId: string) =>
    axios
      .post<{ message: string }>(`${BASE}/meta/connections/${connectionId}/disconnect`)
      .then((r) => r.data),

  // ── Webhooks ───────────────────────────────────────────────────────────────

  getWebhooks: (connectionId: string) =>
    axios
      .get<{ webhooks: MetaWebhookSummary[] }>(`${BASE}/meta/connections/${connectionId}/webhooks`)
      .then((r) => r.data),

  registerAllWebhooks: (connectionId: string) =>
    axios
      .post<{ message: string }>(`${BASE}/meta/connections/${connectionId}/webhooks/register-all`)
      .then((r) => r.data),

  removeWebhook: (webhookId: string) =>
    axios
      .delete<{ message: string }>(`${BASE}/meta/webhooks/${webhookId}`)
      .then((r) => r.data),

  reRegisterWebhook: (webhookId: string) =>
    axios
      .post<{ message: string; id: string; status: string }>(`${BASE}/meta/webhooks/${webhookId}/re-register`)
      .then((r) => r.data),
};
