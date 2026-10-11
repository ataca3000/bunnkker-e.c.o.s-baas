"use client";

import React, { useState } from 'react';
import { Scale, Bluetooth, Usb, RefreshCw, X, Check, ArrowRight, Zap, ShieldCheck } from 'lucide-react';
import type { Product } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

interface ScaleModalProps {
    isOpen: boolean;
    onClose: () => void;
    scale: any; // Return type of useBluetoothScale
    cartItems: (Product & { quantity: number })[];
    onApplyWeightToItem: (productId: string, weight: number) => void;
}

export function ScaleModal({ isOpen, onClose, scale, cartItems, onApplyWeightToItem }: ScaleModalProps) {
    const [selectedItemId, setSelectedItemId] = useState<string>(cartItems[0]?.id || '');
    const [simulatedInput, setSimulatedInput] = useState<string>(scale.weight ? scale.weight.toString() : '0.500');

    if (!isOpen) return null;

    const handleApply = () => {
        if (!selectedItemId) return;
        const finalWeight = scale.weight > 0 ? scale.weight : parseFloat(simulatedInput) || 0;
        if (finalWeight > 0) {
            onApplyWeightToItem(selectedItemId, Number(finalWeight.toFixed(3)));
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-950 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] w-full max-w-lg overflow-hidden text-white flex flex-col"
            >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            <Scale className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base tracking-tight flex items-center gap-2">
                                Báscula de Pesaje Electrónica
                                {scale.isConnected && (
                                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                        {scale.connectionType === 'bluetooth' ? 'Bluetooth Activo' : scale.connectionType === 'serial' ? 'Serial USB' : 'Simulada'}
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-zinc-400">
                                {scale.deviceName || 'Conexión inalámbrica BLE / USB Serial para caja'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Display de Peso Digital */}
                <div className="p-6 flex flex-col items-center justify-center bg-black/60 relative border-b border-white/10">
                    {/* Status badges */}
                    <div className="w-full flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-2">
                        <span className={`flex items-center gap-1 font-bold ${scale.isStable ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}>
                            ● {scale.isStable ? 'ESTABLE' : 'PESANDO...'}
                        </span>
                        <span>TARA: {scale.tareWeight.toFixed(3)} {scale.unit}</span>
                        <span>BRUTO: {scale.grossWeight.toFixed(3)} {scale.unit}</span>
                    </div>

                    {/* Visor LCD de 7 segmentos estilizado */}
                    <div className="w-full bg-zinc-900 border-2 border-cyan-500/40 rounded-xl p-5 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] flex items-baseline justify-center gap-3">
                        <span className="font-mono text-5xl sm:text-6xl font-black text-cyan-300 tracking-tight drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                            {scale.weight.toFixed(3)}
                        </span>
                        <span className="text-2xl font-bold font-mono text-cyan-400 uppercase tracking-widest">
                            {scale.unit}
                        </span>
                    </div>

                    {/* Acciones de Báscula (Tarar / Cambiar Unidad) */}
                    <div className="flex gap-2 w-full mt-4">
                        <button
                            onClick={scale.tare}
                            className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-white/10 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                            Tarar a Cero (0.000)
                        </button>
                        <div className="flex rounded-xl bg-zinc-800 p-0.5 border border-white/10">
                            {(['kg', 'g', 'lb'] as const).map(u => (
                                <button
                                    key={u}
                                    onClick={() => scale.setUnit(u)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                        scale.unit === u ? 'bg-cyan-500 text-black shadow' : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    {u}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Selección y Asignación a Producto del Carrito */}
                <div className="p-6 space-y-4 flex-1">
                    <div>
                        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2">
                            Asignar peso al producto en venta
                        </label>
                        {cartItems.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic p-3 bg-zinc-900/50 rounded-xl border border-white/5">
                                Agrega primero productos a granel o por kilo al carrito para asignarles el peso de la báscula.
                            </p>
                        ) : (
                            <select
                                value={selectedItemId}
                                onChange={(e) => setSelectedItemId(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-sm font-medium text-white focus:border-cyan-500 focus:outline-none"
                            >
                                {cartItems.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} — ${item.price.toFixed(2)} c/u (Actual: {item.quantity} {item.unitType || 'pzas/kg'})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Modo Simulación o Ajuste Rápido */}
                    {!scale.isConnected && (
                        <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-xs space-y-2">
                            <div className="flex items-center justify-between text-cyan-300 font-bold">
                                <span>Simulador de peso (Testing)</span>
                                <button 
                                    onClick={() => scale.toggleSimulated()} 
                                    className="text-[11px] underline text-cyan-400 hover:text-cyan-200"
                                >
                                    {scale.isSimulated ? 'Desactivar virtual' : 'Activar báscula virtual'}
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    step="0.050"
                                    min="0"
                                    value={simulatedInput}
                                    onChange={(e) => {
                                        setSimulatedInput(e.target.value);
                                        const v = parseFloat(e.target.value);
                                        if (!isNaN(v)) scale.setManualWeight(v);
                                    }}
                                    placeholder="0.500"
                                    className="w-28 bg-black/60 border border-cyan-500/30 rounded-lg px-2.5 py-1 text-sm font-mono text-white text-center font-bold"
                                />
                                <span className="text-zinc-400">kg manual</span>
                                <div className="flex gap-1 ml-auto">
                                    {[0.25, 0.5, 1.0, 2.5].map(w => (
                                        <button
                                            key={w}
                                            onClick={() => {
                                                setSimulatedInput(w.toString());
                                                scale.setManualWeight(w);
                                            }}
                                            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono"
                                        >
                                            +{w}k
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Botones de Conexión de Hardware */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                            onClick={scale.connectBluetooth}
                            disabled={scale.isConnecting}
                            className="p-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <Bluetooth className="w-4 h-4 text-blue-400" />
                            Emparejar Bluetooth
                        </button>
                        <button
                            onClick={scale.connectSerial}
                            disabled={scale.isConnecting}
                            className="p-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <Usb className="w-4 h-4 text-purple-400" />
                            Puerto USB Serial
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between">
                    {scale.isConnected && (
                        <button
                            onClick={scale.disconnect}
                            className="text-xs text-red-400 hover:text-red-300 font-medium underline"
                        >
                            Desconectar báscula
                        </button>
                    )}
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold"
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={cartItems.length === 0}
                            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 active:scale-95"
                        >
                            <Check className="w-4 h-4" />
                            Aplicar Peso al Carrito
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
