/**
 * Authentication domain types (frontend).
 */
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  company_id: string | null;
  /**
   * Effective permission names (TASK-IAM-002). Optional so older payloads / callers
   * that haven't refreshed still type-check; treated as [] when absent.
   */
  permissions?: string[];
  /** True when the user holds a system role — bypasses all permission checks. */
  is_system?: boolean;
  /**
   * Full UI authorization context (TASK-IAM-005): visibility, scopes, policies,
   * navigation, dashboard, landing page, feature flags, effective templates.
   * Delivered once by /auth/me so the UI never issues extra authorization requests.
   */
  authorization?: import('@/features/authorization/types').AuthorizationContextDTO;
};

export type LoginCredentials = {
  email: string;
  password: string;
  remember: boolean;
};

export type LoginResponseData = {
  token: string;
  token_type: string;
  user: AuthUser;
};

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
