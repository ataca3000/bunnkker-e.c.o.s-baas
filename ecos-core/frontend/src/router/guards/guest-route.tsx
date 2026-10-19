import { Navigate, Outlet } from 'react-router-dom';

import { FullScreenLoader } from '@/components/common/full-screen-loader';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { ROUTES } from '@/router/routes';

/**
 * Route guard for guest-only pages (e.g. /login). Authenticated users are
 * redirected to the dashboard and can never return to /login.
 */
export function GuestRoute() {
  const status = useAuthStore((state) => state.status);

  if (status === 'idle' || status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status === 'authenticated') {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <Outlet />;
}
