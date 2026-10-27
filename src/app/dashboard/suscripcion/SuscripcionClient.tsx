"use client";

import { motion, AnimatePresence } from 'framer-motion';
import {
    Check,
    CreditCard,
    Wifi,
    Cloud,
    Globe,
    Sparkles,
    Server,
    Zap,
    ShieldCheck,
    Loader2,
    Laptop,
    Copy,
    PlusCircle,
    KeyRound,
    CheckCircle2,
    X,
    QrCode,
    Cpu,
    Radio
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { toast } from '@/lib/toast';
import { getMachineId, checkLicenseStatus, activateLicenseOffline, type LicenseState } from '@/lib/license';
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '@/lib/products';
import OwnerCapabilitySwitches from '@/components/admin/OwnerCapabilitySwitches';

// ── Stripe Price IDs ─────────────────────────────────────────────────────────
const STRIPE_PRICE_IDS = {
    starter_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER || process.env.NEXT_PUBLIC_STRIPE_PRICE_LOCAL,
    starter_annual:  process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL || process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
    pro_monthly:      process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || process.env.NEXT_PUBLIC_STRIPE_PRICE_HYBRID,
    pro_annual:       process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL || process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID_2,
    terminal_addon_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_TERMINAL_ADDON,
    terminal_addon_annual:  process.env.NEXT_PUBLIC_STRIPE_PRICE_TERMINAL_ADDON_ANNUAL,
    enterprise_monthly:     process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE || process.env.NEXT_PUBLIC_STRIPE_PRICE_P2P,
    enterprise_annual:      process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_ANNUAL,
};

export type MembershipFlags = {
    checkoutEnabled: boolean;
    customerBillingPortalEnabled: boolean;
    planVisibility: 'all' | 'monthly' | 'local' | 'enterprise';
};

export default function PricingPage({ flags }: { flags: MembershipFlags }) {
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [selectedPlan, setSelectedPlan] = useState<string>('starter');
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [loadingPortal, setLoadingPortal] = useState(false);
    const [machineId, setMachineId] = useState<string>('');
    const [isElectron, setIsElectron] = useState<boolean>(false);
    const [copiedHwid, setCopiedHwid] = useState<boolean>(false);
    const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
    
    // Modals
    const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
    const [showOfflineModal, setShowOfflineModal] = useState<boolean>(false);
    const [offlinePin, setOfflinePin] = useState<string>('');
    const [activatingPin, setActivatingPin] = useState<boolean>(false);

    const { profile } = useAuth();
    const visiblePlans = SUBSCRIPTION_PLANS.filter((plan) => {
        if (flags.planVisibility === 'enterprise') return plan.id === 'enterprise';
        if (flags.planVisibility === 'local') return plan.id !== 'enterprise';
        return true;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hwid = getMachineId();
            setMachineId(hwid);
            setIsElectron(Boolean((window as any).electronAPI?.getMachineId));
            const status = checkLicenseStatus();
            setLicenseState(status);
        }
    }, []);

    const handleCopyHwid = () => {
        if (!machineId) return;
        navigator.clipboard.writeText(machineId);
        setCopiedHwid(true);
        toast.success('ID de Hardware copiado al portapapeles', '📋 HWID Copiado');
        setTimeout(() => setCopiedHwid(false), 2500);
    };

    const handleSelectPlan = async (plan: SubscriptionPlan) => {
        setSelectedPlan(plan.id);

        if (!flags.checkoutEnabled) {
            toast.warning('El checkout de membresías está pausado temporalmente.', 'Checkout no disponible');
            return;
        }

        const priceKey = `${plan.id}_${billingPeriod}` as keyof typeof STRIPE_PRICE_IDS;
        const priceId = STRIPE_PRICE_IDS[priceKey] || (billingPeriod === 'monthly' ? plan.monthlyPriceId : plan.annualPriceId);

        // Si el Price ID no está configurado aún en Vercel, notificar de manera informativa
        if (!priceId || !/^price_[A-Za-z0-9]+$/.test(priceId)) {
            toast.warning(
                `Configura ${priceKey.toUpperCase()} en tus variables de entorno para activar checkout con Stripe en vivo.`,
                '⚠️ Modo Demostración'
            );
            return;
        }

        setLoadingPlan(plan.id);
        try {
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
                window.location.assign(data.url);
            }
        } catch (error: any) {
            toast.error(error.message || 'No se pudo iniciar el checkout. Intenta nuevamente.');
        } finally {
            setLoadingPlan(null);
        }
    };

    const handleManageBilling = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            toast.error('Inicia sesión para gestionar tu suscripción.');
            return;
        }

        setLoadingPortal(true);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch('/api/stripe/portal', {
                method: 'POST',
                headers: { Authorization: `Bearer ${idToken}` },
            });
            const data = await response.json();

            if (!response.ok || typeof data.url !== 'string') {
                throw new Error(data.error || 'No se pudo abrir el portal de facturación.');
            }

            window.location.assign(data.url);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo abrir el portal de facturación.');
        } finally {
            setLoadingPortal(false);
        }
    };

    const handleActivateOfflinePin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (offlinePin.trim().length !== 6) {
            toast.error('El PIN offline debe ser exactamente de 6 dígitos numéricos.', 'PIN Inválido');
            return;
        }

        setActivatingPin(true);
        try {
            const res = await activateLicenseOffline(offlinePin.trim());
            if (res.success) {
                toast.success(res.message, '🎉 Licencia Desbloqueada');
                setLicenseState(checkLicenseStatus());
                setShowOfflineModal(false);
                setOfflinePin('');
            } else {
                toast.error(res.message, 'Fallo de Activación');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error validando PIN', 'Error');
        } finally {
            setActivatingPin(false);
        }
    };

    const getPlanBadge = (planId: string) => {
        switch (planId) {
            case 'starter':
                return { label: 'Hasta 3 Terminales', color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/40' };
            case 'pro':
                return { label: 'Más Recomendado (6 Terminales)', color: 'border-amber-500/60 text-amber-300 bg-amber-950/40' };
            case 'terminal_addon':
                return { label: '+1 Terminal Adicional', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/40' };
            case 'enterprise':
                return { label: 'Multi-Sucursal & Red B2B', color: 'border-purple-500/40 text-purple-300 bg-purple-950/40' };
            default:
                return { label: 'Licencia', color: 'border-slate-500/40 text-slate-400 bg-slate-900' };
        }
    };

    return (
        <div className="min-h-full p-4 md:p-10 relative overflow-hidden flex flex-col items-center">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[130px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] bg-amber-900/15 blur-[130px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="text-center z-10 mb-8 relative max-w-3xl">
                <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-3 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                >
                    <Sparkles size={13} /> Membresía con Stripe · Terminales y licenciamiento
                </motion.div>
                <motion.h1
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3"
                >
                    Acompañamiento y Crecimiento para Emprendedores
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-400 text-sm md:text-base max-w-3xl mx-auto"
                >
                    Comienza 100% gratis con 1 terminal en caja o celular. Conforme tu negocio crezca, desbloquea repartidores, almacén, facturación y monitoreo global en tiempo real desde cualquier parte del mundo.
                </motion.p>
            </div>

            {(!flags.checkoutEnabled || flags.customerBillingPortalEnabled) && (
                <div className="z-10 mb-6 flex flex-wrap items-center justify-center gap-3">
                    {!flags.checkoutEnabled && (
                        <p role="status" aria-live="polite" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-200">
                            Las nuevas compras de membresía están pausadas temporalmente.
                        </p>
                    )}
                    {flags.customerBillingPortalEnabled && (
                        <button
                            type="button"
                            onClick={handleManageBilling}
                            disabled={loadingPortal}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-400/50 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                        >
                            {loadingPortal ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                            {loadingPortal ? 'Abriendo Stripe…' : 'Gestionar mi suscripción'}
                        </button>
                    )}
                </div>
            )}

            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                className="w-full max-w-5xl z-10 mb-10 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-2xl backdrop-blur-md relative overflow-hidden"
            >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    {/* HWID & Environment */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <h2 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                                Terminal Local Activa
                            </h2>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                                {isElectron ? '💻 Electron Nativo (HWID Seguro)' : '🌐 Navegador Web (UUID Local)'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-mono text-sm md:text-base font-bold text-cyan-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-cyan-900/40 select-all tracking-wider shadow-inner">
                                {machineId || 'Obteniendo identificador...'}
                            </div>
                            <button
                                onClick={handleCopyHwid}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
                                title="Copiar ID de Hardware"
                            >
                                {copiedHwid ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                <span>{copiedHwid ? 'Copiado' : 'Copiar HWID'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Machine Quota & License Status */}
                    <div className="flex items-center gap-4 bg-slate-950/70 border border-slate-800/80 rounded-xl px-4 py-3">
                        <div className="p-2.5 rounded-lg bg-cyan-950/40 text-cyan-400 border border-cyan-800/30">
                            <Cpu size={22} />
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                Cupo de Máquinas
                            </div>
                            <div className="text-sm font-black text-white flex items-center gap-2">
                                <span className="text-cyan-400">1 de 3</span> Terminales Vinculadas
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                {licenseState?.status === 'active'
                                    ? 'Licencia Activa'
                                    : licenseState?.status === 'trial'
                                    ? `Prueba (${licenseState.daysRemaining ?? 7} días)`
                                    : 'Modo Offline Wi-Fi LAN'}
                            </div>
                        </div>
                    </div>

                    {/* Quick Pairing Actions */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={() => setShowLinkModal(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        >
                            <PlusCircle size={15} /> Vincular Máquina
                        </button>
                        <button
                            onClick={() => setShowOfflineModal(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider border border-slate-700 transition-all"
                        >
                            <KeyRound size={15} /> PIN Offline
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Interruptores de Habilidad del Dueño (Modo Omni-Rol) */}
            <div className="w-full max-w-5xl z-10 mb-8">
                <OwnerCapabilitySwitches />
            </div>

            {/* Billing Period Toggle */}
            {flags.planVisibility === 'monthly' ? (
                <p
                    role="status"
                    className="z-10 mb-8 rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 text-xs font-bold uppercase tracking-wider text-cyan-300 shadow-lg"
                >
                    Facturación Mensual
                </p>
            ) : (
                <div className="z-10 mb-8 flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-lg">
                    <button
                        onClick={() => setBillingPeriod('monthly')}
                        className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            billingPeriod === 'monthly'
                                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Facturación Mensual
                    </button>
                    <button
                        onClick={() => setBillingPeriod('annual')}
                        className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                            billingPeriod === 'annual'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Pago Anual
                        <span className="text-[10px] bg-slate-950/70 text-amber-200 px-1.5 py-0.5 rounded font-black">
                            -17% (2 meses gratis)
                        </span>
                    </button>
                </div>
            )}

            {/* ── 4 MONETIZABLE PLAN CARDS ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl z-10 relative">
                {visiblePlans.map((plan, index) => {
                    const badge = getPlanBadge(plan.id);
                    const isSelected = selectedPlan === plan.id;
                    const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceAnnual || plan.priceMonthly * 10;
                    const periodLabel = billingPeriod === 'monthly' ? 'MXN / mes' : 'MXN / año';

                    return (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 25 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 * index, type: 'spring', stiffness: 100 }}
                            whileHover={{ y: -4 }}
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`relative rounded-2xl p-6 cursor-pointer flex flex-col justify-between transition-all duration-200 border ${
                                plan.popular
                                    ? 'border-amber-500/70 bg-gradient-to-b from-amber-950/20 to-slate-900/90 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                                    : isSelected
                                    ? 'border-cyan-500/70 bg-slate-900/90 shadow-[0_0_25px_rgba(6,182,212,0.15)]'
                                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                            }`}
                        >
                            {/* Popular / Focus Badge */}
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-3 py-0.5 rounded-full text-[10px] uppercase tracking-widest shadow-[0_0_12px_rgba(245,158,11,0.5)]">
                                    Más Recomendado
                                </div>
                            )}

                            <div>
                                {/* Top Tag & Selection Indicator */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${badge.color}`}>
                                        {badge.label}
                                    </span>
                                    {isSelected && (
                                        <div className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-md">
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>

                                <h3 className="text-xl font-black text-white mb-1 tracking-tight">
                                    {plan.name}
                                </h3>
                                <p className="text-slate-400 text-xs mb-4 min-h-[36px] leading-relaxed">
                                    {plan.description}
                                </p>

                                {/* Price Box */}
                                <div className="mb-5 pb-5 border-b border-slate-800/80">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-white tracking-tight">
                                            ${price.toLocaleString('es-MX')}
                                        </span>
                                        <span className="text-slate-400 text-xs font-semibold">
                                            {periodLabel}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-cyan-400 font-medium mt-1">
                                        {plan.maxMachines === 999
                                            ? 'Terminales Ilimitadas'
                                            : `Hasta ${plan.maxMachines} ${plan.maxMachines === 1 ? 'terminal vinculada' : 'terminales vinculadas'}`}
                                        {' • '}
                                        {plan.usersPerRole === 999
                                            ? 'Usuarios ilimitados'
                                            : `${plan.usersPerRole} usuarios/rol`}
                                    </div>
                                </div>

                                {/* Limits & Features List */}
                                <div className="space-y-2.5 mb-6">
                                    {plan.limits.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-2.5 text-slate-300 text-xs leading-snug">
                                            <div className="w-4 h-4 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Check size={10} className="text-cyan-400" />
                                            </div>
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Plan CTA Button */}
                            <button
                                id={`btn-plan-${plan.id}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectPlan(plan);
                                }}
                                disabled={Boolean(loadingPlan) || !flags.checkoutEnabled}
                                className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                                    plan.popular
                                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                                        : isSelected
                                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                                }`}
                            >
                                {loadingPlan === plan.id ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" /> Conectando...
                                    </>
                                ) : !flags.checkoutEnabled ? (
                                    'Compras pausadas'
                                ) : plan.id === 'terminal_addon' ? (
                                    'Añadir Terminal'
                                ) : plan.popular ? (
                                    'Activar Plan Pro'
                                ) : (
                                    'Seleccionar Plan'
                                )}
                            </button>
                        </motion.div>
                    );
                })}
            </div>

            {/* Footer Trust Markers */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-14 flex items-center justify-center gap-8 text-slate-500 text-xs z-10 flex-wrap"
            >
                <div className="flex items-center gap-2">
                    <ShieldCheck size={15} className="text-emerald-400" /> Licencia Criptográfica HMAC-SHA256
                </div>
                <div className="flex items-center gap-2">
                    <Wifi size={15} className="text-cyan-400" /> Resiliencia 100% Offline Wi-Fi LAN
                </div>
                <div className="flex items-center gap-2">
                    <Cloud size={15} className="text-sky-400" /> Sincronización Automática BaaS
                </div>
                <div className="flex items-center gap-2">
                    <Radio size={15} className="text-amber-400" /> Malla Local P2P en Puerto 3001
                </div>
            </motion.div>

            {/* Admin Stripe Diagnostic Notice */}
            {profile?.role === 'superadmin' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mt-8 p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 text-xs max-w-2xl text-center z-10 space-y-1.5"
                >
                    <div className="text-cyan-400 font-bold uppercase tracking-wider">
                        ⚙️ Configuración de Stripe (SuperAdmin)
                    </div>
                    <p className="text-[11px] leading-relaxed">
                        Los precios de suscripción en vivo usan los Price IDs configurados en tu entorno Vercel:
                        <code className="text-amber-300 ml-1">STRIPE_MONTHLY_PRICE_STARTER</code>,{' '}
                        <code className="text-amber-300">STRIPE_MONTHLY_PRICE_PRO</code>,{' '}
                        <code className="text-amber-300">STRIPE_PRICE_TERMINAL_ADDON</code>.
                    </p>
                    <p className="text-[11px]">
                        Si no están configurados, el sistema opera con resiliencia en modo demostración y validación offline por PIN.
                    </p>
                </motion.div>
            )}

            {/* ── MODAL: VINCULACIÓN DE OTRA TERMINAL ───────────────────────────── */}
            <AnimatePresence>
                {showLinkModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowLinkModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative"
                        >
                            <button
                                onClick={() => setShowLinkModal(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                                    <QrCode size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Vincular Nueva Terminal</h3>
                                    <p className="text-slate-400 text-xs">Agrega una caja, tablet o escáner a esta sucursal</p>
                                </div>
                            </div>

                            <div className="space-y-4 text-xs text-slate-300 mb-6">
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                                    <div className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
                                        <Laptop size={14} className="text-cyan-400" /> Paso 1: Instalar o Abrir en el Nuevo Dispositivo
                                    </div>
                                    <p className="text-slate-400">
                                        En la nueva máquina (caja, tablet de patio o almacén) conectada a la misma red Wi-Fi, abre la aplicación instalada o navega a:
                                    </p>
                                    <div className="font-mono text-cyan-300 bg-slate-900 px-3 py-1.5 rounded border border-slate-800 select-all">
                                        /dashboard/link
                                    </div>
                                </div>

                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                                    <div className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-emerald-400" /> Paso 2: Autorizar Hardware
                                    </div>
                                    <p className="text-slate-400">
                                        El nuevo dispositivo mostrará su HWID y solicitará autorización. Como SuperAdmin podrás aprobarlo automáticamente o vincularlo con su NIP de 4 dígitos.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <Link
                                    href="/dashboard/link"
                                    className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    Ir a Sala de Vinculación (/dashboard/link)
                                </Link>
                                <button
                                    onClick={() => setShowLinkModal(false)}
                                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── MODAL: ACTIVACIÓN OFFLINE POR PIN ────────────────────────────── */}
            <AnimatePresence>
                {showOfflineModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowOfflineModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl relative"
                        >
                            <button
                                onClick={() => setShowOfflineModal(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-400">
                                    <KeyRound size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Activar Licencia Offline</h3>
                                    <p className="text-slate-400 text-xs">Desbloquea esta máquina sin conexión a Internet</p>
                                </div>
                            </div>

                            <form onSubmit={handleActivateOfflinePin} className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                                        ID de Hardware de Esta Máquina:
                                    </label>
                                    <div className="font-mono text-xs text-cyan-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 select-all break-all">
                                        {machineId}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                                        PIN Criptográfico de 6 Dígitos:
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="000000"
                                        value={offlinePin}
                                        onChange={(e) => setOfflinePin(e.target.value.replace(/\D/g, ''))}
                                        className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-amber-300 outline-none transition-colors"
                                        autoFocus
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1.5">
                                        El PIN es generado exclusivamente para el HWID de esta máquina y tiene validez offline de hasta 60 días.
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowOfflineModal(false)}
                                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={offlinePin.length !== 6 || activatingPin}
                                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2"
                                    >
                                        {activatingPin ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                        Validar PIN
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
