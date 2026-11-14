"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LockKeyhole, Eye, EyeOff, ShieldCheck, AlertCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface VerifiedPinActorClient {
    uid: string;
    name: string;
    role: string;
    isSupervisorOverride: boolean;
}

export interface PinAuthorizationResult {
    verifiedBy: VerifiedPinActorClient;
    reason?: string;
    pin: string;
}

export interface PinAuthorizationModalProps {
    isOpen: boolean;
    title?: string;
    description?: string;
    actionLabel?: string;
    actionTone?: 'danger' | 'warning' | 'neutral';
    requireReason?: boolean;
    reasonLabel?: string;
    defaultReason?: string;
    onClose: () => void;
    onAuthorized: (result: PinAuthorizationResult) => void | Promise<void>;
}

export default function PinAuthorizationModal({
    isOpen,
    title = 'Autorización con NIP de Usuario',
    description = 'Ingresa tu NIP de operador o el de un supervisor para confirmar esta operación.',
    actionLabel = 'Autorizar y Confirmar',
    actionTone = 'danger',
    requireReason = false,
    reasonLabel = 'Motivo de la operación',
    defaultReason = '',
    onClose,
    onAuthorized,
}: PinAuthorizationModalProps) {
    const [pin, setPin] = useState('');
    const [reason, setReason] = useState(defaultReason);
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setReason(defaultReason);
            setError('');
            setShowPin(false);
            const t = window.setTimeout(() => inputRef.current?.focus(), 60);
            return () => window.clearTimeout(t);
        }
    }, [isOpen, defaultReason]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.key === 'Escape' && !isVerifying) {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, isVerifying, onClose]);

    const cleanPin = pin.trim();
    const isPinValidFormat = /^[A-Za-z0-9]{4,6}$/.test(cleanPin);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isPinValidFormat) {
            setError('Ingresa un NIP válido de 4 a 6 caracteres alfanuméricos.');
            return;
        }
        if (requireReason && !reason.trim()) {
            setError('Captura el motivo antes de autorizar.');
            return;
        }

        setIsVerifying(true);
        setError('');
        try {
            const res = await fetch('/api/auth/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    pin: cleanPin,
                    reason: reason.trim() || title,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success || !data?.verifiedBy) {
                setError(data?.error || 'NIP incorrecto o sin permisos.');
                return;
            }

            await onAuthorized({
                verifiedBy: data.verifiedBy,
                reason: reason.trim() || undefined,
                pin: cleanPin,
            });
        } catch {
            setError('Error de conexión al validar tu NIP. Intenta de nuevo.');
        } finally {
            setIsVerifying(false);
        }
    };

    const confirmBtnClass =
        actionTone === 'danger'
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : actionTone === 'warning'
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950';

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[4500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pin-auth-modal-title"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.16 }}
                        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-100"
                    >
                        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                                    <LockKeyhole size={18} />
                                </div>
                                <div className="min-w-0">
                                    <h3 id="pin-auth-modal-title" className="text-base font-bold text-white truncate">
                                        {title}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Protección de operación en curso
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isVerifying}
                                aria-label="Cerrar autorización"
                                className="min-w-[44px] min-h-[44px] rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors disabled:opacity-50"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <p className="text-sm text-slate-300 leading-relaxed">
                                {description}
                            </p>

                            <div>
                                <label
                                    htmlFor="bunkker-pin-auth-input"
                                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                                >
                                    NIP de Usuario o Supervisor (4 a 6 caracteres)
                                </label>
                                <div className="relative">
                                    <input
                                        id="bunkker-pin-auth-input"
                                        ref={inputRef}
                                        type={showPin ? 'text' : 'password'}
                                        autoComplete="one-time-code"
                                        inputMode="text"
                                        maxLength={6}
                                        value={pin}
                                        onChange={(e) => {
                                            setPin(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
                                            if (error) setError('');
                                        }}
                                        placeholder="A1234 o 0000"
                                        className="w-full min-h-[48px] bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-4 pr-12 text-center text-xl font-mono tabular-nums tracking-[0.35em] text-white outline-none transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPin((prev) => !prev)}
                                        aria-label={showPin ? 'Ocultar NIP' : 'Mostrar NIP'}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg"
                                    >
                                        {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {requireReason && (
                                <div>
                                    <label
                                        htmlFor="bunkker-pin-reason-input"
                                        className="block text-xs font-semibold text-slate-300 mb-1.5"
                                    >
                                        {reasonLabel}
                                    </label>
                                    <input
                                        id="bunkker-pin-reason-input"
                                        type="text"
                                        maxLength={140}
                                        value={reason}
                                        onChange={(e) => {
                                            setReason(e.target.value);
                                            if (error) setError('');
                                        }}
                                        placeholder="Ej. Cliente solicitó cambio o pausa operativa"
                                        className="w-full min-h-[44px] bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 text-sm text-white outline-none transition-colors"
                                    />
                                </div>
                            )}

                            {error && (
                                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
                                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isVerifying}
                                    className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    Volver
                                </button>
                                <button
                                    type="submit"
                                    disabled={isVerifying || !isPinValidFormat}
                                    className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${confirmBtnClass}`}
                                >
                                    {isVerifying ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Verificando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck size={16} />
                                            <span>{actionLabel}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
