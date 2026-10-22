"use client";
import { motion } from 'framer-motion';
import { useMemo, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, FileText, ShieldCheck, CheckCircle, Maximize2, Share2, Map, TrendingUp, Zap, Package, ShoppingCart, Truck, Settings, ReceiptText, BookOpen, Cloud, BarChart3, Headphones, Terminal, Store } from 'lucide-react';
import Link from 'next/link';
import StaffRankingWidget from '@/components/admin/StaffRankingWidget';
import RestockAlertWidget from '@/components/admin/RestockAlertWidget';
import { BalanceEffectWidget } from '@/components/BalanceEffectWidget';
import ModuleSection from '@/components/admin/ModuleSection';
import KPICard from '@/components/admin/KPICard';
import CloudBackupConfigWidget from '@/components/admin/CloudBackupConfigWidget';
import { Palette, Globe } from 'lucide-react';
import { isDemo, isNube } from '@/lib/envConfig';

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

/* ─── 1. SUPER ADMIN / ADMIN DASHBOARD ─────────────────────────────────────── */
export default function SuperAdminDashboard({
    profile, userName, greeting, products = [], orders = [],
    maintenanceBalance, ownerBalance, siteConfig,
    formatCurrency, isScannerOpen, setIsScannerOpen, handleAdminScan
}: any) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [rniUrl, setRniUrl] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            (window as any).electronAPI.getRniUrl().then((url: string | null) => {
                if (url) setRniUrl(url);
            });
            (window as any).electronAPI.onRniUrlReady((url: string) => {
                setRniUrl(url);
            });
        }
    }, []);

    const isValidSale = (o: any) => {
        if (!o || o.status === 'cancelled' || o.status === 'refunded') return false;
        return Boolean(o.confirmedAt) || ['paid', 'COMPLETED', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'READY_FOR_PICKUP_PAID'].includes(o.status);
    };

    const yesterdaySales = orders
        .filter((o: any) => isValidSale(o) && new Date(o.date).toDateString() === yesterday.toDateString())
        .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

    const todaySales = orders
        .filter((o: any) => isValidSale(o) && new Date(o.date).toDateString() === new Date().toDateString())
        .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

    const salesDiff = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : (todaySales > 0 ? 100 : 0);

    const todayOrders = orders.filter((o: any) =>
        isValidSale(o) && new Date(o.date).toDateString() === new Date().toDateString()
    ).length;

    const [chartMode, setChartMode] = useState<'bar' | 'area'>('area');

    const chartData = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            const dayOrders = orders.filter((o: any) =>
                isValidSale(o) &&
                new Date(o.date).toDateString() === d.toDateString()
            );
            const salesOnDate = dayOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
            
            data.push({
                name: dateStr,
                ventas: salesOnDate,
                pedidos: dayOrders.length,
                isToday: i === 0,
            });
        }
        return data;
    }, [orders]);

    const weeklyTotalSales = useMemo(
        () => chartData.reduce((acc, item) => acc + item.ventas, 0),
        [chartData]
    );
    const weeklyTotalOrders = useMemo(
        () => chartData.reduce((acc, item) => acc + item.pedidos, 0),
        [chartData]
    );

    const avgTicket = todayOrders > 0 ? todaySales / todayOrders : 0;
    const lowStockCount = products.filter((p: any) => p.stock < 10).length;
    const totalPieces = products.reduce((acc: number, p: any) => acc + (Number(p.stock) || 0), 0);
    const totalInvestment = products.reduce((acc: number, p: any) => acc + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);

    /* ── Module categories ── */
    const isModuleActive = (id: string) => {
        if (!siteConfig?.activeModules) return true; // show all if not configured
        // Core designated operational modules are always accessible to Super Admin
        if (['team', 'purchases', 'reports', 'soporte', 'sales', 'inventory', 'patio', 'pickup', 'delivery'].includes(id)) return true;
        return siteConfig.activeModules.includes(id);
    };

    const categoryAdminVentas = [
        { id: 'sales',      title: 'Caja y Ventas POS',  icon: <ShoppingCart size={26} />, color: '#0ea5e9', href: '/dashboard/sales',       desc: 'Terminal POS, corte de caja, cobro y emisión de tickets.' },
        { id: 'crm',        title: 'Clientes y CRM',      icon: <Users size={26} />,         color: '#0ea5e9', href: '/dashboard/crm',         desc: 'Base de clientes y seguimiento de relaciones.' },
        { id: 'team',       title: 'Gestión de Equipo',   icon: <ShieldCheck size={26} />,   color: '#10b981', href: '/dashboard/team',         desc: 'Roles, permisos y control de personal.' },
        { id: 'users',      title: 'Usuarios y Nodos',    icon: <BookOpen size={26} />,      color: '#8b5cf6', href: '/dashboard/admin/users',  desc: 'Administración de cuentas de acceso al sistema.' },
    ].filter(m => isModuleActive(m.id));

    const categoryOpLog = [
        { id: 'inventory',  title: 'Control de Inventario',  icon: <Package size={26} />,      color: '#ef4444', href: '/dashboard/inventory', desc: 'Catálogo, estantes, stock, importaciones y merma.' },
        { id: 'patio',      title: 'Patio Carga y Descarga', icon: <Truck size={26} />,        color: '#f59e0b', href: '/dashboard/patio',     desc: 'Surtido, verificación y despacho de material pesado.' },
        { id: 'pickup',     title: 'Mostrador y Pickup',     icon: <Store size={26} />,        color: '#8b5cf6', href: '/dashboard/pickup',    desc: 'Entrega rápida en mostrador y pedidos de tienda.' },
        { id: 'delivery',   title: 'Gestión de Reparto',     icon: <Truck size={26} />,        color: '#10b981', href: '/dashboard/delivery',  desc: 'Rutas GPS, firma offline y pedidos a domicilio.' },
        { id: 'purchases',  title: 'Compras y Proveedores',   icon: <ShoppingCart size={26} />, color: '#6366f1', href: '/dashboard/purchases', desc: 'Órdenes de compra y gestión de proveedores.' },
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

    const categoryCloud = isNube() ? [
        { id: 'b2b',       title: 'Red B2B BUNKKER',      icon: <Globe size={26} />,         color: '#0284c7', href: '/b2b-market',              desc: 'Catálogo público y red de abastecimiento.' },
    ] : [];

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
        <main className="bunkker-industrial relative z-10" style={{ padding: '2rem' }}>
            {/* ── Header BUNKKER ERP (Capa 4: Contenedores translúcidos y textos azules) ── */}
            <header className="bunkker-translucent-card p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-cyan-500/20 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
                {/* Logo Hero & Título Maestro */}
                <div className="flex items-center gap-4 text-center md:text-left">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500"></div>
                        <img 
                            src="/bunkker-logo-hero.png" 
                            alt="BUNKKER ERP" 
                            className="relative w-16 h-16 md:w-20 md:h-20 object-contain rounded-2xl bg-black/60 border border-cyan-400/40 p-1 shadow-2xl" 
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-center md:justify-start gap-2.5">
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2 drop-shadow-[0_2px_10px_rgba(56,189,248,0.5)]">
                                BUNKKER <span className="text-cyan-400 font-mono">ERP</span>
                            </h1>
                            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_10px_rgba(56,189,248,0.2)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                ONLINE
                            </span>
                        </div>
                        <p className="text-[11px] font-bold text-cyan-400/90 tracking-widest uppercase mt-0.5">
                            Energía · Control · Optimización · Sostenibilidad
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            {greeting}, <b className="text-white font-semibold">{userName}</b> · {siteConfig?.businessName || 'Empresa'} · <span className="text-cyan-300">Tecnología que genera impacto real</span>
                        </p>
                    </div>
                </div>

                {/* Acciones Rápidas */}
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
                    {rniUrl && (
                        <div className="flex items-center gap-2.5 bg-black/40 border border-cyan-500/30 px-3 py-1.5 rounded-xl shadow-lg">
                            <div 
                                className="bg-white p-1 rounded-lg cursor-pointer hover:scale-105 transition-transform"
                                title="Imprimir QR de Acceso RNI"
                                onClick={() => {
                                    const html = `<html><head><title>Catálogo BUNKKER</title><style>body{font-family:sans-serif;text-align:center;padding:50px;}h1{color:#0ea5e9;font-size:3rem;}p{font-size:1.5rem;color:#64748b;}img{margin:40px 0;width:400px;height:400px;}</style></head><body><h1>Catálogo Móvil</h1><p>Escanea este código para acceder al catálogo local sin fila.</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(rniUrl)}" /><p><strong>${rniUrl}</strong></p><script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script></body></html>`;
                                    const win = window.open('', '_blank');
                                    if(win){ win.document.write(html); win.document.close(); }
                                }}
                            >
                                <QRCodeSVG value={rniUrl} size={36} />
                            </div>
                            <div className="text-left">
                                <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider block">Túnel RNI P2P</span>
                                <span className="text-xs text-white font-mono font-bold truncate max-w-[130px] block">{rniUrl.replace('https://', '').replace('http://', '')}</span>
                            </div>
                        </div>
                    )}

                    {/* Botón Restaurar Respaldo Local */}
                    <motion.label
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 cursor-pointer flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                    >
                        <ShieldCheck size={16} className="text-cyan-400" />
                        <span>RESTAURAR RESPALDO</span>
                        <input
                            type="file"
                            accept=".txt"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = async (evt) => {
                                    const text = evt.target?.result as string;
                                    if (typeof window !== 'undefined' && (window as any).electronAPI) {
                                        const res = await (window as any).electronAPI.restoreBackup(text);
                                        if (res.success) {
                                            alert(res.message);
                                        } else {
                                            alert("Error: " + res.message);
                                        }
                                    } else {
                                        alert("Funcionalidad de respaldo físico disponible en el cliente local.");
                                    }
                                };
                                reader.readAsText(file);
                            }}
                        />
                    </motion.label>

                    {/* Escanear Producto */}
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setIsScannerOpen(true)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide border border-cyan-400 bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_4px_20px_rgba(14,165,233,0.4)] flex items-center gap-1.5 hover:brightness-110 transition-all cursor-pointer"
                    >
                        <Maximize2 size={16} />
                        <span>ESCANEAR PRODUCTO</span>
                    </motion.button>

                    {/* Saldo Operativo */}
                    <div className="bunkker-translucent-card px-3.5 py-2 border border-cyan-500/30 flex items-center gap-2.5 rounded-xl">
                        <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                            <Zap size={16} />
                        </div>
                        <div className="text-left">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Saldo Sistema</span>
                            <span className="text-sm font-black font-mono text-cyan-300">{formatCurrency(maintenanceBalance)}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ⚖️ Algoritmo Efecto Balanza: Rotación vs. Margen Puro (IA SuperAdmin) */}
            <BalanceEffectWidget />



            {/* ── Gráfico de Ventas (7 Días - Recharts BarChart) ─────────────────────────────────────── */}
            <div className="bunkker-card" style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(6, 182, 212, 0.12)', padding: '8px', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                            <BarChart3 size={20} color="#06B6D4" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>
                                Ventas de los Últimos 7 Días
                            </h3>
                            <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                                Acumulado 7 días: <b style={{ color: '#22D3EE' }}>{formatCurrency(weeklyTotalSales)}</b> ({weeklyTotalOrders} órdenes procesadas)
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <button
                            type="button"
                            onClick={() => setChartMode('bar')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '7px',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: chartMode === 'bar' ? '#06B6D4' : 'transparent',
                                color: chartMode === 'bar' ? '#0f172a' : '#94a3b8',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            BARRAS (7D)
                        </button>
                        <button
                            type="button"
                            onClick={() => setChartMode('area')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '7px',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: chartMode === 'area' ? '#06B6D4' : 'transparent',
                                color: chartMode === 'area' ? '#0f172a' : '#94a3b8',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            CURVA TENDENCIA
                        </button>
                    </div>
                </div>

                <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        {chartMode === 'bar' ? (
                            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.95} />
                                        <stop offset="100%" stopColor="#0284C7" stopOpacity={0.65} />
                                    </linearGradient>
                                    <linearGradient id="barTodayGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#059669" stopOpacity={0.75} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(6, 182, 212, 0.1)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `$${val}`} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(6, 182, 212, 0.08)' }}
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(6, 182, 212, 0.35)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', color: '#fff' }}
                                    itemStyle={{ color: '#22D3EE', fontWeight: 'bold' }}
                                    formatter={(value: any, _name: any, props: any) => [
                                        `${formatCurrency(Number(value))} (${props?.payload?.pedidos || 0} pedidos)`,
                                        'Ventas del Día'
                                    ]}
                                />
                                <Bar dataKey="ventas" radius={[8, 8, 2, 2]} maxBarSize={54}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.isToday ? 'url(#barTodayGradient)' : 'url(#barGradient)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        ) : (
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.5}/>
                                        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(6, 182, 212, 0.1)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `$${val}`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(6, 182, 212, 0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', color: '#fff' }}
                                    itemStyle={{ color: '#22D3EE', fontWeight: 'bold' }}
                                    formatter={(value: any) => [formatCurrency(Number(value)), 'Ventas']}
                                />
                                <Area type="monotone" dataKey="ventas" stroke="#22D3EE" strokeWidth={4} fillOpacity={1} fill="url(#colorVentas)" activeDot={{ r: 6, fill: '#06B6D4', stroke: '#fff', strokeWidth: 2, style: { filter: 'drop-shadow(0px 0px 8px rgba(34,211,238,0.8))' } }} />
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── KPI Cards ─────────────────────────────────────── */}
            <div style={{
 display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
                {kpis.map((kpi, i) => (
                    <KPICard
                        key={kpi.label}
                        label={kpi.label}
                        value={kpi.value}
                        color={kpi.color}
                        bg={kpi.bg}
                        icon={kpi.icon}
                        badge={{
                            value: kpi.badge.value,
                            label: kpi.badge.label,
                            positive: kpi.badge.positive,
                            neutral: (kpi.badge as any).neutral
                        }}
                        delayIndex={i}
                    />
                ))}
            </div>

            {/* ── Dashboard Widgets (Ranking & Restock) ──────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[8px] mb-10">
                <StaffRankingWidget tenantId={profile?.tenantId} />
                <RestockAlertWidget products={products} formatCurrency={formatCurrency} />
            </div>

            {/* ── Configuración de Respaldos Automáticos a Google Cloud ──── */}
            <CloudBackupConfigWidget />

            {/* ── Module Sections ────────────────────────────────── */}
            {categoryAdminVentas.length > 0 && <ModuleSection title="Administración y Ventas"         accentColor="#0ea5e9" items={categoryAdminVentas} />}
            {categoryOpLog.length > 0 && <ModuleSection title="Operaciones y Logística"          accentColor="#ef4444" items={categoryOpLog}       />}
            {categoryMarketing.length > 0 && <ModuleSection title="Diseño y Marketing"               accentColor="#8b5cf6" items={categoryMarketing}   />}
            {categoryAudit.length > 0 && <ModuleSection title="Auditoría, Finanzas y Soporte"    accentColor="#10b981" items={categoryAudit}       />}
            {categoryCloud.length > 0 && <ModuleSection title="Mundo NUBE (PRO)"                 accentColor="#0284c7" items={categoryCloud}       />}

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



