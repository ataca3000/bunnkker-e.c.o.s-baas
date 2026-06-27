"use client";

import React, { useState, useEffect } from 'react';
import { useDeviceAuth } from '@/hooks/useDeviceAuth';
import { Fingerprint, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';

export default function DeviceLinkPage() {
    const { hwid, setPin, devicePin } = useDeviceAuth();
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Waiting admin, 2: Create PIN, 3: Done
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        // En un caso real, aquí consultaríamos vía WebSocket si el Admin ya aprobó este HWID.
        // Simularemos que el admin lo aprueba a los 5 segundos de escanear.
        if (step === 1 && !devicePin) {
            const timer = setTimeout(() => {
                setStep(2);
            }, 5000);
            return () => clearTimeout(timer);
        } else if (devicePin) {
            setStep(3);
        }
    }, [step, devicePin]);

    const handleCreatePin = () => {
        if (newPin.length !== 4 || confirmPin.length !== 4) {
            setError('El NIP debe tener 4 dígitos.');
            return;
        }
        if (newPin !== confirmPin) {
            setError('Los NIPs no coinciden.');
            return;
        }
        setPin(newPin);
        setStep(3);
        
        // Redirigir al dashboard en 2 segundos
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-700">
                
                {step === 1 && (
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
                            <Loader2 className="animate-spin text-[#0ea5e9]" size={40} />
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-widest text-white mb-2">Sala de Espera</h1>
                        <p className="text-slate-400 mb-8 text-sm">
                            Este dispositivo aún no tiene autorización para operar. Por favor, avisa al Administrador que acepte la conexión.
                        </p>
                        <div className="bg-slate-900 px-6 py-3 rounded-xl border border-slate-700 w-full">
                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">ID Físico del Dispositivo</p>
                            <p className="font-mono text-sm tracking-wider text-[#0ea5e9]">{hwid}</p>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                            <ShieldAlert className="text-green-500" size={40} />
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-widest text-green-400 mb-2">Dispositivo Autorizado</h1>
                        <p className="text-slate-400 mb-6 text-sm">
                            El administrador ha autorizado esta terminal. Crea un NIP personal de 4 dígitos para proteger tus turnos.
                        </p>

                        <div className="w-full space-y-4">
                            <div>
                                <input
                                    type="password"
                                    maxLength={4}
                                    placeholder="NIP"
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-4 text-center text-xl tracking-[1em] focus:border-[#0ea5e9] outline-none"
                                />
                            </div>
                            <div>
                                <input
                                    type="password"
                                    maxLength={4}
                                    placeholder="CONFIRMAR NIP"
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-4 text-center text-xl tracking-[1em] focus:border-[#0ea5e9] outline-none"
                                />
                            </div>
                            {error && <p className="text-red-500 text-xs font-bold uppercase">{error}</p>}
                            <button
                                onClick={handleCreatePin}
                                disabled={newPin.length !== 4 || confirmPin.length !== 4}
                                className="w-full mt-4 bg-[#0ea5e9] hover:bg-blue-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all"
                            >
                                Registrar Terminal
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="text-green-500" size={40} />
                        </div>
                        <h1 className="text-xl font-black uppercase tracking-widest text-white mb-2">Terminal Vinculada</h1>
                        <p className="text-slate-400 text-sm">
                            El dispositivo ha sido emparejado con éxito a la red segura.
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
}
