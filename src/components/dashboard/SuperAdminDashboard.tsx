"use client";

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useMemo, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldCheck, TrendingUp, Zap, Package, ReceiptText, BarChart3, Download } from 'lucide-react';
import KPICard from '@/components/admin/KPICard';
import { buildDashboardMetrics } from '@/lib/dashboardMetrics';

const BalanceEffectWidget = dynamic(
    () => import('@/components/BalanceEffectWidget').then((module) => module.BalanceEffectWidget),
    { ssr: false }
);
const StaffRankingWidget = dynamic(() => import('@/components/admin/StaffRankingWidget'), { ssr: false });
const RestockAlertWidget = dynamic(() => import('@/components/admin/RestockAlertWidget'), { ssr: false });

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
    formatCurrency
}: any) {
    const [rniUrl, setRniUrl] = useState<string | null>(null);
    const [selectedKpi, setSelectedKpi] = useState<'sales' | 'profit' | 'inventory' | 'orders'>('sales');
    const [chartMode, setChartMode] = useState<'bar' | 'area'>('area');
    const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);

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

    const metrics = useMemo(() => buildDashboardMetrics(orders, products), [orders, products]);
    const {
        todaySales,
        todayOrders,
        chartSalesData,
        chartProfitData,
        chartInventoryData,
        chartOrdersData,
        weeklyTotalSales,
        weeklyTotalProfit,
        weeklyTotalOrders,
        lowStockCount,
        totalPieces,
        totalInvestment,
    } = metrics;

    const avgTicket = todayOrders > 0 ? todaySales / todayOrders : (weeklyTotalOrders > 0 ? weeklyTotalSales / weeklyTotalOrders : 0);
    const estMargin = weeklyTotalSales > 0 ? ((weeklyTotalProfit / weeklyTotalSales) * 100).toFixed(1) : '28.0';

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
        <main className="bunkker-industrial relative z-10 mx-auto w-full max-w-[1600px]" style={{ padding: 'clamp(0.75rem, 1.6vw, 1.5rem)', boxSizing: 'border-box' }}>
            <header className="bunkker-translucent-card p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-cyan-500/20 rounded-2xl">
                <div className="min-w-0">
                    <p className="mb-1 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {siteConfig?.businessName || 'BUNKKER E.C.O.S.'}
                    </p>
                    <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white">Resumen ejecutivo</h1>
                    <p className="mt-1 text-xs text-slate-400">
                        {greeting ? `${greeting} · ${userName}` : `Bienvenido, ${userName}`}
                    </p>
                </div>

                <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
                    {rniUrl && (
                        <button
                            type="button"
                            className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-black/30 px-3 py-2 text-left hover:bg-cyan-500/10"
                            title="Imprimir QR de acceso RNI"
                            onClick={() => {
                                const html = `<html><head><title>Catálogo BUNKKER</title><style>body{font-family:sans-serif;text-align:center;padding:50px;}h1{color:#0ea5e9;font-size:3rem;}p{font-size:1.5rem;color:#64748b;}img{margin:40px 0;width:400px;height:400px;}</style></head><body><h1>Catálogo Móvil</h1><p>Escanea este código para acceder al catálogo local sin fila.</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(rniUrl)}" /><p><strong>${rniUrl}</strong></p><script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script></body></html>`;
                                const win = window.open('', '_blank');
                                if (win) {
                                    win.document.write(html);
                                    win.document.close();
                                }
                            }}
                        >
                            <QRCodeSVG value={rniUrl} size={32} aria-label="Código QR del catálogo móvil" />
                            <span className="text-xs font-medium text-cyan-200">QR local</span>
                        </button>
                    )}

                    <details className="relative">
                        <summary className="cursor-pointer list-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10">
                            Más herramientas
                        </summary>
                        <div className="absolute right-0 top-full z-30 mt-2 flex min-w-56 flex-col gap-2 rounded-xl border border-white/10 bg-slate-950 p-3 shadow-2xl">
                            <motion.label
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                            >
                                <ShieldCheck size={15} />
                                <span>Restaurar respaldo</span>
                                <input
                                    type="file"
                                    accept=".txt"
                                    className="sr-only"
                                    onChange={async (event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = async (loadEvent) => {
                                            const text = loadEvent.target?.result as string;
                                            if (typeof window !== 'undefined' && (window as any).electronAPI) {
                                                const result = await (window as any).electronAPI.restoreBackup(text);
                                                window.alert(result.success ? result.message : `Error: ${result.message}`);
                                            } else {
                                                window.alert('El respaldo físico está disponible en el cliente local.');
                                            }
                                            event.target.value = '';
                                        };
                                        reader.readAsText(file);
                                    }}
                                />
                            </motion.label>

                            <motion.a
                                href="/programas/Bunkker_Setup.exe"
                                download="Bunkker_Setup.exe"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                                title="Descargar instalador de Windows"
                            >
                                <Download size={15} />
                                <span>Descargar instalador</span>
                            </motion.a>
                        </div>
                    </details>

                    <div className="bunkker-translucent-card flex items-center gap-2 rounded-xl border border-cyan-500/30 px-3 py-2">
                        <Zap size={15} className="text-cyan-400" />
                        <div>
                            <span className="block text-[9px] font-medium uppercase tracking-wider text-slate-400">Saldo sistema</span>
                            <span className="font-mono text-sm font-semibold text-cyan-200">{formatCurrency(maintenanceBalance)}</span>
                        </div>
                    </div>
                </div>
            </header>



            {/* ── KPI Cards (Filtros Interactivos de Analítica BUNKKER) ─────────────────────────────────────── */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 p-4 shadow-xl backdrop-blur-2xl sm:p-5">
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

                <div className="relative z-10 h-[240px] w-full sm:h-[260px]">
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

            <details
                className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50"
                onToggle={(event) => setShowAdvancedAnalytics(event.currentTarget.open)}
            >
                <summary className="flex cursor-pointer list-none flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-semibold text-slate-100">Análisis avanzado</span>
                    <span className="text-xs text-slate-400">
                        {lowStockCount} productos con stock bajo · ranking y balance
                    </span>
                </summary>
                {showAdvancedAnalytics && (
                    <div className="grid grid-cols-1 gap-3 border-t border-white/10 p-4 xl:grid-cols-2">
                        <BalanceEffectWidget />
                        <StaffRankingWidget tenantId={profile?.tenantId} />
                        <RestockAlertWidget products={products} formatCurrency={formatCurrency} />
                    </div>
                )}
            </details>
        </main>
    );
};



