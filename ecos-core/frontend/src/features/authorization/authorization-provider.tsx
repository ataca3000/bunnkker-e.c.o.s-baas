import { useMemo, type ReactNode } from 'react';

import { useAuthStore } from '@/features/auth/store/auth-store';

import { AuthorizationReactContext } from './authorization-context';
import { normalizeContext } from './types';

/**
 * AuthorizationProvider (TASK-IAM-005) — the single global provider that resolves the
 * current user's authorization context from the auth store and distributes it to every
 * hook/component. It performs NO network requests: the context arrives with /auth/me and
 * is held in the store, so authorization evaluation is fully cached and reactive (it
 * recomputes only when the user changes).
 *
 * Backend stays authoritative; this context shapes UX only.
 */
export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);

  const context = useMemo(() => {
    const normalized = normalizeContext(user?.authorization);
    // Back-compat: if a payload predates the `authorization` block, fall back to the
    // flat permissions/is_system fields so the UI still functions.
    if (!user?.authorization && user) {
      return {
        ...normalized,
        isSystem: user.is_system ?? false,
        permissions: user.permissions ?? [],
      };
    }
    return normalized;
  }, [user]);

  return (
    <AuthorizationReactContext.Provider value={context}>
      {children}
    </AuthorizationReactContext.Provider>
  );
}
