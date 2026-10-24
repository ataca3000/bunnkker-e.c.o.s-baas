"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { Printer, Radio, Wifi, Sliders, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getPendingPrintJobsCount, flushPendingPrintJobs } from '@/lib/thermalPrinter';
import HardwareSettingsModal from './HardwareSettingsModal';
import { toast } from '@/lib/toast';

export default function StationHardwareHUD() {
    const { profile } = useAuth();
    const pathname = usePathname();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingPrints, setPendingPrints] = useState(0);
    const [isFlushing, setIsFlushing] = useState(false);
    const [printerMode, setPrinterMode] = useState<string>('serial');

    // Solo para roles del sistema y EXCLUSIVAMENTE dentro del dashboard administrativo (nunca en el catálogo virtual)
    const isStaff = profile?.role && [
        'superadmin', 'admin', 'sales', 'caja', 'inventory', 'almacen', 'driver', 'delivery', 'patio', 'carga_descarga', 'billing'
    ].includes(profile.role);

    const isDashboard = pathname?.startsWith('/dashboard');

    useEffect(() => {
        if (!isStaff || !isDashboard || typeof window === 'undefined') return;

        const checkConfigAndQueue = () => {
            try {
                const count = getPendingPrintJobsCount();
                setPendingPrints(count);

                const raw = localStorage.getItem('_bunkker_hardware_config');
                if (raw) {
                    const cfg = JSON.parse(raw);
                    setPrinterMode(cfg.printerMode || 'serial');
                }
            } catch {}
        };

        checkConfigAndQueue();
        const interval = setInterval(checkConfigAndQueue, 4000);
        return () => clearInterval(interval);
    }, [isStaff, isDashboard]);

    if (!isStaff || !isDashboard) return null;

    const handleFlush = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFlushing(true);
        try {
            const res = await flushPendingPrintJobs();
            if (res.printed > 0) {
                toast.success(`${res.printed} tickets impresos exitosamente.`);
            } else if (res.failed > 0) {
                toast.warning(`${res.failed} tickets no se pudieron imprimir. Revisa conexión.`);
            }
            setPendingPrints(getPendingPrintJobsCount());
        } catch {
            toast.error('Error al procesar cola de impresión.');
        } finally {
            setIsFlushing(false);
        }
    };

    return (
        <>
            {/* Pill flotante de Telemetría de Hardware */}
            <aside 
                aria-label="Telemetría de Hardware"
                className="fixed bottom-6 right-6 z-[2000] hidden sm:flex items-center gap-2 bg-slate-950/90 border border-cyan-500/30 rounded-2xl p-1.5 px-3 shadow-2xl backdrop-blur-xl text-xs select-none hover:border-cyan-400 transition-all cursor-pointer group"
                onClick={() => setIsModalOpen(true)}
                title="Configurar Impresoras, Escáneres y Hardware de Estación"
            >
                {/* Impresora */}
                <div className="flex items-center gap-1.5 text-slate-300">
                    <Printer size={13} className="text-cyan-400" />
                    <span className="font-bold text-[10px] uppercase text-cyan-300 font-mono">
                        {printerMode === 'network' ? 'WI-FI PC' : printerMode === 'bluetooth' ? 'BT' : 'USB'}
                    </span>
                </div>

                <span className="w-1 h-1 rounded-full bg-slate-700" />

                {/* Cola de Impresión Offline */}
                {pendingPrints > 0 ? (
                    <button
                        onClick={handleFlush}
                        disabled={isFlushing}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black animate-pulse hover:bg-amber-500/30 transition-all"
                        title="Hay tickets pendientes por fallo de Wi-Fi. Clic para forzar impresión."
                    >
                        <RefreshCw size={11} className={isFlushing ? 'animate-spin' : ''} />
                        <span>{pendingPrints} en cola</span>
                    </button>
                ) : (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="hidden md:inline">Listo</span>
                    </div>
                )}

                <span className="w-1 h-1 rounded-full bg-slate-700" />

                {/* Botón Acceso Rápido Ajustes */}
                <div className="p-1 rounded-lg bg-slate-900 group-hover:bg-cyan-500/20 text-slate-400 group-hover:text-cyan-300 transition-colors">
                    <Sliders size={12} />
                </div>
            </aside>

            {/* Modal de Dispositivos */}
            <HardwareSettingsModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setPendingPrints(getPendingPrintJobsCount());
                }}
            />
        </>
    );
}
