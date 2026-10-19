/**
 * Enterprise UI Authorization Platform — frontend types (TASK-IAM-005 / ADR-041,
 * building on ADR-038/039/040).
 *
 * The whole UI adapts to the user's effective identity, delivered once by /auth/me as an
 * `authorization` context. Permission strings are the backend `module.resource.action`
 * names; helpers normalise casing so a PascalCase literal matches the stored name.
 */

/** A permission name, e.g. "inventory.products.view" or "inventory.products.view_cost". */
export type Permission = string;

/** Data scopes, mirroring the backend DataScope enum (server-side is authoritative). */
export type DataScope =
  | 'self'
  | 'team'
  | 'branch'
  | 'warehouse'
  | 'channel'
  | 'company'
  | 'region'
  | 'business_unit'
  | 'department'
  | 'custom'
  | 'all';

/** A feature-flag key (org-level capability gate). Absent/true = enabled. */
export type FeatureKey = string;

/** An assigned Role Template summary. */
export type EffectiveTemplate = {
  key: string;
  name: string;
  category: string;
  is_primary: boolean;
};

/**
 * The raw authorization context as delivered by the backend (/auth/me `authorization`).
 * snake_case — the provider normalises it into {@link AuthorizationContext}.
 */
export type AuthorizationContextDTO = {
  is_system?: boolean;
  permissions?: string[];
  visibility?: { hidden_fields?: string[] };
  scopes?: Record<string, string>;
  policies?: string[];
  navigation?: string[];
  dashboard?: { profile?: string; hidden?: string[]; collapsed?: string[]; widgetOrder?: string[] };
  landing_page?: string | null;
  preferences?: Record<string, unknown>;
  quick_actions?: string[];
  templates?: EffectiveTemplate[];
  feature_flags?: Record<string, boolean>;
};

/** The normalised, in-memory authorization context distributed by the provider. */
export type AuthorizationContext = {
  isSystem: boolean;
  permissions: Permission[];
  hiddenFields: string[];
  scopes: Record<string, DataScope>;
  policies: string[];
  navigation: string[];
  dashboard: { profile?: string; hidden: string[]; collapsed: string[]; widgetOrder: string[] };
  landingPage: string | null;
  preferences: Record<string, unknown>;
  quickActions: string[];
  templates: EffectiveTemplate[];
  featureFlags: Record<string, boolean>;
};

/** The authorization surface exposed by useAuthorization(). */
export type Authorization = {
  can: (permission: Permission) => boolean;
  cannot: (permission: Permission) => boolean;
  canAccess: (permission: Permission) => boolean;
  canExecute: (permission: Permission) => boolean;
  /** May the user see a sensitive field? Pass the field's required permission. */
  canViewField: (fieldPermission: Permission) => boolean;
  /** Is a semantic sensitive field hidden for this user? (from the Visibility Engine) */
  isFieldHidden: (field: string) => boolean;
  hasScope: (scope: DataScope) => boolean;
  /** Effective data scope for a resource ("sales.orders"); 'all' when unrestricted. */
  scopeFor: (resource: string) => DataScope;
  /** Does the user carry this policy bundle? */
  hasPolicy: (policy: string) => boolean;
  /** Is an org-level feature enabled? (absent flag = enabled) */
  hasFeature: (feature: FeatureKey) => boolean;
  permissions: Permission[];
  isSystem: boolean;
  context: AuthorizationContext;
};

export const EMPTY_CONTEXT: AuthorizationContext = {
  isSystem: false,
  permissions: [],
  hiddenFields: [],
  scopes: {},
  policies: [],
  navigation: [],
  dashboard: { hidden: [], collapsed: [], widgetOrder: [] },
  landingPage: null,
  preferences: {},
  quickActions: [],
  templates: [],
  featureFlags: {},
};

/** Normalise the backend DTO into the in-memory context (safe against partial payloads). */
export function normalizeContext(dto: AuthorizationContextDTO | undefined | null): AuthorizationContext {
  if (!dto) {
    return EMPTY_CONTEXT;
  }
  const dash = dto.dashboard ?? {};
  return {
    isSystem: dto.is_system ?? false,
    permissions: dto.permissions ?? [],
    hiddenFields: dto.visibility?.hidden_fields ?? [],
    scopes: (dto.scopes ?? {}) as Record<string, DataScope>,
    policies: dto.policies ?? [],
    navigation: dto.navigation ?? [],
    dashboard: {
      profile: dash.profile,
      hidden: dash.hidden ?? [],
      collapsed: dash.collapsed ?? [],
      widgetOrder: dash.widgetOrder ?? [],
    },
    landingPage: dto.landing_page ?? null,
    preferences: dto.preferences ?? {},
    quickActions: dto.quick_actions ?? [],
    templates: dto.templates ?? [],
    featureFlags: dto.feature_flags ?? {},
  };
}

/**
 * Normalise a permission literal to the backend canonical form: lowercase each
 * dot-segment and split CamelCase into snake_case. Mirrors PermissionName on the server.
 */
export function normalizePermission(permission: Permission): string {
  return permission
    .split('.')
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .toLowerCase(),
    )
    .join('.');
}
