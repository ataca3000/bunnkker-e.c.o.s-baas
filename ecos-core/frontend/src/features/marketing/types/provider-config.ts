export type ProviderStatus =
  | 'not_configured'
  | 'invalid'
  | 'invalid_configuration'
  | 'ready'
  | 'connected'
  | 'token_expired'
  | 'permission_error'
  | 'webhook_missing'
  | 'sync_disabled'
  | 'service_unavailable'
  | 'unknown';

export type ProviderConfig = {
  provider: string;
  app_id: string | null;
  has_app_secret: boolean;
  redirect_uri: string | null;
  default_redirect_uri: string;
  status: ProviderStatus;
  validated_at: string | null;
  last_updated_at: string | null;
};

export type ValidateConfigPayload = {
  app_id: string;
  app_secret: string;
  redirect_uri?: string;
};

export type SaveConfigPayload = {
  app_id: string;
  app_secret?: string;
  redirect_uri?: string;
};

export type RotateSecretPayload = {
  app_id: string;
  new_app_secret: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export type SaveConfigResult = {
  saved: boolean;
  valid: boolean;
  errors: string[];
  status: ProviderStatus;
  config: ProviderConfig;
};

export type RotateSecretResult = {
  rotated: boolean;
  valid: boolean;
  errors: string[];
  config?: ProviderConfig;
};

export type ProviderHealthCheck = {
  status: ProviderStatus;
  checks: {
    config_exists: boolean;
    credentials_valid: boolean | null;
    service_reachable: boolean | null;
  };
  checked_at: string;
};
