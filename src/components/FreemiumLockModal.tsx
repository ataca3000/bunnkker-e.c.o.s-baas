"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Zap, ShieldAlert, CreditCard, Key, CheckCircle2, ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { checkLicenseStatus, activateLicenseOffline } from '@/lib/license';
import { toast } from '@/lib/toast';

const FREEMIUM_SALES_LIMIT = 300;
const VALID_SALES_STATUSES = ['paid', 'COMPLETED', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function FreemiumLockModal() {
    const { orders } = useCart();
    const [isLocked, setIsLocked] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [activating, setActivating] = useState(false);
    const [salesCount, setSalesCount] = useState(0);

    useEffect(() => {
        const lic = checkLicenseStatus();
        const completedSales = orders.filter(o => VALID_SALES_STATUSES.includes(o.status)).length;
        setSalesCount(completedSales);

        // Bloqueo Freemium activa únicamente cuando se alcanzan 300 ventas y no hay licencia PRO activa
        if (lic.status !== 'active' && completedSales >= FREEMIUM_SALES_LIMIT) {
            setIsLocked(true);
        } else {
            setIsLocked(false);
        }
    }, [orders]);

    const handleActivatePin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!pinInput.trim()) return;
        setActivating(true);

        const result = activateLicenseOffline(pinInput);
        setActivating(false);

        if (result.success) {
            toast.success(result.message, '🎉 Licencia Activada');
            setIsLocked(false);
            setPinInput('');
        } else {
            toast.error(result.message, '❌ PIN Inválido');
        }
    };

    if (!isLocked) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="max-w-lg w-full bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-8 text-white shadow-2xl shadow-rose-950/50 relative overflow-hidden"
                >
                    {/* Glow background */}
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                        <div className="bg-rose-500/20 p-3 rounded-2xl text-rose-400">
                            <Lock size={32} />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-rose-400 tracking-widest uppercase block">
                                LÍMITE FREEMIUM ALCANZADO
                            </span>
                            <h2 className="text-2xl font-black text-white">
                                Dashboard & Caja Bloqueados
                            </h2>
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ShoppingCart size={24} className="text-sky-400" />
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase">Ventas Completadas</p>
                                    <p className="text-lg font-black text-white">{salesCount} / {FREEMIUM_SALES_LIMIT}</p>
                                </div>
                            </div>
                            <span className="bg-rose-500/20 text-rose-300 font-extrabold text-xs px-3 py-1 rounded-full border border-rose-500/30">
                                100% Agotado
                            </span>
                        </div>

                        <p className="text-sm text-slate-300 leading-relaxed">
                            Has alcanzado las <strong className="text-white font-black">300 ventas gratuitas</strong> de prueba sin costo. Para continuar vendiendo y desbloquear tu sistema ERP sin restricciones, activa la suscripción mensual.
                        </p>

                        <div className="bg-gradient-to-r from-sky-900/40 to-indigo-900/40 border border-sky-500/30 rounded-2xl p-5 text-center">
                            <span className="text-xs text-sky-400 font-black uppercase tracking-wider block mb-1">
                                PLAN SUSCRIPCIÓN MENSUAL PRO
                            </span>
                            <div className="text-4xl font-black text-white my-1">
                                $200 <span className="text-sm text-slate-400 font-normal">MXN / mes</span>
                            </div>
                            <p className="text-xs text-sky-200 mt-2">
                                Ventas ilimitadas · Multicaja WiFi · Facturación SAT · Soporte Técnico
                            </p>
                        </div>
                    </div>

                    {/* Desbloqueo por PIN u Online */}
                    <form onSubmit={handleActivatePin} className="space-y-3">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            ¿Tienes un PIN de desbloqueo o clave de licencia?
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Ej: 123456"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                maxLength={32}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono font-bold text-center outline-none focus:border-sky-500"
                            />
                            <button
                                type="submit"
                                disabled={activating}
                                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-5 py-3 rounded-xl transition-all flex items-center gap-2"
                            >
                                <Key size={18} />
                                Activar
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-xs">
                        <a
                            href="/dashboard/suscripcion"
                            className="text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition-colors"
                        >
                            <CreditCard size={14} /> Pagar $200 MXN en Línea
                        </a>
                        <span className="text-slate-500 font-mono">BUNKKER E.C.O.S ERP</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

