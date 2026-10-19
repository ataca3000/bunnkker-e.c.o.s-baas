import type { ReactNode } from 'react';

import { useAuthorization } from '../use-authorization';
import type { DataScope, FeatureKey, Permission } from '../types';

type GateProps = {
  /** A single permission, or a list. */
  permission: Permission | Permission[];
  /**
   * How to combine a list of permissions. 'all' (default) requires every one;
   * 'any' requires at least one. Ignored for a single permission.
   */
  mode?: 'all' | 'any';
  /** Rendered when the check passes. */
  children: ReactNode;
  /** Rendered when the check fails. Defaults to nothing. */
  fallback?: ReactNode;
};

function evaluate(
  can: (p: Permission) => boolean,
  permission: Permission | Permission[],
  mode: 'all' | 'any',
): boolean {
  const list = Array.isArray(permission) ? permission : [permission];
  if (list.length === 0) {
    return true;
  }
  return mode === 'any' ? list.some(can) : list.every(can);
}

/**
 * <Can permission="inventory.products.create">…</Can>
 * Renders children only when the current user holds the permission(s). Keeps role logic
 * out of pages — no component checks roles directly.
 */
export function Can({ permission, mode = 'all', children, fallback = null }: GateProps) {
  const { can } = useAuthorization();
  return <>{evaluate(can, permission, mode) ? children : fallback}</>;
}

/** <Cannot permission="…"> — the inverse of <Can>. */
export function Cannot({ permission, mode = 'all', children, fallback = null }: GateProps) {
  const { can } = useAuthorization();
  return <>{evaluate(can, permission, mode) ? fallback : children}</>;
}

/**
 * <CanViewField permission="inventory.products.view_cost">…</CanViewField>
 * Field-level gate by the field's required permission. The server still masks the value;
 * this hides the empty UI affordance.
 */
export function CanViewField({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { canViewField } = useAuthorization();
  return <>{canViewField(permission) ? children : fallback}</>;
}

/**
 * <VisibilityBoundary field="average_cost">…</VisibilityBoundary>
 * Hides children when the Visibility Engine marks the semantic field hidden for this user.
 */
export function VisibilityBoundary({
  field,
  children,
  fallback = null,
}: {
  field: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isFieldHidden } = useAuthorization();
  return <>{isFieldHidden(field) ? fallback : children}</>;
}

/**
 * <HasScope scope="branch">…</HasScope> — UX-only scope affordance (server enforces).
 */
export function HasScope({
  scope,
  children,
  fallback = null,
}: {
  scope: DataScope;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasScope } = useAuthorization();
  return <>{hasScope(scope) ? children : fallback}</>;
}

/**
 * <ScopeBoundary resource="sales.orders" atLeast="team">…</ScopeBoundary>
 * Renders children when the user's scope on a resource is at least as wide as `atLeast`.
 */
const SCOPE_RANK: Record<DataScope, number> = {
  custom: 5,
  self: 10,
  team: 20,
  branch: 30,
  warehouse: 40,
  channel: 50,
  department: 60,
  business_unit: 70,
  region: 80,
  company: 90,
  all: 100,
};

export function ScopeBoundary({
  resource,
  atLeast,
  children,
  fallback = null,
}: {
  resource: string;
  atLeast: DataScope;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { scopeFor } = useAuthorization();
  const ok = SCOPE_RANK[scopeFor(resource)] >= SCOPE_RANK[atLeast];
  return <>{ok ? children : fallback}</>;
}

/**
 * <Feature name="accounting">…</Feature>
 * Renders children only when the org-level feature is enabled (absent flag = enabled).
 */
export function Feature({
  name,
  children,
  fallback = null,
}: {
  name: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasFeature } = useAuthorization();
  return <>{hasFeature(name) ? children : fallback}</>;
}

/**
 * <ReadOnly when|permission>…</ReadOnly>
 * Renders children in a non-interactive, accessible read-only state when the user lacks
 * `permission` (or when `when` is true): focus is removed, pointer events disabled, and
 * `aria-disabled` is set. Use to present a form/section the user may view but not edit.
 */
export function ReadOnly({
  permission,
  when,
  children,
  className,
}: {
  permission?: Permission;
  when?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { can } = useAuthorization();
  const readOnly = when ?? (permission ? !can(permission) : false);

  if (!readOnly) {
    return <>{children}</>;
  }

  return (
    <div
      aria-disabled="true"
      data-readonly="true"
      className={className}
      style={{ pointerEvents: 'none', opacity: 0.7 }}
    >
      {children}
    </div>
  );
}
