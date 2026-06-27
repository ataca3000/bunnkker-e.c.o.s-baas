"use client";

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@bunkker/core';
import { waitForPendingWrites } from 'firebase/firestore';

export default function ConnectionStatus() {
    const [isOnline, setIsOnline]     = useState(true);
    const [showBanner, setShowBanner] = useState(false);
    const [isSyncing, setIsSyncing]   = useState(false);

    useEffect(() => {
        let reconnectTimer: ReturnType<typeof setTimeout>;

        const handleOffline = () => {
            setIsOnline(false);
            setShowBanner(true);
            setIsSyncing(false);
        };

        const handleOnline = async () => {
            setIsOnline(true);
            setIsSyncing(true);
            setShowBanner(true);

            try {
                await waitForPendingWrites(db);
            } catch (err) {
                console.warn('Error syncing pending writes:', err);
            }

            setIsSyncing(false);

            reconnectTimer = setTimeout(() => {
                setShowBanner(false);
            }, 3500);
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online',  handleOnline);
        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online',  handleOnline);
            clearTimeout(reconnectTimer);
        };
    }, []);

    /* ── Color tokens ─────────────────────────────────────────── */
    const colors = {
        offline:  { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.30)',  text: '#991b1b',  dot: '#ef4444' },
        syncing:  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', text: '#92400e',  dot: '#f59e0b' },
        online:   { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#065f46',  dot: '#10b981' },
    };

    const state  = !isOnline ? 'offline' : isSyncing ? 'syncing' : 'online';
    const color  = colors[state];

    const label = !isOnline
        ? 'SIN CONEXIÓN — cambios en cola local.'
        : isSyncing
            ? 'SINCRONIZANDO con Firestore…'
            : 'CONEXIÓN RESTAURADA — Todo sincronizado.';

    const Icon = !isOnline ? WifiOff : isSyncing ? RefreshCw : Wifi;

    return (
        <AnimatePresence>
            {showBanner && (
                <motion.div
                    key="conn-toast"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0,  scale: 1    }}
                    exit={{    opacity: 0, y: 20,  scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    style={{
                        position:       'fixed',
                        bottom:         '24px',
                        right:          '24px',
                        zIndex:         99999,
                        display:        'flex',
                        alignItems:     'center',
                        gap:            '10px',
                        padding:        '12px 16px',
                        borderRadius:   '16px',
                        background:     color.bg,
                        border:         `1px solid ${color.border}`,
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        boxShadow:      '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
                        color:          color.text,
                        fontSize:       '0.72rem',
                        fontWeight:     '700',
                        letterSpacing:  '0.04em',
                        maxWidth:       '340px',
                        userSelect:     'none',
                    }}
                >
                    {/* Pulsing dot */}
                    <span style={{ position: 'relative', flexShrink: 0 }}>
                        <span style={{
                            display:         'block',
                            width:           '8px',
                            height:          '8px',
                            borderRadius:    '50%',
                            backgroundColor: color.dot,
                        }} />
                        {state !== 'online' && (
                            <span style={{
                                position:        'absolute',
                                inset:           0,
                                borderRadius:    '50%',
                                backgroundColor: color.dot,
                                opacity:         0.4,
                                animation:       'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
                            }} />
                        )}
                    </span>

                    <Icon
                        size={14}
                        style={{ flexShrink: 0, animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}
                    />

                    <span style={{ flex: 1 }}>{label}</span>

                    {/* Dismiss button */}
                    <button
                        onClick={() => setShowBanner(false)}
                        style={{
                            background:   'transparent',
                            border:       'none',
                            cursor:       'pointer',
                            color:        color.text,
                            padding:      '2px',
                            borderRadius: '6px',
                            display:      'flex',
                            alignItems:   'center',
                            opacity:      0.7,
                            flexShrink:   0,
                        }}
                        title="Cerrar"
                    >
                        <X size={12} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
