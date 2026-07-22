"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, ShieldCheck, KeyRound, Loader2, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DeviceLockScreen({ children }: { children: React.ReactNode }) {
    const { networkMode } = useAuth();
    const [isSubscriptionLocked, setIsSubscriptionLocked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [inputVal, setInputVal] = useState('');
    const [error, setError] = useState(false);
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

    // Evitar render en servidor y verificar conexión
    const [mounted, setMounted] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        // --- 1. Lógica de Verificación de Suscripción ---
        const checkSubscription = async () => {
            try {
                if (window.navigator.onLine) { // Sincronizar si hay conexión
                    const confSnap = await getDoc(doc(db, 'settings', 'site_config'));
                    const subData = confSnap.data();
                    const expiresAt = subData?.subscriptionExpiresAt?.toMillis?.() || (Date.now() + 30 * 24 * 60 * 60 * 1000);
                    localStorage.setItem('admin_sub_expires', expiresAt.toString());
                }

                // 2. Verificar localmente
                const expiresStr = localStorage.getItem('admin_sub_expires'); // Leer siempre de localStorage
                if (expiresStr) {
                    const expiresAt = parseInt(expiresStr, 10);
                    const now = Date.now();
                    const diffDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                    
                    if (now > expiresAt) {
                        setIsSubscriptionLocked(true);
                    } else {
                        setIsSubscriptionLocked(false);
                        setDaysRemaining(diffDays);
                    }
                } else {
                    // Primer arranque offline sin datos? Damos 30 días de gracia local
                    const defaultExpires = Date.now() + (30 * 24 * 60 * 60 * 1000);
                    localStorage.setItem('admin_sub_expires', defaultExpires.toString());
                    setIsSubscriptionLocked(false);
                    setDaysRemaining(30);
                }
            } catch (err) {
                console.error("Error verificando suscripción:", err);
            }
        };

        // --- 2. Configuración de Efectos y Listeners ---
        // Se establece a true para indicar que el componente ya se montó en el cliente.
        // Esto evita errores de renderizado en servidor (SSR) donde `window` y `localStorage` no existen.
        // Ver la guarda `if (!mounted) return null;` más abajo.
        setMounted(true); 

        // Función para actualizar el estado de la conexión y volver a verificar la suscripción
        const updateOnlineStatus = () => {
            setIsOnline(window.navigator.onLine);
            checkSubscription(); // Vuelve a verificar la suscripción al cambiar el estado de la red
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus(); // Establecer estado inicial al montar

        checkSubscription(); // Ejecutar la verificación al montar
        
        // Revisar periódicamente (cada hora)
        const interval = setInterval(checkSubscription, 3600000);

        // --- 3. Función de Limpieza ---
        return () => {
            clearInterval(interval);
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []); // El array de dependencias debe estar vacío para que se ejecute solo una vez al montar.

    const handleManualUnlock = () => {
        setLoading(true);
        setTimeout(() => {
            // PIN de emergencia o renovación offline: "999999" o "admin123"
            if (inputVal === '999999' || inputVal === 'admin123') {
                const newExpires = Date.now() + (30 * 24 * 60 * 60 * 1000);
                localStorage.setItem('admin_sub_expires', newExpires.toString());
                setIsSubscriptionLocked(false);
                setDaysRemaining(30);
                setInputVal('');
            } else {
                setError(true);
            }
            setLoading(false);
        }, 1000);
    };

    if (!mounted) return null;

    if (isSubscriptionLocked) {
        return (
            <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center font-sans">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none" />
                
                <AnimatePresence>
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative z-10 w-full max-w-md p-8 bg-slate-900/50 backdrop-blur-xl border border-red-500/20 rounded-[40px] shadow-2xl flex flex-col items-center text-center"
                    >
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500">
                            <Lock size={36} />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-2">
                            Suscripción Expirada
                        </h1>
                        <p className="text-slate-400 text-sm font-medium mb-8">
                            El periodo de licencia para este dispositivo ha concluido. Conéctate a internet para sincronizar tu pago automáticamente o ingresa un código de renovación.
                        </p>

                        {!isOnline && (
                            <div className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-400 p-4 rounded-2xl mb-8 flex items-center gap-3 text-left">
                                <WifiOff size={24} className="shrink-0" />
                                <div>
                                    <h4 className="font-bold text-sm uppercase">Sin Conexión</h4>
                                    <p className="text-xs">No podemos verificar tu pago en línea.</p>
                                </div>
                            </div>
                        )}

                        <div className="w-full mb-6">
                            <label className="block text-left text-[0.65rem] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2">Código de Renovación (6 dígitos)</label>
                            <input
                                type="password"
                                value={inputVal}
                                onChange={(e) => {
                                    setInputVal(e.target.value.replace(/\D/g, ''));
                                    setError(false);
                                }}
                                maxLength={6}
                                className={`w-full bg-slate-950 border-2 ${error ? 'border-red-500' : 'border-slate-800 focus:border-red-500'} rounded-2xl px-6 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none transition-all font-mono shadow-inner`}
                                placeholder="••••••"
                            />
                            {error && <p className="text-red-500 text-xs mt-2 uppercase font-bold animate-pulse">Código Inválido</p>}
                        </div>

                        <button
                            onClick={handleManualUnlock}
                            disabled={loading || inputVal.length < 6}
                            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-4 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-lg shadow-red-900/20"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <KeyRound size={20} />}
                            {loading ? 'Verificando...' : 'Desbloquear'}
                        </button>
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    return (
        <>
            {children}
            {/* Pequeño indicador de días restantes si quedan pocos (opcional) */}
            {daysRemaining !== null && daysRemaining <= 5 && daysRemaining > 0 && (
                <div className="fixed bottom-4 right-4 z-[9000] bg-orange-500 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                    Licencia expira en {daysRemaining} días
                </div>
            )}
        </>
    );
}
