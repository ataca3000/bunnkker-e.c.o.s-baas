"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Phone, Mail, MapPin, Search, PlusCircle,
    Star, X, Save, Loader2, Wifi, WifiOff, Crown,
    ShoppingBag, TrendingUp, UserCheck, RefreshCw,
    ChevronDown, BadgeCheck
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import DemoModeBanner from '@/components/DemoModeBanner';

// Acoustic feedback
const playBeep = () => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) { }
};

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomerType = 'Nuevo' | 'Frecuente' | 'VIP';

interface Customer {
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    type: CustomerType;
    createdAt?: string;
    totalOrders?: number;
    totalSpent?: number;
}

interface CustomerStats {
    totalOrders: number;
    totalSpent: number;
}

// ─── Demo fallback data (fully generic) ───────────────────────────────────────

const DEMO_CUSTOMERS: Customer[] = [
    {
        id: 'DEMO-C001',
        name: 'Empresa Industrial del Norte S.A.',
        phone: '+52 555 100 2000',
        email: 'compras@empresanorte.com',
        address: 'Av. Industrial 45, Col. Parque Empresarial',
        type: 'VIP',
        totalOrders: 24,
        totalSpent: 158400,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString()
    },
    {
        id: 'DEMO-C002',
        name: 'Taller y Servicios Rápidos',
        phone: '+52 555 987 6543',
        email: 'taller.rapido@gmail.com',
        address: 'Calle 5 Sur #120, Local B',
        type: 'Frecuente',
        totalOrders: 8,
        totalSpent: 12350,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString()
    },
    {
        id: 'DEMO-C003',
        name: 'María López Rodríguez',
        phone: '+52 555 333 2211',
        email: 'maria.lopez@yahoo.com',
        address: 'Col. Centro, Local 2',
        type: 'Nuevo',
        totalOrders: 1,
        totalSpent: 850,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
    }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCustomerType(totalOrders: number): CustomerType {
    if (totalOrders === 0 || totalOrders === 1) return 'Nuevo';
    if (totalOrders >= 2 && totalOrders <= 10) return 'Frecuente';
    return 'VIP';
}

function getStarRating(totalOrders: number): number {
    if (totalOrders === 0) return 1;
    if (totalOrders <= 2) return 2;
    if (totalOrders <= 5) return 3;
    if (totalOrders <= 15) return 4;
    return 5;
}

function getTypeBadgeStyle(type: CustomerType): React.CSSProperties {
    switch (type) {
        case 'VIP':
            return { backgroundColor: 'rgba(245, 127, 23, 0.2)', color: '#Fcd34d', border: '1px solid rgba(245, 127, 23, 0.5)' };
        case 'Frecuente':
            return { backgroundColor: 'rgba(46, 125, 50, 0.2)', color: '#4ade80', border: '1px solid rgba(46, 125, 50, 0.5)' };
        case 'Nuevo':
        default:
            return { backgroundColor: 'rgba(21, 101, 192, 0.2)', color: '#38bdf8', border: '1px solid rgba(21, 101, 192, 0.5)' };
    }
}

function getTypeIcon(type: CustomerType) {
    switch (type) {
        case 'VIP': return <Crown size={12} />;
        case 'Frecuente': return <BadgeCheck size={12} />;
        case 'Nuevo': return <UserCheck size={12} />;
    }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CRMPage() {
    const { formatCurrency, firebaseStatus } = useCart();
    const { profile } = useAuth();

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<CustomerType | 'Todos'>('Todos');
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        type: 'Nuevo' as CustomerType
    });
    const [formErrors, setFormErrors] = useState<Partial<typeof form>>({});

    // ─── Load customers + order stats ────────────────────────────────────────

    const loadCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/customers');
            if (!res.ok) throw new Error('Failed to fetch customers');
            const result = await res.json();
            if (result.success) {
                setCustomers(result.data);
                setIsOffline(false);
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            console.warn('[CRM] Local API unavailable — showing demo data.', err?.code || err?.message);
            setIsOffline(true);
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    // ─── Real-time listener ───────────────────────────────────────────────────
    useEffect(() => {
        if (isOffline) return;
        
        // Listen to local socket for order updates to refresh customers
        const handleSync = (event: any) => {
            if (event.action?.includes('ORDER') || event.action?.includes('CUSTOMER')) {
                loadCustomers();
            }
        };

        if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
            (window as any).__inventorySocket.on('sync_db_event', handleSync);
            return () => {
                (window as any).__inventorySocket.off('sync_db_event', handleSync);
            };
        }
    }, [isOffline, loadCustomers]);

    // ─── Filtered list ────────────────────────────────────────────────────────

    const filtered = customers.filter((c: any) => {
        const matchesSearch =
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm);
        const matchesType = filterType === 'Todos' || c.type === filterType;
        return matchesSearch && matchesType;
    });

    // ─── Stats summary ────────────────────────────────────────────────────────

    const totalCustomers = customers.length;
    const vipCount = customers.filter((c: any) => c.type === 'VIP').length;
    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const totalOrders = customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0);

    // ─── Form validation ──────────────────────────────────────────────────────

    const validateForm = () => {
        const errors: Partial<typeof form> = {};
        if (!form.name.trim()) errors.name = 'El nombre es requerido';
        if (!form.phone.trim()) errors.phone = 'El teléfono es requerido';
        if (!form.email.trim()) errors.email = 'El email es requerido';
        else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Email inválido';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // ─── Save customer ────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!validateForm()) return;
        if (isOffline) {
            toast.warning('Modo sin conexión. No se puede guardar en este momento.', '⚠️ Offline');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    phone: form.phone.trim(),
                    email: form.email.trim().toLowerCase(),
                    address: form.address.trim(),
                    type: form.type
                })
            });
            const result = await res.json();
            if (result.success) {
                // Notificar red local
                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                    (window as any).__inventorySocket.emit('sync_db_event', { action: 'CUSTOMER_ADDED' });
                }
                loadCustomers();
                handleCloseModal();
                toast.success('Cliente guardado exitosamente.');
            } else {
                toast.error(result.error || 'Error al guardar el cliente');
            }
        } catch (err: any) {
            console.error('[CRM] Error saving customer:', err);
            toast.error('Error al guardar el cliente. Verifica tu conexión.');
        } finally {
            setSaving(false);
        }
    };

    // ─── Modal helpers ────────────────────────────────────────────────────────

    const handleOpenModal = () => {
        setForm({ name: '', phone: '', email: '', address: '', type: 'Nuevo' });
        setFormErrors({});
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setForm({ name: '', phone: '', email: '', address: '', type: 'Nuevo' });
        setFormErrors({});
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadCustomers();
        setRefreshing(false);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

                {/* ── Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.4rem', fontWeight: '950', color: '#ffffff', margin: 0, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Users size={36} color="#0ea5e9" />
                            DIRECTORIO CRM
                        </h1>
                        <p style={{ color: '#94A3B8', fontSize: '1rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Gestión y fidelización de clientes
                            {isOffline && (
                                <span style={{ backgroundColor: '#fef2f2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                                    <WifiOff size={12} /> Offline
                                </span>
                            )}
                        </p>
                    </div>

                    <button
                        onClick={handleOpenModal}
                        style={{
                            backgroundColor: '#0ea5e9',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '9999px',
                            fontWeight: '800',
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 10px 25px -5px rgba(14, 165, 233, 0.4)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                        onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                        <PlusCircle size={20} />
                        NUEVO CLIENTE
                    </button>
                </div>

                {/* ── Stats grid ── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1.5rem',
                        marginBottom: '2.5rem'
                    }}
                >
                    {[
                        { label: 'Total Clientes', value: totalCustomers, icon: <Users size={22} color="#38bdf8" />, bg: 'rgba(56, 189, 248, 0.1)', accent: '#38bdf8' },
                        { label: 'Clientes VIP', value: vipCount, icon: <Crown size={22} color="#fbbf24" />, bg: 'rgba(251, 191, 36, 0.1)', accent: '#fbbf24' },
                        { label: 'Total Pedidos', value: totalOrders, icon: <ShoppingBag size={22} color="#a78bfa" />, bg: 'rgba(167, 139, 250, 0.1)', accent: '#a78bfa' },
                        { label: 'Facturación Total', value: formatCurrency(totalRevenue), icon: <TrendingUp size={22} color="#34d399" />, bg: 'rgba(52, 211, 153, 0.1)', accent: '#34d399' },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + i * 0.06 }}
                            style={{ 
                                padding: '1.5rem', 
                                backgroundColor: 'rgba(30, 41, 59, 0.7)', 
                                border: `1px solid ${stat.accent}40`,
                                borderRadius: '24px',
                                backdropFilter: 'blur(16px)',
                                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: stat.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {stat.label}
                                </span>
                                <div style={{ backgroundColor: stat.bg, padding: '8px', borderRadius: '12px' }}>
                                    {stat.icon}
                                </div>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: '900', color: '#f8fafc' }}>
                                {stat.value}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* ── Search + Filter ── */}
                <div style={{
                    marginBottom: '2rem',
                    padding: '1.2rem',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    backgroundColor: 'rgba(30, 41, 59, 0.7)',
                    borderRadius: '24px',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email o teléfono…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            flex: 1, minWidth: '220px',
                            padding: '14px 16px',
                            backgroundColor: 'rgba(15, 23, 42, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '16px',
                            color: '#f8fafc',
                            outline: 'none'
                        }}
                    />
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as CustomerType | 'Todos')}
                        style={{
                            padding: '14px',
                            backgroundColor: 'rgba(15, 23, 42, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '16px',
                            color: '#f8fafc'
                        }}
                    >
                        <option value="Todos">Todos</option>
                        <option value="Nuevo">Nuevo</option>
                        <option value="Frecuente">Frecuente</option>
                        <option value="VIP">VIP</option>
                    </select>
                </div>

                {/* ── Customer List ── */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: '#94A3B8' }}>
                        <Loader2 size={32} className="animate-spin" />
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                        <AnimatePresence>
                            {filtered.map((customer) => {
                                const initials = customer.name.substring(0, 2).toUpperCase();
                                return (
                                    <motion.div
                                        key={customer.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        style={{
                                            backgroundColor: 'rgba(30, 41, 59, 0.7)',
                                            borderRadius: '24px',
                                            padding: '1.5rem',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            backdropFilter: 'blur(16px)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800' }}>
                                                {initials}
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, color: '#f8fafc' }}>{customer.name}</h3>
                                                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{customer.type}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* ── New Customer Modal ── */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1000, padding: '1rem', backdropFilter: 'blur(8px)'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            style={{
                                backgroundColor: '#0f172a',
                                padding: '2.5rem',
                                width: '100%',
                                maxWidth: '520px',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                borderRadius: '28px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            {/* Modal header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#ffffff', margin: 0 }}>
                                        NUEVO CLIENTE
                                    </h2>
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                                        Completa los datos para registrarlo
                                    </p>
                                </div>
                                <button
                                    onClick={handleCloseModal}
                                    style={{ border: 'none', background: 'rgba(255,255,255,0.1)', borderRadius: '14px', padding: '10px', cursor: 'pointer', display: 'flex', color: '#f8fafc', transition: 'background 0.2s' }}
                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Form fields */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                                {/* Name */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Nombre completo *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Juan Pérez"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        style={{ width: '100%', padding: '14px 16px', border: formErrors.name ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '1rem', outline: 'none', backgroundColor: 'rgba(15, 23, 42, 0.5)', color: '#f8fafc', boxSizing: 'border-box' }}
                                    />
                                    {formErrors.name && (
                                        <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{formErrors.name}</span>
                                    )}
                                </div>

                                {/* Phone & Email */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Teléfono *
                                        </label>
                                        <input
                                            type="tel"
                                            placeholder="Ej. +52 555 123"
                                            value={form.phone}
                                            onChange={e => setForm({ ...form, phone: e.target.value })}
                                            style={{ width: '100%', padding: '14px 16px', border: formErrors.phone ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '1rem', outline: 'none', backgroundColor: 'rgba(15, 23, 42, 0.5)', color: '#f8fafc', boxSizing: 'border-box' }}
                                        />
                                        {formErrors.phone && (
                                            <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{formErrors.phone}</span>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Correo electrónico *
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="correo@ejemplo.com"
                                            value={form.email}
                                            onChange={e => setForm({ ...form, email: e.target.value })}
                                            style={{ width: '100%', padding: '14px 16px', border: formErrors.email ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '1rem', outline: 'none', backgroundColor: 'rgba(15, 23, 42, 0.5)', color: '#f8fafc', boxSizing: 'border-box' }}
                                        />
                                        {formErrors.email && (
                                            <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{formErrors.email}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Address */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Dirección
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Av. Principal 123"
                                        value={form.address}
                                        onChange={e => setForm({ ...form, address: e.target.value })}
                                        style={{ width: '100%', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '1rem', outline: 'none', backgroundColor: 'rgba(15, 23, 42, 0.5)', color: '#f8fafc', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Customer type */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Tipo de cliente
                                    </label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {(['Nuevo', 'Frecuente', 'VIP'] as CustomerType[]).map(type => {
                                            const badge = getTypeBadgeStyle(type);
                                            const selected = form.type === type;
                                            return (
                                                <button
                                                    key={type}
                                                    onClick={() => setForm({ ...form, type })}
                                                    style={{
                                                        flex: 1,
                                                        padding: '12px 8px',
                                                        borderRadius: '16px',
                                                        border: selected ? `2px solid ${badge.color}` : '1px solid rgba(255,255,255,0.1)',
                                                        backgroundColor: selected ? badge.backgroundColor : 'rgba(15, 23, 42, 0.5)',
                                                        color: selected ? badge.color : '#94a3b8',
                                                        fontWeight: '800',
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '5px',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    {getTypeIcon(type)} {type}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    <button
                                        onClick={handleCloseModal}
                                        style={{ flex: 1, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' }}
                                        disabled={saving}
                                    >
                                        <X size={18} /> Cancelar
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        style={{ flex: 2, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#0ea5e9', border: 'none', color: 'white', borderRadius: '16px', fontWeight: '800', cursor: saving || isOffline ? 'not-allowed' : 'pointer', opacity: saving || isOffline ? 0.7 : 1, transition: 'all 0.2s', boxShadow: '0 10px 20px -5px rgba(14, 165, 233, 0.4)' }}
                                        disabled={saving || isOffline}
                                    >
                                        {saving
                                            ? <><Loader2 size={18} className="animate-spin" /> Guardando…</>
                                            : <><Save size={18} /> GUARDAR CLIENTE</>
                                        }
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
