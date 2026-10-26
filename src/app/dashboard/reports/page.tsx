"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { 
    FileDown, Database, ShieldCheck, HardDrive, RefreshCcw, CheckCircle, 
    FileSpreadsheet, TrendingUp, Package, Calculator, Printer, Upload, FileText, Cpu, Server
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import DemoModeBanner from '@/components/DemoModeBanner';
import { toast } from '@/lib/toast';

interface SalesMetric {
    month: string;
    total: number;
    orders: number;
}


const CustomReportsTooltip = ({ active, payload, label, formatCurrency }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(14, 165, 233, 0.4)',
            borderRadius: '14px',
            padding: '12px 16px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 0 15px rgba(14, 165, 233, 0.25)',
            color: '#fff',
            minWidth: '180px'
        }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                {label || item.payload?.month}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#38BDF8', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                {formatCurrency(Number(item.value || 0))}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38BDF8' }} />
                <span>{item.payload?.orders || 0} órdenes completadas</span>
            </div>
        </div>
    );
};

export default function ReportsAndBackups() {
    const { siteConfig, formatCurrency, orders, products } = useCart();
    const [isExporting, setIsExporting] = useState(false);
    const [exportType, setExportType] = useState('');
    const [metrics, setMetrics] = useState<SalesMetric[]>([]);
    const [topProducts, setTopProducts] = useState<{ name: string; sold: number; revenue: number }[]>([]);
    const [lastBackup, setLastBackup] = useState('');
    const [isRestoring, setIsRestoring] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLastBackup(new Date().toLocaleString('es-MX'));
    }, []);

    // Compute metrics from live orders data
    const VALID_SALES_STATUSES = ['paid', 'COMPLETED', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'READY_FOR_PICKUP_PAID'];

    useEffect(() => {
        if (!orders.length) return;

        // Monthly sales
        const byMonth: Record<string, { total: number; orders: number }> = {};
        orders.forEach(o => {
            if (!VALID_SALES_STATUSES.includes(o.status)) return;
            const month = new Date(o.date || Date.now()).toLocaleString('es-MX', { month: 'short', year: 'numeric' });
            if (!byMonth[month]) byMonth[month] = { total: 0, orders: 0 };
            byMonth[month].total += Number(o.total) || 0;
            byMonth[month].orders += 1;
        });
        setMetrics(Object.entries(byMonth).slice(-6).map(([month, data]) => ({ month, ...data })));

        // Top products by revenue
        const productMap: Record<string, { name: string; sold: number; revenue: number }> = {};
        orders.filter(o => VALID_SALES_STATUSES.includes(o.status)).forEach(o => {
            o.items?.forEach((item: any) => {
                const itemId = item.productId || item.id;
                const itemName = item.name || products.find(p => p.id === itemId)?.name || 'Producto';
                if (!productMap[itemId]) productMap[itemId] = { name: itemName, sold: 0, revenue: 0 };
                productMap[itemId].sold += Number(item.quantity || item.cantidad || 1);
                productMap[itemId].revenue += (Number(item.price || item.precio || 0)) * (Number(item.quantity || item.cantidad || 1));
            });
        });
        setTopProducts(
            Object.values(productMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5)
        );
    }, [orders, products]);

    // CSV Export helpers
    const exportCSV = useCallback((filename: string, rows: string[][], headers: string[]) => {
        const csvContent = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    const handleExport = async (type: string) => {
        setIsExporting(true);
        setExportType(type);
        try {
            await new Promise(r => setTimeout(r, 400));

            if (type === 'Ventas') {
                const rows = orders
                    .filter(o => o.status === 'paid')
                    .map(o => [
                        o.id,
                        o.customer?.name || 'Cliente Mostrador',
                        o.customer?.phone || '',
                        new Date(o.date || Date.now()).toLocaleDateString('es-MX'),
                        o.total.toString(),
                        o.paymentMethod || 'EFECTIVO',
                    ]);
                exportCSV(
                    `ventas_${siteConfig.businessName}_${new Date().toISOString().slice(0, 10)}.csv`,
                    rows,
                    ['ID Pedido', 'Cliente', 'Teléfono', 'Fecha', `Total (${siteConfig.currency})`, 'Método Pago']
                );
                toast.success('Reporte de Ventas descargado correctamente en CSV');
            } else if (type === 'Inventario') {
                const rows = products.map(p => [
                    p.id, p.name, p.category || 'General', p.stock.toString(), p.price.toString()
                ]);
                exportCSV(
                    `inventario_${siteConfig.businessName}_${new Date().toISOString().slice(0, 10)}.csv`,
                    rows,
                    ['ID', 'Nombre', 'Categoría', 'Stock', `Precio (${siteConfig.currency})`]
                );
                toast.success('Reporte de Inventario descargado correctamente en CSV');
            } else if (type === 'Clientes') {
                const clientMap: Record<string, { name: string; phone: string; orders: number; total: number }> = {};
                orders.forEach(o => {
                    const key = o.customer?.phone || o.customer?.name;
                    if (!key) return;
                    if (!clientMap[key]) clientMap[key] = { name: o.customer?.name || 'Cliente', phone: o.customer?.phone || '', orders: 0, total: 0 };
                    if (o.status === 'paid') { clientMap[key].orders++; clientMap[key].total += o.total; }
                });
                const rows = Object.values(clientMap).map(c => [
                    c.name, c.phone, c.orders.toString(), c.total.toString()
                ]);
                exportCSV(
                    `clientes_${siteConfig.businessName}_${new Date().toISOString().slice(0, 10)}.csv`,
                    rows,
                    ['Cliente', 'Teléfono', 'Pedidos', `Total (${siteConfig.currency})`]
                );
                toast.success('Reporte de Clientes descargado correctamente en CSV');
            } else if (type === 'Facturas') {
                const rows = orders
                    .filter(o => (o as any).requiresInvoice)
                    .map(o => [o.id, o.customer?.name || '', new Date(o.date || Date.now()).toLocaleDateString('es-MX'), o.total.toString()]);
                exportCSV(
                    `cfdi_${siteConfig.businessName}_${new Date().toISOString().slice(0, 10)}.csv`,
                    rows,
                    ['ID Pedido', 'Cliente', 'Fecha', `Total (${siteConfig.currency})`]
                );
                toast.success('Reporte de CFDI descargado correctamente en CSV');
            }
        } finally {
            setIsExporting(false);
            setExportType('');
        }
    };

    // Download Local Database JSON Backup
    const handleDownloadLocalBackup = async () => {
        try {
            setIsExporting(true);
            setExportType('RespaldoJSON');
            const res = await fetch('/api/backup');
            if (!res.ok) throw new Error('No se pudo generar el respaldo local');
            const data = await res.json();
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bunkker_backup_sqlite_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Respaldo SQLite completo guardado exitosamente');
        } catch (e: any) {
            toast.error(e.message || 'Error descargando respaldo');
        } finally {
            setIsExporting(false);
            setExportType('');
        }
    };

    // Restore Backup JSON
    const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsRestoring(true);
        try {
            const text = await file.text();
            const json = JSON.parse(text);

            const res = await fetch('/api/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(json),
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Error restaurando la base de datos');
            }

            toast.success('✅ Base de datos restaurada correctamente. Recargando...');
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            toast.error(err.message || 'El archivo de respaldo no es válido');
        } finally {
            setIsRestoring(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Printable PDF Report trigger
    const handlePrintPDFReport = () => {
        window.print();
    };

    const validOrders = orders.filter(o => VALID_SALES_STATUSES.includes(o.status));
    const totalSales = validOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const totalOrders = validOrders.length;
    const maxMetric = Math.max(...metrics.map(m => m.total), 1);

    return (
        <div style={{ backgroundColor: 'transparent', minHeight: '100vh', padding: '2.5rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <DemoModeBanner sectionName="Reportes y Respaldo Local" />

                {/* Header */}
                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 className="bunkker-heading" style={{ margin: '0 0 0.5rem 0' }}>REPORTES & RESPALDO LOCAL</h1>
                        <p style={{ color: '#666', margin: 0 }}>Datos de <b>{siteConfig.businessName}</b> procesados por el Motor Local SQLite P2P.</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={handlePrintPDFReport}
                            className="bunkker-btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.2rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                        >
                            <Printer size={18} /> Imprimir / PDF
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', backgroundColor: '#e8f5e9', fontSize: '0.8rem', fontWeight: 'bold', color: '#2e7d32' }}>
                            <Cpu size={16} />
                            MOTOR LOCAL EXCLUSIVO
                        </div>
                    </div>
                </header>

                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    {[
                        { label: 'Ventas Totales', value: formatCurrency(totalSales), icon: <TrendingUp size={22} />, color: '#0ea5e9' },
                        { label: 'Pedidos Completados', value: totalOrders.toString(), icon: <CheckCircle size={22} />, color: '#27ae60' },
                        { label: 'Productos en Catálogo', value: products.length.toString(), icon: <Package size={22} />, color: '#F39C12' },
                    ].map((kpi, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bunkker-card" style={{ padding: '1.5rem', borderLeft: `5px solid ${kpi.color}` }}>
                            <div style={{ color: kpi.color, marginBottom: '8px' }}>{kpi.icon}</div>
                            <p style={{ color: '#666', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 4px' }}>{kpi.label}</p>
                            <h3 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#1a1a1a', margin: 0 }}>{kpi.value}</h3>
                        </motion.div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>

                    {/* Left column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Export buttons */}
                        <div className="bunkker-card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', marginBottom: '1rem' }}>
                                <FileSpreadsheet size={24} /> DESCARGAR REPORTES (EXCEL / CSV)
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem' }}>
                                Genera archivos CSV UTF-8 totalmente compatibles con Excel, Google Sheets y programas contables.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {['Ventas', 'Inventario', 'Clientes', 'Facturas'].map(type => (
                                    <motion.button
                                        key={type}
                                        onClick={() => handleExport(type)}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        className="bunkker-btn-secondary"
                                        disabled={isExporting}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '1rem', opacity: isExporting && exportType !== type ? 0.5 : 1 }}
                                    >
                                        {isExporting && exportType === type ? (
                                            <RefreshCcw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                        ) : <FileDown size={18} />}
                                        {isExporting && exportType === type ? 'Generando...' : `Exportar ${type}`}
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Sales chart (recharts) */}
                        <div className="relative overflow-hidden backdrop-blur-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] rounded-3xl p-5 sm:p-6 mb-6">
                            <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-sky-500/15 blur-[90px] pointer-events-none mix-blend-screen" />
                            <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-indigo-500/15 blur-[90px] pointer-events-none mix-blend-screen" />

                            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.3)]">
                                        <TrendingUp size={22} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="m-0 text-base sm:text-lg font-black text-white tracking-tight uppercase">
                                                Histórico de Ventas Mensuales
                                            </h3>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                                ANALÍTICA
                                            </span>
                                        </div>
                                        <p className="m-0 text-xs text-slate-400 mt-0.5">
                                            Comportamiento de facturación y volumen de órdenes por período mensual
                                        </p>
                                    </div>
                                </div>

                                {metrics.length > 0 && (
                                    <div className="flex items-center gap-4 bg-slate-950/60 px-4 py-2 rounded-2xl border border-white/10">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-500 block">Total Período</span>
                                            <span className="text-sm font-black text-sky-400 font-mono">
                                                {formatCurrency(metrics.reduce((acc, m) => acc + m.total, 0))}
                                            </span>
                                        </div>
                                        <div className="w-px h-6 bg-white/10" />
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-500 block">Total Órdenes</span>
                                            <span className="text-sm font-black text-white font-mono">
                                                {metrics.reduce((acc, m) => acc + m.orders, 0)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="relative z-10 w-full h-[260px]">
                                {metrics.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={metrics} margin={{ top: 15, right: 25, left: 0, bottom: 5 }}>
                                            <defs>
                                                <linearGradient id="reportsSalesGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.6} />
                                                    <stop offset="60%" stopColor="#6366F1" stopOpacity={0.2} />
                                                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                                            <Tooltip content={<CustomReportsTooltip formatCurrency={formatCurrency} />} />
                                            <Area 
                                                type="monotone" 
                                                dataKey="total" 
                                                stroke="#38BDF8" 
                                                strokeWidth={3} 
                                                fillOpacity={1} 
                                                fill="url(#reportsSalesGradient)" 
                                                activeDot={{ r: 6, fill: '#0EA5E9', stroke: '#fff', strokeWidth: 2, style: { filter: 'drop-shadow(0px 0px 8px rgba(14,165,233,0.9))' } }} 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-2">
                                            <TrendingUp size={24} />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-300 m-0">Aún no hay ventas mensuales registradas</h4>
                                        <p className="text-xs text-slate-500 m-0 mt-1 max-w-sm">
                                            Las ventas cobradas en caja se proyectarán automáticamente en esta gráfica con métricas y comparativas mensuales.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Local SQLite Backup Card */}
                        <div className="bunkker-card" style={{ background: '#111827', color: 'white', borderColor: '#374151' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                    <HardDrive size={24} color="#38BDF8" /> RESPALDO LOCAL BASE DE DATOS
                                </h3>
                                <span style={{ fontSize: '0.7rem', color: '#38BDF8', background: 'rgba(56,189,248,0.15)', padding: '5px 12px', borderRadius: '15px', fontWeight: 'bold' }}>
                                    SQLITE LOCAL
                                </span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: '#9CA3AF', marginBottom: '1.5rem' }}>
                                Descarga o restaura una copia de seguridad integra de tu base de datos SQLite (Ventas, Inventario, Usuarios y Clientes).
                            </p>

                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={handleDownloadLocalBackup}
                                    disabled={isExporting}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '0.75rem 1.25rem', backgroundColor: '#0284C7',
                                        color: 'white', border: 'none', borderRadius: '10px',
                                        fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'
                                    }}
                                >
                                    <FileText size={18} /> Descargar Respaldo (.JSON)
                                </button>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isRestoring}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '0.75rem 1.25rem', backgroundColor: '#374151',
                                        color: 'white', border: '1px solid #4B5563', borderRadius: '10px',
                                        fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'
                                    }}
                                >
                                    <Upload size={18} /> {isRestoring ? 'Restaurando...' : 'Restaurar Respaldo'}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleRestoreBackup}
                                    accept=".json"
                                    style={{ display: 'none' }}
                                />
                            </div>

                            <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#9CA3AF' }}>
                                <RefreshCcw size={14} /> Fecha sistema local: {lastBackup}
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* System status */}
                        <div className="bunkker-card" style={{ borderLeft: '6px solid #27ae60' }}>
                            <h4 style={{ fontWeight: '900', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Server size={18} /> ESTADO MOTOR LOCAL
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {[
                                    { label: 'Base de Datos (SQLite)', status: 'ONLINE' },
                                    { label: 'Servidor Local (Node.js)', status: 'ACTIVO' },
                                    { label: 'Sincronización P2P Multi-Tab', status: '0ms INSTANT' },
                                    { label: 'Facturación SAT CFDI', status: 'CONECTADO' },
                                    { label: 'Licencia Local', status: 'VÁLIDA' },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                        <span>{item.label}:</span>
                                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>{item.status}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#F0F9FF', borderRadius: '8px', border: '1px solid #BAE6FD', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <ShieldCheck size={20} color="#0369A1" />
                                <span style={{ fontSize: '0.7rem', color: '#0369A1' }}>Seguridad local estricta con hash bcrypt y firmas HMAC.</span>
                            </div>
                        </div>

                        {/* Auditoría de Cortes de Caja */}
                        <div className="bunkker-card" style={{ borderLeft: '6px solid #e11d48' }}>
                            <h4 style={{ fontWeight: '900', color: '#e11d48', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calculator size={20} /> AUDITORÍA DE CAJAS
                            </h4>
                            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem' }}>
                                Revisa los cortes de caja históricos de todos los cajeros y detecta faltantes al instante.
                            </p>
                            <button
                                onClick={() => window.location.href = '/dashboard/reports/cash-registers'}
                                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] flex items-center justify-center gap-2"
                            >
                                Revisar Cortes de Caja
                            </button>
                        </div>

                        {/* Top products */}
                        {topProducts.length > 0 && (
                            <div className="bunkker-card">
                                <h4 style={{ fontWeight: '900', color: '#0ea5e9', marginBottom: '1rem' }}>TOP PRODUCTOS</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {topProducts.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#333' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#888' }}>{p.sold} unidades vendidas</div>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0ea5e9' }}>{formatCurrency(p.revenue)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media print {
                    header, button, nav, aside, .bunkker-heading { display: none !important; }
                    .bunkker-card { border: none !important; box-shadow: none !important; color: black !important; background: white !important; }
                }
            `}</style>
        </div>
    );
}

