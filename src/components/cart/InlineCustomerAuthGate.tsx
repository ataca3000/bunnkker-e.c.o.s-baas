'use client';

import React, { useState } from 'react';
import { UserCheck, UserPlus, Phone, Lock, User, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { saveCustomerSession } from '@/lib/customerAuth';
import { toast } from '@/lib/toast';

interface InlineCustomerAuthGateProps {
    onAuthenticated: (customer: any) => void;
    theme?: 'light' | 'dark';
    title?: string;
    subtitle?: string;
}

export function InlineCustomerAuthGate({
    onAuthenticated,
    theme = 'light',
    title = 'Identifícate para levantar tu pedido',
    subtitle = 'Es obligatorio registrarte o iniciar sesión como cliente para apartar stock y dar seguimiento a tu pedido en pizarra, caja y reparto.'
}: InlineCustomerAuthGateProps) {
    const [mode, setMode] = useState<'login' | 'register'>('register');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isDark = theme === 'dark';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        const cleanPhone = phone.trim();
        const cleanPin = pin.trim();
        const cleanName = name.trim();

        if (!cleanPhone || cleanPhone.length < 4) {
            setErrorMsg('Ingresa tu teléfono o correo válido.');
            return;
        }
        if (!cleanPin || cleanPin.length < 4) {
            setErrorMsg('Ingresa un PIN o contraseña de al menos 4 caracteres.');
            return;
        }
        if (mode === 'register' && cleanName.length < 2) {
            setErrorMsg('Ingresa tu nombre completo para registrarte.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/customer/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: mode,
                    phone: cleanPhone,
                    pin: cleanPin,
                    ...(mode === 'register' ? { name: cleanName } : {})
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success || !data?.customer) {
                setErrorMsg(data?.error || 'No se pudo autenticar tu cuenta.');
                return;
            }

            saveCustomerSession(
                {
                    uid: data.uid || data.customer.id,
                    role: 'client',
                    signature: data.signature,
                    token: data.token
                },
                data.customer
            );

            toast.success(
                mode === 'register'
                    ? `¡Bienvenido, ${data.customer.name}! Cuenta creada y lista para pedir.`
                    : `¡Hola de nuevo, ${data.customer.name}!`
            );
            onAuthenticated(data.customer);
        } catch {
            setErrorMsg('Error de conexión al validar tu cuenta.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className={`rounded-2xl p-5 border shadow-lg ${
                isDark
                    ? 'bg-slate-900/95 border-sky-500/30 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
        >
            <div className="flex items-start gap-3 mb-4">
                <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-sky-100 text-sky-600'
                    }`}
                >
                    <ShieldCheck size={20} />
                </div>
                <div>
                    <h4 className="font-black text-base leading-tight">{title}</h4>
                    <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {subtitle}
                    </p>
                </div>
            </div>

            <div
                className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl mb-4 ${
                    isDark ? 'bg-slate-950 border border-white/10' : 'bg-slate-200/80'
                }`}
            >
                <button
                    type="button"
                    onClick={() => { setMode('register'); setErrorMsg(''); }}
                    className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        mode === 'register'
                            ? 'bg-sky-500 text-white shadow-sm'
                            : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <UserPlus size={14} /> Registrarme
                </button>
                <button
                    type="button"
                    onClick={() => { setMode('login'); setErrorMsg(''); }}
                    className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        mode === 'login'
                            ? 'bg-sky-500 text-white shadow-sm'
                            : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <UserCheck size={14} /> Ya tengo cuenta
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'register' && (
                    <div>
                        <label className={`text-xs font-bold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Nombre Completo / Razón Social
                        </label>
                        <div className="relative">
                            <User size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej. Juan Pérez"
                                required
                                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                                    isDark
                                        ? 'bg-slate-950 border-slate-700 focus:border-sky-400 text-white'
                                        : 'bg-white border-slate-300 focus:border-sky-500 text-slate-900'
                                }`}
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className={`text-xs font-bold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Teléfono o Correo Electrónico
                    </label>
                    <div className="relative">
                        <Phone size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="10 dígitos o correo"
                            required
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                                isDark
                                    ? 'bg-slate-950 border-slate-700 focus:border-sky-400 text-white'
                                    : 'bg-white border-slate-300 focus:border-sky-500 text-slate-900'
                            }`}
                        />
                    </div>
                </div>

                <div>
                    <label className={`text-xs font-bold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        PIN o Contraseña de Acceso
                    </label>
                    <div className="relative">
                        <Lock size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="Mínimo 4 dígitos o caracteres"
                            required
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                                isDark
                                    ? 'bg-slate-950 border-slate-700 focus:border-sky-400 text-white'
                                    : 'bg-white border-slate-300 focus:border-sky-500 text-slate-900'
                            }`}
                        />
                    </div>
                </div>

                {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                    {submitting ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Validando...</span>
                        </>
                    ) : mode === 'register' ? (
                        <>
                            <UserPlus size={16} />
                            <span>Crear Cuenta y Continuar Pedido</span>
                        </>
                    ) : (
                        <>
                            <UserCheck size={16} />
                            <span>Entrar y Continuar Pedido</span>
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
