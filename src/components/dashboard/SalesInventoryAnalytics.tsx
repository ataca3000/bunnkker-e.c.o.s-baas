"use client";

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, 
    CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell 
} from 'recharts';
import { 
    TrendingUp, Package, Calendar, AlertTriangle, ArrowUpRight, 
    DollarSign, Activity, Layers, Filter, Zap, RefreshCw 
} from 'lucide-react';
import { useCart } from '@/context/CartContext';

interface SalesInventoryAnalyticsProps {
    compact?: boolean;
}

export function SalesInventoryAnalytics({ compact = false }: SalesInventoryAnalyticsProps) {
    const { orders = [], products = [], formatCurrency } = useCart();
    const [timeframe, setTimeframe] = useState<'7d' | '14d' | '30d'>('14d');
    const [demandGrowth, setDemandGrowth] = useState<number>(0); // % multiplier for projection simulation

    // 1. Process Daily Sales Data based on timeframe
    const dailySalesData = useMemo(() => {
        const daysCount = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30;
        const now = new Date();
        const daysMap: Record<string, { dateStr: string; label: string; total: number; count: number; cash: number; card: number; transfer: number }> = {};

        for (let i = daysCount - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
            daysMap[dateStr] = { dateStr, label, total: 0, count: 0, cash: 0, card: 0, transfer: 0 };
        }

        orders.forEach(order => {
            const orderDate = new Date(order.date || Date.now()).toISOString().split('T')[0];
            if (daysMap[orderDate] && (order.status === 'paid' || order.status === 'DELIVERED' || order.status === 'COMPLETED')) {
                const total = order.total || 0;
                daysMap[orderDate].total += total;
                daysMap[orderDate].count += 1;
                
                const pm = (order.paymentMethod || 'CASH').toUpperCase();
                if (pm.includes('CASH') || pm.includes('EFECTIVO')) {
                    daysMap[orderDate].cash += total;
                } else if (pm.includes('CARD') || pm.includes('TARJETA')) {
                    daysMap[orderDate].card += total;
                } else {
                    daysMap[orderDate].transfer += total;
                }
            }
        });

        return Object.values(daysMap);
    }, [orders, timeframe]);

    // Summary Metrics
    const periodSummary = useMemo(() => {
        const totalRevenue = dailySalesData.reduce((acc, curr) => acc + curr.total, 0);
        const totalOrders = dailySalesData.reduce((acc, curr) => acc + curr.count, 0);
        const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const avgDaily = dailySalesData.length > 0 ? totalRevenue / dailySalesData.length : 0;

        return {
            totalRevenue,
            totalOrders,
            avgTicket,
            avgDaily
        };
    }, [dailySalesData]);

    // 2. Compute Inventory Velocity & Projections
    const inventoryProjections = useMemo(() => {
        const daysCount = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30;
        const multiplier = 1 + demandGrowth / 100;

        // Calculate historic sales per product
        const salesByProduct: Record<string, number> = {};
        orders.forEach(o => {
            if (o.status === 'paid' || o.status === 'DELIVERED' || o.status === 'COMPLETED') {
                o.items?.forEach((item: any) => {
                    const pid = item.id || item.productId;
                    const qty = item.quantity || item.cantidad || 1;
                    salesByProduct[pid] = (salesByProduct[pid] || 0) + qty;
                });
            }
        });

        // Group by category and compute depletion days
        const categoryData: Record<string, { category: string; totalStock: number; dailyVelocity: number; daysRemaining: number }> = {};

        products.forEach(p => {
            const cat = p.category || 'General';
            if (!categoryData[cat]) {
                categoryData[cat] = { category: cat, totalStock: 0, dailyVelocity: 0, daysRemaining: 999 };
            }

            const soldQty = salesByProduct[p.id] || 0;
            // Estima velocidad diaria + simulador de demanda
            const dailyVel = (soldQty / Math.max(daysCount, 1)) * multiplier;

            categoryData[cat].totalStock += (p.stock || 0);
            categoryData[cat].dailyVelocity += dailyVel;
        });

        // Calculate days remaining per category
        return Object.values(categoryData).map(item => {
            const daysLeft = item.dailyVelocity > 0 
                ? Math.round(item.totalStock / item.dailyVelocity) 
                : (item.totalStock > 0 ? 90 : 0);
            return {
                ...item,
                daysRemaining: Math.min(daysLeft, 120), // Cap for display
                dailyVelocityFormatted: item.dailyVelocity.toFixed(1)
            };
        }).sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [products, orders, timeframe, demandGrowth]);

    // Top Critical Stock Items
    const criticalStockItems = useMemo(() => {
        const daysCount = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30;
        const multiplier = 1 + demandGrowth / 100;

        const salesByProduct: Record<string, number> = {};
        orders.forEach(o => {
            if (o.status === 'paid' || o.status === 'DELIVERED' || o.status === 'COMPLETED') {
                o.items?.forEach((item: any) => {
                    const pid = item.id || item.productId;
                    const qty = item.quantity || item.cantidad || 1;
                    salesByProduct[pid] = (salesByProduct[pid] || 0) + qty;
                });
            }
        });

        return products.map(p => {
            const sold = salesByProduct[p.id] || 0;
            const dailyVel = ((sold / Math.max(daysCount, 1)) || 0.2) * multiplier; // Fallback velocity
            const daysLeft = Math.round((p.stock || 0) / Math.max(dailyVel, 0.1));
            return {
                ...p,
                dailyVel: dailyVel.toFixed(1),
                daysLeft
            };
        })
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 6);
    }, [products, orders, timeframe, demandGrowth]);

    return (
        <div className="w-full space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl text-white">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Activity size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                            Analítica de Ventas y Proyección de Inventario
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                En Vivo P2P
                            </span>
                        </h2>
                        <p className="text-xs text-slate-400">
                            Comportamiento diario de ingresos y cálculo predictivo de stock antes del agotamiento.
                        </p>
                    </div>
                </div>

                {/* Timeframe Selector & Demand Simulator */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
                        {(['7d', '14d', '30d'] as const).map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                    timeframe === tf 
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25' 
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                            >
                                {tf === '7d' ? '7 Días' : tf === '14d' ? '14 Días' : '30 Días'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs text-slate-300">
                        <Zap size={14} className="text-amber-400" />
                        <span>Simular Demanda:</span>
                        <select 
                            value={demandGrowth}
                            onChange={(e) => setDemandGrowth(Number(e.target.value))}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-amber-300 focus:outline-none"
                        >
                            <option value={0}>Normal (0%)</option>
                            <option value={20}>+20% Alta Temp.</option>
                            <option value={50}>+50% Temporada</option>
                            <option value={-20}>-20% Baja Temp.</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Ingresos en el Periodo</span>
                        <DollarSign size={16} className="text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-white">{formatCurrency(periodSummary.totalRevenue)}</div>
                    <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                        <ArrowUpRight size={12} /> Promedio diario {formatCurrency(periodSummary.avgDaily)}
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Órdenes Procesadas</span>
                        <TrendingUp size={16} className="text-sky-400" />
                    </div>
                    <div className="text-2xl font-black text-white">{periodSummary.totalOrders} <span className="text-xs font-normal text-slate-400">pedidos</span></div>
                    <div className="text-[11px] text-sky-400 mt-1">Ticket Promedio: {formatCurrency(periodSummary.avgTicket)}</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Riesgo de Agotamiento</span>
                        <AlertTriangle size={16} className="text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-amber-400">
                        {criticalStockItems.filter(i => i.daysLeft <= 7).length} <span className="text-xs font-normal text-slate-400">productos</span>
                    </div>
                    <div className="text-[11px] text-amber-300/80 mt-1">Stock para menos de 7 días</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Total Catálogo Activo</span>
                        <Package size={16} className="text-purple-400" />
                    </div>
                    <div className="text-2xl font-black text-white">{products.length} <span className="text-xs font-normal text-slate-400">artículos</span></div>
                    <div className="text-[11px] text-purple-400 mt-1">
                        Stock acumulado: {products.reduce((acc, p) => acc + (p.stock || 0), 0)} u.
                    </div>
                </motion.div>
            </div>

            {/* Main Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Sales Chart (AreaChart) - Takes 2 cols */}
                <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <TrendingUp size={16} className="text-sky-400" />
                                Tendencia de Ventas Diarias
                            </h3>
                            <p className="text-xs text-slate-400">Evolución de ingresos y distribución de métodos de pago</p>
                        </div>
                    </div>

                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailySalesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                                    </linearGradient>
                                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                                    formatter={(value: any) => [formatCurrency(Number(value)), 'Venta']}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Area type="monotone" dataKey="total" name="Ventas Totales ($)" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                                <Area type="monotone" dataKey="cash" name="Efectivo ($)" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorCash)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Days of Stock Remaining by Category (BarChart) */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Layers size={16} className="text-amber-400" />
                                Días de Stock por Categoría
                            </h3>
                            <p className="text-xs text-slate-400">Estimación antes de desabasto</p>
                        </div>
                    </div>

                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={inventoryProjections} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}d`} />
                                <YAxis dataKey="category" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={80} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                                    formatter={(value: any) => [`${value} días aproximados`, 'Proyección Stock']}
                                />
                                <Bar dataKey="daysRemaining" name="Días Restantes" radius={[0, 6, 6, 0]}>
                                    {inventoryProjections.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.daysRemaining < 10 ? '#ef4444' : entry.daysRemaining < 25 ? '#f59e0b' : '#10b981'} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Critical Stock Items List */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <AlertTriangle size={16} className="text-rose-400" />
                        Alerta Preventiva de Reposición (Top Artículos en Riesgo)
                    </h3>
                    <span className="text-xs text-slate-400">Basado en velocidad de venta diaria</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {criticalStockItems.map(item => (
                        <div 
                            key={item.id} 
                            className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between gap-3"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-white truncate">{item.name}</div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                    <span>Stock: <strong className="text-slate-200">{item.stock} u.</strong></span>
                                    <span>•</span>
                                    <span>Consumo: <strong className="text-sky-400">{item.dailyVel} u./día</strong></span>
                                </div>
                            </div>
                            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold text-center min-w-[70px] ${
                                item.daysLeft <= 5 
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                    : item.daysLeft <= 15 
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}>
                                {item.daysLeft} días
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
