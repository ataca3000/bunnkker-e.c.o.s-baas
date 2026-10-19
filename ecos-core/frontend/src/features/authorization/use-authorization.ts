import { useContext, useMemo } from 'react';

import { AuthorizationReactContext } from './authorization-context';
import type { Authorization, DataScope, FeatureKey, Permission } from './types';
import { normalizePermission } from './types';

/**
 * Pure check: does the given permission set (plus system flag) satisfy `permission`?
 * Exported so non-React code (route loaders, guards) can reuse the same logic.
 */
export function grants(
  permissions: readonly string[],
  isSystem: boolean,
  permission: Permission,
): boolean {
  if (isSystem) {
    return true;
  }
  return permissions.includes(normalizePermission(permission));
}

/**
 * useAuthorization — the single source of truth for authorization checks in the UI
 * (TASK-IAM-005). Consumes the AuthorizationProvider context (permissions, visibility,
 * scope, policies, feature flags). No page reads roles or permission arrays directly.
 * All checks are UX-only — the server is the authoritative gate.
 */
export function useAuthorization(): Authorization {
  const context = useContext(AuthorizationReactContext);

  return useMemo<Authorization>(() => {
    const { isSystem, permissions, hiddenFields, scopes, policies, featureFlags } = context;

    const can = (permission: Permission) => grants(permissions, isSystem, permission);
    const cannot = (permission: Permission) => !can(permission);

    const isFieldHidden = (field: string) => !isSystem && hiddenFields.includes(field);

    const scopeFor = (resource: string): DataScope =>
      isSystem ? 'all' : ((scopes[resource] as DataScope | undefined) ?? 'all');

    const hasScope = (scope: DataScope) =>
      isSystem || scope === 'all' || Object.values(scopes).includes(scope);

    const hasPolicy = (policy: string) => policies.includes(policy);

    // Absent flag = enabled; system users bypass gating.
    const hasFeature = (feature: FeatureKey) => isSystem || featureFlags[feature] !== false;

    return {
      can,
      cannot,
      canAccess: can,
      canExecute: can,
      canViewField: can,
      isFieldHidden,
      hasScope,
      scopeFor,
      hasPolicy,
      hasFeature,
      permissions,
      isSystem,
      context,
    };
  }, [context]);
}

/** usePermission — focused permission checks. */
export function usePermission(): Pick<Authorization, 'can' | 'cannot' | 'canAccess' | 'canExecute'> {
  const { can, cannot, canAccess, canExecute } = useAuthorization();
  return { can, cannot, canAccess, canExecute };
}

/** useVisibility — field-level visibility (Visibility Engine). */
export function useVisibility(): Pick<Authorization, 'canViewField' | 'isFieldHidden'> {
  const { canViewField, isFieldHidden } = useAuthorization();
  return { canViewField, isFieldHidden };
}

/** useScope — data-scope helpers (UX only; server enforces record filtering). */
export function useScope(): Pick<Authorization, 'hasScope' | 'scopeFor'> {
  const { hasScope, scopeFor } = useAuthorization();
  return { hasScope, scopeFor };
}

/** usePolicies — business-policy bundle checks. */
export function usePolicies(): { policies: string[]; hasPolicy: (policy: string) => boolean } {
  const { context, hasPolicy } = useAuthorization();
  return { policies: context.policies, hasPolicy };
}

/** useFeature — org-level feature-flag gating. */
export function useFeature(): { hasFeature: (feature: FeatureKey) => boolean } {
  const { hasFeature } = useAuthorization();
  return { hasFeature };
}

/** useDashboard — the user's dashboard profile (from their Role Templates). */
export function useDashboard() {
  const { context } = useAuthorization();
  return context.dashboard;
}

/** useLandingPage — the ROUTES key the user should open on login. */
export function useLandingPage(): string | null {
  const { context } = useAuthorization();
  return context.landingPage;
}
