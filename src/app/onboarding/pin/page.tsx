"use client";

import { useState } from 'react';
import { ShieldAlert, KeyRound, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PinOnboardingPage() {
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const cleanPin = newPin.trim().toUpperCase();

        if (cleanPin.length < 4 || cleanPin.length > 6 || !/^[A-Z0-9]{4,6}$/.test(cleanPin)) {
            setError('El código de seguridad debe tener entre 4 y 6 caracteres alfanuméricos (ej. 1234, 0000, A1234).');
            return;
        }

        if (cleanPin !== confirmPin.trim().toUpperCase()) {
            setError('Los códigos de seguridad no coinciden.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/users/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CHANGE_PIN', newPin: cleanPin })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                window.location.href = '/login';
            } else {
                setError(data.error || 'Error al actualizar el código.');
            }
        } catch {
            setError('Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-amber-500/40 w-full max-w-md rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            >
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-amber-500/50 mb-3 shadow-lg shadow-amber-500/20">
                        <img src="/lion-manager.png" alt="Lion Tu Gerente de Sucursal" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mb-2">
                        Lion • Tu Gerente de Sucursal
                    </span>
                    <h1 className="text-xl font-black text-white mb-2">Personaliza tu Código de Seguridad</h1>
                    <p className="text-slate-400 text-xs max-w-xs">
                        Ingresa un código de 4 a 6 caracteres (ej. 1234, 0000, A1234) para asegurar tu terminal.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-1.5 text-center">
                            Nuevo Código (1 Letra + 4 Números) *
                        </label>
                        <div className="relative">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="text" 
                                value={newPin}
                                onChange={e => setNewPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                maxLength={5}
                                required
                                className="w-full bg-slate-950 border border-amber-500/40 text-white uppercase rounded-xl py-3 pl-12 pr-4 focus:border-amber-400 outline-none text-center tracking-[0.4em] font-mono font-bold text-xl transition-colors"
                                placeholder="A1234"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-1.5 text-center">
                            Confirmar Nuevo Código *
                        </label>
                        <div className="relative">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="text" 
                                value={confirmPin}
                                onChange={e => setConfirmPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                maxLength={5}
                                required
                                className="w-full bg-slate-950 border border-amber-500/40 text-white uppercase rounded-xl py-3 pl-12 pr-4 focus:border-amber-400 outline-none text-center tracking-[0.4em] font-mono font-bold text-xl transition-colors"
                                placeholder="A1234"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 mt-4"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <span>Guardar Código y Continuar</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
