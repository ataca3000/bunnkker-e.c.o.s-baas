"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, KeyRound, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PinOnboardingPage() {
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPin.length < 4 || newPin.length > 6) {
            setError('El PIN debe tener entre 4 y 6 dígitos.');
            return;
        }

        if (newPin === '0000') {
            setError('No puedes usar 0000 como PIN de seguridad.');
            return;
        }

        if (newPin !== confirmPin) {
            setError('Los PINs no coinciden.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/users/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CHANGE_PIN', newPin })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                // Pin cambiado con éxito, forzamos un refetch del perfil o vamos al login para que genere nueva sesión
                window.location.href = '/login';
            } else {
                setError(data.error || 'Error al actualizar el PIN.');
            }
        } catch (err) {
            setError('Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-800 border border-amber-500/30 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="p-4 bg-amber-500/20 text-amber-500 rounded-full mb-4">
                        <ShieldAlert size={48} strokeWidth={1.5} />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Cambio de PIN Obligatorio</h1>
                    <p className="text-slate-400 text-sm">
                        Tu cuenta está usando el PIN por defecto (0000). Por seguridad, debes establecer un nuevo PIN personal antes de continuar.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm font-semibold text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Nuevo PIN (4 a 6 dígitos)</label>
                        <div className="relative">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input 
                                type="password" 
                                value={newPin}
                                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                                maxLength={6}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-amber-500 outline-none text-center tracking-[1em] font-bold text-xl"
                                placeholder="****"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Confirmar Nuevo PIN</label>
                        <div className="relative">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input 
                                type="password" 
                                value={confirmPin}
                                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                maxLength={6}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-amber-500 outline-none text-center tracking-[1em] font-bold text-xl"
                                placeholder="****"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading || newPin.length < 4}
                        className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold uppercase tracking-wider flex justify-center items-center gap-2 transition-colors"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <><ArrowRight size={20} /> Actualizar y Entrar</>}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
