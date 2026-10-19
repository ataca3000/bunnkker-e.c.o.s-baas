import { Navigate, Outlet } from 'react-router-dom';

import { FullScreenLoader } from '@/components/common/full-screen-loader';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { ROUTES } from '@/router/routes';

/**
 * Route guard for protected areas. Anonymous users are redirected to /login.
 * Waits for session bootstrap to finish before deciding.
 */
export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);

  if (status === 'idle' || status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to={ROUTES.login} replace />;
  }

  return <Outlet />;
}
