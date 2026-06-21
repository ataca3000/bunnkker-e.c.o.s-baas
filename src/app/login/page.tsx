"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Loader2, Mail, ArrowRight, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import AmbientMusic from '@/components/AmbientMusic';

export default function LoginPage() {
    const { networkMode, user, profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [hostname, setHostname] = useState('Mi Empresa');
    const [checkingSetup, setCheckingSetup] = useState(true);
    const [bgImage, setBgImage] = useState('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1920&auto=format&fit=crop');
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            // Si es localhost o 127.0.0.1, mostramos algo genérico, sino el subdominio
            setHostname(host.includes('localhost') ? 'Mi Empresa Local' : host);
        }

        const initApp = async () => {
            try {
                const qSnap = await getDocs(collection(db, 'users'));
                if (qSnap.empty) {
                    // Si no hay usuarios en absoluto, no redirigimos al Launcher.
                    // El admin debe ser creado externamente o con el bypass de desarrollo.
                    return;
                }

                const { getDoc } = await import('firebase/firestore');
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // BYPASS DE DESARROLLO / DEMO
        if (email === 'admin@admin.com' && password === 'admin') {
            document.cookie = `msj-session=local_owner; path=/; max-age=86400; SameSite=Lax`;
            document.cookie = `msj-role=superadmin; path=/; max-age=86400; SameSite=Lax`;
            window.location.href = '/dashboard';
            return;
        }


        // BYPASS OFFLINE SOBERANO
        if (!navigator.onLine && networkMode.isMaster) {
            console.warn("Modo Soberano: Ignorando validación en la nube.");
            document.cookie = `msj-session=local_owner; path=/; max-age=86400; SameSite=Lax`;
            document.cookie = `msj-role=superadmin; path=/; max-age=86400; SameSite=Lax`;
            window.location.href = '/dashboard';
            return;
        }

        try {
            // 1. Consultar Firestore para ver si es un usuario local
            const qUsers = query(collection(db, 'users'), where('email', '==', email));
            const querySnap = await getDocs(qUsers);

            if (!querySnap.empty) {
                const userDoc = querySnap.docs[0];
                const userData = userDoc.data();
                const storedPassword = userData.password || '0000';

                if (password === storedPassword) {
                    const newSessionId = Math.random().toString(36).substring(2);
                    import('firebase/firestore').then(({ updateDoc }) => {
                        updateDoc(userDoc.ref, { currentSessionId: newSessionId }).catch(console.error);
                    });
                    localStorage.setItem('msj-session-id', newSessionId);
                    
                    document.cookie = `msj-session=${userDoc.id}; path=/; max-age=86400; SameSite=Lax`;
                    document.cookie = `msj-role=${userData.role || 'node'}; path=/; max-age=86400; SameSite=Lax`;
                    window.location.href = '/dashboard';
                    return;
                }
            }
        } catch (localErr) {
            console.error("Local user lookup failed:", localErr);
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const newSessionId = Math.random().toString(36).substring(2);
            import('firebase/firestore').then(({ updateDoc }) => {
                updateDoc(doc(db, 'users', userCredential.user.uid), { currentSessionId: newSessionId }).catch(console.error);
            });
            localStorage.setItem('msj-session-id', newSessionId);
            window.location.href = '/dashboard';
        } catch (err: any) {
            console.error(err);
            setError('Credenciales inválidas o error de red.');
        } finally {
            setLoading(false);
        }
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
                className="bg-slate-900/60 backdrop-blur-xl border border-white/10 w-full max-w-2xl rounded-[40px] p-10 md:p-16 shadow-2xl relative overflow-hidden z-10"
            >
                <header className="flex flex-col items-center mb-10">
                    <div className="p-5 rounded-3xl mb-6 shadow-inner bg-purple-600/20 text-purple-400 border border-purple-500/30">
                        <ShieldCheck size={56} strokeWidth={2} />
                    </div>
                    <h1 className="text-4xl font-[950] text-white uppercase tracking-tight leading-none mb-2 drop-shadow-md text-center">{hostname}</h1>
                    <p className="font-bold text-xs uppercase tracking-[0.25em] text-purple-300/80">
                        Portal de Acceso
                    </p>
                </header>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="bg-red-500/20 text-red-200 text-xs font-bold p-4 rounded-2xl border border-red-500/50 mb-4 backdrop-blur-md">
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <label className="text-[0.7rem] font-black text-slate-400 uppercase ml-2 tracking-wider">Correo Electrónico</label>
                        <div className="relative">
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                type="email" placeholder="tucorreo@ejemplo.com" required
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                className="w-full py-4 pl-[68px] pr-6 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:border-purple-500 focus:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-semibold text-white placeholder-slate-500" 
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[0.7rem] font-black text-slate-400 uppercase ml-2 tracking-wider">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                type="password" placeholder="••••••••" required
                                value={password} onChange={(e) => setPassword(e.target.value)}
                                className="w-full py-4 pl-[68px] pr-6 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:border-purple-500 focus:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-semibold text-white placeholder-slate-500" 
                            />
                        </div>
                    </div>

                    <button 
                        disabled={loading}
                        className="w-full mt-8 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50 border bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-900/30 border-purple-500/30"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "Entrar al Sistema"}
                    </button>
                    
                    <div className="relative flex py-4 items-center">
                        <div className="flex-grow border-t border-slate-700/50"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold uppercase">O entra con</span>
                        <div className="flex-grow border-t border-slate-700/50"></div>
                    </div>

                    <div className="flex justify-center w-full mt-2">
                        <button 
                            type="button"
                            disabled={loading}
                            onClick={() => {
                                setEmail('admin@admin.com');
                                setPassword('admin');
                            }}
                            className="w-full bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600/50 py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            <ShieldCheck size={18} className="text-emerald-400" />
                            Admin Local
                        </button>
                    </div>
                </form>

                <div className="mt-8 pt-8 border-t border-slate-700/50 flex flex-col items-center gap-4">
                    <button onClick={() => {
                        if (!email) return alert('Ingresa tu correo arriba primero y luego presiona este botón.');
                        import('firebase/auth').then(({ sendPasswordResetEmail }) => {
                            sendPasswordResetEmail(auth, email)
                                .then(() => alert('Correo de recuperación enviado.'))
                                .catch((e: any) => alert('Error: ' + e.message));
                        });
                    }} className="text-sky-400 hover:text-sky-300 font-bold text-xs transition-colors">
                        ¿Olvidaste tu contraseña? (Recuperar)
                    </button>
                    <p className="text-slate-400 text-sm font-medium mt-2">¿Eres un cliente y deseas hacer pedidos?</p>
                    <Link href="/registro" className="inline-flex items-center justify-center gap-2 text-purple-400 hover:text-purple-300 font-bold text-sm transition-colors group">
                        Portal de Clientes (Entrar / Registrarse) <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </motion.div>

            <div className="mt-12 text-slate-500 text-[0.65rem] font-bold uppercase tracking-widest text-center relative z-10 pb-4 flex flex-col items-center gap-2">
                <span>Derechos reservados &copy; {new Date().getFullYear()} {hostname}</span>
                <a href="https://admin.com" target="_blank" rel="noopener noreferrer" className="text-purple-400/50 hover:text-purple-400 transition-colors">
                    Powered by Admin.com
                </a>
            </div>
        </div>
    );
}
