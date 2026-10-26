"use client";

import { createContext, useContext, useState, useEffect } from 'react';

import type { UserProfile } from '@/lib/types';

import { getStaffSession, saveStaffSession, clearStaffSession } from '@/lib/staffAuth';

export type { UserProfile };

interface AuthContextType {
    user: any | null;
    profile: UserProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isReadOnly: boolean;
    isPremium: boolean;
    networkMode: {
        isMaster: boolean;
        host: string;
        label: string;
    };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    // Pre-hidratación instantánea (0ms) desde almacenamiento local
    const [user, setUser] = useState<any | null>(() => {
        const cached = getStaffSession();
        return cached?.user || (cached?.uid ? { id: cached.uid, role: cached.role } : null);
    });
    const [profile, setProfile] = useState<UserProfile | null>(() => {
        const cached = getStaffSession();
        if (cached?.profile) return cached.profile as UserProfile;
        if (cached?.uid && cached?.role) {
            return {
                uid: cached.uid,
                email: '',
                displayName: cached.user?.name || 'Personal',
                role: cached.role,
                signature: cached.signature,
                nodeAccess: [],
                lastLogin: Date.now(),
                isPremium: true
            };
        }
        return null;
    });
    const [loading, setLoading] = useState(() => {
        // Si ya tenemos sesión persistida en el navegador, no bloquear con pantalla de carga
        return !getStaffSession();
    });
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [networkMode, setNetworkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            const port = window.location.port;
            const isMaster = hostname === 'localhost' || hostname === '127.0.0.1';
            return {
                isMaster,
                host: hostname,
                label: isMaster ? 'SERVIDOR MAESTRO' : `NODO CONECTADO A ${hostname}:${port}`
            };
        }
        return { isMaster: true, host: 'localhost', label: 'SERVIDOR MAESTRO' };
    });

    useEffect(() => {
        // Si estamos en Electron, inicializar el Machine ID desde el host nativo
        if (typeof window !== 'undefined') {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI?.getMachineId) {
                electronAPI.getMachineId().then((hwid: string) => {
                    if (hwid) {
                        localStorage.setItem('_admincom_v1_mid', hwid);
                        console.log("[Electron] Machine ID persistido:", hwid);
                    }
                }).catch((err: any) => console.error("[Electron] Error al obtener Machine ID:", err));
            }
        }

        const loadUser = async (silent = false) => {
            try {
                if (!silent && !getStaffSession()) setLoading(true);
                const res = await fetch('/api/users/me', { credentials: 'include' }).catch(() => null);
                if (res && res.ok) {
                    const data = await res.json().catch(() => null);
                    if (data && data.success && data.user) {
                        const newProfile: UserProfile = {
                            uid: data.user.id,
                            email: data.user.email || '',
                            displayName: data.user.name || 'Usuario ERP',
                            role: data.user.role || 'sales',
                            signature: data.user.signature || '',
                            nodeAccess: [],
                            lastLogin: Date.now(),
                            isPremium: true
                        };

                        setUser((prev: any) => (prev?.id === data.user.id && prev?.role === data.user.role ? prev : data.user));
                        setProfile((prev) => {
                            if (
                                prev &&
                                prev.uid === newProfile.uid &&
                                prev.role === newProfile.role &&
                                prev.displayName === newProfile.displayName
                            ) {
                                return prev;
                            }
                            return newProfile;
                        });

                        // Persistir sesión de trabajador validada
                        saveStaffSession({
                            uid: data.user.id,
                            role: data.user.role || 'sales',
                            signature: data.user.signature || '',
                            user: data.user,
                            profile: newProfile
                        });
                    } else if (!silent && !getStaffSession()) {
                        setUser(null);
                        setProfile(null);
                    }
                } else if (res && res.status === 401) {
                    // Solo cerrar sesión si el backend explícitamente rechazó las credenciales
                    clearStaffSession();
                    setUser(null);
                    setProfile(null);
                }
                // Si la red falló o hubo timeout, NO borramos la sesión persistida
            } catch {
                if (!silent && !getStaffSession()) {
                    setUser(null);
                    setProfile(null);
                }
            } finally {
                setLoading(false);
            }
        };

        loadUser();

        // Polling silencioso solo cuando la pestaña esté activa y no haya errores de red
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                loadUser(true);
            }
        }, 15000);

        return () => clearInterval(interval);

    }, []);

    const signOut = async () => {
        try {
            await fetch('/api/auth/session', { method: 'DELETE' });
            clearStaffSession();
            setUser(null);
            setProfile(null);
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Error signing out', error);
            clearStaffSession();
            setUser(null);
            setProfile(null);
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
    };

    const isAdmin = profile?.role === 'superadmin';
    const isSuperAdmin = profile?.role === 'superadmin';

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            signOut,
            isAdmin,
            isSuperAdmin,
            isReadOnly,
            isPremium: true,
            networkMode
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
