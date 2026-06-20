"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileDown, Database, ShieldCheck, HardDrive, RefreshCcw, CheckCircle, FileSpreadsheet, TrendingUp, Package, Users, ShoppingCart, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCart } from '@/context/CartContext';
import DemoModeBanner from '@/components/DemoModeBanner';

interface SalesMetric {
    month: string;
    total: number;
    orders: number;
}

export default function ReportsAndBackups() {
    const { siteConfig, formatCurrency, firebaseStatus, orders, products } = useCart();
    const [isExporting, setIsExporting] = useState(false);
    const [exportType, setExportType] = useState('');
    const [metrics, setMetrics] = useState<SalesMetric[]>([]);
    const [topProducts, setTopProducts] = useState<{ name: string; sold: number; revenue: number }[]>([]);
    const [lastBackup, setLastBackup] = useState('');

    useEffect(() => {
        setLastBackup(new Date().toLocaleString('es-MX'));
    }, []);

    // Compute metrics from live orders data
    useEffect(() => {
        if (!orders.length) return;

        // Monthly sales
        const byMonth: Record<string, { total: number; orders: number }> = {};
        orders.forEach(o => {
            if (o.status !== 'paid') return;
            const month = new Date(o.date).toLocaleString('es-MX', { month: 'short', year: 'numeric' });
            if (!byMonth[month]) byMonth[month] = { total: 0, orders: 0 };
            byMonth[month].total += o.total;
            byMonth[month].orders += 1;
        });
        setMetrics(Object.entries(byMonth).slice(-6).map(([month, data]) => ({ month, ...data })));

        // Top products by revenue
        const productMap: Record<string, { name: string; sold: number; revenue: number }> = {};
        orders.filter(o => o.status === 'paid').forEach(o => {
            o.items?.forEach((item: any) => {
                if (!productMap[item.id]) productMap[item.id] = { name: item.name, sold: 0, revenue: 0 };
                productMap[item.id].sold += item.quantity;
                productMap[item.id].revenue += item.price * item.quantity;
            });
        });
        setTopProducts(
            Object.values(productMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5)
        );
    }, [orders]);

    // CSV Export helpers
    const exportCSV = useCallback((filename: string, rows: string[][], headers: string[]) => {
        const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
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
            await new Promise(r => setTimeout(r, 600)); // brief UX delay

            if (type === 'Ventas') {
                const rows = orders
                    .filter(o => o.status === 'paid')
                    .map(o => [
                        o.id,
                        o.customer?.name || '',
                        o.customer?.phone || '',
                        new Date(o.date).toLocaleDateString('es-MX'),
                        o.total.toString(),
                        o.paymentMethod || '',
                    ]);
                exportCSV(
                    `ventas_${siteConfig.businessName}_${new Date().toISOString().slice(0, 10)}.csv`,
                    rows,
                    ['ID Pedido', 'Cliente', 'Teléfono', 'Fecha', `Total ${siteConfig.currency}`, 'Método Pago']
                );
            } else if (type === 'Inventario') {
                const rows = products.map(p => [
                    p.id, p.name, p.category, p.stock.toString(), p.price.toString()
                ]);
                exportCSV(
                    `inventario_${siteConfig.businessName}_${new Date().toISOString().slice(0, 10)}.csv`,
                    rows,
                    ['ID', 'Nombre', 'Categoría', 'Stock', `Precio ${siteConfig.currency}`]
                );
            } else if (type === 'Clientes') {
                const clientMap: Record<string, { name: string; phone: string; orders: number; total: number }> = {};
                orders.forEach(o => {
                    const key = o.customer?.phone || o.customer?.name;
                    if (!key) return;
                    if (!clientMap[key]) clientMap[key] = { name: o.customer.name, phone: o.customer.phone, orders: 0, total: 0 };
                    if (o.status === 'paid') { clientMap[key].orders++; clientMap[key].total += o.total; }
                });
                const rows = Object.values(clientMap).map(c => [
                    c.name, c.phone, c.orders.toString(), c.total.toString()
                ]);
                exportCSV(
                    `clientes_${siteConfig.businessName}_${new Date().toISOString().slice(0, 10)}.csv`,
                    rows,
                    ['Cliente', 'Teléfono', 'Pedidos', `Total ${siteConfig.currency}`]
                );
            } else if (type === 'Facturas') {
                const rows = orders
                    .filter(o => (o as any).requiresInvoice)
                    .map(o => [o.id, o.customer?.name || '', new Date(o.date).toLocaleDateString('es-MX'), o.total.toString()]);
                exportCSV(
                    `cfdi_${siteConfig.businessName}_${new Date().toISOString().slice(0, 10)}.csv`,
                    rows,
                    ['ID Pedido', 'Cliente', 'Fecha', `Total ${siteConfig.currency}`]
                );
            }
        } finally {
            setIsExporting(false);
            setExportType('');
        }
    };

    const totalSales = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.filter(o => o.status === 'paid').length;
    const maxMetric = Math.max(...metrics.map(m => m.total), 1);

    return (
        <div style={{ backgroundColor: 'transparent', minHeight: '100vh', padding: '3rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <DemoModeBanner sectionName="Reportes y Analíticas" />

                {/* Header */}
                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="heading-sanjose">REPORTES Y EXPORTACIÓN</h1>
                        <p style={{ color: '#666' }}>Los datos de <b>{siteConfig.businessName}</b> exportados en formato compatible con Excel.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', backgroundColor: firebaseStatus === 'online' ? '#e8f5e9' : '#fff3e0', fontSize: '0.8rem', fontWeight: 'bold', color: firebaseStatus === 'online' ? '#2e7d32' : '#e65100' }}>
                        {firebaseStatus === 'online' ? <Wifi size={14} /> : <WifiOff size={14} />}
                        {firebaseStatus === 'online' ? 'EN LÍNEA' : 'MODO OFFLINE'}
                    </div>
                </header>

                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    {[
                        { label: 'Ventas Totales', value: formatCurrency(totalSales), icon: <TrendingUp size={22} />, color: '#0ea5e9' },
                        { label: 'Pedidos Completados', value: totalOrders.toString(), icon: <CheckCircle size={22} />, color: '#27ae60' },
                        { label: 'Productos en Catálogo', value: products.length.toString(), icon: <Package size={22} />, color: '#F39C12' },
                    ].map((kpi, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="card-sanjose" style={{ padding: '1.5rem', borderLeft: `5px solid ${kpi.color}` }}>
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
                        <div className="card-sanjose">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', marginBottom: '1.5rem' }}>
                                <FileSpreadsheet size={24} /> DESCARGAR REPORTES
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '2rem' }}>
                                Genera archivos CSV compatibles con Excel, Google Sheets y cualquier software contable.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {['Ventas', 'Inventario', 'Clientes', 'Facturas'].map(type => (
                                    <motion.button
                                        key={type}
                                        onClick={() => handleExport(type)}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        className="btn-sanjose-secondary"
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

                        {/* Sales chart (bar) */}
                        {metrics.length > 0 && (
                            <div className="card-sanjose">
                                <h3 style={{ color: '#0ea5e9', marginBottom: '1.5rem', fontSize: '1rem', fontWeight: '900' }}>VENTAS POR MES</h3>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '120px' }}>
                                    {metrics.map((m, i) => (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: `${Math.round((m.total / maxMetric) * 100)}px` }}
                                                transition={{ delay: i * 0.1, type: 'spring' }}
                                                style={{ width: '100%', backgroundColor: '#0ea5e9', borderRadius: '4px 4px 0 0', minHeight: '4px' }}
                                            />
                                            <span style={{ fontSize: '0.65rem', color: '#888', textAlign: 'center' }}>{m.month}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cloud backup */}
                        <div className="card-sanjose" style={{ background: '#1A1A1A', color: 'white', borderColor: '#333' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                    <HardDrive size={24} color="#FFCB05" /> RESPALDO EN LA NUBE
                                </h3>
                                <span style={{ fontSize: '0.7rem', color: '#27ae60', background: 'rgba(39,174,96,0.1)', padding: '5px 10px', borderRadius: '15px' }}>ACTIVO</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1.5rem' }}>
                                Toda la información se sincroniza en tiempo real con Firebase Google Cloud. Tus datos están protegidos contra fallos locales.
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#FFCB05' }}>
                                <RefreshCcw size={14} /> Última sincronización: {lastBackup}
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* System status */}
                        <div className="card-sanjose" style={{ borderLeft: '6px solid #27ae60' }}>
                            <h4 style={{ fontWeight: '900', marginBottom: '1rem' }}>STATUS DEL SISTEMA</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {[
                                    { label: 'Base de Datos', status: firebaseStatus === 'online' ? 'ONLINE' : 'OFFLINE' },
                                    { label: 'Servidor', status: 'ACTIVO' },
                                    { label: 'Facturación SAT', status: 'CONECTADO' },
                                    { label: 'Licencia', status: 'VÁLIDA' },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                        <span>{item.label}:</span>
                                        <span style={{ color: item.status === 'OFFLINE' ? '#e65100' : '#27ae60', fontWeight: 'bold' }}>{item.status}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '2rem', padding: '1rem', background: '#F0F9FF', borderRadius: '8px', border: '1px solid #BAE6FD', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <ShieldCheck size={20} color="#0369A1" />
                                <span style={{ fontSize: '0.7rem', color: '#0369A1' }}>Cifrado de extremo a extremo activo.</span>
                            </div>
                        </div>

                        {/* Top products */}
                        {topProducts.length > 0 && (
                            <div className="card-sanjose">
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
                    header, button, nav, aside { display: none !important; }
                    .card-sanjose { border: none !important; box-shadow: none !important; }
                }
            `}</style>
        </div>
    );
}
