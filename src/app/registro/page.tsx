"use client";

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
    UserPlus, Mail, Lock, User, Phone, Loader2,
    ArrowRight, ShieldCheck, KeyRound, MapPin,
    CreditCard, Calendar, Venus, CheckCircle2, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

type Mode = 'login' | 'register' | 'recover';

const BG = 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1920&auto=format&fit=crop';

// ─── Campo de formulario reutilizable ────────────────────────────────────────
function Field({
    label, icon, children
}: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1">
                {icon} {label}
            </label>
            {children}
        </div>
    );
}

const inputCls = "w-full py-3.5 pl-[52px] pr-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all text-white placeholder-slate-500 text-sm font-medium";
const selectCls = "w-full py-3.5 pl-[52px] pr-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl focus:border-purple-500 outline-none transition-all text-white text-sm font-medium appearance-none";

export default function RegisterPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>('register');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // ── Campos de registro ──────────────────────────────────────────────────
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('');
    const [address, setAddress] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [curpRfc, setCurpRfc] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');

    // ── Login ───────────────────────────────────────────────────────────────
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');

    // ── Recover ─────────────────────────────────────────────────────────────
    const [recoverEmail, setRecoverEmail] = useState('');

    const reset = () => { setError(''); setSuccess(''); };

    // ── Registrar ───────────────────────────────────────────────────────────
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
        if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
        setLoading(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const uid = cred.user.uid;
            await setDoc(doc(db, 'users', uid), {
                email,
                displayName: name,
                phone,
                age: parseInt(age) || null,
                gender,
                address,
                curpRfc: curpRfc.toUpperCase(),
                role: 'client',
                status: 'active',
                createdAt: serverTimestamp(),
            });
            document.cookie = `msj-session=${uid}; path=/; max-age=86400; SameSite=Lax`;
            document.cookie = `msj-role=client; path=/; max-age=86400; SameSite=Lax`;
            window.location.href = '/cuenta';
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') setError('Este correo ya está registrado.');
            else if (err.code === 'auth/weak-password') setError('La contraseña debe tener al menos 6 caracteres.');
            else setError('Error al crear la cuenta. Intenta de nuevo.');
        } finally { setLoading(false); }
    };

    // ── Iniciar sesión ───────────────────────────────────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPass);
            window.location.href = '/cuenta';
        } catch {
            setError('Correo o contraseña incorrectos.');
        } finally { setLoading(false); }
    };

    // ── Recuperar contraseña ─────────────────────────────────────────────────
    const handleRecover = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, recoverEmail);
            setSuccess('Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.');
        } catch {
            setError('No encontramos ese correo. Verifica que esté bien escrito.');
        } finally { setLoading(false); }
    };

    const titles: Record<Mode, { title: string; sub: string; icon: React.ReactNode; color: string }> = {
        register: { title: 'Crear Cuenta', sub: 'Únete para hacer pedidos y guardar tu información', icon: <UserPlus size={44} />, color: 'purple' },
        login:    { title: 'Bienvenido',   sub: 'Accede a tu cuenta para ver tus pedidos',           icon: <ShieldCheck size={44} />, color: 'sky' },
        recover:  { title: 'Recuperar Acceso', sub: 'Te enviamos un enlace a tu correo',             icon: <KeyRound size={44} />, color: 'amber' },
    };
    const t = titles[mode];
    const accentMap: Record<string, string> = {
        purple: 'from-purple-600 to-indigo-600 border-purple-500/30 shadow-purple-900/30',
        sky:    'from-sky-500 to-blue-600 border-sky-500/30 shadow-sky-900/30',
        amber:  'from-amber-500 to-orange-500 border-amber-500/30 shadow-amber-900/30',
    };
    const iconBgMap: Record<string, string> = {
        purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
        sky:    'bg-sky-500/20 text-sky-400 border border-sky-500/30',
        amber:  'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    };

    return (
        <div className="min-h-screen relative flex flex-col items-center justify-center p-4 py-10 font-sans">
            {/* BG */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BG} alt="bg" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm pointer-events-none" />

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/70 backdrop-blur-xl border border-white/10 w-full max-w-xl rounded-[36px] p-8 md:p-12 shadow-2xl relative z-10"
            >
                {/* Header */}
                <header className="flex flex-col items-center mb-8">
                    <div className={`p-4 rounded-3xl mb-5 ${iconBgMap[t.color]}`}>
                        {t.icon}
                    </div>
                    <h1 className="text-3xl font-[950] text-white uppercase tracking-tight text-center">{t.title}</h1>
                    <p className="text-slate-400 text-xs font-medium mt-2 text-center">{t.sub}</p>
                </header>

                {/* Error / Success */}
                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-red-500/15 text-red-300 text-xs font-bold p-4 rounded-2xl border border-red-500/30 mb-5">
                            ❌ {error}
                        </motion.div>
                    )}
                    {success && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-emerald-500/15 text-emerald-300 text-xs font-bold p-4 rounded-2xl border border-emerald-500/30 mb-5 flex items-center gap-2">
                            <CheckCircle2 size={16} /> {success}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── MODO REGISTRO ────────────────────────────────────────────────── */}
                <AnimatePresence mode="wait">
                    {mode === 'register' && (
                        <motion.form key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onSubmit={handleRegister} className="space-y-4">

                            {/* Nombre */}
                            <Field label="Nombre Completo" icon={<User size={10} />}>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input type="text" placeholder="Ej. Juan Pérez García" required
                                        value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                                </div>
                            </Field>

                            {/* Edad + Sexo */}
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Edad" icon={<Calendar size={10} />}>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input type="number" placeholder="25" min="1" max="120" required
                                            value={age} onChange={e => setAge(e.target.value)} className={inputCls} />
                                    </div>
                                </Field>
                                <Field label="Sexo" icon={<Venus size={10} />}>
                                    <div className="relative">
                                        <Venus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <select required value={gender} onChange={e => setGender(e.target.value)} className={selectCls}>
                                            <option value="" className="bg-slate-900">Seleccionar...</option>
                                            <option value="Masculino" className="bg-slate-900">Masculino</option>
                                            <option value="Femenino" className="bg-slate-900">Femenino</option>
                                            <option value="Otro" className="bg-slate-900">Otro</option>
                                            <option value="Prefiero no decir" className="bg-slate-900">Prefiero no decir</option>
                                        </select>
                                    </div>
                                </Field>
                            </div>

                            {/* Dirección */}
                            <Field label="Dirección de Casa" icon={<MapPin size={10} />}>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input type="text" placeholder="Calle, Número, Colonia, Ciudad" required
                                        value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
                                </div>
                            </Field>

                            {/* Teléfono */}
                            <Field label="Número Telefónico" icon={<Phone size={10} />}>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input type="tel" placeholder="55 1234 5678" required
                                        value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
                                </div>
                            </Field>

                            {/* Correo */}
                            <Field label="Correo Electrónico" icon={<Mail size={10} />}>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input type="email" placeholder="tucorreo@ejemplo.com" required
                                        value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                                </div>
                            </Field>

                            {/* CURP / RFC */}
                            <Field label="CURP o RFC (para facturación)" icon={<CreditCard size={10} />}>
                                <div className="relative">
                                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input type="text" placeholder="Ej. PEGJ850101HDFRRN02 o PEGJ850101XX5"
                                        value={curpRfc} onChange={e => setCurpRfc(e.target.value.toUpperCase())}
                                        maxLength={18} className={`${inputCls} uppercase tracking-widest`} />
                                </div>
                                <p className="text-[10px] text-slate-600 ml-1">Opcional. Solo se usa para generar tu factura.</p>
                            </Field>

                            {/* Contraseña */}
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Contraseña" icon={<Lock size={10} />}>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input type="password" placeholder="••••••••" required minLength={6}
                                            value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                                    </div>
                                </Field>
                                <Field label="Confirmar" icon={<Lock size={10} />}>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input type="password" placeholder="••••••••" required minLength={6}
                                            value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} />
                                    </div>
                                </Field>
                            </div>

                            <button disabled={loading}
                                className={`w-full mt-4 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50 bg-gradient-to-r border ${accentMap['purple']}`}>
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={18} /> Crear Mi Cuenta</>}
                            </button>
                        </motion.form>
                    )}

                    {/* ── MODO LOGIN ───────────────────────────────────────────────────── */}
                    {mode === 'login' && (
                        <motion.form key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onSubmit={handleLogin} className="space-y-4">
                            <Field label="Correo Electrónico" icon={<Mail size={10} />}>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input type="email" placeholder="tucorreo@ejemplo.com" required
                                        value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className={inputCls} />
                                </div>
                            </Field>
                            <Field label="Contraseña" icon={<Lock size={10} />}>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input type="password" placeholder="••••••••" required
                                        value={loginPass} onChange={e => setLoginPass(e.target.value)} className={inputCls} />
                                </div>
                            </Field>
                            <div className="flex justify-end">
                                <button type="button" onClick={() => { setMode('recover'); reset(); }}
                                    className="text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors">
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </div>
                            <button disabled={loading}
                                className={`w-full mt-2 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50 bg-gradient-to-r border ${accentMap['sky']}`}>
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <><ShieldCheck size={18} /> Entrar</>}
                            </button>
                        </motion.form>
                    )}

                    {/* ── MODO RECUPERAR ───────────────────────────────────────────────── */}
                    {mode === 'recover' && (
                        <motion.form key="recover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onSubmit={handleRecover} className="space-y-4">
                            <Field label="Correo Electrónico Registrado" icon={<Mail size={10} />}>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input type="email" placeholder="tucorreo@ejemplo.com" required
                                        value={recoverEmail} onChange={e => setRecoverEmail(e.target.value)} className={inputCls} />
                                </div>
                            </Field>
                            <button disabled={loading}
                                className={`w-full mt-2 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50 bg-gradient-to-r border ${accentMap['amber']}`}>
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <><KeyRound size={18} /> Enviar Enlace</>}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>

                {/* ── Tabs de navegación ────────────────────────────────────────────── */}
                <div className="mt-8 pt-6 border-t border-white/5">
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                        {mode !== 'login' && (
                            <button onClick={() => { setMode('login'); reset(); }}
                                className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-bold text-xs transition-colors border border-sky-500/20 bg-sky-500/10 px-4 py-2 rounded-full">
                                <ShieldCheck size={13} /> Ya tengo cuenta — Entrar
                            </button>
                        )}
                        {mode !== 'register' && (
                            <button onClick={() => { setMode('register'); reset(); }}
                                className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-bold text-xs transition-colors border border-purple-500/20 bg-purple-500/10 px-4 py-2 rounded-full">
                                <UserPlus size={13} /> Crear cuenta nueva
                            </button>
                        )}
                        {mode !== 'recover' && (
                            <button onClick={() => { setMode('recover'); reset(); }}
                                className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold text-xs transition-colors border border-amber-500/20 bg-amber-500/10 px-4 py-2 rounded-full">
                                <KeyRound size={13} /> Olvidé mi contraseña
                            </button>
                        )}
                    </div>

                    {/* Link al login de personal */}
                    <div className="text-center mt-5">
                        <Link href="/login"
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest transition-colors">
                            <ChevronLeft size={11} /> Acceso para personal del negocio
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* Footer */}
            <p className="relative z-10 text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-8 text-center">
                Powered by Admin.com ERP
            </p>
        </div>
    );
}
