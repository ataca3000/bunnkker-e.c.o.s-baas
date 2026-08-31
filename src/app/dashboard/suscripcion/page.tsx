"use client";

import { motion } from 'framer-motion';
import { Check, Wifi, Cloud, Globe, Sparkles, Server, Zap, ShieldCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { toast } from '@/lib/toast';

// ── Stripe Price IDs ─────────────────────────────────────────────────────────
// IMPORTANTE: Reemplaza estos IDs con los reales de tu dashboard de Stripe:
// https://dashboard.stripe.com/products
// Formato: price_XXXXXXXXXXXXXXXXXXXXXXXX
const STRIPE_PRICE_IDS = {
    local:  process.env.NEXT_PUBLIC_STRIPE_PRICE_LOCAL  || 'price_local_placeholder',
    hybrid: process.env.NEXT_PUBLIC_STRIPE_PRICE_HYBRID || 'price_hybrid_placeholder',
    p2p:    process.env.NEXT_PUBLIC_STRIPE_PRICE_P2P    || 'price_p2p_placeholder',
};

const plans = [
    {
        id: 'local',
        name: 'Versión Local',
        subtitle: 'WiFi LAN',
        price: 500,
        color: '#06B6D4',
        icon: <Wifi size={32} className="text-cyan-400" />,
        features: [
            '1 Usuario (Caja)',
            'Inventario en red local',
            'Reportes básicos PDF',
            'Sin cuotas anuales',
            'Soporte de la comunidad'
        ],
        glow: 'rgba(6, 182, 212, 0.2)'
    },
    {
        id: 'hybrid',
        name: 'Versión Híbrida',
        subtitle: 'Nube + Local',
        price: 999,
        popular: true,
        color: '#22D3EE',
        icon: <Cloud size={32} className="text-cyan-300" />,
        features: [
            'Hasta 5 Usuarios',
            'Módulo de Repartidores (GPS)',
            'Base de datos SQLite + Nube',
            'Sincronización en tiempo real',
            'Facturación CFDI 4.0 básica'
        ],
        glow: 'rgba(34, 211, 238, 0.4)'
    },
    {
        id: 'p2p',
        name: 'Versión Despliegue',
        subtitle: 'Servicios P2P',
        price: 1500,
        color: '#f59e0b',
        icon: <Globe size={32} className="text-amber-400" />,
        features: [
            'Usuarios Ilimitados',
            'Arquitectura P2P Avanzada',
            'Múltiples Sucursales (Multi-Tenant)',
            'Predicciones IA del Mercado',
            'Soporte Técnico Premium 24/7'
        ],
        glow: 'rgba(245, 158, 11, 0.3)'
    }
];

export default function PricingPage() {
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const { profile } = useAuth();

    const handleSelectPlan = async (planId: string) => {
        setSelectedPlan(planId);

        const priceId = STRIPE_PRICE_IDS[planId as keyof typeof STRIPE_PRICE_IDS];

        // Si el Price ID no está configurado aún, mostrar instrucción al admin
        if (priceId.includes('placeholder')) {
            toast.warning(
                'Configura los Price IDs de Stripe en .env.local para activar cobros reales.',
                '⚠️ Stripe no configurado'
            );
            return;
        }

        setLoadingPlan(planId);
        try {
            // Obtener token de Firebase para autenticar la llamada al backend
            const currentUser = auth.currentUser;
            const idToken = currentUser ? await currentUser.getIdToken() : null;

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                },
                body: JSON.stringify({ priceId }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al crear la sesión de pago');
            }

            if (data.url) {
                // Redirigir a Stripe Checkout (ventana del banco)
                window.location.href = data.url;
            }
        } catch (error: any) {
            toast.error(error.message || 'No se pudo iniciar el pago. Intenta de nuevo.');
        } finally {
            setLoadingPlan(null);
        }
    };

    return (
        <div className="min-h-full p-6 md:p-12 relative overflow-hidden flex flex-col items-center">

            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/30 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-900/10 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="text-center z-10 mb-12 relative">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-900/40 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-4">
                    <Sparkles size={14} /> Elige tu arquitectura
                </motion.div>
                <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                    Potencia tu Negocio
                </motion.h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-slate-400 text-lg max-w-2xl mx-auto">
                    Plataformas escalables diseñadas para rendir. Desde un comercio local hasta infraestructura distribuida P2P.
                </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl z-10 relative">
                {plans.map((plan, index) => (
                    <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index, type: "spring", stiffness: 100 }}
                        whileHover={{ y: -5, scale: 1.02 }}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`relative rounded-3xl p-8 cursor-pointer transition-all duration-300 ${plan.popular ? 'border-2' : 'border border-white/5'} card-sanjose`}
                        style={{
                            borderColor: plan.popular ? plan.color : selectedPlan === plan.id ? plan.color : 'rgba(255,255,255,0.05)',
                            boxShadow: plan.popular
                                ? `0 0 30px ${plan.glow}, inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 10px 40px -10px rgba(0, 0, 0, 0.7)`
                                : 'inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 10px 40px -10px rgba(0, 0, 0, 0.7)',
                            transformStyle: 'preserve-3d'
                        }}
                    >
                        {plan.popular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-900 font-bold px-4 py-1 rounded-full text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                                Más Popular
                            </div>
                        )}

                        <div className="mb-6 flex justify-between items-center">
                            <div className="p-3 rounded-2xl bg-slate-900/50 border border-white/5 shadow-inner">
                                {plan.icon}
                            </div>
                            {selectedPlan === plan.id && (
                                <motion.div layoutId="check" className="bg-emerald-500 text-white p-1 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                                    <Check size={16} strokeWidth={3} />
                                </motion.div>
                            )}
                        </div>

                        <h3 className="text-2xl font-bold text-white mb-1">{plan.name}</h3>
                        <p className="text-slate-400 text-sm mb-6">{plan.subtitle}</p>

                        <div className="mb-8">
                            <span className="text-4xl font-black text-white">${plan.price}</span>
                            <span className="text-slate-500 font-medium ml-1">MXN / mes</span>
                        </div>

                        <div className="space-y-4 mb-8">
                            {plan.features.map((feature, i) => (
                                <div key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-900/30 flex items-center justify-center border border-cyan-500/20">
                                        <Check size={12} className="text-cyan-400" />
                                    </div>
                                    {feature}
                                </div>
                            ))}
                        </div>

                        <button
                            id={`btn-plan-${plan.id}`}
                            onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}
                            disabled={!!loadingPlan}
                            className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                                plan.popular
                                ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-[0_4px_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)]'
                                : 'bg-slate-800 text-white hover:bg-slate-700 border border-white/5'
                            }`}
                        >
                            {loadingPlan === plan.id ? (
                                <><Loader2 size={16} className="animate-spin" /> Redirigiendo a pago...</>
                            ) : (
                                plan.popular ? '🚀 Comenzar Ahora' : 'Seleccionar Plan'
                            )}
                        </button>
                    </motion.div>
                ))}
            </div>

            {/* Footer Trust symbols */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-16 flex items-center gap-8 text-slate-500 text-sm z-10">
                <div className="flex items-center gap-2"><ShieldCheck size={16} /> Encriptación SSL</div>
                <div className="flex items-center gap-2"><Server size={16} /> 99.9% Uptime</div>
                <div className="flex items-center gap-2"><Zap size={16} /> Latencia Ultra-Baja</div>
            </motion.div>

            {/* Nota para el admin si hay placeholders */}
            {profile?.role === 'superadmin' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    className="mt-8 p-4 rounded-2xl bg-amber-900/20 border border-amber-500/30 text-amber-300 text-xs max-w-2xl text-center z-10">
                    <strong>⚙️ Admin:</strong> Para activar cobros reales, agrega en <code>.env.local</code>:
                    <br />
                    <code>NEXT_PUBLIC_STRIPE_PRICE_LOCAL=price_xxx</code> |{' '}
                    <code>NEXT_PUBLIC_STRIPE_PRICE_HYBRID=price_xxx</code> |{' '}
                    <code>NEXT_PUBLIC_STRIPE_PRICE_P2P=price_xxx</code>
                    <br />
                    Encuéntralos en: <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener" className="underline">dashboard.stripe.com/products</a>
                </motion.div>
            )}
        </div>
    );
}
