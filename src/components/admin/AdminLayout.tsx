// @ts-nocheck
/* eslint-disable */
"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {
    Users,
    Package,
    FileText,
    LayoutDashboard,
    ShoppingCart,
    ShieldCheck,
    LogOut,
    Truck,
    BookOpen,
    History,
    Share2,
    Palette,
    CreditCard,
    Lock,
    ChevronLeft,
    ChevronRight,
    Play,
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
    RefreshCw as Refresh
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';


const rolePaths: Record<string, string[]> = {
    sales: ['/dashboard', '/dashboard/admin/sales', '/dashboard/admin/customers'],
    inventory: ['/dashboard', '/dashboard/inventory'],
    carga_descarga: ['/dashboard', '/dashboard/pickup'],
    driver: ['/dashboard', '/dashboard/delivery'],
    marketing: ['/dashboard', '/dashboard/marketing', '/dashboard/design'],
    client: ['/cuenta']
};

/* ─── Sidebar menu groups ─────────────────────────────────────────────────── */
const menuGroups = [
    {
        label: 'Administración y Ventas',
        items: [
            { id: 'dashboard',  title: 'Dashboard General',  icon: <LayoutDashboard size={20} />, href: '/dashboard',             premium: false },
            { id: 'sales',      title: 'Control de Ventas',  icon: <ShoppingCart size={20} />,    href: '/dashboard/admin/sales', premium: false },

            { id: 'users',      title: 'Usuarios y Roles',   icon: <Users size={20} />,           href: '/dashboard/admin/users', premium: false },
            { id: 'customers',  title: 'CRM y Clientes',     icon: <User size={20} />,            href: '/dashboard/admin/customers', premium: false },
        ],
    },
    {
        label: 'Operaciones y Logística',
        items: [
            { id: 'inventory', title: 'Inventario',         icon: <Package size={20} />, href: '/dashboard/inventory', premium: false },
            { id: 'delivery',  title: 'Logística y Reparto', icon: <Truck size={20} />,   href: '/dashboard/delivery',  premium: false },
            { id: 'pickup',    title: 'Recolección en Tienda', icon: <Package size={20} />, href: '/dashboard/pickup',  premium: false },
        ],
    },
    {
        label: 'Diseño y Marketing',
        items: [
            { id: 'design',    title: 'Diseño y Marca',  icon: <Palette size={20} />, href: '/dashboard/design',     premium: false },
            { id: 'marketing', title: 'Marketing y QR',  icon: <Share2 size={20} />,  href: '/dashboard/marketing',  premium: false },
        ],
    },
    {
        label: 'Licencias y Auditoría',
        items: [
            { id: 'billing',      title: 'Facturas SAT',       icon: <FileText size={20} />,  href: '/dashboard/billing',      premium: true  },
            { id: 'audit',        title: 'Registro Auditoría', icon: <History size={20} />,   href: '/dashboard/audit',        premium: false },
            { id: 'subscription', title: 'Mi Suscripción',     icon: <CreditCard size={20} />, href: '/dashboard/suscripcion', premium: false },
        ],
    },
    {
        label: 'Herramientas',
        items: [
            { id: 'tests', title: 'Pruebas de Lógica', icon: <Play size={20} />, href: '/dashboard/tests', premium: false },
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
                        background:      'rgba(255,255,255,0.97)',
                        backdropFilter:  'blur(12px)',
                        border:          '1px solid #e2e8f0',
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
                            background: isOnline ? '#ecfdf5' : '#fff7ed',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {isOnline
                                ? <Wifi size={16} color="#059669" />
                                : <WifiOff size={16} color="#ea580c" />}
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '800', color: '#1e293b' }}>
                                {isOnline ? 'Sistema en Línea' : 'Sin Conexión'}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8' }}>
                                Estado de Firestore
                            </p>
                        </div>
                    </div>

                    {/* Items */}
                    {[
                        {
                            icon: isOnline ? <CheckCircle2 size={13} color="#10b981" /> : <AlertTriangle size={13} color="#f59e0b" />,
                            text: isOnline ? 'Sincronización en tiempo real activa' : 'Datos locales en caché activos',
                        },
                        {
                            icon: isOnline ? <CheckCircle2 size={13} color="#10b981" /> : <AlertTriangle size={13} color="#f59e0b" />,
                            text: isOnline ? 'Escrituras confirmadas en la nube' : 'Los cambios se encolarán y sincronizarán al reconectar',
                        },
                        {
                            icon: <Info size={13} color="#94a3b8" />,
                            text: isOnline ? 'Base de datos: Cloud Firestore' : 'Revisa tu conexión a internet o las API Keys de Firebase',
                        },
                    ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
                            <span style={{ fontSize: '0.7rem', color: '#475569', lineHeight: '1.4' }}>{item.text}</span>
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
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                displayName:   name.trim(),
                recoveryEmail: recoveryEmail.trim(),
                password:      password.trim(),
                needsSetup:    false,
            });
            alert('¡Perfil configurado con éxito!');
            window.location.reload();
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
    const router = useRouter();
    const [isCollapsed, setIsCollapsed]         = useState(false);
    const [connTooltipOpen, setConnTooltipOpen] = useState(false);
    const tooltipRef                            = useRef<HTMLDivElement>(null);
    const [activeModules, setActiveModules]     = useState<string[] | null>(null);
    const [siteConfig, setSiteConfig]           = useState<any>(null);

    const isDashboard = pathname?.startsWith('/dashboard');
    const { isReadOnly, isPremium, profile, signOut } = useAuth();
    const { firebaseStatus } = useCart();

    /* persist sidebar preference */
    useEffect(() => {
        const saved = localStorage.getItem('_admincom_sidebar_collapsed');
        if (saved === 'true') setIsCollapsed(true);
    }, []);

    // Fetch site config (activeModules)
    useEffect(() => {
        const fetchSiteConfig = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'site_config'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSiteConfig(data);
                    if (data.activeModules) {
                        setActiveModules(data.activeModules);
                    } else {
                        // Default fallback if not defined
                        setActiveModules(['sales', 'users', 'customers', 'inventory', 'delivery', 'pickup', 'design', 'marketing', 'billing', 'audit', 'dashboard', 'tests', 'subscription']);
                    }
                }
            } catch (err) {
                console.warn("Aviso: No se pudo cargar config del sitio (posible error de red o falta env):", err);
            }
        };
        fetchSiteConfig();
    }, []);

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

    /* Single Session & RBAC Enforcement */
    useEffect(() => {
        if (!profile?.uid || profile.uid === 'local_owner') return;

        // RBAC Check
        const isMasterAdmin = profile.role === 'admin' || profile.role === 'superadmin';
        if (!isMasterAdmin && isDashboard) {
            const paths = rolePaths[profile.role] || [];
            const isAllowed = paths.some(p => pathname?.startsWith(p));
            if (!isAllowed) {
                router.replace('/dashboard');
                return;
            }
        }

        // Active Modules Block Check
        if (activeModules) {
            // Find which module id matches the current pathname
            const matchingItem = menuGroups.flatMap(g => g.items).find(i => pathname?.startsWith(i.href) && i.href !== '/dashboard');
            if (matchingItem && !activeModules.includes(matchingItem.id)) {
                // If it's a known module but it's disabled in activeModules, kick them out
                router.replace('/dashboard');
                return;
            }
        }

        // Single Session Watcher
        let unsubscribe: any = () => {};
        try {
            if (profile && profile.uid && typeof profile.uid === 'string' && profile.uid !== 'local_owner') {
                unsubscribe = onSnapshot(doc(db, 'users', profile.uid), (docSnap: any) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const dbSession = data.currentSessionId;
                        const localSession = localStorage.getItem('msj-session-id');
                        if (dbSession && localSession && dbSession !== localSession) {
                            alert("⚠️ Sesión iniciada en otro dispositivo. Cerrando esta sesión por seguridad...");
                            signOut().then(() => {
                                window.location.href = '/login';
                            });
                        }
                    }
                }, (error) => {
                    console.warn("Aviso: onSnapshot desconectado (sin red o db inactiva):", error);
                });
            }
        } catch (error) {
            console.warn("Aviso: Fallo configurando onSnapshot:", error);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [profile?.uid, pathname, isDashboard, profile?.role, signOut, activeModules]);

    const toggleSidebar = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('_admincom_sidebar_collapsed', String(next));
            return next;
        });
    };

    if (profile?.needsSetup) {
        return <ProfileSetupScreen uid={profile.uid} />;
    }

    if (!isDashboard) {
        return <>{children}</>;
    }

    const isMasterAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
    const sidebarWidth  = isCollapsed ? '90px' : '280px';

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
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f111a', color: '#f8fafc' }}>

            {/* ── Sidebar ─────────────────────────────────────────── */}
            {isMasterAdmin && (
                <aside className="liquid-glass" style={{
                    width: sidebarWidth,
                    color: 'white',
                    padding: isCollapsed ? '2rem 0.75rem' : '2rem 1.5rem',
                    position: 'fixed',
                    height: '100vh',
                    overflowY: 'auto',
                    zIndex: 100,
                    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), padding 0.3s cubic-bezier(0.4,0,0.2,1)',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* Header + Toggle */}
                    <div style={{
                        marginBottom: '3rem', display: 'flex', alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'space-between', gap: '10px',
                    }}>
                        {!isCollapsed && (
                            <div>
                                <h2 className="tornasol-text" style={{ fontSize: '1.2rem', margin: 0, textTransform: 'uppercase' }}>
                                    {siteConfig?.businessName || 'CONSOLA MASTER'}
                                </h2>
                                <span style={{ fontSize: '0.7rem', opacity: 0.7, color: 'var(--plasma-cyan)' }}>{siteConfig?.slogan || 'Sistema Empresarial'}</span>
                            </div>
                        )}
                        <button
                            onClick={toggleSidebar}
                            style={{
                                background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
                                padding: '8px', borderRadius: '8px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'background 0.2s',
                            }}
                            title={isCollapsed ? 'Expandir Panel' : 'Colapsar Panel'}
                        >
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                    </div>

                    {/* Nav groups */}
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                        {menuGroups.map((group, groupIdx) => {
                            const visibleItems = group.items.filter(item => 
                                item.id === 'dashboard' || 
                                item.id === 'subscription' || 
                                item.id === 'tests' || 
                                (activeModules ? activeModules.includes(item.id) : true)
                            );

                            if (visibleItems.length === 0) return null;

                            return (
                                <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {!isCollapsed ? (
                                        <div style={{
                                            fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase',
                                            color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em',
                                            paddingLeft: '12px',
                                            marginTop: groupIdx === 0 ? '0px' : '1.2rem',
                                            marginBottom: '0.4rem',
                                        }}>
                                            {group.label}
                                        </div>
                                    ) : (
                                        groupIdx > 0 && (
                                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.8rem 0' }} />
                                        )
                                    )}

                                    {visibleItems.map((item) => {
                                        const active = pathname === item.href;
                                        const locked = item.premium && !isPremium;

                                        return (
                                            <Link
                                                key={item.id}
                                                id={`tour-sidebar-${item.id}`}
                                                href={locked ? '/dashboard/suscripcion' : item.href}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                                                    gap: '12px',
                                                    padding: '12px',
                                                    borderRadius: '12px',
                                                    textDecoration: 'none',
                                                    color: locked ? 'rgba(255,255,255,0.4)' : active ? 'var(--neon-yellow)' : 'white',
                                                    background: active ? 'rgba(0,242,255,0.1)' : 'transparent',
                                                    borderLeft: active ? '4px solid var(--neon-yellow)' : '4px solid transparent',
                                                    boxShadow: active ? 'inset 20px 0 20px -20px rgba(0,242,255,0.4)' : 'none',
                                                    textShadow: active ? '0 0 10px rgba(212,255,0,0.5)' : 'none',
                                                    transition: 'all 0.2s',
                                                    cursor: locked ? 'not-allowed' : 'pointer',
                                                }}
                                                title={isCollapsed ? item.title : undefined}
                                            >
                                                <div style={{ flexShrink: 0 }}>{item.icon}</div>
                                                {!isCollapsed && (
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{item.title}</span>
                                                )}
                                                {!isCollapsed && locked && <Lock size={14} style={{ marginLeft: 'auto', color: '#FFCB05' }} />}
                                            </Link>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        <div style={{ margin: '1.5rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

                        <Link
                            href="/dashboard/guia"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '12px', padding: '12px', borderRadius: '12px', color: '#FFCB05', textDecoration: 'none' }}
                            title={isCollapsed ? 'Guía del Dueño' : undefined}
                        >
                            <div style={{ flexShrink: 0 }}><BookOpen size={20} /></div>
                            {!isCollapsed && <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Guía del Dueño</span>}
                        </Link>

                        <Link
                            href="/"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '12px', padding: '12px', borderRadius: '12px', color: '#FFCB05', textDecoration: 'none', marginTop: 'auto' }}
                            title={isCollapsed ? 'Salir al Market' : undefined}
                        >
                            <div style={{ flexShrink: 0 }}><LogOut size={20} /></div>
                            {!isCollapsed && <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Salir al Market</span>}
                        </Link>
                    </nav>
                </aside>
            )}

            {/* ── Main content ────────────────────────────────────── */}
            <div style={{
                flex: 1,
                marginLeft: isMasterAdmin ? sidebarWidth : '0',
                transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
            }}>
                {/* ── Top header bar ─────────────────────────────── */}
                <div className="liquid-glass" style={{
                    borderBottom: '1px solid rgba(0,242,255,0.2)',
                    padding: '0.875rem 2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                }}>
                    {/* Breadcrumbs */}
                    <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8' }}>
                        <Link
                            href="/dashboard"
                            style={crumbLinkBase}
                            onMouseEnter={e => (e.currentTarget.style.color = '#0284c7')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#0ea5e9')}
                        >
                            PANEL
                        </Link>

                        {pathname !== '/dashboard' && (
                            <>
                                <ChevronRight size={11} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                {pathname.split('/').filter(Boolean).slice(1).map((segment, idx, arr) => {
                                    const path    = '/' + pathname.split('/').filter(Boolean).slice(0, idx + 2).join('/');
                                    const isLast  = idx === arr.length - 1;
                                    const label   = labelsMap[segment] || segment.toUpperCase();

                                    return isLast ? (
                                        <span key={segment} style={{ color: '#1e293b', padding: '2px 4px' }}>{label}</span>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {/* Premium badge */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '0.68rem', fontWeight: '900', letterSpacing: '0.05em',
                            backgroundColor: isPremium ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                            color: isPremium ? '#fbbf24' : '#94a3b8',
                            padding: '5px 12px', borderRadius: '8px',
                            border: isPremium ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.1)',
                        }}>
                            <ShieldCheck size={13} />
                            <span className="hidden sm:inline">{isPremium ? 'PREMIUM ACTIVE' : 'BÁSICO'}</span>
                        </div>

                        {/* Connection badge */}
                        <div ref={tooltipRef} style={{ position: 'relative' }}>
                            <button
                                onClick={() => setConnTooltipOpen(o => !o)}
                                title="Ver estado de conexión"
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
                                <span className="hidden sm:inline">{firebaseStatus === 'online' ? 'SISTEMA ONLINE' : 'SIN CONEXIÓN'}</span>
                            </button>

                            <ConnectionTooltip isOpen={connTooltipOpen} firebaseStatus={firebaseStatus} />
                        </div>

                        {/* Atrás */}
                        {pathname !== '/dashboard' && (
                            <button
                                onClick={() => router.back()}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    fontSize: '0.75rem', fontWeight: '900', color: '#cbd5e1',
                                    backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px 12px',
                                    borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                title="Volver a la vista anterior"
                            >
                                <ChevronLeft size={14} />
                                <span className="hidden sm:inline">ATRÁS</span>
                            </button>
                        )}

                        {/* Mi Perfil */}
                        <Link
                            href="/dashboard/profile"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '0.75rem', fontWeight: '900', color: '#38bdf8',
                                backgroundColor: 'rgba(56,189,248,0.1)', padding: '6px 12px',
                                borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)',
                                textDecoration: 'none', transition: 'all 0.2s',
                            }}
                            title="Ir a Mi Perfil"
                        >
                            <User size={14} />
                            <span className="hidden sm:inline">PERFIL</span>
                        </Link>

                        {/* Cerrar Sesión */}
                        <button
                            onClick={signOut}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '0.75rem', fontWeight: '900', color: '#ef4444',
                                backgroundColor: 'rgba(239,68,68,0.1)', padding: '6px 12px',
                                borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)',
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                            title="Cerrar Sesión"
                        >
                            <LogOut size={14} />
                            <span className="hidden sm:inline">SALIR</span>
                        </button>
                    </div>
                </div>

                {/* ── Read-only banner ──────────────────────────── */}
                {isReadOnly && (
                    <div style={{
                        backgroundColor: '#FFF4E5', color: '#663C00',
                        padding: '10px 2rem',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        fontSize: '0.78rem', fontWeight: 'bold',
                        borderBottom: '1px solid #FFCB05',
                    }}>
                        <AlertCircle size={16} color="#FFCB05" style={{ flexShrink: 0 }} />
                        <span>MODO DEMOSTRACIÓN: Usted está en modo de solo lectura. Los cambios no se guardarán en la base de datos real.</span>
                    </div>
                )}

                {/* ── Content body ──────────────────────────────── */}
                <div style={{ flex: 1 }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
