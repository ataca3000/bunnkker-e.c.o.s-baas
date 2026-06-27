"use client";

import { createContext, useContext, useState, useEffect } from 'react';

import type { UserProfile } from '@/lib/types';

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
    const [user, setUser] = useState<any | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [networkMode, setNetworkMode] = useState({ isMaster: true, host: 'localhost', label: 'Detectando...' });

    useEffect(() => {
        // Detectar si somos Maestro o Nodo basado en la URL
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            const port = window.location.port;
            const isMaster = hostname === 'localhost' || hostname === '127.0.0.1';
            setNetworkMode({
                isMaster,
                host: hostname,
                label: isMaster ? 'SERVIDOR MAESTRO' : `NODO CONECTADO A ${hostname}:${port}`
            });

            // Si estamos en Electron, inicializar el Machine ID desde el host nativo
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

        const loadUser = async () => {
            try {
                const res = await fetch('/api/users/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        setUser(data.user);
                        setProfile({
                            uid: data.user.id,
                            email: data.user.email || '',
                            displayName: data.user.name,
                            role: data.user.role,
                            nodeAccess: [],
                            lastLogin: Date.now(),
                            isPremium: true
                        });
                    } else {
                        setUser(null);
                        setProfile(null);
                    }
                } else {
                    setUser(null);
                    setProfile(null);
                }
            } catch (err) {
                console.error("Error cargando perfil local:", err);
                setUser(null);
                setProfile(null);
                setIsReadOnly(true);
            } finally {
                setLoading(false);
            }
        };

        loadUser();

    }, [networkMode.isMaster]);

    const signOut = async () => {
        try {
            await fetch('/api/auth/session', { method: 'DELETE' });
            setUser(null);
            setProfile(null);
        } catch (error) {
            console.error('Error signing out', error);
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
