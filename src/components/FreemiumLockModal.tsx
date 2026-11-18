"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Zap, CreditCard, Key, ShoppingCart, Sparkles, AlertCircle } from 'lucide-react';
import { checkLicenseStatus, activateLicenseOffline } from '@/lib/license';
import { toast } from '@/lib/toast';

const TRIAL_SALES_TARGET = 100;
const HARD_SALES_LIMIT = 120; // 100 ventas de prueba + 20 de colchón

export default function FreemiumLockModal() {
    const [isLocked, setIsLocked] = useState(false);
    const [inGrace, setInGrace] = useState(false);
    const [remainingGrace, setRemainingGrace] = useState(20);
    const [pinInput, setPinInput] = useState('');
    const [activating, setActivating] = useState(false);
    const [salesCount, setSalesCount] = useState(0);
    const [showPinInput, setShowPinInput] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkStatus = async () => {
            if (typeof document !== 'undefined' && !document.cookie.includes('msj-session=')) {
                return;
            }
            try {
                const res = await fetch('/api/sales/counter', {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const contentType = res.headers.get('content-type') || '';
                if (!res.ok || !contentType.includes('application/json')) {
                    return;
                }
                const data = await res.json().catch(() => null);
                if (!isMounted || !data || !data.success) return;

                setSalesCount(data.lifetimeSales || 0);
                if (data.isSubscribed) {
                    setIsLocked(false);
                    setInGrace(false);
                    return;
                }

                if (data.isLocked) {
                    setIsLocked(true);
                    setInGrace(false);
                } else if (data.inGracePeriod) {
                    setIsLocked(false);
                    setInGrace(true);
                    setRemainingGrace(data.remainingGrace);
                } else {
                    setIsLocked(false);
                    setInGrace(false);
                }
            } catch {
                // Silencioso ante cortes transitorios de red o recompilación del servidor local
            }
        };

        void checkStatus();
        const interval = setInterval(() => void checkStatus(), 30000); // Revisar cada 30 seg
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const handleActivatePin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!pinInput.trim()) return;
        setActivating(true);

        const result = activateLicenseOffline(pinInput);
        setActivating(false);

        if (result.success) {
            toast.success(result.message, '🎉 Licencia VIP Activada');
            setIsLocked(false);
            setInGrace(false);
            setPinInput('');
        } else {
            toast.error(result.message, '❌ Código o PIN Inválido');
        }
    };

    // Barra sutil de colchón cuando están entre la venta 100 y 119
    if (inGrace && !isLocked) {
        return (
            <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9990] bg-gradient-to-r from-amber-500/90 to-orange-600/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-2xl border border-amber-300/30 flex items-center gap-3 animate-bounce">
                <AlertCircle size={18} className="text-amber-200" />
                <span className="text-xs font-bold">
                    🚀 ¡Alcanzaste 100 ventas de prueba! Te restan <strong className="underline">{remainingGrace} ventas de cortesía</strong> para activar tu suscripción mensual ($349 MXN/mes).
                </span>
                <Link
                    href="/dashboard/suscripcion"
                    className="bg-white text-orange-900 font-extrabold text-[11px] px-3 py-1 rounded-full uppercase hover:bg-amber-100 transition-colors"
                >
                    Activar
                </Link>
            </div>
        );
    }

    if (!isLocked) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="max-w-lg w-full bg-slate-900 border-2 border-sky-500/50 rounded-3xl p-8 text-white shadow-2xl shadow-sky-950/50 relative overflow-hidden"
                >
                    {/* Glow background */}
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                        <div className="bg-sky-500/20 p-3 rounded-2xl text-sky-400">
                            <Sparkles size={32} />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-sky-400 tracking-widest uppercase block">
                                PRUEBA DE 100 + 20 VENTAS COMPLETADA
                            </span>
                            <h2 className="text-2xl font-black text-white">
                                ¡Felicidades por tus ventas!
                            </h2>
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ShoppingCart size={24} className="text-sky-400" />
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase">Ventas Acumuladas</p>
                                    <p className="text-lg font-black text-white">{salesCount} / {HARD_SALES_LIMIT}</p>
                                </div>
                            </div>
                            <span className="bg-emerald-500/20 text-emerald-300 font-extrabold text-xs px-3 py-1 rounded-full border border-emerald-500/30">
                                100 + 20 Completadas
                            </span>
                        </div>

                        <p className="text-sm text-slate-300 leading-relaxed">
                            Has comprobado que <strong className="text-white font-black">BUNKKER E.C.O.S.</strong> impulsa tu negocio. Para continuar cobrando sin límites de ventas, activa tu suscripción mensual.
                        </p>

                        <div className="bg-gradient-to-r from-sky-900/40 to-indigo-900/40 border border-sky-500/30 rounded-2xl p-5 text-center">
                            <span className="text-xs text-sky-400 font-black uppercase tracking-wider block mb-1">
                                SUSCRIPCIÓN MENSUAL ILIMITADA
                            </span>
                            <div className="text-4xl font-black text-white my-1">
                                $349 <span className="text-sm text-slate-400 font-normal">MXN / mes</span>
                            </div>
                            <p className="text-xs text-sky-200 mt-2">
                                Ventas ilimitadas · Cajas y Usuarios Ilimitados · Modo Offline · Facturación SAT
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Link
                            href="/dashboard/suscripcion"
                            className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-4 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-lg shadow-sky-500/20 text-base"
                        >
                            <CreditCard size={20} />
                            Activar Suscripción ($349 MXN / mes)
                        </Link>

                        {!showPinInput ? (
                            <button
                                type="button"
                                onClick={() => setShowPinInput(true)}
                                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 transition-colors pt-2"
                            >
                                ¿Tienes un código o PIN de activación offline? Haz clic aquí
                            </button>
                        ) : (
                            <form onSubmit={handleActivatePin} className="space-y-2 pt-2">
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Código / PIN de Activación
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
                                        className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-3 rounded-xl transition-all flex items-center gap-2 border border-slate-700"
                                    >
                                        <Key size={16} />
                                        Validar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-slate-500">
                        <span>Soberanía Local-First</span>
                        <span className="font-mono">BUNKKER E.C.O.S ERP</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
