"use client";

import { motion } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useState, useMemo } from 'react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import {
    Users, FileText, ChevronRight, ShieldCheck, CheckCircle, Maximize2,
    Share2, Map, TrendingUp, Zap, Package, ShoppingCart, Truck, Settings,
    AlertCircle, Calculator, PackageCheck, ScanLine, Clock, Route,
    AlertTriangle, MapPin, LogOut, Play, Loader2, QrCode, Palette,
    ArrowUpRight, ArrowDownRight, Minus, TrendingDown,
    BarChart3, Headphones, ReceiptText, BookOpen
} from 'lucide-react';
import Link from 'next/link';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useAuth } from '@/context/AuthContext';
import StaffRankingWidget from '@/components/admin/StaffRankingWidget';
import RestockAlertWidget from '@/components/admin/RestockAlertWidget';

/* ─── Shared premium button style ─────────────────────────────────────────── */
const premiumBtn: React.CSSProperties = {
    display:         'inline-flex',
    alignItems:      'center',
    gap:             '8px',
    padding:         '10px 20px',
    borderRadius:    '14px',
    fontWeight:      '700',
    fontSize:        '0.82rem',
    letterSpacing:   '0.04em',
    border:          'none',
    cursor:          'pointer',
    transition:      'all 0.18s cubic-bezier(0.4,0,0.2,1)',
    userSelect:      'none',
};

/* ─── Trend Badge ─────────────────────────────────────────────────────────── */
function TrendBadge({
    value,
    label,
    positive,
    neutral,
}: {
    value: string;
    label: string;
    positive?: boolean;
    neutral?: boolean;
}) {
    const bg    = neutral ? '#f1f5f9' : positive ? '#ecfdf5' : '#fef2f2';
    const color = neutral ? '#64748b' : positive ? '#065f46' : '#991b1b';
    const Icon  = neutral ? Minus : positive ? ArrowUpRight : ArrowDownRight;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: bg, color, fontSize: '0.68rem', fontWeight: '800', padding: '3px 8px', borderRadius: '20px' }}>
                <Icon size={11} />
                {value}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>{label}</span>
        </div>
    );
}

