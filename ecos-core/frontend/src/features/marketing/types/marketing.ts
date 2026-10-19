// ─── Enums ───────────────────────────────────────────────────────────────────

export type ConnectorType =
  | 'meta'
  | 'google_ads'
  | 'tiktok'
  | 'snapchat'
  | 'linkedin'
  | 'pinterest'
  | 'x_ads';

// Full lifecycle + legacy values
export type ConnectionStatus =
  | 'pending' | 'authenticating' | 'connected' | 'validating'
  | 'synchronizing' | 'healthy' | 'warning' | 'degraded'
  | 'disconnected' | 'archived'
  // legacy (backward compat)
  | 'active' | 'expired' | 'error';

export type AssetType =
  // Canonical provider-agnostic
  | 'business_account'
  | 'ad_account'
  | 'page'
  | 'social_account'
  | 'pixel'
  | 'catalog'
  | 'domain'
  | 'dataset'
  | 'app'
  // Legacy (backward compat)
  | 'business_manager'
  | 'instagram_account'
  | 'whatsapp_account';

export type AssetHealth =
  | 'healthy'
  | 'warning'
  | 'disconnected'
  | 'expired_token'
  | 'permission_missing'
  | 'sync_failed'
  | 'inactive'
  | 'unknown';

export type SyncStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SyncType   = 'manual' | 'scheduled' | 'incremental' | 'full';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface MarketingConnection {
  id: string;
  company_id: string | null;
  connector_type: ConnectorType;
  label: string;
  status: ConnectionStatus;
  external_account_id: string | null;
  scopes: string[] | null;
  required_scopes: string[] | null;
  is_token_expired: boolean;
  is_token_expiring_soon: boolean;
  token_expires_at: string | null;
  permissions_validated_at: string | null;
  last_validated_at: string | null;
  last_synced_at: string | null;
  connected_by: string | null;
  disconnected_at: string | null;
  disconnected_by: string | null;
  connector_meta: Record<string, unknown> | null;
  assets_count?: number;
  created_at: string;
  updated_at: string;
}

export interface MarketingAsset {
  id: string;
  company_id: string | null;
  marketing_connection_id: string;
  connector_type: ConnectorType;
  asset_type: AssetType;
  external_id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  health_status: AssetHealth;
  health_checked_at: string | null;
  health_metadata: Record<string, unknown> | null;
  asset_metadata: Record<string, unknown> | null;
  last_synced_at: string | null;
  next_sync_at: string | null;
  relationships_count?: number;
  connection?: Pick<MarketingConnection, 'id' | 'label' | 'connector_type' | 'status'>;
  relationships?: AssetRelationship[];
  created_at: string;
  updated_at: string;
}

export interface AssetRelationship {
  id: string;
  marketing_asset_id: string;
  related_type: string;
  related_id: string;
  mapped_by: string | null;
  mapped_at: string | null;
  confidence: number | null;
  is_auto_suggested: boolean;
  accepted_at: string | null;
  accepted_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  asset?: Pick<MarketingAsset, 'id' | 'name' | 'asset_type' | 'connector_type'>;
  created_at: string;
  updated_at: string;
}

export interface MarketingSyncLog {
  id: string;
  marketing_connection_id: string;
  sync_type: SyncType;
  status: SyncStatus;
  assets_discovered: number;
  assets_created: number;
  assets_updated: number;
  assets_failed: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  triggered_by: string | null;
  error_message: string | null;
  sync_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface MappingProfile {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  connector_type: ConnectorType | null;
  is_active: boolean;
  auto_apply: boolean;
  created_by: string | null;
  rules?: MappingProfileRule[];
  created_at: string;
  updated_at: string;
}

export interface MappingProfileRule {
  id: string;
  mapping_profile_id: string;
  match_field: 'name' | 'name_contains' | 'external_id' | 'asset_type';
  match_value: string;
  related_type: string;
  related_id: string;
  priority: number;
}

// ─── API Response shapes ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export interface MarketingDashboard {
  kpis: {
    total_connections: number;
    active_connections: number;
    total_assets: number;
    healthy_assets: number;
    warning_assets: number;
    error_assets: number;
    pending_suggestions: number;
  };
  assets_by_type: Record<AssetType, number>;
  recent_syncs: MarketingSyncLog[];
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const CONNECTOR_LABELS: Record<ConnectorType, string> = {
  meta:        'Meta',
  google_ads:  'Google Ads',
  tiktok:      'TikTok',
  snapchat:    'Snapchat',
  linkedin:    'LinkedIn',
  pinterest:   'Pinterest',
  x_ads:       'X (Twitter) Ads',
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  // Canonical
  business_account:   'Business Account',
  ad_account:         'Ad Account',
  page:               'Page',
  social_account:     'Social Account',
  pixel:              'Pixel',
  catalog:            'Product Catalog',
  domain:             'Domain',
  dataset:            'Dataset',
  app:                'App',
  // Legacy
  business_manager:   'Business Manager',
  instagram_account:  'Instagram Account',
  whatsapp_account:   'WhatsApp Account',
};

// ─── Connector Health ─────────────────────────────────────────────────────────

export interface ConnectorHealthData {
  connection_status: string;
  auth_status: string;
  token_expires_at: string | null;
  api_available: boolean;
  rate_limit_remaining: number | null;
  rate_limit_reset_at: string | null;
  avg_sync_duration_seconds: number | null;
  last_successful_sync_at: string | null;
  last_failed_sync_at: string | null;
  error_count: number;
  retry_queue_size: number;
  overall_status: 'healthy' | 'warning' | 'error';
}

// ─── Relationship Graph ───────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  sub_label: string | null;
  metadata: Record<string, unknown>;
  health_status: string | null;
  connector_type: ConnectorType | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  accepted: boolean;
  auto_suggested: boolean;
  confidence: number | null;
}

export interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
