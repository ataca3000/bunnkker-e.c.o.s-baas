import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { ROUTES } from '@/router/routes';

import { useAuthorization } from '../use-authorization';
import type { Permission } from '../types';

/**
 * <RequirePermission permission="…"> — a route guard, composed *inside* ProtectedRoute
 * (which already handles authentication). Denies access to a screen when the user lacks
 * the permission by redirecting to a safe landing route.
 *
 * Use as a layout route element:
 *   <Route element={<RequirePermission permission="finance.periods.view" />}>
 *     <Route path="finance/close" element={<CloseWorkspace />} />
 *   </Route>
 */
export function RequirePermission({
  permission,
  mode = 'all',
  redirectTo = ROUTES.dashboard,
}: {
  permission: Permission | Permission[];
  mode?: 'all' | 'any';
  redirectTo?: string;
}) {
  const { can } = useAuthorization();
  const list = Array.isArray(permission) ? permission : [permission];
  const allowed = list.length === 0 || (mode === 'any' ? list.some(can) : list.every(can));

  return allowed ? <Outlet /> : <Navigate to={redirectTo} replace />;
}

/**
 * <PermissionBoundary permission="…" fallback={<NoAccess/>}>…</PermissionBoundary>
 *
 * A non-routing region guard. Unlike <Can> (which silently renders nothing), a boundary
 * is meant to wrap a whole section and show an explicit fallback (empty state, "no
 * access" panel) when the user is not permitted.
 */
export function PermissionBoundary({
  permission,
  mode = 'all',
  children,
  fallback = null,
}: {
  permission: Permission | Permission[];
  mode?: 'all' | 'any';
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuthorization();
  const list = Array.isArray(permission) ? permission : [permission];
  const allowed = list.length === 0 || (mode === 'any' ? list.some(can) : list.every(can));

  return <>{allowed ? children : fallback}</>;
}
