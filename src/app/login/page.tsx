"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Loader2, QrCode, KeyRound, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function LoginPage() {
    const { networkMode, user, profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'pin' | 'qr'>('pin');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [hostname, setHostname] = useState('Mi Empresa');
    const [checkingSetup, setCheckingSetup] = useState(true);
    const [bgImage, setBgImage] = useState('/bg-default.jpg');
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            setHostname(host.includes('localhost') ? 'Mi Empresa Local' : host);
        }

        const initApp = async () => {
            // Ya no buscamos configuración en Firebase para el login
            // Todo corre de manera local (BUNKKER E.C.O.S)
            setCheckingSetup(false);
        };
        initApp();
    }, []);

    // Ruteo Automático por Rol
    useEffect(() => {
        if (user && profile) {
            switch (profile.role) {
                case 'superadmin': router.push('/dashboard'); break;
                case 'admin': router.push('/dashboard/inventory'); break;
                case 'sales': router.push('/dashboard/sales'); break;
                case 'inventory': router.push('/dashboard'); break;
                case 'carga_descarga': router.push('/dashboard'); break;
                case 'marketing': router.push('/dashboard'); break;
                case 'driver': router.push('/dashboard/delivery'); break;
                case 'node': router.push('/scan'); break;
                case 'client': router.push('/cuenta'); break;
                default: router.push('/catalogo');
            }
        }
    }, [user, profile, router]);

    // Lógica del Scanner QR
    useEffect(() => {
        if (mode === 'qr') {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );
            scanner.render(
                (decodedText: string) => {
                    scanner.clear();
                    handleAuthWithCode(decodedText);
                },
                (error: any) => {
                    // ignore scan errors
                }
            );

            return () => {
                scanner.clear().catch(console.error);
            };
        }
    }, [mode]);

    const handleAuthWithCode = async (code: string) => {
        setLoading(true);
        setError('');

        try {
            const { getDeviceFingerprint } = await import('@/lib/fingerprint');
            const deviceId = getDeviceFingerprint();
            
            // Llamar directamente al servidor local que validará el PIN contra SQLite
            const res = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: code, deviceId })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                // Actualizar sessionId en localStorage para la red local (P2P) si se necesita
                const newSessionId = Math.random().toString(36).substring(2);
                localStorage.setItem('msj-session-id', newSessionId);

                if (data.requirePinChange) {
                    window.location.href = '/onboarding/pin';
                } else {
                    window.location.href = '/dashboard';
                }
            } else {
                setError(data.error || 'PIN incorrecto o acceso denegado.');
            }
        } catch (err) {
            setError('Error de conexión con el servidor local.');
        } finally {
            setLoading(false);
        }
    };

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleAuthWithCode(pin);
    };

    if (checkingSetup) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" size={48} /></div>;
    }

    return (
        <div className="min-h-screen relative flex flex-col items-center justify-center p-6 font-sans">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
                src={bgImage} 
                alt="Background" 
                className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm mix-blend-multiply pointer-events-none"></div>
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/70 backdrop-blur-xl border border-white/10 w-full max-w-lg rounded-[40px] p-10 shadow-2xl relative z-10"
            >
                <header className="flex flex-col items-center mb-8">
                    <div className="p-4 rounded-3xl mb-4 shadow-inner bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <ShieldCheck size={48} strokeWidth={2} />
                    </div>
                    <h1 className="text-3xl font-[950] text-white uppercase tracking-tight leading-none mb-2 drop-shadow-md text-center">{hostname}</h1>
                    <p className="font-bold text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                        Acceso Restringido • Personal
                    </p>
                </header>

                <div className="flex bg-slate-800/50 p-1 rounded-2xl mb-8">
                    <button 
                        onClick={() => setMode('pin')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex justify-center items-center gap-2 ${mode === 'pin' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        <KeyRound size={16} /> PIN Acceso
                    </button>
                    <button 
                        onClick={() => setMode('qr')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex justify-center items-center gap-2 ${mode === 'qr' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        <QrCode size={16} /> Escanear QR
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-500/20 text-red-200 text-xs font-bold p-4 rounded-2xl border border-red-500/50 mb-6 backdrop-blur-md text-center">
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {mode === 'pin' ? (
                    <motion.form key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handlePinSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[0.7rem] font-black text-slate-400 uppercase ml-2 tracking-wider">PIN de Seguridad (6 dígitos)</label>
                            <div className="relative">
                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input 
                                    type="password" placeholder="••••••" required minLength={4} maxLength={8}
                                    value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    className="w-full py-5 pl-[68px] pr-6 bg-slate-800/80 border border-slate-700/50 rounded-2xl focus:border-amber-500 focus:bg-slate-800 focus:ring-1 focus:ring-amber-500 outline-none transition-all font-mono text-2xl text-center tracking-[1em] text-white placeholder-slate-600" 
                                />
                            </div>
                        </div>

                        <button 
                            disabled={loading || pin.length < 4}
                            className="w-full mt-4 text-slate-900 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50 border bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 shadow-amber-900/30 border-amber-500/30"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : "Desbloquear Sistema"}
                        </button>
                    </motion.form>
                ) : (
                    <motion.div key="qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                        <style dangerouslySetInnerHTML={{__html: `
                            #reader { border: none !important; background: transparent !important; }
                            #reader__dashboard_section_csr span { color: #94a3b8 !important; font-size: 0.8rem; font-family: monospace; }
                            #reader__dashboard_section_csr button { 
                                background: #f59e0b !important; color: #1e293b !important; 
                                border: none !important; padding: 10px 20px !important; 
                                border-radius: 12px !important; font-weight: 800 !important; 
                                text-transform: uppercase !important; font-size: 0.75rem !important;
                                margin: 10px 0 !important; cursor: pointer; transition: all 0.2s;
                            }
                            #reader__dashboard_section_csr button:hover { opacity: 0.9 !important; transform: scale(0.98); }
                            #reader select { 
                                background: #1e293b !important; color: #cbd5e1 !important; 
                                border: 1px solid #334155 !important; padding: 8px !important; 
                                border-radius: 8px !important; outline: none; margin-bottom: 10px;
                            }
                            #reader__camera_selection { max-width: 100%; }
                            #reader video { border-radius: 16px !important; object-fit: cover !important; }
                            #html5-qrcode-anchor-scan-type-change { color: #38bdf8 !important; text-decoration: none !important; font-size: 0.75rem !important; }
                        `}} />
                        <div className="w-full aspect-square bg-slate-900/80 rounded-[24px] overflow-hidden border border-slate-700/50 shadow-inner relative flex items-center justify-center mb-6">
                            <div id="reader" className="w-full h-full p-2"></div>
                        </div>
                        <p className="text-slate-400 text-xs text-center px-4 leading-relaxed font-medium">
                            Coloca tu <strong className="text-amber-400">código QR</strong> frente a la cámara para desbloquear el portal de tu área.
                        </p>
                    </motion.div>
                )}

                <div className="mt-8 pt-8 border-t border-slate-700/50 flex flex-col items-center gap-4">
                    <p className="text-slate-400 text-xs font-medium text-center">¿Eres cliente y deseas hacer pedidos?</p>
                    <Link href="/registro" className="inline-flex items-center justify-center gap-2 text-sky-400 hover:text-sky-300 font-bold text-xs transition-colors group">
                        Ir al Portal de Clientes <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </motion.div>

            <div className="mt-12 flex flex-col gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest text-center relative z-10 pb-4">
                <span>Derechos reservados &copy; {new Date().getFullYear()} {hostname}</span>
                <div className="flex gap-4 justify-center">
                    <a href="#" className="hover:text-amber-400 transition-colors">Términos y Condiciones</a>
                    <span>|</span>
                    <a href="#" className="hover:text-amber-400 transition-colors">Aviso de Privacidad</a>
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-slate-400">
                    <span className="text-xs">Powered by</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 font-black text-sm tracking-widest drop-shadow-md">GEMINI</span>
                </div>
            </div>
        </div>
    );
}
