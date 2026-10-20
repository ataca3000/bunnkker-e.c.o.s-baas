"use client";

import React from 'react';
import { Search, DollarSign, Scale, Trash2, Camera, History, TerminalSquare, Settings, Zap } from 'lucide-react';

interface TactileShortcutsBarProps {
    onSearchClick: () => void;
    onCobrarClick: () => void;
    onScaleClick: () => void;
    onClearClick: () => void;
    onCameraClick: () => void;
    onHistoryClick: () => void;
    onCorteClick: () => void;
    onSettingsClick: () => void;
    canCobrar: boolean;
    scaleWeight?: number;
    scaleUnit?: string;
    isScaleConnected?: boolean;
}

export function TactileShortcutsBar({
    onSearchClick,
    onCobrarClick,
    onScaleClick,
    onClearClick,
    onCameraClick,
    onHistoryClick,
    onCorteClick,
    onSettingsClick,
    canCobrar,
    scaleWeight = 0,
    scaleUnit = 'kg',
    isScaleConnected = false,
}: TactileShortcutsBarProps) {
    const triggerHaptic = () => {
        try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(15);
            }
        } catch {}
    };

    return (
        <div className="w-full bg-zinc-950/80 backdrop-blur-md border-b border-white/10 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto hide-scrollbar shrink-0 select-none z-20">
            {/* F1: Buscar */}
            <button
                onClick={() => { triggerHaptic(); onSearchClick(); }}
                className="flex min-h-12 items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-all active:scale-95 text-xs font-semibold shrink-0"
                title="Buscar o enfocar escáner (F1 o /)"
            >
                <Search className="w-3.5 h-3.5 text-blue-400" />
                <span>Buscar</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 text-zinc-400 border border-white/10">F1</span>
            </button>

            {/* F2: Cobrar Caja */}
            <button
                onClick={() => { triggerHaptic(); onCobrarClick(); }}
                disabled={!canCobrar}
                className={`flex min-h-14 items-center gap-2 px-5 py-3 rounded-xl transition-all active:scale-95 text-sm font-black uppercase tracking-wider shrink-0 ${
                    canCobrar
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                }`}
                title="Cobrar en caja (F2 o Espacio)"
            >
                <DollarSign className="w-4 h-4 font-black" />
                <span>Cobrar</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/30 text-black font-bold">F2</span>
            </button>

            {/* F3: Báscula Bluetooth */}
            <button
                onClick={() => { triggerHaptic(); onScaleClick(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all active:scale-95 text-xs font-semibold shrink-0 ${
                    isScaleConnected
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/5'
                }`}
                title="Báscula de pesaje BLE / Serial (F3)"
            >
                <Scale className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                    {isScaleConnected ? `${scaleWeight.toFixed(3)} ${scaleUnit}` : 'Báscula'}
                </span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 text-zinc-400 border border-white/10">F3</span>
            </button>

            {/* F5: Cámara Escáner */}
            <button
                onClick={() => { triggerHaptic(); onCameraClick(); }}
                className="flex min-h-12 items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-all active:scale-95 text-xs font-semibold shrink-0"
                title="Escanear con cámara (F5 o C)"
            >
                <Camera className="w-3.5 h-3.5 text-indigo-400" />
                <span>Cámara</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 text-zinc-400 border border-white/10">F5</span>
            </button>

            {/* F8: Historial Tickets */}
            <button
                onClick={() => { triggerHaptic(); onHistoryClick(); }}
                className="flex min-h-12 items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-all active:scale-95 text-xs font-semibold shrink-0"
                title="Bitácora de Tickets y Reimpresión (F8)"
            >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>Tickets</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 text-zinc-400 border border-white/10">F8</span>
            </button>

            {/* F10: Corte Caja Ciego */}
            <button
                onClick={() => { triggerHaptic(); onCorteClick(); }}
                className="flex min-h-12 items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-all active:scale-95 text-xs font-semibold shrink-0"
                title="Corte de Caja Ciego (F10)"
            >
                <TerminalSquare className="w-3.5 h-3.5 text-rose-400" />
                <span>Corte</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 text-zinc-400 border border-white/10">F10</span>
            </button>

            {/* F4: Limpiar Carrito */}
            <button
                onClick={() => { triggerHaptic(); onClearClick(); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-white/5 transition-all active:scale-95 text-xs font-medium shrink-0 ml-auto"
                title="Vaciar carrito (F4)"
            >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Vaciar</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 text-zinc-400 border border-white/10">F4</span>
            </button>

            {/* Configuración */}
            <button
                onClick={() => { triggerHaptic(); onSettingsClick(); }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5 transition-all active:scale-95 shrink-0"
                title="Ajustes de Panel y Caja"
            >
                <Settings className="w-4 h-4" />
            </button>
        </div>
    );
}
