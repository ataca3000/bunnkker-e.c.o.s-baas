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
        // Lógica de Verificación de Suscripción Local-First
        const checkSubscription = async () => {
            try {
                const expiresStr = localStorage.getItem('admin_sub_expires');
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
                    const defaultExpires = Date.now() + (30 * 24 * 60 * 60 * 1000);
                    localStorage.setItem('admin_sub_expires', defaultExpires.toString());
                    setIsSubscriptionLocked(false);
                    setDaysRemaining(30);
                }
            } catch (err) {
                console.error("Error verificando suscripción:", err);
            }
        };

        checkSubscription();
    }, [isOnline]);

    useEffect(() => {
        setMounted(true);
        const updateOnlineStatus = () => {
            setIsOnline(window.navigator.onLine);
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();

        const interval = setInterval(() => {
            setIsOnline(window.navigator.onLine);
        }, 3600000);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    const handleManualUnlock = () => {
        setLoading(true);
        setTimeout(() => {
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

    // Soberanía Local-First: La app inicia con Licencia VIP de entrada sin bloqueos de PIN.
    // El control de ventas (100 ventas + 20 de colchón) se gestiona a través del contador
    // monotónico en /api/sales/counter y FreemiumLockModal.
    if (mounted && isSubscriptionLocked) {
        // No bloqueamos en seco con PIN; dejamos fluir la operación de entrada
        setIsSubscriptionLocked(false);
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
