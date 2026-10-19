import { create } from 'zustand';

import { authService } from '@/features/auth/services/auth-service';
import type { AuthStatus, AuthUser, LoginCredentials } from '@/features/auth/types';
import { setOnUnauthorized } from '@/lib/axios';
import { tokenStorage } from '@/lib/token-storage';

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  /** Authenticate with credentials and persist the token. */
  login: (credentials: LoginCredentials) => Promise<void>;
  /** Revoke the token (server + local) and reset state. */
  logout: () => Promise<void>;
  /** Restore the session on app start from a persisted token. */
  bootstrap: () => Promise<void>;
  /** Clear state locally (used by the 401 interceptor). */
  setUnauthenticated: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',

  login: async (credentials) => {
    const { token, user } = await authService.login(credentials);
    tokenStorage.set(token);
    if (user.company_id) {
      localStorage.setItem('ecos:activeCompanyId', user.company_id);
    }
    set({ user, status: 'authenticated' });
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network / already-expired errors — we clear locally regardless.
    }
    tokenStorage.clear();
    set({ user: null, status: 'unauthenticated' });
  },

  bootstrap: async () => {
    if (!tokenStorage.get()) {
      set({ status: 'unauthenticated' });
      return;
    }

    set({ status: 'loading' });

    try {
      const user = await authService.me();
      if (user.company_id && !localStorage.getItem('ecos:activeCompanyId')) {
        localStorage.setItem('ecos:activeCompanyId', user.company_id);
      }
      set({ user, status: 'authenticated' });
    } catch {
      tokenStorage.clear();
      set({ user: null, status: 'unauthenticated' });
    }
  },

  setUnauthenticated: () => {
    set({ user: null, status: 'unauthenticated' });
  },
}));

// Bridge the Axios 401 interceptor to the store (automatic logout on 401).
setOnUnauthorized(() => {
  useAuthStore.getState().setUnauthenticated();
});