/* ─── Module Category Section ─────────────────────────────────────────────── */
function ModuleSection({
    title,
    accentColor,
    items,
}: {
    title: string;
    accentColor: string;
    items: { id: string; title: string; icon: React.ReactNode; color: string; href: string; desc: string }[];
}) {
    return (
        <div style={{ marginBottom: '2.5rem' }}>
            {/* Section title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem' }}>
                <div style={{ width: '4px', height: '20px', borderRadius: '4px', backgroundColor: accentColor }} />
                <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>
                    {title}
                </h3>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#f1f5f9' }} />
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {items.map((node, i) => (
                    <motion.div
                        key={node.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Link href={node.href} style={{ textDecoration: 'none', display: 'block' }}>
                            <div className="glass-module hover-lift" style={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                borderTop: `3px solid ${node.color}`,
                                padding: '1.2rem',
                                borderRadius: '16px',
                                transition: 'box-shadow 0.2s',
                            }}>
                                <div>
                                    <div style={{ color: node.color, marginBottom: '12px' }}>{node.icon}</div>
                                    <h4 style={{ fontSize: '0.88rem', fontWeight: '900', color: '#fff', margin: '0 0 4px' }}>{node.title}</h4>
                                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0, lineHeight: '1.4' }}>{node.desc}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '1rem', fontSize: '0.72rem', fontWeight: '800', color: node.color, gap: '3px' }}>
                                    ACCEDER <ChevronRight size={14} />
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

/* ─── 1. SUPER ADMIN / ADMIN DASHBOARD ─────────────────────────────────────── */
const SuperAdminDashboard = ({
    profile, userName, greeting, products, orders,
    maintenanceBalance, ownerBalance, siteConfig,
    formatCurrency, isScannerOpen, setIsScannerOpen, handleAdminScan,
}: any) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdaySales = orders
        .filter((o: any) => o.status === 'paid' && new Date(o.date).toDateString() === yesterday.toDateString())
        .reduce((sum: number, o: any) => sum + o.total, 0);

    const todaySales = orders
        .filter((o: any) => o.status === 'paid' && new Date(o.date).toDateString() === new Date().toDateString())
        .reduce((sum: number, o: any) => sum + o.total, 0);

    const salesDiff = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : (todaySales > 0 ? 100 : 0);

    const todayOrders = orders.filter((o: any) =>
        o.status === 'paid' && new Date(o.date).toDateString() === new Date().toDateString()
    ).length;

    const chartData = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            
            const salesOnDate = orders
                .filter((o: any) => o.status === 'paid' && new Date(o.date).toDateString() === d.toDateString())
                .reduce((sum: number, o: any) => sum + o.total, 0);
            
            data.push({ name: dateStr, ventas: salesOnDate });
        }
        return data;
    }, [orders]);

    const avgTicket = todayOrders > 0 ? todaySales / todayOrders : 0;
    const lowStockCount = products.filter((p: any) => p.stock < 10).length;
    const totalPieces = products.reduce((acc: number, p: any) => acc + (Number(p.stock) || 0), 0);
    const totalInvestment = products.reduce((acc: number, p: any) => acc + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);

    /* ── Module categories ── */
    const isModuleActive = (id: string) => {
        if (!siteConfig?.activeModules) return true; // show all if not configured
        // Some core modules are always active or not in the toggle list
        if (['team', 'purchases', 'reports', 'soporte'].includes(id)) return true;
        return siteConfig.activeModules.includes(id);
    };

    const categoryAdminVentas = [
        { id: 'sales',      title: 'Control de Ventas',  icon: <ShoppingCart size={26} />, color: '#0ea5e9', href: '/dashboard/admin/sales', desc: 'POS, corte de caja y registro de transacciones.' },

        { id: 'crm',        title: 'Clientes y CRM',      icon: <Users size={26} />,         color: '#0ea5e9', href: '/dashboard/crm',         desc: 'Base de clientes y seguimiento de relaciones.' },
        { id: 'team',       title: 'Gestión de Equipo',   icon: <ShieldCheck size={26} />,   color: '#10b981', href: '/dashboard/team',         desc: 'Roles, permisos y control de personal.' },
        { id: 'users',      title: 'Usuarios y Nodos',    icon: <BookOpen size={26} />,      color: '#8b5cf6', href: '/dashboard/admin/users',  desc: 'Administración de cuentas de acceso al sistema.' },
    ].filter(m => isModuleActive(m.id));

    const categoryOpLog = [
        { id: 'inventory',  title: 'Control de Inventario',  icon: <Package size={26} />,      color: '#ef4444', href: '/dashboard/inventory', desc: 'Catálogo, stock, importaciones y baúl de merma.' },
        { id: 'purchases',  title: 'Compras y Proveedores',   icon: <ShoppingCart size={26} />, color: '#f59e0b', href: '/dashboard/purchases', desc: 'Órdenes de compra y gestión de proveedores.' },
        { id: 'delivery',   title: 'Gestión de Entregas',     icon: <Truck size={26} />,        color: '#10b981', href: '/dashboard/delivery',  desc: 'Rutas, estado de envíos y logística de reparto.' },
    ].filter(m => isModuleActive(m.id));

    const categoryMarketing = [
        { id: 'design',    title: 'Diseño y Marca',  icon: <Palette size={26} />, color: '#8b5cf6', href: '/dashboard/design',    desc: 'Canvas visual, colores, logo y apariencia de tienda.' },
        { id: 'marketing', title: 'Marketing y QR',  icon: <Share2 size={26} />,  color: '#ec4899', href: '/dashboard/marketing', desc: 'Flyers, códigos QR y gestión de campañas.' },
    ].filter(m => isModuleActive(m.id));

    const categoryAudit = [
        { id: 'billing',   title: 'Facturación SAT',     icon: <FileText size={26} />,      color: '#0ea5e9', href: '/dashboard/billing',      desc: 'Timbrado CFDI, facturas y notas de crédito.' },
        { id: 'audit',     title: 'Registro Auditoría',  icon: <Map size={26} />,            color: '#ef4444', href: '/dashboard/audit',         desc: 'Bitácora inmutable de operaciones y caja.' },
        { id: 'reports',   title: 'Reportes',             icon: <BarChart3 size={26} />,      color: '#0ea5e9', href: '/dashboard/reports',       desc: 'Análisis de ventas, KPIs y exportación de datos.' },
        { id: 'soporte',   title: 'Soporte y Tickets',   icon: <Headphones size={26} />,     color: '#14b8a6', href: '/dashboard/soporte',       desc: 'Gestión de tickets de soporte y quejas de clientes.' },
    ].filter(m => isModuleActive(m.id));

    /* ── KPI cards config ── */
    const kpis = [
        {
            label: 'VENTAS DE HOY',
            value: formatCurrency(todaySales),
            color: '#0ea5e9',
            bg: '#E3F2FD',
            icon: <TrendingUp color="#0ea5e9" size={22} />,
            badge: { 
                value: salesDiff > 0 ? `+${salesDiff.toFixed(1)}%` : `${salesDiff.toFixed(1)}%`, 
                label: 'vs ayer', 
                positive: salesDiff >= 0 
            },
        },
        {
            label: 'GANANCIA ACUMULADA',
            value: formatCurrency(ownerBalance),
            color: '#10b981',
            bg: '#E8F5E9',
            icon: <ShieldCheck color="#10b981" size={22} />,
            badge: { value: '+5.8%', label: 'vs mes anterior', positive: true },
        },
        {
            label: 'PRODUCTOS ACTIVOS',
            value: String(products.length),
            color: '#f59e0b',
            bg: '#FFF8E1',
            icon: <Package color="#f59e0b" size={22} />,
            badge: { value: `${totalPieces} px`, label: `Inv: ${formatCurrency(totalInvestment)}`, neutral: true },
        },
        {
            label: 'PEDIDOS HOY',
            value: String(todayOrders),
            color: '#8b5cf6',
            bg: '#ede9fe',
            icon: <ReceiptText color="#8b5cf6" size={22} />,
            badge: todayOrders >= 10
                ? { value: 'Meta Alcanzada', label: '≥ 10 pedidos', positive: true }
                : { value: `${10 - todayOrders} para meta`, label: 'objetivo: 10 pedidos/día', positive: false },
        },
    ];

    return (
        <main style={{ padding: '2.5rem' }}>
            {/* ── Header ────────────────────────────────────────── */}
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="tornasol-text" style={{ fontSize: '2.2rem', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        PANEL MAESTRO
                    </h1>
                    <p style={{ color: '#64748b', marginTop: '6px', fontSize: '0.9rem' }}>
                        {greeting}, <b style={{ color: '#1e293b' }}>{userName}</b> · {siteConfig.businessName}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setIsScannerOpen(true)}
                        style={{
                            ...premiumBtn,
                            backgroundColor: '#0ea5e9',
                            color: 'white',
                            boxShadow: '0 4px 14px rgba(14,165,233,0.35)',
                        }}
                    >
                        <Maximize2 size={18} /> ESCANEAR PRODUCTO
                    </motion.button>

                    {/* Saldo sistema */}
                    <div className="bg-[#1a1d2d] border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.05)] hover:shadow-[0_0_20px_rgba(14,165,233,0.15)] transition-shadow" style={{
                        borderLeft: `4px solid ${maintenanceBalance < 10 ? '#ef4444' : '#10b981'}`,
                        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                        <div style={{ backgroundColor: maintenanceBalance < 10 ? '#FFE5E5' : '#E6F4EA', padding: '7px', borderRadius: '50%' }}>
                            <Zap size={18} color={maintenanceBalance < 10 ? '#ef4444' : '#10b981'} />
                        </div>
                        <div>
                            <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 'bold', display: 'block' }}>SALDO SISTEMA</span>
                            <h4 style={{ margin: 0, color: '#1e293b', fontSize: '0.95rem', fontWeight: '800' }}>{formatCurrency(maintenanceBalance)}</h4>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Gráfico de Ventas ─────────────────────────────────────── */}
            <div style={{ marginBottom: '2.5rem', backgroundColor: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <BarChart3 size={20} color="#0ea5e9" />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>Evolución de Ventas (7 Días)</h3>
                </div>
                <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `$${val}`} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                formatter={(value: any) => [formatCurrency(Number(value)), 'Ventas']}
                            />
                            <Area type="monotone" dataKey="ventas" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── KPI Cards ─────────────────────────────────────── */}
            <div style={{
 display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
                {kpis.map((kpi, i) => (
                    <motion.div
                        key={kpi.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="bg-[#1a1d2d] border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.05)] hover:shadow-[0_0_20px_rgba(14,165,233,0.15)] transition-shadow"
                        style={{ borderLeft: `4px solid ${kpi.color}`, padding: '1.4rem', borderRadius: '16px' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <p style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '800', margin: '0 0 6px', letterSpacing: '0.07em' }}>
                                    {kpi.label}
                                </p>
                                <h3 style={{ fontSize: '1.9rem', fontWeight: '900', color: kpi.color, margin: 0, letterSpacing: '-0.02em' }}>
                                    {kpi.value}
                                </h3>
                                <TrendBadge
                                    value={kpi.badge.value}
                                    label={kpi.badge.label}
                                    positive={kpi.badge.positive}
                                    neutral={(kpi.badge as any).neutral}
                                />
                            </div>
                            <div style={{ background: kpi.bg, padding: '10px', borderRadius: '12px', flexShrink: 0 }}>
                                {kpi.icon}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Dashboard Widgets (Ranking & Restock) ──────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                <StaffRankingWidget tenantId={profile?.tenantId} />
                <RestockAlertWidget products={products} formatCurrency={formatCurrency} />
            </div>

            {/* ── Module Sections ────────────────────────────────── */}
            {categoryAdminVentas.length > 0 && <ModuleSection title="Administración y Ventas"         accentColor="#0ea5e9" items={categoryAdminVentas} />}
            {categoryOpLog.length > 0 && <ModuleSection title="Operaciones y Logística"          accentColor="#ef4444" items={categoryOpLog}       />}
            {categoryMarketing.length > 0 && <ModuleSection title="Diseño y Marketing"               accentColor="#8b5cf6" items={categoryMarketing}   />}
            {categoryAudit.length > 0 && <ModuleSection title="Auditoría, Finanzas y Soporte"    accentColor="#10b981" items={categoryAudit}       />}

            {/* ── System Health ──────────────────────────────────── */}
            <div className="bg-[#1a1d2d] border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.05)] hover:shadow-[0_0_20px_rgba(14,165,233,0.15)] transition-shadow" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', borderRadius: '16px', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(16,185,129,0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                        <CheckCircle size={28} color="#10b981" />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontWeight: '800', color: '#fff', fontSize: '0.9rem' }}>Sistema Activo</p>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Sincronización en tiempo real activa.</p>
                    </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <Link href="/dashboard/setup">
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            style={{ ...premiumBtn, backgroundColor: '#2d3345', color: '#f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                        >
                            <Settings size={15} /> CONFIGURACIÓN
                        </motion.button>
                    </Link>
                </div>
            </div>
        </main>
    );
};

/* ─── 2. SALES DASHBOARD ──────────────────────────────────────────────────── */
const SalesDashboardWorker = ({ userName, greeting, formatCurrency, orders, signOut }: any) => {
    const mySales = orders
        .filter((o: any) => o.status === 'paid' && new Date(o.date).toDateString() === new Date().toDateString())
        .reduce((sum: number, o: any) => sum + o.total, 0);

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-[#0ea5e9] uppercase tracking-tighter">ESTACIÓN DE CAJA</h1>
                    <p className="text-gray-400 font-medium text-base mt-1">{greeting}, <b className="text-white">{userName}</b>. Buen turno.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={signOut}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                >
                    <LogOut size={14} /> Cerrar Sesión
                </motion.button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <Link href="/dashboard/sales">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-8 text-white shadow-xl shadow-emerald-900/20 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <ScanLine size={48} className="mb-6 opacity-80" />
                            <h2 className="text-3xl font-black mb-2">PUNTO DE VENTA</h2>
                            <p className="text-emerald-100 text-sm font-medium">Abrir escáner, cobrar tickets y procesar carritos de clientes.</p>
                        </div>
                        <div className="mt-8 flex items-center font-bold uppercase tracking-widest text-sm">
                            Comenzar a Escanear <ChevronRight className="ml-2" />
                        </div>
                    </motion.div>
                </Link>

                <div className="bg-[#1a1d2d] border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.05)] rounded-3xl p-8 flex flex-col justify-center">
                    <h3 className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs mb-2 flex items-center gap-2">
                        <Clock size={16} /> Ventas de mi Turno (Hoy)
                    </h3>
                    <p className="text-5xl font-black text-white mb-6">{formatCurrency(mySales)}</p>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex gap-4">
                        <AlertTriangle className="text-yellow-400 shrink-0" />
                        <p className="text-yellow-100 text-sm font-medium">Recuerda hacer el <b>Corte de Caja Ciego</b> antes de retirarte e imprimir el ticket de cierre para tu supervisor.</p>
                    </div>
                </div>
            </div>

            <div className="bg-[#1a1d2d] border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.05)] rounded-3xl p-8">
                <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2">
                    <Users className="text-emerald-500" /> Tareas Rápidas
                </h3>
                <div className="grid grid-cols-1 gap-4">
                    <Link href="/dashboard/crm" className="bg-slate-800/80/5 p-4 rounded-2xl border border-white/10 font-bold text-gray-300 hover:border-[#0ea5e9] hover:text-[#0ea5e9] transition-all flex items-center gap-3 active:scale-95">
                        <Users size={20} /> Registrar Cliente
                    </Link>
                </div>
            </div>
        </main>
    );
};

/* ─── 3. INVENTORY DASHBOARD ──────────────────────────────────────────────── */
const InventoryDashboardWorker = ({ userName, greeting, products, signOut, formatCurrency }: any) => {
    const lowStockProducts = products.filter((p: any) => p.stock < 10);
    const lowStockCount    = lowStockProducts.length;

    const totalPieces = products.reduce((acc: number, p: any) => acc + (Number(p.stock) || 0), 0);
    const totalInvestment = products.reduce((acc: number, p: any) => acc + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-rose-500 uppercase tracking-tighter flex items-center gap-2 justify-center sm:justify-start">
                        <Package size={32} /> CENTRAL DE INVENTARIO
                    </h1>
                    <p className="text-gray-400 font-medium text-base mt-1">{greeting}, <b>{userName}</b>. Almacén activo en red local.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/dashboard/inventory" className="bg-[#0ea5e9] hover:bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2">
                        <Package size={16} /> Abrir Inventario
                    </Link>
                    <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={signOut}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                    >
                        <LogOut size={14} /> Cerrar Sesión
                    </motion.button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-gradient-to-br from-rose-500 to-red-700 rounded-3xl p-6 text-white shadow-lg shadow-rose-900/10 flex flex-col justify-between min-h-[140px]">
                    <div>
                        <PackageCheck size={36} className="mb-2 opacity-80" />
                        <h4 className="font-bold text-sm text-rose-100 uppercase tracking-widest">Estantes Físicos</h4>
                        <p className="text-xs text-rose-50">Gestor de productos en carpetas organizadas.</p>
                    </div>
                    <Link href="/dashboard/inventory" className="text-xs font-black uppercase tracking-wider text-white underline mt-4 block">
                        Gestionar Bodega →
                    </Link>
                </div>

                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Alertas de Stock Bajo</h4>
                    <p className={`text-4xl font-black ${lowStockCount > 0 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`}>{lowStockCount}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Productos con menos de 10 piezas.</p>
                </div>

                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Total de Artículos</h4>
                    <p className="text-4xl font-black text-white">{products.length}</p>
                    <p className="text-gray-500 text-[11px] mt-1">{totalPieces} px en stock.</p>
                </div>

                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Inversión en Inventario</h4>
                    <p className="text-4xl font-black text-emerald-500">{formatCurrency(totalInvestment)}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Valor total estimado de las mercancías.</p>
                </div>
            </div>

            <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6">
                <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-rose-500" /> Productos con Bajo Inventario
                </h3>
                <div className="grid gap-3">
                    {lowStockProducts.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <CheckCircle size={40} className="mx-auto text-emerald-500 mb-2" />
                            <h4 className="font-bold uppercase text-xs tracking-wider">Inventario Óptimo</h4>
                            <p className="text-xs text-gray-500 mt-1">No hay productos con stock menor a 10 unidades.</p>
                        </div>
                    ) : (
                        lowStockProducts.map((p: any) => (
                            <div key={p.id} className="flex justify-between items-center bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20">
                                <div>
                                    <h4 className="font-bold text-white text-sm uppercase">{p.name}</h4>
                                    <p className="text-xs text-gray-400">Categoría: {p.category} | Ubicación: Estante {p.location?.estante || 'N/A'}, Fila {p.location?.fila || 'N/A'}</p>
                                </div>
                                <span className="bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full text-xs font-black">{p.stock} pzas</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
};

/* ─── 3.5. CARGA Y DESCARGA DASHBOARD ────────────────────────────────────── */
const CargaDescargaDashboardWorker = ({ userName, greeting, orders, startLoading, completeLoading, profile, signOut, formatCurrency }: any) => {
    const [searchTerm, setSearchTerm]       = useState('');
    const [processingId, setProcessingId]   = useState<string | null>(null);

    const pendingLoads = orders.filter((o: any) => {
        const validStatus  = o.status === 'paid' || o.status === 'PREPARANDO' || o.status === 'NIGHT_QUEUE' || o.status === 'PENDIENTE_LLEGADA';
        const notLoaded    = !(o as any).isLoaded;
        const custName     = o.customer?.name || o.customerName || 'Cliente';
        const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || custName.toLowerCase().includes(searchTerm.toLowerCase());
        return validStatus && notLoaded && matchesSearch;
    }).sort((a: any, b: any) => {
        if (a.status === 'NIGHT_QUEUE' || a.status === 'PENDIENTE_LLEGADA') return 1;
        if (b.status === 'NIGHT_QUEUE' || b.status === 'PENDIENTE_LLEGADA') return -1;
        return 0;
    });

    const handleAction = async (orderId: string, action: 'start' | 'complete' | 'postpone' | 'resume') => {
        setProcessingId(orderId);
        try {
            if (action === 'start') {
                await startLoading(orderId);
            } else if (action === 'complete') {
                await completeLoading(orderId);
            } else if (action === 'postpone') {
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: 'PENDIENTE_LLEGADA' })
                });
            } else if (action === 'resume') {
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: 'PREPARANDO' })
                });
            }
        } catch {
            alert('Error al procesar la acción de carga.');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-[#0ea5e9] uppercase tracking-tighter flex items-center gap-2 justify-center sm:justify-start">
                        <Truck size={32} /> CONTROL DE PATIO Y CARGA
                    </h1>
                    <p className="text-gray-400 font-medium text-base mt-1">{greeting}, <b>{userName}</b>. Estación de patio activa.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={signOut}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                >
                    <LogOut size={14} /> Cerrar Sesión
                </motion.button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Cargas Pendientes</h4>
                    <p className="text-4xl font-black text-white">{pendingLoads.length}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Órdenes en cola para despacho.</p>
                </div>
                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Cargador Activo</h4>
                    <p className="text-2xl font-black text-[#0ea5e9] uppercase truncate">{userName}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Operando canal de patio en tiempo real.</p>
                </div>
            </div>

            <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-white/5">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">COLA DE ENTREGAS EN LOCAL</h3>
                        <p className="text-xs text-gray-400">Coordinación de patio sincronizada en tiempo real. Toma una orden para iniciar.</p>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar Orden o Cliente..."
                        className="px-4 py-2 bg-[#0f111a] border border-white/5 rounded-2xl outline-none focus:border-[#0ea5e9] text-xs font-semibold w-full sm:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="grid gap-4">
                    {pendingLoads.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
                            <h4 className="font-bold uppercase tracking-widest text-sm">Cola de Patio Vacía</h4>
                            <p className="text-xs text-gray-400 mt-1">No hay cargas pendientes por tomar.</p>
                        </div>
                    ) : (
                        pendingLoads.map((order: any) => {
                            const isNight   = order.status === 'NIGHT_QUEUE';
                            const isPending = order.status === 'PENDIENTE_LLEGADA';
                            const isDelayed = isNight || isPending;

                            return (
                                <motion.div
                                    key={order.id}
                                    layout
                                    className={`bg-[#0f111a] rounded-2xl p-5 border-l-8 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 transition-all border ${isNight ? 'border-purple-500' : isPending ? 'border-amber-500' : order.loadedBy ? 'border-orange-500' : 'border-blue-500'}`}
                                >
                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className="bg-[#1a1d2d] text-gray-400 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">{order.id}</span>
                                            {isNight   && <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Turno Nocturno</span>}
                                            {isPending && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Pospuesto</span>}
                                            {order.loadedBy && <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1"><Clock size={10} /> En proceso: {order.loadedBy}</span>}
                                        </div>
                                        <h4 className="font-black text-white text-base uppercase truncate">{order.customer?.name || order.customerName || 'Cliente'}</h4>
                                        <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1 mt-0.5">
                                            <MapPin size={12} className="text-gray-500 animate-bounce" />
                                            Destino: {order.customer?.address || order.customerAddress || 'Retiro en Sucursal / Local'}
                                        </p>
                                        <div className="mt-2 flex flex-col gap-1">
                                            {order.items.map((item: any, i: number) => (
                                                <div key={i} className="text-xs font-semibold text-gray-400 flex justify-between bg-[#1a1d2d] p-2 rounded-xl border border-white/5">
                                                    <span>{item.quantity}x {item.product?.name || item.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 w-full md:w-auto">
                                        {isDelayed ? (
                                            <motion.button
                                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                onClick={() => handleAction(order.id, 'resume')}
                                                disabled={!!processingId}
                                                className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase flex items-center gap-2 justify-center hover:bg-indigo-700 transition-all shadow-md"
                                            >
                                                {processingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                                Retomar
                                            </motion.button>
                                        ) : !order.loadedBy ? (
                                            <>
                                                <motion.button
                                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleAction(order.id, 'start')}
                                                    disabled={!!processingId}
                                                    className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase flex items-center gap-2 justify-center hover:bg-blue-700 transition-all shadow-md w-full"
                                                >
                                                    {processingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} INICIAR CARGA
                                                </motion.button>
                                                <motion.button
                                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleAction(order.id, 'postpone')}
                                                    disabled={!!processingId}
                                                    className="bg-amber-500 text-white px-5 py-1.5 rounded-2xl font-bold text-[10px] uppercase hover:bg-amber-600 transition-all"
                                                >
                                                    Posponer
                                                </motion.button>
                                            </>
                                        ) : (
                                            <motion.button
                                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                onClick={() => handleAction(order.id, 'complete')}
                                                disabled={!!processingId || (order.loadedByUid !== profile?.uid && profile?.role !== 'superadmin')}
                                                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md disabled:opacity-40"
                                            >
                                                {processingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} FINALIZAR
                                            </motion.button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </div>
        </main>
    );
};

/* ─── 3.8. MARKETING DASHBOARD ────────────────────────────────────────────── */
const MarketingDashboardWorker = ({ userName, greeting, orders, signOut, formatCurrency }: any) => {
    const totalSales = orders.filter((o: any) => o.status === 'paid').reduce((sum: number, o: any) => sum + o.total, 0);

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-purple-500 uppercase tracking-tighter flex items-center gap-2 justify-center sm:justify-start">
                        <Share2 size={32} /> PORTAL DE MARKETING Y DISEÑO
                    </h1>
                    <p className="text-gray-400 font-medium text-base mt-1">{greeting}, <b>{userName}</b>. Editor y Publicidad de la Tienda.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={signOut}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                >
                    <LogOut size={14} /> Cerrar Sesión
                </motion.button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <Link href="/dashboard/design">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-gradient-to-br from-indigo-500 to-purple-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-900/20 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <Palette size={48} className="mb-6 opacity-80" />
                            <h2 className="text-3xl font-black mb-2 uppercase">Canvas de la Tienda</h2>
                            <p className="text-indigo-100 text-sm font-medium">Edita la apariencia de la tienda, colores de botones, fondos, textos y reubica elementos en el catálogo.</p>
                        </div>
                        <div className="mt-8 flex items-center font-bold uppercase tracking-widest text-sm">
                            Abrir Editor Canvas <ChevronRight className="ml-2" />
                        </div>
                    </motion.div>
                </Link>

                <Link href="/dashboard/marketing">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl p-8 text-white shadow-xl shadow-purple-900/20 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <QrCode size={48} className="mb-6 opacity-80" />
                            <h2 className="text-3xl font-black mb-2 uppercase">Campañas y Códigos QR</h2>
                            <p className="text-purple-100 text-sm font-medium">Genera flyers y fichas de precios con códigos QR únicos para que los clientes compren directamente.</p>
                        </div>
                        <div className="mt-8 flex items-center font-bold uppercase tracking-widest text-sm">
                            Ver Herramientas QR <ChevronRight className="ml-2" />
                        </div>
                    </motion.div>
                </Link>
            </div>

            <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-8">
                <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="text-purple-500" /> Impacto de Campañas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-[#0f111a] p-6 rounded-2xl border border-white/5">
                        <h4 className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Ventas Totales</h4>
                        <p className="text-2xl font-black text-white">{formatCurrency(totalSales)}</p>
                    </div>
                    <div className="bg-[#0f111a] p-6 rounded-2xl border border-white/5">
                        <h4 className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Escaneos QR Recientes</h4>
                        <p className="text-2xl font-black text-purple-400">142</p>
                    </div>
                    <div className="bg-[#0f111a] p-6 rounded-2xl border border-white/5">
                        <h4 className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Conversión de Diseño</h4>
                        <p className="text-2xl font-black text-emerald-500">4.8%</p>
                    </div>
                </div>
            </div>
        </main>
    );
};

/* ─── 4. DELIVERY DASHBOARD ───────────────────────────────────────────────── */
const DeliveryDashboardWorker = ({ userName, greeting, orders, signOut }: any) => {
    const pendingDeliveries = orders.filter((o: any) => o.status === 'processing' || o.status === 'shipping' || o.status === 'ready_for_delivery');

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-blue-500 uppercase tracking-tighter">RUTA Y ENTREGAS</h1>
                    <p className="text-gray-400 font-medium text-lg mt-1">{greeting}, <b>{userName}</b>. Conduce con cuidado.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={signOut}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                >
                    <LogOut size={14} /> Cerrar Sesión
                </motion.button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <Link href="/dashboard/delivery">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-gradient-to-br from-blue-500 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-900/20 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <Route size={48} className="mb-6 opacity-80" />
                            <h2 className="text-3xl font-black mb-2">MAPA DE ENTREGAS</h2>
                            <p className="text-blue-100 text-sm font-medium">Ver rutas pendientes, escanear paquetes cargados y marcar como entregados.</p>
                        </div>
                        <div className="mt-8 flex items-center font-bold uppercase tracking-widest text-sm">
                            Iniciar Ruta <ChevronRight className="ml-2" />
                        </div>
                    </motion.div>
                </Link>

                <div className="bg-slate-800/80 rounded-3xl p-8 border border-slate-700/50 shadow-lg flex flex-col justify-center">
                    <h3 className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs mb-2 flex items-center gap-2">
                        <Truck size={16} className="text-blue-500" /> Entregas Pendientes Hoy
                    </h3>
                    <p className="text-5xl font-black text-white mb-6">{pendingDeliveries.length}</p>
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4">
                        <MapPin className="text-blue-500 shrink-0" />
                        <p className="text-blue-800 text-sm font-medium">Asegúrate de llevar contigo los remitos impresos o recolectar firma digital en la app de entregas.</p>
                    </div>
                </div>
            </div>
        </main>
    );
};

/* ─── MAIN ROUTER ─────────────────────────────────────────────────────────── */
export default function DashboardRouter() {
    const { orders, products, maintenanceBalance, ownerBalance, siteConfig, firebaseStatus, formatCurrency, startLoading, completeLoading } = useCart();
    const { profile, signOut } = useAuth();
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const handleAdminScan = (code: string) => {
        const product = products.find(p => p.id === code || p.barcode === code);
        if (product) {
            alert(`✅ Producto Identificado:\n\nNombre: ${product.name}\nStock: ${product.stock} unidades\nPrecio: ${formatCurrency(product.price)}`);
        } else {
            alert(`❌ Código "${code}" no encontrado en el sistema.`);
        }
        setIsScannerOpen(false);
    };

    const hour     = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const userName = profile?.displayName?.split(' ')[0] || 'Trabajador';
    const role     = profile?.role || 'superadmin';

    /* ── Role routing ── */
    if (role === 'sales') {
        return <SalesDashboardWorker userName={userName} greeting={greeting} formatCurrency={formatCurrency} orders={orders} signOut={signOut} />;
    }
    if (role === 'inventory') {
        return <InventoryDashboardWorker userName={userName} greeting={greeting} products={products} signOut={signOut} formatCurrency={formatCurrency} />;
    }
    if (role === 'carga_descarga') {
        return (
            <CargaDescargaDashboardWorker
                userName={userName} greeting={greeting}
                orders={orders} startLoading={startLoading}
                completeLoading={completeLoading} profile={profile}
                signOut={signOut} formatCurrency={formatCurrency}
            />
        );
    }
    if (role === 'marketing') {
        return <MarketingDashboardWorker userName={userName} greeting={greeting} orders={orders} signOut={signOut} formatCurrency={formatCurrency} />;
    }
    if (role === 'driver') {
        return <DeliveryDashboardWorker userName={userName} greeting={greeting} orders={orders} signOut={signOut} />;
    }

    /* ── Default: Super Admin ── */
    return (
        <>
            <SuperAdminDashboard
                profile={profile}
                userName={userName}
                greeting={greeting}
                products={products}
                orders={orders}
                maintenanceBalance={maintenanceBalance}
                ownerBalance={ownerBalance}
                siteConfig={siteConfig}
                firebaseStatus={firebaseStatus}
                formatCurrency={formatCurrency}
                isScannerOpen={isScannerOpen}
                setIsScannerOpen={setIsScannerOpen}
                handleAdminScan={handleAdminScan}
            />

            {isScannerOpen && (
                <BarcodeScanner
                    onScanSuccess={handleAdminScan}
                    onClose={() => setIsScannerOpen(false)}
                    mode="admin"
                />
            )}
        </>
    );
}
