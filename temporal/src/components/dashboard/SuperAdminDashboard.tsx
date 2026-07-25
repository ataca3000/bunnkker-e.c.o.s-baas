
"use client";
import { motion } from 'framer-motion';
import { useMemo, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, FileText, ShieldCheck, CheckCircle, Maximize2, Share2, Map, TrendingUp, Zap, Package, ShoppingCart, Truck, Settings, ReceiptText, BookOpen, Cloud, BarChart3, Headphones, Terminal } from 'lucide-react';
import Link from 'next/link';
import StaffRankingWidget from '@/components/admin/StaffRankingWidget';
import RestockAlertWidget from '@/components/admin/RestockAlertWidget';
import ModuleSection from '@/components/admin/ModuleSection';
import KPICard from '@/components/admin/KPICard';
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

    const yesterdaySales = orders
        .filter((o: any) => ['paid', 'COMPLETED', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status) && new Date(o.date).toDateString() === yesterday.toDateString())
        .reduce((sum: number, o: any) => sum + o.total, 0);

    const todaySales = orders
        .filter((o: any) => ['paid', 'COMPLETED', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status) && new Date(o.date).toDateString() === new Date().toDateString())
        .reduce((sum: number, o: any) => sum + o.total, 0);

    const salesDiff = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : (todaySales > 0 ? 100 : 0);

    const todayOrders = orders.filter((o: any) =>
        ['paid', 'COMPLETED', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status) && new Date(o.date).toDateString() === new Date().toDateString()
    ).length;

    const chartData = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            
            const salesOnDate = orders
                .filter((o: any) => ['paid', 'COMPLETED', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status) && new Date(o.date).toDateString() === d.toDateString())
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
        { id: 'tests',     title: 'Laboratorio de Estrés',icon: <Terminal size={26} />,      color: '#f97316', href: '/dashboard/tests',         desc: 'Simulaciones de carga y concurrencia local.' },
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
        <main style={{ padding: '2.5rem' }}>
            {/* ── Header ────────────────────────────────────────── */}
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="tornasol-text" style={{ fontSize: '2.2rem', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        PANEL MAESTRO
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                            {greeting}, <b style={{ color: '#1e293b' }}>{userName}</b> · {siteConfig.businessName}
                        </p>
                        <span className="flex items-center gap-1 bg-cyan-900/40 text-cyan-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-cyan-500/30">
                            <Cloud size={12} /> RED NODO RNI
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {rniUrl && (
                        <div className="card-sanjose flex items-center gap-4 px-4 py-2" style={{ padding: '8px 16px' }}>
                            <div className="bg-white p-1 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.6)] cursor-pointer hover:scale-105 transition-transform" 
                                 title="Imprimir Poster Cero Filas"
                                 onClick={() => {
                                     const html = `<html><head><title>Poster Cero Filas</title><style>body{font-family:sans-serif;text-align:center;padding:50px;}h1{color:#0ea5e9;font-size:3rem;}p{font-size:1.5rem;color:#64748b;}img{margin:40px 0;width:400px;height:400px;}</style></head><body><h1>Catálogo Cero Filas</h1><p>Escanea este código con tu celular para ordenar al instante sin hacer fila.</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(rniUrl)}" /><p><strong>${rniUrl}</strong></p><script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script></body></html>`;
                                     const win = window.open('', '_blank');
                                     if(win){ win.document.write(html); win.document.close(); }
                                 }}>
                                <QRCodeSVG value={rniUrl} size={48} />
                            </div>
                            <div>
                                <span className="text-[0.62rem] text-cyan-400 font-bold block uppercase tracking-widest">Escanea para acceder (Túnel P2P)</span>
                                <a href={rniUrl} target="_blank" rel="noreferrer" className="text-white text-sm font-bold truncate block max-w-[200px] hover:text-cyan-300 transition-colors">
                                    {rniUrl}
                                </a>
                                <button onClick={() => {
                                     const html = `<html><head><title>Poster Cero Filas</title><style>body{font-family:sans-serif;text-align:center;padding:50px;}h1{color:#0ea5e9;font-size:3rem;}p{font-size:1.5rem;color:#64748b;}img{margin:40px 0;width:400px;height:400px;}</style></head><body><h1>Catálogo Cero Filas</h1><p>Escanea este código con tu celular para ordenar al instante sin hacer fila.</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(rniUrl)}" /><p><strong>${rniUrl}</strong></p><script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script></body></html>`;
                                     const win = window.open('', '_blank');
                                     if(win){ win.document.write(html); win.document.close(); }
                                 }} className="text-xs text-blue-400 underline mt-1 cursor-pointer bg-transparent border-none p-0">Imprimir Poster</button>
                            </div>
                        </div>
                    )}
                    <motion.label
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        style={{
                            ...premiumBtn,
                            backgroundColor: 'rgba(6, 182, 212, 0.1)',
                            color: '#06b6d4',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <ShieldCheck size={18} /> ¿YA NOS CONOCÍAMOS?
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
                                        alert("Funcionalidad solo disponible en la App de Escritorio.");
                                    }
                                };
                                reader.readAsText(file);
                            }}
                        />
                    </motion.label>

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

            {/* ── Banner de Descarga (Demo a Local) ──────────────────── */}
            {isDemo() && (
                <div className="bg-gradient-to-r from-sky-900 to-indigo-900 border border-sky-500/30 rounded-xl p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-sky-900/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-32 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />
                    <div className="relative z-10">
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">
                            Promesas cualquiera, ponme a trabajar.
                        </h2>
                        <p className="text-sky-200">
                            Descarga BUNKKER E.C.O.S. para Windows y gestiona tu negocio 100% sin internet.
                        </p>
                    </div>
                    <a 
                        href="#" // TODO: Poner el link real a Github Releases, Drive, etc.
                        className="relative z-10 bg-white hover:bg-sky-50 text-sky-900 font-black uppercase tracking-widest py-4 px-8 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-2"
                        onClick={() => alert('¡Listo para compilar! Ejecuta npm run dist:win y sube el .exe a tu nube preferida para pegar el enlace aquí.')}
                    >
                        <Terminal size={20} />
                        Descargar .exe Gratis
                    </a>
                </div>
            )}

            {/* ── Gráfico de Ventas ─────────────────────────────────────── */}
            <div className="card-sanjose" style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <BarChart3 size={20} color="#06B6D4" />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>Evolución de Ventas (7 Días)</h3>
                </div>
                <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                <StaffRankingWidget tenantId={profile?.tenantId} />
                <RestockAlertWidget products={products} formatCurrency={formatCurrency} />
            </div>

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


