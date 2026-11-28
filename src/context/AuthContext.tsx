"use client";

import { createContext, useContext, useState, useEffect } from 'react';

import type { UserProfile } from '@/lib/types';

import { getStaffSession, saveStaffSession, clearStaffSession } from '@/lib/staffAuth';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { getQueuedOfflineOrders } from '@/lib/indexedDBCart';

export type { UserProfile };

interface AuthContextType {
    user: any | null;
    profile: UserProfile | null;
    loading: boolean;
    deviceId: string | null;
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

function detectPlatformLabel(): string {
    if (typeof navigator === 'undefined') return 'Web';
    const ua = navigator.userAgent || '';
    if ((window as any).electronAPI) return 'Escritorio Desktop';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPad|Tablet/i.test(ua)) return 'iPad / Tablet';
    if (/iPhone|iOS/i.test(ua)) return 'iPhone';
    if (/Windows/i.test(ua)) return 'Windows Web';
    if (/Mac/i.test(ua)) return 'macOS Web';
    return 'Navegador Web';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    // Inicialización idéntica SSR/CSR para evitar Hydration Mismatch; se rehidrata inmediatamente tras el montaje.
    const [user, setUser] = useState<any | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [isReadOnly] = useState(false);
    const [networkMode, setNetworkMode] = useState({
        isMaster: true,
        host: 'localhost',
        label: 'SERVIDOR MAESTRO'
    });

    useEffect(() => {
        // Rehidratación inmediata tras el montaje + detección de nodo y Machine ID
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            const port = window.location.port;
            const isMaster = hostname === 'localhost' || hostname === '127.0.0.1';
            const hostPort = port ? `${hostname}:${port}` : hostname;
            setNetworkMode({
                isMaster,
                host: hostname,
                label: isMaster ? 'SERVIDOR MAESTRO' : `NODO CONECTADO A ${hostPort}`
            });

            const cached = getStaffSession();
            if (cached?.uid && cached?.role) {
                setUser(cached.user || { id: cached.uid, role: cached.role });
                setProfile(
                    (cached.profile as UserProfile) || {
                        uid: cached.uid,
                        email: '',
                        displayName: cached.user?.name || 'Personal',
                        role: cached.role,
                        signature: cached.signature,
                        nodeAccess: [],
                        lastLogin: Date.now(),
                        isPremium: true
                    }
                );
                setLoading(false);
            }

            setDeviceId(getDeviceFingerprint());
            const electronAPI = (window as any).electronAPI;
            if (electronAPI?.getMachineId) {
                electronAPI.getMachineId().then((hwid: string) => {
                    if (hwid) {
                        localStorage.setItem('_admincom_v1_mid', hwid);
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
                    const errJson = await res.json().catch(() => null);
                    // Solo cerrar sesión si el backend explícitamente rechazó las credenciales
                    clearStaffSession();
                    setUser(null);
                    setProfile(null);
                    if (errJson?.code === 'SESSION_REVOKED' && typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
                        window.location.assign('/login?error=session_revoked');
                    }
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

    // ─── Heartbeat Multidispositivo + Detección de Revocación Remota ────────
    useEffect(() => {
        if (typeof window === 'undefined' || !profile?.uid) return;
        const devId = getDeviceFingerprint();
        setDeviceId(devId);
        let cancelled = false;

        const sendHeartbeat = async () => {
            if (cancelled) return;
            if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
            try {
                const queued = await getQueuedOfflineOrders().catch(() => []);
                const res = await fetch('/api/pairing/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        deviceId: devId,
                        userName: profile.displayName,
                        platform: detectPlatformLabel(),
                        currentPath: window.location.pathname,
                        pendingQueueSize: queued.length,
                    }),
                });
                if (res.status === 403) {
                    const json = await res.json().catch(() => null);
                    if (json?.code === 'ERR_DEVICE_REVOKED') {
                        clearStaffSession();
                        setUser(null);
                        setProfile(null);
                        window.location.assign('/login?error=device_revoked');
                    }
                }
            } catch {
                // Reintento silencioso en el próximo pulso
            }
        };

        void sendHeartbeat();
        const hbInterval = setInterval(() => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') {
                void sendHeartbeat();
            }
        }, 30_000);

        return () => {
            cancelled = true;
            clearInterval(hbInterval);
        };
    }, [profile?.uid, profile?.displayName]);

    const signOut = async () => {
        try {
            await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
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

    const isAdmin = profile?.role === 'superadmin' || profile?.role === 'admin';
    const isSuperAdmin = profile?.role === 'superadmin';

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            deviceId,
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
