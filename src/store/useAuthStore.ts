import { create } from 'zustand';

interface AuthState {
    isAuthenticated: boolean;
    user: { id: string; name: string; role: string } | null;
    login: () => boolean;
    logout: () => void;
}

// Store legado neutralizado: la autenticación real reside en /api/auth/session con cookies firmadas HMAC
export const useAuthStore = create<AuthState>()((set) => ({
    isAuthenticated: false,
    user: null,
    login: () => false,
    logout: () => set({ isAuthenticated: false, user: null }),
}));
