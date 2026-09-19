"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Server, 
    Wifi, 
    WifiOff, 
    RefreshCw, 
    CheckCircle2, 
    AlertTriangle, 
    Database, 
    Activity, 
    Clock, 
    ChevronDown,
    Zap
} from 'lucide-react';
import { subscribeSyncStatus, triggerManualSync, type SyncState, getSyncState } from '@/lib/localSync';
import { toast } from '@/lib/toast';

interface SyncToolbarIndicatorProps {
    variant?: 'navbar' | 'admin' | 'compact';
    className?: string;
}

export default function SyncToolbarIndicator({ variant = 'navbar', className = '' }: SyncToolbarIndicatorProps) {
    const [syncState, setSyncState] = useState<SyncState>(getSyncState);
    const [isOpen, setIsOpen] = useState(false);
    const [isManualSyncing, setIsManualSyncing] = useState(false);
    const [lastSyncText, setLastSyncText] = useState('Reciente');
    const containerRef = useRef<HTMLDivElement>(null);

    // Suscripción en tiempo real al estado de sincronización local
    useEffect(() => {
        const unsubscribe = subscribeSyncStatus((newState) => {
            setSyncState(newState);
        });
        return () => unsubscribe();
    }, []);

    // Formatear tiempo relativo de última sincronización
    useEffect(() => {
        const updateRelativeTime = () => {
            if (!syncState.lastSyncTime) {
                setLastSyncText('Sin sincronizar');
                return;
            }
            const seconds = Math.floor((Date.now() - syncState.lastSyncTime) / 1000);
            if (seconds < 5) {
                setLastSyncText('Justo ahora');
            } else if (seconds < 60) {
                setLastSyncText(`Hace ${seconds}s`);
            } else {
                const minutes = Math.floor(seconds / 60);
                setLastSyncText(`Hace ${minutes}m`);
            }
        };

        updateRelativeTime();
        const interval = setInterval(updateRelativeTime, 3000);
        return () => clearInterval(interval);
    }, [syncState.lastSyncTime]);

    // Cerrar el popover al hacer clic fuera
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const handleForceSync = async () => {
        setIsManualSyncing(true);
        try {
            const result = await triggerManualSync();
            if (result.success) {
                toast.success('Sincronización con el servidor completada exitosamente.', '⚡ Sincronizado');
            } else if (result.queueRemaining > 0) {
                toast.warning(`Sincronización en curso. ${result.queueRemaining} operaciones pendientes en cola local.`, '⏳ Cola Local');
            } else {
                toast.warning('Servidor principal no responde. Los datos permanecen guardados de forma segura localmente.', '⚠️ Modo Local');
            }
        } catch (e) {
            toast.error('Error al sincronizar con el servidor principal.', 'Error de Red');
        } finally {
            setIsManualSyncing(false);
        }
    };

    const isOnline = syncState.status === 'online';
    const isSyncing = syncState.status === 'syncing' || isManualSyncing;
    const isOffline = syncState.status === 'offline';

    // Determinar colores y estilos
    let badgeBg = 'rgba(16, 185, 129, 0.12)';
    let badgeBorder = 'rgba(16, 185, 129, 0.28)';
    let badgeText = '#10b981';
    let dotColor = '#10b981';
    let label = 'SERVIDOR ACTIVO';

    if (isSyncing) {
        badgeBg = 'rgba(245, 158, 11, 0.15)';
        badgeBorder = 'rgba(245, 158, 11, 0.35)';
        badgeText = '#f59e0b';
        dotColor = '#f59e0b';
        label = syncState.pendingQueue > 0 ? `SINCRONIZANDO (${syncState.pendingQueue})` : 'SINCRONIZANDO';
    } else if (isOffline) {
        badgeBg = 'rgba(239, 68, 68, 0.15)';
        badgeBorder = 'rgba(239, 68, 68, 0.35)';
        badgeText = '#ef4444';
        dotColor = '#ef4444';
        label = 'MODO LOCAL (OFFLINE)';
    }

    return (
        <div ref={containerRef} className={`relative inline-flex items-center select-none ${className}`}>
            {/* Botón Indicador Persistente en Barra de Herramientas */}
            <button
                type="button"
                id="toolbar-sync-indicator-btn"
                onClick={() => setIsOpen(!isOpen)}
                title="Estado de conexión con el servidor principal en tiempo real"
                style={{
                    backgroundColor: badgeBg,
                    borderColor: badgeBorder,
                    color: badgeText,
                }}
                className={`
                    group flex items-center gap-2 px-2.5 py-1.5 rounded-full border 
                    transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                    text-xs font-black tracking-wider cursor-pointer shadow-sm
                    backdrop-blur-md outline-none
                    ${variant === 'compact' ? 'px-2 py-1' : ''}
                `}
            >
                {/* Punto indicador con animación de pulso */}
                <div className="relative flex items-center justify-center w-2.5 h-2.5">
                    <span 
                        className="block w-2 h-2 rounded-full transition-colors"
                        style={{ backgroundColor: dotColor }} 
                    />
                    {isOnline && (
                        <span 
                            className="absolute inset-0 rounded-full animate-ping opacity-60"
                            style={{ backgroundColor: dotColor }} 
                        />
                    )}
                    {isSyncing && (
                        <RefreshCw 
                            size={12} 
                            className="absolute animate-spin text-amber-500" 
                        />
                    )}
                    {isOffline && (
                        <span 
                            className="absolute inset-0 rounded-full animate-ping opacity-40"
                            style={{ backgroundColor: dotColor }} 
                        />
                    )}
                </div>

                {/* Ícono de Servidor */}
                <Server size={14} className="opacity-90 hidden xs:block" />

                {/* Texto del estado */}
                <span className="font-mono text-[11px] font-bold tracking-tight whitespace-nowrap hidden sm:inline">
                    {label}
                </span>

                {/* Latencia en tiempo real si está online */}
                {isOnline && syncState.latencyMs !== null && (
                    <span className="text-[10px] font-mono opacity-80 bg-black/20 px-1.5 py-0.5 rounded font-normal hidden md:inline">
                        {syncState.latencyMs}ms
                    </span>
                )}

                {/* Badge de operaciones pendientes si existen */}
                {syncState.pendingQueue > 0 && (
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                        {syncState.pendingQueue}
                    </span>
                )}

                <ChevronDown 
                    size={12} 
                    className={`transition-transform duration-200 opacity-70 ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>

            {/* Popover Detallado de Sincronización */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id="toolbar-sync-popover"
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="absolute top-full right-0 mt-2 w-80 sm:w-88 z-[99999] rounded-2xl bg-slate-950/95 border border-slate-800 text-slate-100 p-4 shadow-2xl backdrop-blur-2xl"
                        style={{
                            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        {/* Header del Popover */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                            <div className="flex items-center gap-2.5">
                                <div 
                                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: badgeBg, border: `1px solid ${badgeBorder}` }}
                                >
                                    {isOnline ? <Wifi size={16} className="text-emerald-400" /> : isSyncing ? <RefreshCw size={16} className="text-amber-400 animate-spin" /> : <WifiOff size={16} className="text-red-400" />}
                                </div>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                                        Sincronización Local
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                        Servidor Central ERP
                                    </p>
                                </div>
                            </div>

                            <span 
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                                style={{ backgroundColor: badgeBg, color: badgeText, border: `1px solid ${badgeBorder}` }}
                            >
                                {syncState.status}
                            </span>
                        </div>

                        {/* Métricas y Datos en Tiempo Real */}
                        <div className="space-y-2 mb-4 text-xs">
                            {/* Host / IP */}
                            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
                                <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                                    <Server size={13} className="text-sky-400" /> Host Servidor:
                                </span>
                                <span className="font-mono font-semibold text-slate-200 text-[11px] select-all">
                                    {syncState.serverIp}
                                </span>
                            </div>

                            {/* Latencia RTT */}
                            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
                                <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                                    <Activity size={13} className="text-emerald-400" /> Latencia Real:
                                </span>
                                <span className="font-mono font-bold text-[11px]">
                                    {syncState.latencyMs !== null ? (
                                        <span className="text-emerald-400">{syncState.latencyMs} ms (Óptima)</span>
                                    ) : (
                                        <span className="text-rose-400">Sin respuesta</span>
                                    )}
                                </span>
                            </div>

                            {/* Cola WAL Offline */}
                            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
                                <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                                    <Database size={13} className="text-amber-400" /> Cola Local WAL:
                                </span>
                                <span className="font-mono font-bold text-[11px]">
                                    {syncState.pendingQueue > 0 ? (
                                        <span className="text-amber-400 font-black">{syncState.pendingQueue} operaciones en espera</span>
                                    ) : (
                                        <span className="text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Al día (0 pendientes)
                                        </span>
                                    )}
                                </span>
                            </div>

                            {/* Última Sincronización */}
                            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
                                <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                                    <Clock size={13} className="text-purple-400" /> Último Sync:
                                </span>
                                <span className="font-mono text-slate-300 text-[11px]">
                                    {lastSyncText}
                                </span>
                            </div>
                        </div>

                        {/* Mensaje descriptivo */}
                        <div className="mb-4 text-[11px] text-slate-400 leading-relaxed bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/40">
                            {isOnline && syncState.pendingQueue === 0 && (
                                <p className="text-emerald-300/90 flex items-start gap-1.5">
                                    <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-400" />
                                    <span>Conexión bidireccional activa. Las ventas e inventario se confirman en el servidor central en tiempo real.</span>
                                </p>
                            )}
                            {isOnline && syncState.pendingQueue > 0 && (
                                <p className="text-amber-300/90 flex items-start gap-1.5">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                                    <span>Transmitiendo {syncState.pendingQueue} operaciones acumuladas al servidor principal...</span>
                                </p>
                            )}
                            {isOffline && (
                                <p className="text-rose-300/90 flex items-start gap-1.5">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-400" />
                                    <span>Trabajando en modo local autónomo. Todas tus operaciones se guardan de forma segura en la base de datos local y se sincronizarán al reconectar.</span>
                                </p>
                            )}
                        </div>

                        {/* Botón Forzar Sincronización */}
                        <button
                            type="button"
                            id="btn-force-manual-sync"
                            onClick={handleForceSync}
                            disabled={isManualSyncing}
                            className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-sky-900/30 cursor-pointer"
                        >
                            {isManualSyncing ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Sincronizando...</span>
                                </>
                            ) : (
                                <>
                                    <Zap size={14} className="text-amber-300" />
                                    <span>Sincronizar con Servidor Ahora</span>
                                </>
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
