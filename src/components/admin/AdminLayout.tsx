/* eslint-disable */
"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import {
    Users,
    Package,
    FileText,
    LayoutDashboard,
    ShieldCheck,
    LogOut,
    BookOpen,
    History,
    CreditCard,
    Lock,
    QrCode,
    Route,
    Warehouse,
    Megaphone,
    PackageCheck,
    ChevronRight,
    Wifi,
    WifiOff,
    Info,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    Calculator,
    Key,
    Mail,
    User,
    Save,
    RefreshCw as Refresh,
    Activity,
    Boxes,
    Settings,
    Store
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { toast } from '@/lib/toast';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import AdminDock, { type AdminDockItem } from './AdminDock';
import { useTranslation } from '@/context/LanguageContext';
/* ─── Navegación canónica del dashboard ───────────────────────────────────── */
type DashboardMenuItem = {
    id: string;
    title: string;
    icon: React.ReactNode;
    href: string;
    premium?: boolean;
    roles?: string[];
};

const menuGroups: { label: string; items: DashboardMenuItem[] }[] = [
    {
        label: 'Panel y administración',
        items: [
            { id: 'dashboard', title: 'Resumen ejecutivo', icon: <LayoutDashboard size={19} />, href: '/dashboard' },
            { id: 'pos', title: 'Punto de venta', icon: <Calculator size={19} />, href: '/dashboard/sales' },
            { id: 'team', title: 'Equipo y permisos', icon: <Users size={19} />, href: '/dashboard/team' },
            { id: 'users', title: 'Cuentas de acceso', icon: <Key size={19} />, href: '/dashboard/admin/users' },
            { id: 'crm', title: 'CRM comercial', icon: <User size={19} />, href: '/dashboard/crm' },
            { id: 'customers', title: 'Historial y tickets', icon: <History size={19} />, href: '/dashboard/admin/customers' },
            { id: 'billing', title: 'Facturación CFDI', icon: <FileText size={19} />, href: '/dashboard/billing' },
            { id: 'qr', title: 'Vinculación QR', icon: <QrCode size={19} />, href: '/dashboard/qr' },
            { id: 'setup', title: 'Configuración', icon: <Settings size={19} />, href: '/dashboard/setup' },
            { id: 'guide', title: 'Guía de uso', icon: <BookOpen size={19} />, href: '/dashboard/guia' },
            { id: 'demo', title: 'Entorno de pruebas', icon: <Activity size={19} />, href: '/dashboard/demo', roles: ['superadmin'] },
        ],
    },
    {
        label: 'Operación y logística',
        items: [
            { id: 'inventory', title: 'Inventario', icon: <Package size={19} />, href: '/dashboard/inventory' },
            { id: 'patio', title: 'Patio de carga', icon: <Warehouse size={19} />, href: '/dashboard/patio' },
            { id: 'pickup', title: 'Mostrador y pickup', icon: <PackageCheck size={19} />, href: '/dashboard/pickup' },
            { id: 'delivery', title: 'Reparto', icon: <Route size={19} />, href: '/dashboard/delivery' },
            { id: 'simulator', title: 'Simulador operativo', icon: <Boxes size={19} />, href: '/dashboard/simulator' },
        ],
    },
    {
        label: 'Control del negocio',
        items: [
            { id: 'marketing', title: 'Marketing y marca', icon: <Megaphone size={19} />, href: '/dashboard/marketing' },
            { id: 'audit', title: 'Auditoría', icon: <ShieldCheck size={19} />, href: '/dashboard/audit' },
            { id: 'subscription', title: 'Suscripción', icon: <CreditCard size={19} />, href: '/dashboard/suscripcion', roles: ['superadmin'] },
            { id: 'store', title: 'Tienda pública', icon: <Store size={19} />, href: '/' },
        ],
    },
];

