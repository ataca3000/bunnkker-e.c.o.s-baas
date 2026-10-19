import { useEffect, type ReactNode } from 'react';

import { useAuthStore } from '@/features/auth/store/auth-store';

/**
 * Restores the authentication session on app start (token persistence) by
 * calling the store's bootstrap routine once on mount.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <>{children}</>;
}
