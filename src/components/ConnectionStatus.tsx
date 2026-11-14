"use client";

import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, X, AlertTriangle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useERPStore } from '@/store/useERPStore';
import { getSyncErrorDescriptor } from '@/lib/syncErrorCodes';
import { flushOfflineOrderQueue } from '@/lib/indexedDBCart';
import { forceReconnectInventorySockets } from '@/lib/inventorySocketControl';

export default function ConnectionStatus() {
    const firebaseStatus = useERPStore((s) => s.firebaseStatus);
    const syncErrorCode = useERPStore((s) => s.syncErrorCode);
    const syncErrorDetail = useERPStore((s) => s.syncErrorDetail);
    const pendingOfflineCount = useERPStore((s) => s.pendingOfflineCount);
    const reconnectAttempt = useERPStore((s) => s.reconnectAttempt);

    const [navigatorOnline, setNavigatorOnline] = useState(true);
    const [dismissed, setDismissed] = useState(false);
    const [showRecovered, setShowRecovered] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const wasOfflineRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setNavigatorOnline(navigator.onLine);

        const onOnline = () => {
            setNavigatorOnline(true);
            setDismissed(false);
            window.dispatchEvent(new CustomEvent('bunkker_force_resync'));
        };
        const onOffline = () => {
            setNavigatorOnline(false);
            setDismissed(false);
        };

        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    const isOfflineState = !navigatorOnline || firebaseStatus === 'offline';
    const hasProblem = isOfflineState || Boolean(syncErrorCode) || pendingOfflineCount > 0;

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (isOfflineState) {
            wasOfflineRef.current = true;
            setShowRecovered(false);
            setDismissed(false);
        } else if (wasOfflineRef.current && !hasProblem) {
            wasOfflineRef.current = false;
            setShowRecovered(true);
            setDismissed(false);
            timer = setTimeout(() => {
                setShowRecovered(false);
            }, 3500);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isOfflineState, hasProblem]);

    const handleManualRetry = async () => {
        setIsRetrying(true);
        try {
            await flushOfflineOrderQueue();
            forceReconnectInventorySockets();
        } finally {
            setTimeout(() => setIsRetrying(false), 700);
        }
    };

    const visible = !dismissed && (hasProblem || showRecovered);
    const descriptor = getSyncErrorDescriptor(syncErrorCode || (!navigatorOnline ? 'ERR_NET_OFFLINE' : null));

    const tone = isOfflineState
        ? {
            bg: 'rgba(127, 29, 29, 0.92)',
            border: 'rgba(248, 113, 113, 0.45)',
            text: '#fef2f2',
            sub: '#fecaca',
            dot: '#ef4444',
        }
        : hasProblem
            ? {
                bg: 'rgba(120, 53, 15, 0.92)',
                border: 'rgba(251, 191, 36, 0.45)',
                text: '#fffbeb',
                sub: '#fde68a',
                dot: '#f59e0b',
            }
            : {
                bg: 'rgba(6, 78, 59, 0.92)',
                border: 'rgba(52, 211, 153, 0.45)',
                text: '#ecfdf5',
                sub: '#a7f3d0',
                dot: '#10b981',
            };

    const Icon = isOfflineState ? WifiOff : isRetrying ? RefreshCw : hasProblem ? AlertTriangle : Wifi;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="conn-toast"
                    initial={{ opacity: 0, y: -16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className="fixed top-[72px] right-4 z-[99990] max-w-[360px] rounded-2xl px-3.5 py-2.5 shadow-2xl backdrop-blur-md select-none"
                    style={{
                        background: tone.bg,
                        border: `1px solid ${tone.border}`,
                        color: tone.text,
                    }}
                >
                    <div className="flex items-start gap-2.5">
                        <span className="relative mt-1 shrink-0">
                            <span
                                className="block w-2 h-2 rounded-full"
                                style={{ backgroundColor: tone.dot }}
                            />
                            {hasProblem && (
                                <span
                                    className="absolute inset-0 rounded-full opacity-50 animate-ping"
                                    style={{ backgroundColor: tone.dot }}
                                />
                            )}
                        </span>

                        <Icon
                            size={15}
                            className={`mt-0.5 shrink-0 ${isRetrying ? 'animate-spin' : ''}`}
                        />

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-black uppercase tracking-wider leading-tight">
                                    {descriptor?.title || (showRecovered ? 'Conexión restaurada' : 'Sincronizando cola')}
                                </span>
                                {descriptor?.code && (
                                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/30 border border-white/15">
                                        {descriptor.code}
                                    </span>
                                )}
                            </div>

                            <p className="text-[11px] leading-snug mt-0.5" style={{ color: tone.sub }}>
                                {showRecovered && !hasProblem
                                    ? 'Todo el inventario y los pedidos están sincronizados.'
                                    : (syncErrorDetail || descriptor?.message || `${pendingOfflineCount} pedido(s) en espera de envío.`)}
                            </p>

                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {pendingOfflineCount > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/30">
                                        {pendingOfflineCount} en cola local
                                    </span>
                                )}
                                {reconnectAttempt > 0 && isOfflineState && (
                                    <span className="text-[10px] opacity-80">
                                        Intento #{reconnectAttempt}
                                    </span>
                                )}
                                {hasProblem && (
                                    <button
                                        type="button"
                                        onClick={handleManualRetry}
                                        disabled={isRetrying}
                                        className="ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <RotateCcw size={11} className={isRetrying ? 'animate-spin' : ''} />
                                        {isRetrying ? 'Reconectando...' : 'Reintentar'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setDismissed(true)}
                            className="p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                            title="Ocultar aviso"
                        >
                            <X size={13} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
