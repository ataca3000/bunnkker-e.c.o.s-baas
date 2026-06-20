"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
    onAuthStateChanged,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

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
        }

        let unsubscribe = () => {};
        
        try {
            unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {

            setUser(firebaseUser);
            setIsReadOnly(false);

            if (firebaseUser) {
                document.cookie = `msj-session=${firebaseUser.uid}; path=/; max-age=86400; SameSite=Lax`;
                try {
                    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        document.cookie = `msj-role=${data.role || 'node'}; path=/; max-age=86400; SameSite=Lax`;
                        setProfile({
                            uid: firebaseUser.uid,
                            email: data.email || firebaseUser.email || '',
                            displayName: data.displayName || firebaseUser.displayName || '',
                            role: data.role || 'node',
                            nodeAccess: data.nodeAccess || [],
                            isPremium: data.isPremium || false,
                            recoveryEmail: data.recoveryEmail,
                            recoveryPhone: data.recoveryPhone,
                            twoFactorConfigured: data.twoFactorConfigured,
                            needsSetup: data.needsSetup || false,
                            lastLogin: data.lastLogin || Date.now()
                        });
                    } else {
                        // Create admin profile for first-time users
                        const newProfile: UserProfile = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email || '',
                            displayName: firebaseUser.displayName || 'Cliente',
                            role: 'client',
                            nodeAccess: [],
                            lastLogin: Date.now()
                        };
                        import('firebase/firestore').then(({ setDoc }) => {
                            setDoc(doc(db, 'users', firebaseUser.uid), newProfile).catch(console.error);
                        });
                        document.cookie = `msj-role=admin; path=/; max-age=86400; SameSite=Lax`;
                        setProfile(newProfile);
                    }
                } catch (err) {
                    console.error('Error loading user profile:', err);
                }
            } else {
                // Check if we have a local bypass session active
                const sessionCookie = typeof document !== 'undefined' 
                    ? document.cookie.split('; ').find(row => row.startsWith('msj-session='))
                    : null;
                const sessionUid = sessionCookie ? sessionCookie.split('=')[1] : null;

                if (sessionUid === 'local_owner') {
                    setProfile({
                        uid: 'local_owner',
                        email: 'admin@negocio.local',
                        displayName: 'DUEÑO DEL NEGOCIO',
                        role: 'superadmin',
                        nodeAccess: ['Todos'],
                        isPremium: false
                    });
                } else if (sessionUid) {
                    // Cargar perfil local desde Firestore
                    getDoc(doc(db, 'users', sessionUid)).then((userDoc: any) => {
                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            setProfile({
                                uid: sessionUid,
                                email: data.email || '',
                                displayName: data.displayName || 'Colaborador',
                                role: data.role || 'node',
                                nodeAccess: data.nodeAccess || ['Todos'],
                                recoveryEmail: data.recoveryEmail,
                                recoveryPhone: data.recoveryPhone,
                                isPremium: data.isPremium || false,
                                needsSetup: data.needsSetup || false,
                                lastLogin: data.lastLogin || Date.now()
                            });
                            setUser({ uid: sessionUid, email: data.email });
                        } else {
                            setProfile(null);
                            setUser(null);
                            document.cookie = 'msj-session=; path=/; max-age=0';
                            document.cookie = 'msj-role=; path=/; max-age=0';
                        }
                    }).catch(() => {
                        setProfile(null);
                        setUser(null);
                    });
                } else {
                    setProfile(null);
                    setUser(null);
                    document.cookie = 'msj-session=; path=/; max-age=0';
                    document.cookie = 'msj-role=; path=/; max-age=0';
                }
            }
            setLoading(false);
        });
        } catch (err) {
            console.warn("Iniciando en Modo Soberano (Local-Only)");
            
            // Si no hay internet o API Key, creamos una sesión local maestra
            if (!profile && networkMode.isMaster) {
                document.cookie = `msj-session=local_owner; path=/; max-age=86400; SameSite=Lax`;
                document.cookie = `msj-role=superadmin; path=/; max-age=86400; SameSite=Lax`;
                setProfile({
                    uid: 'local_owner',
                    email: 'admin@negocio.local',
                    displayName: 'DUEÑO DEL NEGOCIO',
                    role: 'superadmin',
                    nodeAccess: ['Todos'],
                    isPremium: false
                });
            }
            setIsReadOnly(false); // Permitimos escritura en la DB local
            setLoading(false);
        }

        return () => unsubscribe();
    }, [networkMode.isMaster]);

    const signOut = async () => {
        document.cookie = 'msj-session=; path=/; max-age=0';
        document.cookie = 'msj-role=; path=/; max-age=0';
        await firebaseSignOut(auth);
        setProfile(null);
        setIsReadOnly(false);
    };

    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
    const isSuperAdmin = profile?.role === 'superadmin';
    const isPremium = profile?.isPremium || false;

    return (
        <AuthContext.Provider value={{ 
            user, 
            profile, 
            loading, 
            signOut, 
            isAdmin, 
            isSuperAdmin, 
            isReadOnly, 
            isPremium,
            networkMode 
        }}>
            {children}
        </AuthContext.Provider>
    );
}


export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
