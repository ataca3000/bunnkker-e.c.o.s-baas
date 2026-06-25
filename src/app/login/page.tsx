"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Loader2, QrCode, KeyRound, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import AmbientMusic from '@/components/AmbientMusic';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function LoginPage() {
    const { networkMode, user, profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'pin' | 'qr'>('pin');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [hostname, setHostname] = useState('Mi Empresa');
    const [checkingSetup, setCheckingSetup] = useState(true);
    const [bgImage, setBgImage] = useState('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1920&auto=format&fit=crop');
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            setHostname(host.includes('localhost') ? 'Mi Empresa Local' : host);
        }

        const initApp = async () => {
            try {
                const { getDoc, doc } = await import('firebase/firestore');
                const confSnap = await getDoc(doc(db, 'settings', 'site_config'));
                if (confSnap.exists()) {
                    const data = confSnap.data();
                    if (data.businessName) setHostname(data.businessName);
                    if (data.loginBackgroundUrl) setBgImage(data.loginBackgroundUrl);
                }
            } catch (err) {
                console.error("Error init login:", err);
            } finally {
                setCheckingSetup(false);
            }
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

        // BYPASS DE DESARROLLO / DEMO (PIN: 123456 o admin)
        if (code === '123456' || code === 'admin') {
            document.cookie = `msj-session=local_owner; path=/; max-age=86400; SameSite=Lax`;
            document.cookie = `msj-role=superadmin; path=/; max-age=86400; SameSite=Lax`;
            window.location.href = '/dashboard';
            return;
        }

        try {
            // Buscamos al usuario por su PIN (el PIN se guarda en password por ahora, o en campo pin)
            // Primero intentamos buscar por 'pin', luego por 'password'
            let qUsers = query(collection(db, 'users'), where('pin', '==', code));
            let querySnap = await getDocs(qUsers);

            if (querySnap.empty) {
                qUsers = query(collection(db, 'users'), where('password', '==', code));
                querySnap = await getDocs(qUsers);
            }

            if (!querySnap.empty) {
                const userDoc = querySnap.docs[0];
                const userData = userDoc.data();

                // Validamos que sea personal
                if (userData.role === 'client') {
                    setError('Acceso denegado. Este portal es solo para personal.');
                    setLoading(false);
                    return;
                }

                const newSessionId = Math.random().toString(36).substring(2);
                updateDoc(userDoc.ref, { currentSessionId: newSessionId }).catch(console.error);
                localStorage.setItem('msj-session-id', newSessionId);
                
                document.cookie = `msj-session=${userDoc.id}; path=/; max-age=86400; SameSite=Lax`;
                document.cookie = `msj-role=${userData.role || 'node'}; path=/; max-age=86400; SameSite=Lax`;
                window.location.href = '/dashboard';
            } else {
                setError('Credencial/PIN inválido.');
            }
        } catch (err: any) {
            console.error(err);
            setError('Error de conexión o validación.');
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
            <AmbientMusic />
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
                                    type="password" placeholder="••••••" required minLength={6} maxLength={6}
                                    value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    className="w-full py-5 pl-[68px] pr-6 bg-slate-800/80 border border-slate-700/50 rounded-2xl focus:border-amber-500 focus:bg-slate-800 focus:ring-1 focus:ring-amber-500 outline-none transition-all font-mono text-2xl text-center tracking-[1em] text-white placeholder-slate-600" 
                                />
                            </div>
                        </div>

                        <button 
                            disabled={loading || pin.length < 6}
                            className="w-full mt-4 text-slate-900 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50 border bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 shadow-amber-900/30 border-amber-500/30"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : "Desbloquear Sistema"}
                        </button>
                    </motion.form>
                ) : (
                    <motion.div key="qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                        <div className="w-full aspect-square bg-black/50 rounded-3xl overflow-hidden border-2 border-dashed border-slate-600 relative flex items-center justify-center mb-4">
                            <div id="reader" className="w-full h-full"></div>
                        </div>
                        <p className="text-slate-400 text-xs text-center">Coloca tu código QR de acceso frente a la cámara para desbloquear el portal de tu área.</p>
                    </motion.div>
                )}

                <div className="mt-8 pt-8 border-t border-slate-700/50 flex flex-col items-center gap-4">
                    <p className="text-slate-400 text-xs font-medium text-center">¿Eres cliente y deseas hacer pedidos?</p>
                    <Link href="/registro" className="inline-flex items-center justify-center gap-2 text-sky-400 hover:text-sky-300 font-bold text-xs transition-colors group">
                        Ir al Portal de Clientes <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </motion.div>

            <div className="mt-12 text-slate-500 text-[0.65rem] font-bold uppercase tracking-widest text-center relative z-10 pb-4">
                <span>Derechos reservados &copy; {new Date().getFullYear()} {hostname}</span>
            </div>
        </div>
    );
}
