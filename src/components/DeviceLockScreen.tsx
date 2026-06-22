"use client";

import React, { useState, useEffect } from 'react';
import { useDeviceAuth } from '@/hooks/useDeviceAuth';
import { Lock, ShieldCheck, KeyRound, ArrowRight, Loader2, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DeviceLockScreen({ children }: { children: React.ReactNode }) {
    const { 
        hwid, 
        isLocked, 
        isMasterActivated, 
        devicePin, 
        activateMaster, 
        setPin, 
        unlockWithPin 
    } = useDeviceAuth();

    const [inputVal, setInputVal] = useState('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [welcomeAnim, setWelcomeAnim] = useState(false);

    // Evitar render en servidor
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    // --- ESCENARIO 1: SÚPER ADMIN PRIMER ARRANQUE ---
    if (!isMasterActivated) {
        return (
            <div className="fixed inset-0 z-[9999] bg-black text-white flex flex-col items-center justify-center font-mono">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black" />
                
                <AnimatePresence>
                    {!welcomeAnim ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative z-10 w-full max-w-md p-8"
                        >
                            <div className="flex justify-center mb-8">
                                <Fingerprint className="text-[#0ea5e9] animate-pulse" size={64} />
                            </div>
                            <h1 className="text-2xl font-black text-center mb-2 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#0ea5e9] to-blue-500">
                                Inicialización de Sistema
                            </h1>
                            <p className="text-gray-400 text-xs text-center mb-8 font-bold uppercase tracking-widest">
                                Ingrese la Llave Maestra de Activación
                            </p>

                            <div className="relative">
                                <input
                                    type="password"
                                    value={inputVal}
                                    onChange={(e) => {
                                        setInputVal(e.target.value);
                                        setError(false);
                                    }}
                                    className={`w-full bg-slate-900 border-2 ${error ? 'border-red-500' : 'border-slate-800 focus:border-[#0ea5e9]'} rounded-xl px-6 py-4 text-center text-2xl tracking-[0.5em] outline-none transition-all font-black`}
                                    placeholder="••••••••"
                                    autoFocus
                                />
                            </div>

                            <button
                                onClick={() => {
                                    setLoading(true);
                                    setTimeout(() => {
                                        if (activateMaster(inputVal)) {
                                            setWelcomeAnim(true);
                                            setTimeout(() => window.location.reload(), 4000); // Reload to clear lock
                                        } else {
                                            setError(true);
                                            setLoading(false);
                                            setInputVal('');
                                        }
                                    }, 800);
                                }}
                                disabled={loading || inputVal.length < 5}
                                className="w-full mt-6 bg-[#0ea5e9] hover:bg-blue-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-4 rounded-xl flex justify-center items-center gap-2 transition-all"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <KeyRound size={20} />}
                                {loading ? 'Validando...' : 'Autenticar'}
                            </button>
                            {error && <p className="text-red-500 text-xs text-center mt-4 uppercase font-bold animate-pulse">Llave Inválida o Expulsada</p>}
                        </motion.div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative z-10 w-full max-w-lg p-8 text-center"
                        >
                            <ShieldCheck className="text-green-500 mx-auto mb-6" size={80} />
                            <h2 className="text-green-400 text-xl font-black uppercase tracking-widest mb-4">Acceso Autorizado</h2>
                            <p className="text-gray-300 leading-relaxed font-bold border-l-4 border-green-500 pl-4 text-left text-sm uppercase">
                                Bienvenido a nuestro sistema de operación. Implacable, de seguridad de punta y logística globalmente adaptada a sus necesidades. Su dispositivo ha sido encriptado y blindado exitosamente.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // --- ESCENARIO 2: EMPLEADO NUEVO (SIN PIN AÚN) ---
    // Si no tiene PIN, pero no estamos en localhost (o sea, es un empleado en tablet)
    // El empleado debe ser forzado a crear un PIN si su HWID fue autorizado
    // Nota: El proceso de "Prospecto" lo maneja AuthContext bloqueando el contenido.
    // Aquí solo interceptamos si ya fue autorizado (tiene un perfil) pero no ha creado PIN local.
    // Lo simplificaremos pidiendo crear PIN la primera vez que inicia su turno.

    // --- ESCENARIO 3: BLOQUEO POR NIP (5 MINUTOS INACTIVIDAD O ARRANQUE) ---
    if (isLocked && devicePin) {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center font-sans backdrop-blur-xl">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm p-8 bg-white rounded-3xl shadow-2xl flex flex-col items-center"
                >
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-[#0ea5e9]">
                        <Lock size={28} />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 mb-1">Turno Bloqueado</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8 text-center">Ingresa tu NIP de 4 dígitos</p>

                    <div className="flex gap-4 mb-8">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className={`w-4 h-4 rounded-full transition-all ${inputVal.length > i ? 'bg-[#0ea5e9] scale-110' : 'bg-slate-200'}`} />
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-4 w-full">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => {
                                    if (inputVal.length < 4) {
                                        const newVal = inputVal + num;
                                        setInputVal(newVal);
                                        if (newVal.length === 4) {
                                            if (unlockWithPin(newVal)) {
                                                setInputVal('');
                                                setError(false);
                                            } else {
                                                setError(true);
                                                setTimeout(() => setInputVal(''), 500);
                                            }
                                        }
                                    }
                                }}
                                className="h-16 rounded-2xl bg-slate-50 text-slate-800 text-2xl font-black hover:bg-[#0ea5e9] hover:text-white transition-all shadow-sm active:scale-95"
                            >
                                {num}
                            </button>
                        ))}
                        <div />
                        <button
                            onClick={() => {
                                if (inputVal.length < 4) {
                                    const newVal = inputVal + '0';
                                    setInputVal(newVal);
                                    if (newVal.length === 4) {
                                        if (unlockWithPin(newVal)) {
                                            setInputVal('');
                                            setError(false);
                                        } else {
                                            setError(true);
                                            setTimeout(() => setInputVal(''), 500);
                                        }
                                    }
                                }
                            }}
                            className="h-16 rounded-2xl bg-slate-50 text-slate-800 text-2xl font-black hover:bg-[#0ea5e9] hover:text-white transition-all shadow-sm active:scale-95"
                        >
                            0
                        </button>
                        <button
                            onClick={() => setInputVal(prev => prev.slice(0, -1))}
                            className="h-16 rounded-2xl bg-slate-100 text-slate-500 text-sm font-bold uppercase hover:bg-slate-200 transition-all flex items-center justify-center active:scale-95"
                        >
                            Borrar
                        </button>
                    </div>

                    {error && <p className="text-red-500 text-xs font-bold uppercase tracking-widest mt-6 animate-bounce">NIP Incorrecto</p>}
                </motion.div>
            </div>
        );
    }

    return <>{children}</>;
}
