"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShoppingCart,
    PlusCircle,
    CreditCard,
    Clock,
    CheckCircle,
    Truck,
    X,
    Save,
    RefreshCw,
    Users,
    CalendarDays,
    AlertCircle,
    ChevronDown,
    Package,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import DemoModeBanner from '@/components/DemoModeBanner';

// ─── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = 'Pendiente' | 'En Tránsito' | 'Recibido';

interface PurchaseOrder {
    id: string;
    supplier: string;
    concept: string;
    amount: number;
    status: OrderStatus;
    date: string; // ISO string
    createdAt?: unknown;
}

// ─── Demo fallback data ─────────────────────────────────────────────────────────

const DEMO_ORDERS: PurchaseOrder[] = [
    {
        id: 'OC-DEMO-001',
        supplier: 'Distribuidora Global S.A.',
        concept: 'Reposición de materiales de oficina',
        amount: 12500,
        status: 'Pendiente',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'OC-DEMO-002',
        supplier: 'Suministros Industriales del Centro',
        concept: 'Equipos de protección y seguridad',
        amount: 45800,
        status: 'En Tránsito',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'OC-DEMO-003',
        supplier: 'Logística Premium Corp.',
        concept: 'Insumos para producción mensual',
        amount: 89000,
        status: 'Recibido',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
];

// ─── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
    OrderStatus,
    { bg: string; color: string; icon: React.ReactNode; next: OrderStatus | null; nextLabel: string | null }
> = {
    Pendiente: {
        bg: '#FFF8E1',
        color: '#F57F17',
        icon: <Clock size={13} />,
        next: 'En Tránsito',
        nextLabel: 'Marcar En Tránsito',
    },
    'En Tránsito': {
        bg: '#E3F2FD',
        color: '#1565C0',
        icon: <Truck size={13} />,
        next: 'Recibido',
        nextLabel: 'Marcar como Recibido',
    },
    Recibido: {
        bg: '#E8F5E9',
        color: '#2E7D32',
        icon: <CheckCircle size={13} />,
        next: null,
        nextLabel: null,
    },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
}

function generateOrderId(): string {
    return `OC-${Date.now().toString().slice(-6)}`;
}

function getMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function PurchasesDashboard() {
    const { formatCurrency, siteConfig } = useCart();

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [statusDropdown, setStatusDropdown] = useState<string | null>(null);

    // Form state
    const [formSupplier, setFormSupplier] = useState('');
    const [formConcept, setFormConcept] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formError, setFormError] = useState('');

    // ─── Load orders ──────────────────────────────────────────────────────────

    const loadOrders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/purchases');
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            if (data.success) {
                setOrders(data.data.map((p: any) => ({
                    ...p,
                    date: p.createdAt,
                })));
                setIsOffline(false);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            console.warn('[Purchases] Using demo fallback', err);
            setIsOffline(true);
            setOrders(DEMO_ORDERS);
        } finally {
            setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    useEffect(() => {
        if (isOffline) return;
        const handleSync = (event: any) => {
            if (event.action?.includes('PURCHASE')) loadOrders();
        };

        if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
            (window as any).__inventorySocket.on('sync_db_event', handleSync);
            return () => {
                (window as any).__inventorySocket.off('sync_db_event', handleSync);
            };
        }
    }, [isOffline, loadOrders]);

    // ─── Stats ────────────────────────────────────────────────────────────────

    const cuentasPorPagar = orders
        .filter(o => o.status === 'Pendiente' || o.status === 'En Tránsito')
        .reduce((sum, o) => sum + o.amount, 0);

    const monthStart = getMonthStart();
    const ordenesMes = orders.filter(o => new Date(o.date) >= monthStart).length;

    const proveedoresActivos = new Set(
        orders.filter(o => o.status !== 'Recibido').map(o => o.supplier)
    ).size;

    // ─── Create order ─────────────────────────────────────────────────────────

    const handleSaveOrder = async () => {
        setFormError('');
        if (!formSupplier.trim()) { setFormError('El nombre del proveedor es requerido.'); return; }
        if (!formConcept.trim()) { setFormError('El concepto es requerido.'); return; }
        const amountNum = parseFloat(formAmount);
        if (!formAmount || isNaN(amountNum) || amountNum <= 0) { setFormError('Ingresa un monto válido mayor a 0.'); return; }

        setSaving(true);
        const newOrder: Omit<PurchaseOrder, 'id'> = {
            supplier: formSupplier.trim(),
            concept: formConcept.trim(),
            amount: amountNum,
            status: 'Pendiente',
            date: new Date().toISOString(),
        };

        if (isOffline) {
            // Offline mode — add locally only
            const localOrder: PurchaseOrder = { id: generateOrderId(), ...newOrder };
            setOrders(prev => [localOrder, ...prev]);
            resetForm();
            setSaving(false);
            return;
        }

        try {
            const res = await fetch('/api/purchases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplier: newOrder.supplier,
                    concept: newOrder.concept,
                    amount: newOrder.amount,
                    status: newOrder.status
                })
            });
            const data = await res.json();
            if (data.success) {
                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                    (window as any).__inventorySocket.emit('sync_db_event', { action: 'PURCHASE_ADDED' });
                }
                const saved: PurchaseOrder = { id: data.data.id, ...newOrder, date: data.data.createdAt };
                setOrders(prev => [saved, ...prev]);
                resetForm();
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            console.error('[Purchases] Error saving order:', err);
            setFormError('Error al guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setFormSupplier('');
        setFormConcept('');
        setFormAmount('');
        setFormError('');
        setShowForm(false);
    };

    // ─── Update status ────────────────────────────────────────────────────────

    const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
        setStatusDropdown(null);
        setUpdatingId(orderId);

        // Optimistic update
        setOrders(prev =>
            prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
        );

        if (!isOffline) {
            try {
                const res = await fetch('/api/purchases', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: newStatus })
                });
                if (res.ok) {
                    if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                        (window as any).__inventorySocket.emit('sync_db_event', { action: 'PURCHASE_UPDATED' });
                    }
                }
            } catch (err) {
                console.error('[Purchases] Error updating status:', err);
                // Revert on failure
                await loadOrders();
            }
        }

        setUpdatingId(null);
    };

    // ─── Animation variants ───────────────────────────────────────────────────

    const containerVariants = {
        hidden: {},
        show: { transition: { staggerChildren: 0.07 } },
    };

    const rowVariants = {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
        exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
    };

    const statVariants = {
        hidden: { opacity: 0, scale: 0.9 },
        show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 20 } },
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', padding: '2.5rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <DemoModeBanner sectionName="Compras y Proveedores" />

                {/* ── Offline Banner ─────────────────────────────────────── */}
                <AnimatePresence>
                    {isOffline && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{
                                backgroundColor: '#FFF3CD',
                                border: '1px solid #F0AD00',
                                borderRadius: '10px',
                                padding: '12px 20px',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '0.85rem',
                                color: '#856404',
                                fontWeight: '600',
                            }}
                        >
                            <AlertCircle size={18} color="#856404" />
                            Modo sin conexión — mostrando datos de demostración. Los cambios se guardarán localmente.
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Header ─────────────────────────────────────────────── */}
                <header
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        marginBottom: '2.5rem',
                    }}
                >
                    <div>
                        <h1
                            style={{
                                fontSize: '2rem',
                                fontWeight: '950',
                                color: '#0ea5e9',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                margin: 0,
                            }}
                        >
                            <ShoppingCart size={32} />
                            COMPRAS Y PROVEEDORES
                        </h1>
                        <p style={{ color: '#666', marginTop: '6px', fontSize: '0.9rem' }}>
                            Gestiona órdenes de compra, seguimiento de proveedores y recepción de mercancía.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={loadOrders}
                            disabled={loading}
                            style={{
                                background: 'white',
                                border: '1.5px solid #ddd',
                                borderRadius: '10px',
                                padding: '10px 14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                color: '#666',
                            }}
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                            ACTUALIZAR
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setShowForm(f => !f)}
                            className="btn-sanjose"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 22px',
                                fontSize: '0.85rem',
                            }}
                        >
                            <PlusCircle size={18} />
                            NUEVA ORDEN DE COMPRA
                        </motion.button>
                    </div>
                </header>

                {/* ── Inline Form ────────────────────────────────────────── */}
                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginBottom: '2rem' }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div
                                className="card-sanjose"
                                style={{
                                    padding: '2rem',
                                    borderTop: '4px solid #0ea5e9',
                                    backgroundColor: 'white',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '1.5rem',
                                    }}
                                >
                                    <h3
                                        style={{
                                            margin: 0,
                                            fontSize: '1rem',
                                            fontWeight: '800',
                                            color: '#0ea5e9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <Package size={18} />
                                        NUEVA ORDEN DE COMPRA
                                    </h3>
                                    <button
                                        onClick={resetForm}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#999',
                                            padding: '4px',
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                        gap: '1.2rem',
                                    }}
                                >
                                    {/* Supplier */}
                                    <div>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                color: '#555',
                                                marginBottom: '6px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                            }}
                                        >
                                            Proveedor *
                                        </label>
                                        <input
                                            type="text"
                                            value={formSupplier}
                                            onChange={e => setFormSupplier(e.target.value)}
                                            placeholder="Nombre del proveedor"
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                border: '1.5px solid #ddd',
                                                borderRadius: '8px',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                transition: 'border-color 0.2s',
                                            }}
                                            onFocus={e => (e.target.style.borderColor = '#0ea5e9')}
                                            onBlur={e => (e.target.style.borderColor = '#ddd')}
                                        />
                                    </div>

                                    {/* Concept */}
                                    <div>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                color: '#555',
                                                marginBottom: '6px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                            }}
                                        >
                                            Concepto *
                                        </label>
                                        <input
                                            type="text"
                                            value={formConcept}
                                            onChange={e => setFormConcept(e.target.value)}
                                            placeholder="Descripción de la compra"
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                border: '1.5px solid #ddd',
                                                borderRadius: '8px',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                transition: 'border-color 0.2s',
                                            }}
                                            onFocus={e => (e.target.style.borderColor = '#0ea5e9')}
                                            onBlur={e => (e.target.style.borderColor = '#ddd')}
                                        />
                                    </div>

                                    {/* Amount */}
                                    <div>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                color: '#555',
                                                marginBottom: '6px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                            }}
                                        >
                                            Monto ({siteConfig.currency}) *
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={formAmount}
                                            onChange={e => setFormAmount(e.target.value)}
                                            placeholder="0.00"
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                border: '1.5px solid #ddd',
                                                borderRadius: '8px',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                transition: 'border-color 0.2s',
                                            }}
                                            onFocus={e => (e.target.style.borderColor = '#0ea5e9')}
                                            onBlur={e => (e.target.style.borderColor = '#ddd')}
                                        />
                                    </div>
                                </div>

                                {/* Error */}
                                <AnimatePresence>
                                    {formError && (
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            style={{
                                                color: '#E30613',
                                                fontSize: '0.82rem',
                                                marginTop: '1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                            }}
                                        >
                                            <AlertCircle size={14} /> {formError}
                                        </motion.p>
                                    )}
                                </AnimatePresence>

                                {/* Actions */}
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '10px',
                                        marginTop: '1.5rem',
                                        justifyContent: 'flex-end',
                                    }}
                                >
                                    <button
                                        onClick={resetForm}
                                        className="btn-sanjose-secondary"
                                        style={{ padding: '10px 20px', fontSize: '0.82rem' }}
                                    >
                                        CANCELAR
                                    </button>
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleSaveOrder}
                                        disabled={saving}
                                        className="btn-sanjose"
                                        style={{
                                            padding: '10px 24px',
                                            fontSize: '0.82rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            opacity: saving ? 0.7 : 1,
                                        }}
                                    >
                                        {saving ? (
                                            <>
                                                <RefreshCw size={15} /> GUARDANDO...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={15} /> GUARDAR ORDEN
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Stats Cards ────────────────────────────────────────── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1.5rem',
                        marginBottom: '2.5rem',
                    }}
                >
                    {/* Cuentas por pagar */}
                    <motion.div variants={statVariants} className="card-sanjose" style={{ borderLeft: '5px solid #F39C12', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <p style={{ color: '#666', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                    Cuentas por Pagar
                                </p>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#1a1a1a', margin: '8px 0 4px' }}>
                                    {formatCurrency(cuentasPorPagar)}
                                </h3>
                                <p style={{ color: '#F39C12', fontSize: '0.78rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={13} />
                                    {orders.filter(o => o.status === 'Pendiente').length} órden(es) pendiente(s)
                                </p>
                            </div>
                            <div style={{ background: '#FFF3CD', padding: '10px', borderRadius: '50%' }}>
                                <CreditCard size={22} color="#F39C12" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Órdenes del mes */}
                    <motion.div variants={statVariants} className="card-sanjose" style={{ borderLeft: '5px solid #0ea5e9', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <p style={{ color: '#666', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                    Órdenes del Mes
                                </p>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0ea5e9', margin: '8px 0 4px' }}>
                                    {ordenesMes}
                                </h3>
                                <p style={{ color: '#666', fontSize: '0.78rem', margin: 0 }}>
                                    Registradas este mes
                                </p>
                            </div>
                            <div style={{ background: '#E3F2FD', padding: '10px', borderRadius: '50%' }}>
                                <CalendarDays size={22} color="#0ea5e9" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Proveedores activos */}
                    <motion.div variants={statVariants} className="card-sanjose" style={{ borderLeft: '5px solid #27AE60', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <p style={{ color: '#666', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                    Proveedores Activos
                                </p>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#27AE60', margin: '8px 0 4px' }}>
                                    {proveedoresActivos}
                                </h3>
                                <p style={{ color: '#666', fontSize: '0.78rem', margin: 0 }}>
                                    Con órdenes en proceso
                                </p>
                            </div>
                            <div style={{ background: '#E8F5E9', padding: '10px', borderRadius: '50%' }}>
                                <Users size={22} color="#27AE60" />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* ── Orders Table ───────────────────────────────────────── */}
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#333', margin: 0 }}>
                        ÓRDENES DE COMPRA
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: '600' }}>
                        {orders.length} registro(s) total
                    </span>
                </div>

                <div
                    style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        backgroundColor: 'white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    }}
                >
                    {/* Table header */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '130px 1fr 1fr 160px 130px 160px',
                            backgroundColor: '#F8FAFC',
                            borderBottom: '2px solid #E8ECF0',
                            padding: '0 8px',
                        }}
                    >
                        {['ORDEN', 'PROVEEDOR', 'CONCEPTO', 'MONTO', 'ESTADO', 'FECHA'].map(col => (
                            <div
                                key={col}
                                style={{
                                    padding: '14px 12px',
                                    fontSize: '0.7rem',
                                    fontWeight: '800',
                                    color: '#888',
                                    letterSpacing: '0.5px',
                                }}
                            >
                                {col}
                            </div>
                        ))}
                    </div>

                    {/* Loading skeleton */}
                    {loading && (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>
                            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '10px', opacity: 0.5 }} />
                            <p style={{ margin: 0, fontSize: '0.85rem' }}>Cargando órdenes...</p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && orders.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ padding: '4rem', textAlign: 'center', color: '#bbb' }}
                        >
                            <ShoppingCart size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                            <p style={{ margin: 0, fontWeight: '600', fontSize: '0.9rem' }}>
                                No hay órdenes de compra registradas.
                            </p>
                            <p style={{ margin: '6px 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
                                Haz clic en &quot;NUEVA ORDEN DE COMPRA&quot; para comenzar.
                            </p>
                        </motion.div>
                    )}

                    {/* Animated rows */}
                    {!loading && orders.length > 0 && (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                        >
                            <AnimatePresence>
                                {orders.map((order, idx) => {
                                    const cfg = STATUS_CONFIG[order.status];
                                    const isUpdating = updatingId === order.id;
                                    const isDropdownOpen = statusDropdown === order.id;

                                    return (
                                        <motion.div
                                            key={order.id}
                                            variants={rowVariants}
                                            exit="exit"
                                            layout
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '130px 1fr 1fr 160px 130px 160px',
                                                borderBottom: idx < orders.length - 1 ? '1px solid #F0F0F0' : 'none',
                                                padding: '0 8px',
                                                backgroundColor: isUpdating ? '#FAFBFF' : 'white',
                                                transition: 'background-color 0.3s',
                                                alignItems: 'center',
                                            }}
                                        >
                                            {/* Order ID */}
                                            <div style={{ padding: '16px 12px', fontWeight: '800', color: '#0ea5e9', fontSize: '0.85rem' }}>
                                                {order.id.length > 15 ? order.id.slice(0, 13) + '…' : order.id}
                                            </div>

                                            {/* Supplier */}
                                            <div style={{ padding: '16px 12px', fontWeight: '600', color: '#333', fontSize: '0.875rem' }}>
                                                {order.supplier}
                                            </div>

                                            {/* Concept */}
                                            <div style={{ padding: '16px 12px', color: '#666', fontSize: '0.825rem' }}>
                                                {order.concept}
                                            </div>

                                            {/* Amount */}
                                            <div style={{ padding: '16px 12px', fontWeight: '700', color: '#1a1a1a', fontSize: '0.875rem' }}>
                                                {formatCurrency(order.amount)}
                                            </div>

                                            {/* Status + action */}
                                            <div style={{ padding: '16px 12px', position: 'relative' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {/* Status badge */}
                                                    <span
                                                        style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '20px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: '700',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            backgroundColor: cfg.bg,
                                                            color: cfg.color,
                                                            width: 'fit-content',
                                                        }}
                                                    >
                                                        {isUpdating ? <RefreshCw size={11} /> : cfg.icon}
                                                        {order.status}
                                                    </span>

                                                    {/* Action button */}
                                                    {cfg.next && !isUpdating && (
                                                        <div style={{ position: 'relative' }}>
                                                            <button
                                                                onClick={() =>
                                                                    setStatusDropdown(isDropdownOpen ? null : order.id)
                                                                }
                                                                style={{
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: '700',
                                                                    background: 'none',
                                                                    border: '1px solid #ddd',
                                                                    borderRadius: '6px',
                                                                    padding: '3px 8px',
                                                                    cursor: 'pointer',
                                                                    color: '#555',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                Actualizar <ChevronDown size={10} />
                                                            </button>

                                                            <AnimatePresence>
                                                                {isDropdownOpen && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, y: -4 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        exit={{ opacity: 0, y: -4 }}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '100%',
                                                                            left: 0,
                                                                            zIndex: 50,
                                                                            backgroundColor: 'white',
                                                                            border: '1px solid #ddd',
                                                                            borderRadius: '8px',
                                                                            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                                                            minWidth: '160px',
                                                                            overflow: 'hidden',
                                                                            marginTop: '4px',
                                                                        }}
                                                                    >
                                                                        {(
                                                                            ['Pendiente', 'En Tránsito', 'Recibido'] as OrderStatus[]
                                                                        )
                                                                            .filter(s => s !== order.status)
                                                                            .map(s => {
                                                                                const sc = STATUS_CONFIG[s];
                                                                                return (
                                                                                    <button
                                                                                        key={s}
                                                                                        onClick={() => handleUpdateStatus(order.id, s)}
                                                                                        style={{
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '8px',
                                                                                            width: '100%',
                                                                                            padding: '10px 14px',
                                                                                            border: 'none',
                                                                                            background: 'none',
                                                                                            cursor: 'pointer',
                                                                                            fontSize: '0.8rem',
                                                                                            fontWeight: '600',
                                                                                            color: sc.color,
                                                                                            textAlign: 'left',
                                                                                            borderBottom: '1px solid #f5f5f5',
                                                                                        }}
                                                                                        onMouseEnter={e =>
                                                                                            ((e.currentTarget as HTMLElement).style.backgroundColor = sc.bg)
                                                                                        }
                                                                                        onMouseLeave={e =>
                                                                                            ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
                                                                                        }
                                                                                    >
                                                                                        {sc.icon} {s}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Date */}
                                            <div style={{ padding: '16px 12px', color: '#888', fontSize: '0.82rem' }}>
                                                {formatDate(order.date)}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>

                {/* ── Footer summary ─────────────────────────────────────── */}
                {!loading && orders.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        style={{
                            marginTop: '1rem',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '2rem',
                            fontSize: '0.82rem',
                            color: '#888',
                            padding: '0 8px',
                        }}
                    >
                        {(['Pendiente', 'En Tránsito', 'Recibido'] as OrderStatus[]).map(s => {
                            const cfg = STATUS_CONFIG[s];
                            const count = orders.filter(o => o.status === s).length;
                            return (
                                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: cfg.color, fontWeight: '600' }}>
                                    {cfg.icon} {count} {s}
                                </span>
                            );
                        })}
                    </motion.div>
                )}

                {/* ── Click-away to close dropdown ───────────────────────── */}
                {statusDropdown && (
                    <div
                        onClick={() => setStatusDropdown(null)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 40,
                        }}
                    />
                )}

            </div>
        </div>
    );
}
