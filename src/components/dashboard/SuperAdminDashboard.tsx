"use client";
import { motion } from 'framer-motion';
import { useMemo, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, FileText, ShieldCheck, CheckCircle, Maximize2, Share2, Map, TrendingUp, Zap, Package, ShoppingCart, Truck, Settings, ReceiptText, BookOpen, Cloud, BarChart3, Headphones, Terminal, Store, Boxes, Radio, Download } from 'lucide-react';
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
const CustomDashboardTooltip = ({ active, payload, label, selectedKpi, formatCurrency }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0];
    const isSales = selectedKpi === 'sales';
    const isProfit = selectedKpi === 'profit';
    const isInventory = selectedKpi === 'inventory';
    const isOrders = selectedKpi === 'orders';

    const accentColor = isSales ? '#22D3EE' : isProfit ? '#34D399' : isInventory ? '#FBBF24' : '#A78BFA';
    const badgeText = isSales ? 'Ventas' : isProfit ? 'Utilidad' : isInventory ? 'Stock Físico' : 'Pedidos';

    let displayValue = '';
    let subDetail = '';

    if (isSales) {
        displayValue = formatCurrency(Number(data.value || 0));
        subDetail = `${data.payload?.pedidos || 0} pedido(s) procesados`;
    } else if (isProfit) {
        displayValue = formatCurrency(Number(data.value || 0));
        subDetail = `Margen en ${data.payload?.pedidos || 0} orden(es)`;
    } else if (isInventory) {
        displayValue = `${Number(data.value || 0).toLocaleString()} pzs`;
        subDetail = `Inversión: ${formatCurrency(Number(data.payload?.valor || 0))}`;
    } else {
        displayValue = `${data.value || 0} pedidos`;
        subDetail = 'Registrados en sistema';
    }

    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1.5px solid ${accentColor}66`,
            borderRadius: '16px',
            padding: '12px 16px',
            boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 0 20px ${accentColor}33`,
            color: '#fff',
            minWidth: '200px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label || data.payload?.name}
                </span>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    color: accentColor,
                    backgroundColor: `${accentColor}1A`,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: `1px solid ${accentColor}40`
                }}>
                    {badgeText}
                </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                {displayValue}
            </div>
            {subDetail && (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}` }}></span>
                    {subDetail}
                </div>
            )}
        </div>
    );
};

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

    const [selectedKpi, setSelectedKpi] = useState<'sales' | 'profit' | 'inventory' | 'orders'>('sales');
    const [chartMode, setChartMode] = useState<'bar' | 'area'>('area');

    // 7D Sales data
    const chartSalesData = useMemo(() => {
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

    // 7D Profit data (calculated from order items margin or realistic gross margin)
    const chartProfitData = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            const dayOrders = orders.filter((o: any) =>
                isValidSale(o) &&
                new Date(o.date).toDateString() === d.toDateString()
            );
            const profitOnDate = dayOrders.reduce((sum: number, o: any) => {
                if (Array.isArray(o.items) && o.items.length > 0) {
                    const itemProfit = o.items.reduce((acc: number, it: any) => {
                        const itPrice = Number(it.price) || 0;
                        const itCost = Number(it.cost) || (itPrice * 0.72);
                        const itQty = Number(it.quantity) || 1;
                        return acc + Math.max(0, (itPrice - itCost) * itQty);
                    }, 0);
                    return sum + itemProfit;
                }
                return sum + (Number(o.ownerCut || o.profit || (Number(o.total || 0) * 0.28)) || 0);
            }, 0);
            
            data.push({
                name: dateStr,
                ganancia: Math.round(profitOnDate),
                pedidos: dayOrders.length,
                isToday: i === 0,
            });
        }
        return data;
    }, [orders]);

    // Inventory category distribution
    const chartInventoryData = useMemo(() => {
        const map: Record<string, { name: string; piezas: number; valor: number }> = {};
        products.forEach((p: any) => {
            const rawCat = p.category ? String(p.category).trim() : 'General';
            const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
            if (!map[cat]) {
                map[cat] = { name: cat, piezas: 0, valor: 0 };
            }
            const st = Number(p.stock) || 0;
            const pr = Number(p.price) || 0;
            map[cat].piezas += st;
            map[cat].valor += st * pr;
        });
        const list = Object.values(map).sort((a, b) => b.piezas - a.piezas).slice(0, 7);
        return list.length > 0 ? list : [{ name: 'General', piezas: 0, valor: 0 }];
    }, [products]);

    // 7D Orders count
    const chartOrdersData = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            const dayOrders = orders.filter((o: any) =>
                isValidSale(o) &&
                new Date(o.date).toDateString() === d.toDateString()
            );
            data.push({
                name: dateStr,
                pedidos: dayOrders.length,
                isToday: i === 0,
            });
        }
        return data;
    }, [orders]);

    const weeklyTotalSales = useMemo(
        () => chartSalesData.reduce((acc, item) => acc + item.ventas, 0),
        [chartSalesData]
    );
    const weeklyTotalProfit = useMemo(
        () => chartProfitData.reduce((acc, item) => acc + item.ganancia, 0),
        [chartProfitData]
    );
    const weeklyTotalOrders = useMemo(
        () => chartSalesData.reduce((acc, item) => acc + item.pedidos, 0),
        [chartSalesData]
    );

    const avgTicket = todayOrders > 0 ? todaySales / todayOrders : (weeklyTotalOrders > 0 ? weeklyTotalSales / weeklyTotalOrders : 0);
    const lowStockCount = products.filter((p: any) => (p.stock || 0) < 10).length;
    const totalPieces = products.reduce((acc: number, p: any) => acc + (Number(p.stock) || 0), 0);
    const totalInvestment = products.reduce((acc: number, p: any) => acc + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);
    const estMargin = weeklyTotalSales > 0 ? ((weeklyTotalProfit / weeklyTotalSales) * 100).toFixed(1) : '28.0';

    /* ── Module categories ── */
    const isModuleActive = (id: string) => {
        if (!siteConfig?.activeModules) return true; // show all if not configured
        // Core designated operational modules are always accessible to Super Admin
        if (['team', 'purchases', 'reports', 'soporte', 'sales', 'inventory', 'patio', 'pickup', 'delivery', 'simulator'].includes(id)) return true;
        return siteConfig.activeModules.includes(id);
    };

    const categoryAdminVentas = [
        { id: 'sales',      title: 'Caja y Ventas POS',  icon: <ShoppingCart size={26} />, color: '#0ea5e9', href: '/dashboard/sales',       desc: 'Terminal POS, corte de caja, cobro y emisión de tickets.' },
        { id: 'crm',        title: 'Clientes y CRM',      icon: <Users size={26} />,         color: '#0ea5e9', href: '/dashboard/crm',         desc: 'Base de clientes y seguimiento de relaciones.' },
        { id: 'team',       title: 'Gestión de Equipo',   icon: <ShieldCheck size={26} />,   color: '#10b981', href: '/dashboard/team',         desc: 'Roles, permisos y control de personal.' },
        { id: 'users',      title: 'Usuarios y Nodos',    icon: <BookOpen size={26} />,      color: '#8b5cf6', href: '/dashboard/admin/users',  desc: 'Administración de cuentas de acceso al sistema.' },
    ].filter(m => isModuleActive(m.id));

    const categoryOpLog = [
        { id: 'simulator',  title: 'Simulador 3D FerreFlujo', icon: <Boxes size={26} />, color: '#06b6d4', href: '/dashboard/simulator', desc: 'Gemelo digital interactivo: Almacén, racks, patio, montacargas y mostrador.' },
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

    /* ── KPI cards config (Filtros interactivos de la gráfica) ── */
    const kpis = [
        {
            id: 'sales' as const,
            label: 'VENTAS DE HOY',
            value: formatCurrency(todaySales),
            color: '#0ea5e9',
            bg: 'rgba(14, 165, 233, 0.15)',
            icon: <TrendingUp color="#0ea5e9" size={22} />,
            badge: { 
                value: `${todayOrders} tickets`, 
                label: `Ticket Prom: ${formatCurrency(avgTicket)}`, 
                positive: todayOrders > 0 
            },
        },
        {
            id: 'profit' as const,
            label: 'GANANCIA ACUMULADA',
            value: formatCurrency(ownerBalance),
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.15)',
            icon: <ShieldCheck color="#10b981" size={22} />,
            badge: { 
                value: `Margen ~${estMargin}%`, 
                label: `7D: ${formatCurrency(weeklyTotalProfit)}`, 
                positive: true 
            },
        },
        {
            id: 'inventory' as const,
            label: 'PRODUCTOS ACTIVOS',
            value: `${products.length} catálogo`,
            color: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.15)',
            icon: <Package color="#f59e0b" size={22} />,
            badge: { 
                value: `${totalPieces.toLocaleString()} pzas`, 
                label: `Inv: ${formatCurrency(totalInvestment)}`, 
                neutral: true 
            },
        },
        {
            id: 'orders' as const,
            label: 'PEDIDOS HOY',
            value: `${todayOrders} órdenes`,
            color: '#8b5cf6',
            bg: 'rgba(139, 92, 246, 0.15)',
            icon: <ReceiptText color="#8b5cf6" size={22} />,
            badge: { 
                value: `${weeklyTotalOrders} esta sem`, 
                label: `Total: ${orders.length} pedidos`, 
                positive: true 
            },
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

                    {/* Descargar Instalador Windows */}
                    <motion.a
                        href="/programas/Bunkker_Setup.exe"
                        download="Bunkker_Setup.exe"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide border border-cyan-400/60 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_4px_18px_rgba(16,185,129,0.3)] flex items-center gap-1.5 hover:brightness-110 transition-all cursor-pointer"
                        title="Descargar instalador de Windows"
                    >
                        <Download size={16} />
                        <span>DESCARGAR .EXE</span>
                    </motion.a>

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

            {/* 🌐 Gemelo Digital 3D: FerreFlujo Logístico y Económico */}
            <div className="bunkker-translucent-card p-4 sm:p-5 mb-8 border border-cyan-500/30 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 shadow-lg shadow-cyan-500/20">
                            <Boxes size={24} className="text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                FerreFlujo 3D <span className="text-cyan-400 font-mono text-xs">GEMELO DIGITAL</span>
                            </h2>
                        </div>
                    </div>

                    <Link href="/dashboard/simulator" className="w-full sm:w-auto">
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black tracking-wider border border-cyan-400 bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_4px_20px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer uppercase"
                        >
                            <Boxes size={16} />
                            <span>Abrir Simulador 3D</span>
                        </motion.button>
                    </Link>
                </div>
            </div>



            {/* ── KPI Cards (Filtros Interactivos de Analítica BUNKKER) ─────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
                {kpis.map((kpi, i) => (
                    <KPICard
                        key={kpi.id}
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
                        isSelected={selectedKpi === kpi.id}
                        onClick={() => setSelectedKpi(kpi.id)}
                    />
                ))}
            </div>

            {/* ── Gráfica Dinámica Multimétrica (Filtro según KPI Seleccionado) ────────────────────────── */}
            <div className="relative overflow-hidden backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.55)] rounded-3xl p-5 sm:p-6" style={{ marginBottom: '2.5rem' }}>
                {/* Luces ambientales decorativas reactivas al KPI */}
                <div 
                    className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-[100px] pointer-events-none transition-all duration-700 opacity-40 mix-blend-screen"
                    style={{
                        backgroundColor: selectedKpi === 'sales' ? '#06b6d4' : selectedKpi === 'profit' ? '#10b981' : selectedKpi === 'inventory' ? '#f59e0b' : '#8b5cf6'
                    }}
                />
                <div 
                    className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-[100px] pointer-events-none transition-all duration-700 opacity-25 mix-blend-screen"
                    style={{
                        backgroundColor: selectedKpi === 'sales' ? '#3b82f6' : selectedKpi === 'profit' ? '#059669' : selectedKpi === 'inventory' ? '#d97706' : '#ec4899'
                    }}
                />

                <div className="relative z-10 flex justify-between items-center flex-wrap gap-4 mb-6">
                    <div className="flex items-center gap-3.5">
                        <div style={{
                            background: selectedKpi === 'sales' ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(59, 130, 246, 0.15))'
                                : selectedKpi === 'profit' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))'
                                : selectedKpi === 'inventory' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))'
                                : 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(236, 72, 153, 0.15))',
                            padding: '10px',
                            borderRadius: '14px',
                            border: `1px solid ${
                                selectedKpi === 'sales' ? 'rgba(6, 182, 212, 0.4)'
                                : selectedKpi === 'profit' ? 'rgba(16, 185, 129, 0.4)'
                                : selectedKpi === 'inventory' ? 'rgba(245, 158, 11, 0.4)'
                                : 'rgba(139, 92, 246, 0.4)'
                            }`,
                            boxShadow: `0 4px 15px ${
                                selectedKpi === 'sales' ? 'rgba(6, 182, 212, 0.25)'
                                : selectedKpi === 'profit' ? 'rgba(16, 185, 129, 0.25)'
                                : selectedKpi === 'inventory' ? 'rgba(245, 158, 11, 0.25)'
                                : 'rgba(139, 92, 246, 0.25)'
                            }`
                        }}>
                            {selectedKpi === 'sales' && <BarChart3 size={22} color="#22D3EE" />}
                            {selectedKpi === 'profit' && <ShieldCheck size={22} color="#34D399" />}
                            {selectedKpi === 'inventory' && <Package size={22} color="#FBBF24" />}
                            {selectedKpi === 'orders' && <ReceiptText size={22} color="#C084FC" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="m-0 text-base sm:text-lg font-black text-white tracking-tight">
                                    {selectedKpi === 'sales' && 'Ventas de los Últimos 7 Días'}
                                    {selectedKpi === 'profit' && 'Ganancias y Utilidad Operativa (7 Días)'}
                                    {selectedKpi === 'inventory' && 'Distribución de Stock por Categoría'}
                                    {selectedKpi === 'orders' && 'Volumen de Pedidos Diarios (7 Días)'}
                                </h3>
                                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-slate-300 border border-white/10">
                                    EN VIVO
                                </span>
                            </div>
                            <p className="m-0 text-xs text-slate-400 mt-0.5">
                                {selectedKpi === 'sales' && (
                                    <>Acumulado 7 días: <b className="text-cyan-400 font-bold">{formatCurrency(weeklyTotalSales)}</b> • <span className="text-slate-300 font-medium">{weeklyTotalOrders} órdenes</span></>
                                )}
                                {selectedKpi === 'profit' && (
                                    <>Utilidad 7 días: <b className="text-emerald-400 font-bold">{formatCurrency(weeklyTotalProfit)}</b> • Margen: <span className="text-emerald-300 font-medium">{estMargin}%</span></>
                                )}
                                {selectedKpi === 'inventory' && (
                                    <>Total inventario: <b className="text-amber-400 font-bold">{totalPieces.toLocaleString()} piezas</b> • Valor: <span className="text-amber-300 font-medium">{formatCurrency(totalInvestment)}</span></>
                                )}
                                {selectedKpi === 'orders' && (
                                    <>Total semana: <b className="text-purple-400 font-bold">{weeklyTotalOrders} órdenes</b> • Hoy: <span className="text-purple-300 font-medium">{todayOrders} pedidos</span></>
                                )}
                            </p>
                        </div>
                    </div>

                    {selectedKpi !== 'inventory' ? (
                        <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-white/10 shadow-inner">
                            <button
                                type="button"
                                onClick={() => setChartMode('bar')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 ${
                                    chartMode === 'bar'
                                        ? selectedKpi === 'profit'
                                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                                            : selectedKpi === 'orders'
                                                ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/25'
                                                : 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/25'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <BarChart3 size={14} /> BARRAS
                            </button>
                            <button
                                type="button"
                                onClick={() => setChartMode('area')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 ${
                                    chartMode === 'area'
                                        ? selectedKpi === 'profit'
                                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                                            : selectedKpi === 'orders'
                                                ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/25'
                                                : 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/25'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <TrendingUp size={14} /> CURVA TENDENCIA
                            </button>
                        </div>
                    ) : (
                        <div className="px-3.5 py-1.5 rounded-xl text-xs font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 shadow-sm flex items-center gap-1.5">
                            <Package size={14} /> TOP 7 CATEGORÍAS
                        </div>
                    )}
                </div>

                <div className="relative z-10 w-full h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        {/* 1. VENTAS */}
                        {selectedKpi === 'sales' && (
                            chartMode === 'bar' ? (
                                <BarChart data={chartSalesData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="barGradientSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#38BDF8" stopOpacity={1} />
                                            <stop offset="60%" stopColor="#0284C7" stopOpacity={0.85} />
                                            <stop offset="100%" stopColor="#0369A1" stopOpacity={0.45} />
                                        </linearGradient>
                                        <linearGradient id="barTodayGradientSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                                            <stop offset="60%" stopColor="#10B981" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#047857" stopOpacity={0.5} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(56, 189, 248, 0.08)' }}
                                        content={<CustomDashboardTooltip selectedKpi={selectedKpi} formatCurrency={formatCurrency} />}
                                    />
                                    <Bar dataKey="ventas" radius={[10, 10, 3, 3]} maxBarSize={56}>
                                        {chartSalesData.map((entry, index) => (
                                            <Cell
                                                key={`cell-sales-${index}`}
                                                fill={entry.isToday ? 'url(#barTodayGradientSales)' : 'url(#barGradientSales)'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            ) : (
                                <AreaChart data={chartSalesData} margin={{ top: 15, right: 25, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.55}/>
                                            <stop offset="50%" stopColor="#0284C7" stopOpacity={0.2}/>
                                            <stop offset="100%" stopColor="#0284C7" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                                    <Tooltip 
                                        content={<CustomDashboardTooltip selectedKpi={selectedKpi} formatCurrency={formatCurrency} />}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="ventas" 
                                        stroke="#38BDF8" 
                                        strokeWidth={3.5} 
                                        fillOpacity={1} 
                                        fill="url(#colorVentas)" 
                                        activeDot={{ r: 7, fill: '#0284C7', stroke: '#fff', strokeWidth: 2.5, style: { filter: 'drop-shadow(0px 0px 10px rgba(56,189,248,0.9))' } }} 
                                    />
                                </AreaChart>
                            )
                        )}

                        {/* 2. GANANCIAS */}
                        {selectedKpi === 'profit' && (
                            chartMode === 'bar' ? (
                                <BarChart data={chartProfitData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="barGradientProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                                            <stop offset="60%" stopColor="#10B981" stopOpacity={0.85} />
                                            <stop offset="100%" stopColor="#059669" stopOpacity={0.45} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(52, 211, 153, 0.08)' }}
                                        content={<CustomDashboardTooltip selectedKpi={selectedKpi} formatCurrency={formatCurrency} />}
                                    />
                                    <Bar dataKey="ganancia" radius={[10, 10, 3, 3]} maxBarSize={56} fill="url(#barGradientProfit)" />
                                </BarChart>
                            ) : (
                                <AreaChart data={chartProfitData} margin={{ top: 15, right: 25, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#34D399" stopOpacity={0.55}/>
                                            <stop offset="50%" stopColor="#059669" stopOpacity={0.2}/>
                                            <stop offset="100%" stopColor="#059669" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                                    <Tooltip 
                                        content={<CustomDashboardTooltip selectedKpi={selectedKpi} formatCurrency={formatCurrency} />}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="ganancia" 
                                        stroke="#34D399" 
                                        strokeWidth={3.5} 
                                        fillOpacity={1} 
                                        fill="url(#colorProfit)" 
                                        activeDot={{ r: 7, fill: '#059669', stroke: '#fff', strokeWidth: 2.5, style: { filter: 'drop-shadow(0px 0px 10px rgba(52,211,153,0.9))' } }} 
                                    />
                                </AreaChart>
                            )
                        )}

                        {/* 3. INVENTARIO */}
                        {selectedKpi === 'inventory' && (
                            <BarChart data={chartInventoryData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="barGradientInventory" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#FBBF24" stopOpacity={1} />
                                        <stop offset="60%" stopColor="#F59E0B" stopOpacity={0.85} />
                                        <stop offset="100%" stopColor="#D97706" stopOpacity={0.45} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val} pz`} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(251, 191, 36, 0.08)' }}
                                    content={<CustomDashboardTooltip selectedKpi={selectedKpi} formatCurrency={formatCurrency} />}
                                />
                                <Bar dataKey="piezas" radius={[10, 10, 3, 3]} maxBarSize={56} fill="url(#barGradientInventory)" />
                            </BarChart>
                        )}

                        {/* 4. PEDIDOS */}
                        {selectedKpi === 'orders' && (
                            chartMode === 'bar' ? (
                                <BarChart data={chartOrdersData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="barGradientOrders" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#C084FC" stopOpacity={1} />
                                            <stop offset="60%" stopColor="#A855F7" stopOpacity={0.85} />
                                            <stop offset="100%" stopColor="#7E22CE" stopOpacity={0.45} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(192, 132, 252, 0.08)' }}
                                        content={<CustomDashboardTooltip selectedKpi={selectedKpi} formatCurrency={formatCurrency} />}
                                    />
                                    <Bar dataKey="pedidos" radius={[10, 10, 3, 3]} maxBarSize={56} fill="url(#barGradientOrders)" />
                                </BarChart>
                            ) : (
                                <AreaChart data={chartOrdersData} margin={{ top: 15, right: 25, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#C084FC" stopOpacity={0.55}/>
                                            <stop offset="50%" stopColor="#7E22CE" stopOpacity={0.2}/>
                                            <stop offset="100%" stopColor="#7E22CE" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <Tooltip 
                                        content={<CustomDashboardTooltip selectedKpi={selectedKpi} formatCurrency={formatCurrency} />}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="pedidos" 
                                        stroke="#C084FC" 
                                        strokeWidth={3.5} 
                                        fillOpacity={1} 
                                        fill="url(#colorOrders)" 
                                        activeDot={{ r: 7, fill: '#7E22CE', stroke: '#fff', strokeWidth: 2.5, style: { filter: 'drop-shadow(0px 0px 10px rgba(192,132,252,0.9))' } }} 
                                    />
                                </AreaChart>
                            )
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Dashboard Widgets (Ranking & Restock) ──────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[8px] mb-6">
                <StaffRankingWidget tenantId={profile?.tenantId} />
                <RestockAlertWidget products={products} formatCurrency={formatCurrency} />
            </div>

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