/* ─── Tooltip de estado de conexión ──────────────────────────────────────── */
function ConnectionTooltip({ isOpen, firebaseStatus }: { isOpen: boolean; firebaseStatus: string }) {
    const isOnline = firebaseStatus === 'online';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{
                        position:        'absolute',
                        top:             'calc(100% + 10px)',
                        right:           0,
                        zIndex:          9999,
                        background:      'rgba(5, 10, 20, 0.94)',
                        backdropFilter:  'blur(18px) saturate(140%)',
                        border:          '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius:    '14px',
                        padding:         '16px 18px',
                        boxShadow:       '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                        minWidth:        '260px',
                        pointerEvents:   'none',
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '10px',
                            background: isOnline ? 'rgba(16,185,129,0.14)' : 'rgba(249,115,22,0.14)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {isOnline
                                ? <Wifi size={16} color="#059669" />
                                : <WifiOff size={16} color="#ea580c" />}
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '800', color: '#f8fafc' }}>
                                {isOnline ? 'Sistema en Línea' : 'Modo Local / Offline'}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8' }}>
                                Persistencia IndexedDB Activa
                            </p>
                        </div>
                    </div>

                    {/* Items */}
                    {[
                        {
                            icon: isOnline ? <CheckCircle2 size={13} color="#10b981" /> : <AlertTriangle size={13} color="#f59e0b" />,
                            text: isOnline ? 'Sincronización en tiempo real activa' : 'Datos locales e IndexedDB activos',
                        },
                        {
                            icon: isOnline ? <CheckCircle2 size={13} color="#10b981" /> : <AlertTriangle size={13} color="#f59e0b" />,
                            text: isOnline ? 'Escrituras confirmadas en el servidor' : 'Los pedidos y carritos se guardan en IndexedDB y sincronizan al reconectar',
                        },
                        {
                            icon: <Info size={13} color="#94a3b8" />,
                            text: isOnline ? 'Base de datos local y nube listas' : 'Tus operaciones continúan sin interrupción',
                        },
                    ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
                            <span style={{ fontSize: '0.7rem', color: '#cbd5e1', lineHeight: '1.4' }}>{item.text}</span>
                        </div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* ─── Perfil setup modal (para cuentas nuevas) ───────────────────────────── */
function ProfileSetupScreen({ uid }: { uid: string }) {
    const [name, setName]                     = useState('');
    const [recoveryEmail, setRecoveryEmail]   = useState('');
    const [password, setPassword]             = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading]               = useState(false);
    const [error, setError]                   = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !recoveryEmail.trim() || !password.trim()) {
            setError('Todos los campos son obligatorios.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (password === '0000') {
            setError('Por favor elige una contraseña diferente de "0000".');
            return;
        }
        if (password.length < 4) {
            setError('La contraseña debe tener al menos 4 caracteres.');
            return;
        }

        setLoading(true);
        try {
            const [{ db }, { doc, updateDoc }] = await Promise.all([
                import('@/lib/firebase'),
                import('firebase/firestore'),
            ]);
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                displayName:   name.trim(),
                recoveryEmail: recoveryEmail.trim(),
                password:      password.trim(),
                needsSetup:    false,
            });
            toast.success('¡Perfil configurado con éxito!', '✅ Perfil');
        } catch (err) {
            console.error(err);
            setError('Error al actualizar el perfil. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1920")',
            backgroundSize: 'cover', backgroundPosition: 'center', padding: '20px',
        }}>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)' }} />

            <div style={{
                position: 'relative', width: '100%', maxWidth: '520px',
                background: 'rgba(255,255,255,0.95)', padding: '40px', borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
                fontFamily: 'sans-serif',
            }}>
                <header style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '20px', background: '#0ea5e9', color: 'white', marginBottom: '16px' }}>
                        <Key size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#1e293b', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                        Configura tu Perfil
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                        Actualiza tus datos de colaborador y reemplaza tu contraseña genérica.
                    </p>
                </header>

                {error && (
                    <div style={{
                        padding: '12px 16px', borderRadius: '12px', background: '#fef2f2',
                        border: '1px solid #fee2e2', color: '#991b1b', fontSize: '0.8rem',
                        fontWeight: 'bold', marginBottom: '20px',
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {[
                        { label: 'Nombre Completo',         icon: <User size={18} />,  type: 'text',     val: name,            set: setName,            ph: 'Juan Pérez' },
                        { label: 'Correo de Recuperación',  icon: <Mail size={18} />,  type: 'email',    val: recoveryEmail,   set: setRecoveryEmail,   ph: 'recuperacion@correo.com' },
                        { label: 'Nueva Contraseña',        icon: <Lock size={18} />,  type: 'password', val: password,        set: setPassword,        ph: '••••••••' },
                        { label: 'Confirmar Nueva Contraseña', icon: <Lock size={18} />, type: 'password', val: confirmPassword, set: setConfirmPassword, ph: '••••••••' },
                    ].map((f) => (
                        <div key={f.label}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                                {f.label}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>{f.icon}</span>
                                <input
                                    type={f.type}
                                    required
                                    value={f.val}
                                    onChange={e => f.set(e.target.value)}
                                    placeholder={f.ph}
                                    style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#1e293b', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>
                    ))}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '14px', background: '#0ea5e9', color: 'white',
                            border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '8px', boxShadow: '0 4px 12px rgba(14,165,233,0.25)',
                            transition: 'all 0.2s', opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? <Refresh size={16} className="animate-spin" /> : <Save size={16} />}
                        {loading ? 'GUARDANDO...' : 'GUARDAR Y ACTIVAR CUENTA'}
                    </button>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Layout ─────────────────────────────────────────────────────────── */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [connTooltipOpen, setConnTooltipOpen] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const isDashboard = pathname === '/dashboard' || pathname?.startsWith('/dashboard/');
    const { isReadOnly, isPremium, profile, signOut } = useAuth();
    const { firebaseStatus, siteConfig } = useCart();
    const { t } = useTranslation();

    /* close tooltip on outside click */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
                setConnTooltipOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (firebaseStatus === 'online') {
            const hasSeenPrompt = sessionStorage.getItem('bunkker_update_prompt');
            if (!hasSeenPrompt) {
                sessionStorage.setItem('bunkker_update_prompt', 'true');
            }
        }
    }, [firebaseStatus]);

    if (profile?.needsSetup) {
        return <ProfileSetupScreen uid={profile.uid} />;
    }

    if (!isDashboard) {
        return <>{children}</>;
    }

    const isPOSFullscreen = pathname === '/dashboard/sales';
    const showAdminDock = !isPOSFullscreen && (profile?.role === 'superadmin' || profile?.role === 'admin');
    const currentRole = profile?.role || 'admin';
    const shortLabels: Record<string, string> = {
        dashboard: 'Panel', pos: 'POS', team: 'Equipo', users: 'Accesos', crm: 'CRM',
        customers: 'Clientes', billing: 'CFDI', qr: 'QR', setup: 'Ajustes', guide: 'Guía',
        demo: 'Pruebas', inventory: 'Stock', patio: 'Patio', pickup: 'Pickup', delivery: 'Rutas',
        simulator: 'Simulador', marketing: 'Marketing', audit: 'Auditoría', subscription: 'Plan', store: 'Tienda',
    };
    const dockItems: AdminDockItem[] = menuGroups
        .flatMap((group) => group.items)
        .filter((item) => !item.roles || item.roles.includes(currentRole))
        .map((item) => ({
            id: item.id,
            title: item.title,
            shortLabel: shortLabels[item.id] || item.title,
            icon: item.icon,
            href: item.href,
            premium: item.premium,
        }));

    /* ── Breadcrumbs helper ───────────────────────────────────── */
    const labelsMap: Record<string, string> = {
        admin: 'ADMINISTRADOR', sales: 'VENTAS', inventory: 'INVENTARIO',
        design: 'DISEÑO', delivery: 'LOGÍSTICA',
        billing: 'FACTURACIÓN', audit: 'AUDITORÍA', tests: 'PRUEBAS',
        users: 'USUARIOS', marketing: 'MARKETING', suscripcion: 'SUSCRIPCIÓN',
        crm: 'CRM', team: 'EQUIPO', purchases: 'COMPRAS', reports: 'REPORTES',
        soporte: 'SOPORTE', setup: 'CONFIGURACIÓN', guia: 'GUÍA',
    };

    /* ── Inline styles shared ─────────────────────────────────── */
    const crumbLinkBase: React.CSSProperties = {
        color: '#0ea5e9', textDecoration: 'none', transition: 'color 0.15s ease',
        borderRadius: '4px', padding: '2px 4px',
    };

    return (
        <div className="bunkker-shell" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'transparent', color: '#f8fafc' }}>

            {/* ── Main content (Layer 4) ────────────────────────────────────── */}
            <div
                className={`admin-main-viewport min-w-0 flex-1 flex flex-col min-h-screen relative z-10 transition-all duration-300 ${isPOSFullscreen ? 'pb-0' : showAdminDock ? 'pb-28' : 'pb-6'} w-full`}
                style={{ transition: 'padding-bottom 0.3s ease' }}
            >
                {/* ── Top header bar (Layer 4 Translucent Container) ─────────────────────────────── */}
                {!isPOSFullscreen && (
                <div style={{
                    background: 'rgba(8, 12, 22, 0.75)',
                    backdropFilter: 'blur(20px) saturate(140%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                    borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                    padding: '0.65rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}>
                    {/* Breadcrumbs */}
                    <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8' }}>
                        <Link
                            href={profile?.role === 'marketing' ? '/dashboard/marketing' : '/dashboard'}
                            style={crumbLinkBase}
                            onMouseEnter={e => (e.currentTarget.style.color = '#0284c7')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#0ea5e9')}
                        >
                            {t('nav.panel', 'PANEL')}
                        </Link>

                        {pathname !== '/dashboard' && (
                            <>
                                <ChevronRight size={11} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                {pathname.split('/').filter(Boolean).slice(1).map((segment, idx, arr) => {
                                    const path    = '/' + pathname.split('/').filter(Boolean).slice(0, idx + 2).join('/');
                                    const isLast  = idx === arr.length - 1;
                                    const label   = labelsMap[segment] || segment.toUpperCase();

                                    return isLast ? (
                                        <span key={segment} style={{ color: '#e2e8f0', padding: '2px 4px' }}>{label}</span>
                                    ) : (
                                        <div key={segment} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Link
                                                href={path}
                                                style={crumbLinkBase}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#38bdf8')}
                                                onMouseLeave={e => (e.currentTarget.style.color = '#0ea5e9')}
                                            >
                                                {label}
                                            </Link>
                                            <ChevronRight size={11} style={{ color: '#475569', flexShrink: 0 }} />
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </nav>

                    {/* Status Indicators & Profile */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Selector de Idioma (Español, Inglés, Francés, Chino) */}
                        <LanguageSelector />

                        {/* Selector de Tema */}
                        <ThemeToggle />

                        {/* Connection badge */}
                        <div ref={tooltipRef} style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setConnTooltipOpen(!connTooltipOpen)}
                                title="Ver estado de conexión"
                                aria-label={firebaseStatus === 'online' ? 'Sistema en línea' : 'Sistema en modo local u offline'}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    fontSize: '0.68rem', fontWeight: '900', letterSpacing: '0.05em',
                                    backgroundColor: firebaseStatus === 'online' ? 'rgba(16,185,129,0.1)' : 'rgba(249,115,22,0.1)',
                                    color: firebaseStatus === 'online' ? '#34d399' : '#fb923c',
                                    padding: '5px 12px', borderRadius: '8px',
                                    border: firebaseStatus === 'online' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(249,115,22,0.2)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    outline: 'none',
                                }}
                            >
                                <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{
                                        display: 'block', width: '6px', height: '6px', borderRadius: '50%',
                                        backgroundColor: firebaseStatus === 'online' ? '#10b981' : '#f97316',
                                    }} />
                                    {firebaseStatus !== 'online' && (
                                        <span style={{
                                            position: 'absolute', inset: 0, borderRadius: '50%',
                                            backgroundColor: '#f97316', opacity: 0.4,
                                            animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
                                        }} />
                                    )}
                                </span>
                                <span className="sr-only">{firebaseStatus === 'online' ? t('status.online', 'SISTEMA ONLINE') : t('status.offline', 'SIN CONEXIÓN')}</span>
                            </button>

                            <ConnectionTooltip isOpen={connTooltipOpen} firebaseStatus={firebaseStatus} />
                        </div>

                        <details className="relative">
                            <summary
                                className="inline-flex list-none cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                                aria-label="Abrir menú de perfil"
                                title={profile?.displayName || 'Perfil'}
                            >
                                <User size={15} aria-hidden="true" />
                                <span className="hidden max-w-28 truncate text-xs font-semibold xl:inline">
                                    {profile?.displayName || t('nav.profile', 'PERFIL')}
                                </span>
                            </summary>
                            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-950/90 p-2 text-white shadow-2xl backdrop-blur-2xl">
                                <div className="border-b border-white/10 px-3 py-2">
                                    <p className="truncate text-sm font-semibold text-white">{profile?.displayName || 'Personal'}</p>
                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        {profile?.role || 'usuario'} · {isPremium ? 'PREMIUM' : 'BÁSICO'}
                                    </p>
                                </div>
                                <Link
                                    href="/dashboard/profile"
                                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    <User size={15} aria-hidden="true" />
                                    Mi perfil
                                </Link>
                                <button
                                    type="button"
                                    onClick={signOut}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                                >
                                    <LogOut size={15} aria-hidden="true" />
                                    Cerrar sesión
                                </button>
                            </div>
                        </details>
                    </div>
                </div>
                )}

                {/* ── Read-only banner ──────────────────────────── */}
                {isReadOnly && (
                    <div style={{
                        backgroundColor: '#FFF4E5', color: '#663C00',
                        padding: '10px 1rem',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        fontSize: '0.78rem', fontWeight: 'bold',
                        borderBottom: '1px solid #FFCB05',
                    }}>
                        <AlertCircle size={16} color="#FFCB05" style={{ flexShrink: 0 }} />
                        <span>{t('status.demo_warning', 'MODO DEMOSTRACIÓN: Usted está en modo de solo lectura. Los cambios no se guardarán en la base de datos real.')}</span>
                    </div>
                )}

                {/* ── Content body ──────────────────────────────── */}
                <div style={{ flex: 1 }}>
                    {children}
                </div>
            </div>
            {showAdminDock && <AdminDock items={dockItems} isPremium={isPremium} />}
        </div>
    );
}

