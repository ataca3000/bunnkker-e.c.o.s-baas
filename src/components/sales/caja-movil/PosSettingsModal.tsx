"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Volume2, Scale, Printer, LayoutGrid, Check, X, Bell, Zap, Shield, Smartphone, Sliders } from 'lucide-react';
import { playSupermarketBeep, playIncrementBeep, playErrorBeep } from '@/lib/scannerAudio';
import { toast } from '@/lib/toast';
import HardwareSettingsModal from '@/components/hardware/HardwareSettingsModal';

export interface PosConfig {
    soundEnabled: boolean;
    soundVolume: number;
    scaleUnit: 'kg' | 'g' | 'lb';
    scaleDefaultMode: 'bluetooth' | 'serial' | 'simulated';
    showTouchShortcuts: boolean;
    autoPrintReceipt: boolean;
    receiptCopies: 'both' | 'cliente' | 'tienda';
    showAisleInfo: boolean; // Modo Pasillo
    cajaName: string;
}

export const DEFAULT_POS_CONFIG: PosConfig = {
    soundEnabled: true,
    soundVolume: 0.3,
    scaleUnit: 'kg',
    scaleDefaultMode: 'bluetooth',
    showTouchShortcuts: true,
    autoPrintReceipt: true,
    receiptCopies: 'both',
    showAisleInfo: true,
    cajaName: 'Caja Principal 01',
};

interface PosSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: PosConfig;
    onSaveConfig: (newConfig: PosConfig) => void;
}

export function PosSettingsModal({ isOpen, onClose, config, onSaveConfig }: PosSettingsModalProps) {
    const [localConfig, setLocalConfig] = useState<PosConfig>(config);
    const [hardwareOpen, setHardwareOpen] = useState(false);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSaveConfig(localConfig);
        try {
            localStorage.setItem('_bunkker_pos_config', JSON.stringify(localConfig));
            toast.success('Configuración de caja y panel guardada.');
        } catch {}
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-white flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/80">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            <Settings className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base">Configuración de Panel & Caja POS</h3>
                            <p className="text-xs text-zinc-400">Personaliza escáner, báscula, atajos táctiles y tickets</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Formulario de opciones */}
                <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
                    
                    {/* Sección 1: Pitido y Audio Supermercado */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-white flex items-center gap-2 text-sm">
                                <Volume2 className="w-4 h-4 text-cyan-400" />
                                Pitido Acústico Tipo Supermercado
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={localConfig.soundEnabled}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                        </div>
                        <p className="text-zinc-400 text-[11px]">
                            Emite un pitido cristalino al escanear o incrementar (+1) productos con pistola láser o cámara.
                        </p>
                        {localConfig.soundEnabled && (
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => playSupermarketBeep(localConfig.soundVolume)}
                                    className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold hover:bg-cyan-500/30 active:scale-95"
                                >
                                    Probar Pitido (1er escaneo)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => playIncrementBeep(localConfig.soundVolume)}
                                    className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/30 active:scale-95"
                                >
                                    Probar (+1 ráfaga)
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Sección 2: Báscula Bluetooth / Serial */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-white flex items-center gap-2 text-sm">
                                <Scale className="w-4 h-4 text-purple-400" />
                                Báscula de Pesaje
                            </span>
                            <span className="text-[10px] uppercase font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                                BLE & Web Serial
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-zinc-400 block mb-1">Unidad Predeterminada</label>
                                <select
                                    value={localConfig.scaleUnit}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, scaleUnit: e.target.value as any }))}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                                >
                                    <option value="kg">Kilogramos (kg)</option>
                                    <option value="g">Gramos (g)</option>
                                    <option value="lb">Libras (lb)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-zinc-400 block mb-1">Modo por Defecto</label>
                                <select
                                    value={localConfig.scaleDefaultMode}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, scaleDefaultMode: e.target.value as any }))}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                                >
                                    <option value="bluetooth">Bluetooth (Inalámbrico)</option>
                                    <option value="serial">USB Serial (Cable)</option>
                                    <option value="simulated">Virtual / Simulado</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Sección 3: Atajos Táctiles y Comandos */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-white flex items-center gap-2 text-sm">
                                <Smartphone className="w-4 h-4 text-emerald-400" />
                                Barra de Atajos Táctiles en Pantalla
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={localConfig.showTouchShortcuts}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, showTouchShortcuts: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>
                        <p className="text-zinc-400 text-[11px]">
                            Muestra botones táctiles rápidos (F1 Buscar, F2 Cobrar, F3 Báscula, F5 Cámara, F8 Tickets, F10 Corte) para monitores touch y tablets de mostrador.
                        </p>
                    </div>

                    {/* Sección 4: Modo Pasillo y Ubicación Física */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-white flex items-center gap-2 text-sm">
                                <LayoutGrid className="w-4 h-4 text-amber-400" />
                                Modo Pasillo / Ubicación en Bodega
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={localConfig.showAisleInfo}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, showAisleInfo: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>
                        <p className="text-zinc-400 text-[11px]">
                            Visualiza el pasillo, estante y fila de cada producto directo en el catálogo y carrito para picking rápido.
                        </p>
                    </div>

                    {/* Sección 5: Tickets y Comprobantes */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <span className="font-bold text-white flex items-center gap-2 text-sm">
                            <Printer className="w-4 h-4 text-blue-400" />
                            Comprobantes y Tickets
                        </span>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-zinc-400 block mb-1">Copias a Generar</label>
                                <select
                                    value={localConfig.receiptCopies}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, receiptCopies: e.target.value as any }))}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                                >
                                    <option value="both">Doble Copia (Cliente + Tienda)</option>
                                    <option value="cliente">Solo Copia Cliente</option>
                                    <option value="tienda">Solo Copia Tienda</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-zinc-400 block mb-1">Nombre de Terminal / Caja</label>
                                <input
                                    type="text"
                                    value={localConfig.cajaName}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, cajaName: e.target.value }))}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                                    placeholder="Caja Mostrador 01"
                                />
                            </div>
                        </div>

                        {/* Botón Vinculación de Impresoras (Bluetooth, USB o Red LAN Wi-Fi PC) */}
                        <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2">
                            <span className="text-[11px] text-zinc-400">
                                Conexión directa a impresora USB, Bluetooth o Wi-Fi PC:
                            </span>
                            <button
                                type="button"
                                onClick={() => setHardwareOpen(true)}
                                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold hover:bg-cyan-500/30 transition-all flex items-center gap-1.5 shrink-0"
                            >
                                <Sliders className="w-3.5 h-3.5" />
                                Vincular Periféricos
                            </button>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-zinc-900/80 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-1.5"
                    >
                        <Check className="w-4 h-4" />
                        Guardar Preferencias
                    </button>
                </div>
            </div>

            {/* Modal de Dispositivos y Hardware */}
            <HardwareSettingsModal 
                isOpen={hardwareOpen} 
                onClose={() => setHardwareOpen(false)} 
            />
        </div>
    );
}
