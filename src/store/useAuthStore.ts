import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    isAuthenticated: boolean;
    user: { id: string; name: string; role: string } | null;
    login: (password: string) => boolean;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            isAuthenticated: false,
            user: null,
            login: (password: string) => {
                // Contraseña maestra local definida en .env como LOCAL_ADMIN_PASSWORD
                const masterPassword = process.env.NEXT_PUBLIC_LOCAL_ADMIN_PASSWORD;
                if (masterPassword && password === masterPassword) { 
                    set({ isAuthenticated: true, user: { id: 'local-admin', name: 'Administrador Local', role: 'admin' } });
                    return true;
                }
                return false;
            },
            logout: () => set({ isAuthenticated: false, user: null }),
        }),
        { name: 'local-session-storage' }
    )
);
