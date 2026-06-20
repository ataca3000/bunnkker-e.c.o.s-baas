"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Phone, Mail, MapPin, Search, PlusCircle,
    Star, X, Save, Loader2, Wifi, WifiOff, Crown,
    ShoppingBag, TrendingUp, UserCheck, RefreshCw,
    ChevronDown, BadgeCheck
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
    collection,
    getDocs,
    addDoc,
    query,
    where,
    serverTimestamp,
    onSnapshot,
    QueryDocumentSnapshot,
    DocumentData
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import DemoModeBanner from '@/components/DemoModeBanner';

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
            return { backgroundColor: '#FFF8E1', color: '#F57F17', border: '1px solid #FFE082' };
        case 'Frecuente':
            return { backgroundColor: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7' };
        case 'Nuevo':
        default:
            return { backgroundColor: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9' };
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

    const fetchCustomerStats = useCallback(async (customerEmail: string): Promise<CustomerStats> => {
        try {
            const q = query(
                collection(db, 'orders'),
                where('customer.phone', '==', customerEmail)
            );
            const snap = await getDocs(q);

            // Also try by customerEmail field
            const q2 = query(
                collection(db, 'orders'),
                where('customerEmail', '==', customerEmail)
            );
            const snap2 = await getDocs(q2);

            const allDocs = new Map<string, any>();
            snap.docs.forEach((d: any) => allDocs.set(d.id, d.data()));
            snap2.docs.forEach((d: any) => allDocs.set(d.id, d.data()));

            const paidOrders = Array.from(allDocs.values()).filter(
                o => o.status === 'paid' || o.status === 'pending'
            );
            const totalSpent = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);

            return { totalOrders: paidOrders.length, totalSpent };
        } catch {
            return { totalOrders: 0, totalSpent: 0 };
        }
    }, []);

    const loadCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'customer'));
            const snap = await getDocs(q);

            if (snap.empty && customers.length === 0) {
                // No customers yet — start with empty state (not demo)
                setCustomers([]);
                setIsOffline(false);
                setLoading(false);
                return;
            }

            const rawCustomers = snap.docs.map((d: any) => ({
                id: d.id,
                name: d.data().displayName || d.data().name || 'Sin nombre',
                phone: d.data().phone || d.data().recoveryPhone || '',
                email: d.data().email || '',
                address: d.data().address || '',
                type: (d.data().type as CustomerType) || 'Nuevo',
                createdAt: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
            }));

            // Enrich with order stats
            const enriched = await Promise.all(
                rawCustomers.map(async (c: any) => {
                    const stats = await fetchCustomerStats(c.email || c.phone);
                    const derivedType = getCustomerType(stats.totalOrders);
                    return {
                        ...c,
                        totalOrders: stats.totalOrders,
                        totalSpent: stats.totalSpent,
                        type: c.type !== 'Nuevo' ? c.type : derivedType
                    };
                })
            );

            setCustomers(enriched);
            setIsOffline(false);
        } catch (err: any) {
            console.warn('[CRM] Firestore unavailable — showing demo data.', err?.code || err?.message);
            setIsOffline(true);
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [fetchCustomerStats]);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    // ─── Real-time listener ───────────────────────────────────────────────────
    useEffect(() => {
        if (isOffline) return;
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'customer'));
            const unsub = onSnapshot(q, async (snap: any) => {
                const rawCustomers = snap.docs.map((d: any) => ({
                    id: d.id,
                    name: d.data().displayName || d.data().name || 'Sin nombre',
                    phone: d.data().phone || d.data().recoveryPhone || '',
                    email: d.data().email || '',
                    address: d.data().address || '',
                    type: (d.data().type as CustomerType) || 'Nuevo',
                    createdAt: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
                }));
                const enriched = await Promise.all(
                    rawCustomers.map(async (c: any) => {
                        const stats = await fetchCustomerStats(c.email || c.phone);
                        const derivedType = getCustomerType(stats.totalOrders);
                        return {
                            ...c,
                            totalOrders: stats.totalOrders,
                            totalSpent: stats.totalSpent,
                            type: c.type !== 'Nuevo' ? c.type : derivedType
                        };
                    })
                );
                setCustomers(enriched);
            }, (err: any) => {
                console.warn('[CRM] Snapshot error:', err?.code);
                setIsOffline(true);
                setCustomers([]);
            });
            return () => unsub();
        } catch {
            // Ignore
        }
    }, [isOffline, fetchCustomerStats]);

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
            alert('⚠️ Modo sin conexión. No se puede guardar en este momento.');
            return;
        }

        setSaving(true);
        try {
            await addDoc(collection(db, 'users'), {
                displayName: form.name.trim(),
                name: form.name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim().toLowerCase(),
                address: form.address.trim(),
                type: form.type,
                role: 'customer',
                createdAt: serverTimestamp(),
                createdBy: profile?.uid || 'admin'
            });
            handleCloseModal();
        } catch (err: any) {
            console.error('[CRM] Error saving customer:', err);
            alert('❌ Error al guardar el cliente. Verifica tu conexión.');
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

    // ─── Input style ──────────────────────────────────────────────────────────

    const inputStyle = (hasError?: boolean): React.CSSProperties => ({
        width: '100%',
        padding: '12px 14px',
        borderRadius: '10px',
        border: `2px solid ${hasError ? '#E53E3E' : '#E2E8F0'}`,
        outline: 'none',
        fontSize: '0.95rem',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box'
    });

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div style={{ backgroundColor: 'transparent', minHeight: '100vh', padding: '2.5rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                {/* ── Header ── */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '2.5rem',
                        flexWrap: 'wrap',
                        gap: '1rem'
                    }}
                >
                    <div>
                        <h1 style={{
                            fontSize: '2.2rem',
                            fontWeight: '950',
                            color: '#0ea5e9',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '6px'
                        }}>
                            <Users size={34} /> CLIENTES Y CRM
                        </h1>
                        <p style={{ color: '#64748B', fontSize: '0.95rem' }}>
                            Gestiona tu cartera de clientes, historial de pedidos y niveles de lealtad.
                        </p>

                        {/* Connection status badge */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '10px',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            backgroundColor: isOffline ? '#FFF3CD' : '#D1FAE5',
                            color: isOffline ? '#856404' : '#065F46'
                        }}>
                            {isOffline
                                ? <><WifiOff size={12} /> MODO DEMO — Sin conexión</>
                                : <><Wifi size={12} /> Conectado a Firestore</>
                            }
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            onClick={handleRefresh}
                            className="btn-sanjose-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px' }}
                            title="Actualizar lista"
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            {refreshing ? 'Actualizando…' : 'Actualizar'}
                        </button>
                        <button
                            onClick={handleOpenModal}
                            className="btn-sanjose"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
                        >
                            <PlusCircle size={20} /> NUEVO CLIENTE
                        </button>
                    </div>
                </motion.header>

                {/* ── Stats Row ── */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                        gap: '1.2rem',
                        marginBottom: '2rem'
                    }}
                >
                    {[
                        { label: 'Total Clientes', value: totalCustomers, icon: <Users size={22} color="#0ea5e9" />, bg: '#EFF6FF', accent: '#0ea5e9' },
                        { label: 'Clientes VIP', value: vipCount, icon: <Crown size={22} color="#F57F17" />, bg: '#FFFDE7', accent: '#F57F17' },
                        { label: 'Total Pedidos', value: totalOrders, icon: <ShoppingBag size={22} color="#6D28D9" />, bg: '#F5F3FF', accent: '#6D28D9' },
                        { label: 'Facturación Total', value: formatCurrency(totalRevenue), icon: <TrendingUp size={22} color="#065F46" />, bg: '#ECFDF5', accent: '#065F46' },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + i * 0.06 }}
                            className="card-sanjose"
                            style={{ padding: '1.3rem', backgroundColor: stat.bg, border: `1px solid ${stat.accent}22` }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: stat.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {stat.label}
                                </span>
                                {stat.icon}
                            </div>
                            <div style={{ fontSize: '1.7rem', fontWeight: '900', color: stat.accent }}>
                                {stat.value}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* ── Search + Filter ── */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="card-sanjose"
                    style={{
                        marginBottom: '1.8rem',
                        padding: '1rem 1.4rem',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}
                >
                    {/* Search input */}
                    <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                        <Search
                            size={18}
                            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                        />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, email o teléfono…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '11px 12px 11px 44px',
                                border: '2px solid #E2E8F0',
                                borderRadius: '10px',
                                fontSize: '0.95rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Type filter */}
                    <div style={{ position: 'relative', minWidth: '160px' }}>
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value as CustomerType | 'Todos')}
                            style={{
                                width: '100%',
                                padding: '11px 36px 11px 14px',
                                border: '2px solid #E2E8F0',
                                borderRadius: '10px',
                                fontSize: '0.9rem',
                                outline: 'none',
                                appearance: 'none',
                                backgroundColor: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="Todos">Todos los tipos</option>
                            <option value="Nuevo">Nuevo</option>
                            <option value="Frecuente">Frecuente</option>
                            <option value="VIP">VIP</option>
                        </select>
                        <ChevronDown
                            size={16}
                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748B' }}
                        />
                    </div>

                    <span style={{ color: '#94A3B8', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                    </span>
                </motion.div>

                {/* ── Customer List ── */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', gap: '14px', color: '#94A3B8' }}>
                        <Loader2 size={28} className="animate-spin" />
                        <span style={{ fontSize: '1rem' }}>Cargando clientes…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="card-sanjose"
                        style={{ textAlign: 'center', padding: '4rem', color: '#94A3B8' }}
                    >
                        <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px' }}>
                            {searchTerm || filterType !== 'Todos' ? 'Sin resultados' : 'Sin clientes registrados'}
                        </p>
                        <p style={{ fontSize: '0.9rem' }}>
                            {searchTerm || filterType !== 'Todos'
                                ? 'Prueba con otros términos de búsqueda.'
                                : 'Agrega tu primer cliente usando el botón "NUEVO CLIENTE".'}
                        </p>
                    </motion.div>
                ) : (
                    <div style={{ display: 'grid', gap: '1.2rem' }}>
                        <AnimatePresence>
                            {filtered.map((customer, idx) => {
                                const stars = getStarRating(customer.totalOrders || 0);
                                const badgeStyle = getTypeBadgeStyle(customer.type);

                                return (
                                    <motion.div
                                        key={customer.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        transition={{ delay: idx * 0.04, duration: 0.3 }}
                                        whileHover={{ scale: 1.008, boxShadow: '0 6px 24px rgba(0,74,153,0.10)' }}
                                        className="card-sanjose"
                                        style={{ padding: '1.5rem', cursor: 'default' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>

                                            {/* Left: Customer info */}
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                {/* Name row */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                                    <div style={{
                                                        width: '42px', height: '42px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#0ea5e9',
                                                        color: 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: '900', fontSize: '1.1rem',
                                                        flexShrink: 0
                                                    }}>
                                                        {customer.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#1E293B', margin: 0 }}>
                                                            {customer.name}
                                                        </h3>
                                                        {customer.createdAt && (
                                                            <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                                                                Cliente desde {new Date(customer.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Contact info */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.875rem', color: '#475569' }}>
                                                    {customer.phone && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <Phone size={14} color="#0ea5e9" /> {customer.phone}
                                                        </span>
                                                    )}
                                                    {customer.email && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <Mail size={14} color="#0ea5e9" /> {customer.email}
                                                        </span>
                                                    )}
                                                    {customer.address && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <MapPin size={14} color="#0ea5e9" /> {customer.address}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Stats + Badge */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', minWidth: '150px' }}>
                                                {/* Type badge */}
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    padding: '5px 14px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '700',
                                                    ...badgeStyle
                                                }}>
                                                    {getTypeIcon(customer.type)} {customer.type}
                                                </span>

                                                {/* Star rating */}
                                                <div style={{ display: 'flex', gap: '3px' }}>
                                                    {Array(5).fill(0).map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            size={15}
                                                            fill={i < stars ? '#FFCB05' : 'transparent'}
                                                            color={i < stars ? '#FFCB05' : '#CBD5E1'}
                                                        />
                                                    ))}
                                                </div>

                                                {/* Orders + Spent */}
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', marginBottom: '3px' }}>
                                                        <ShoppingBag size={13} color="#6D28D9" />
                                                        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#6D28D9' }}>
                                                            {customer.totalOrders || 0} pedido{(customer.totalOrders || 0) !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                                                        <TrendingUp size={13} color="#065F46" />
                                                        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#065F46' }}>
                                                            {formatCurrency(customer.totalSpent || 0)}
                                                        </span>
                                                    </div>
                                                </div>
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
                            position: 'fixed', top: 0, left: 0,
                            width: '100vw', height: '100vh',
                            backgroundColor: 'rgba(0,0,0,0.65)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1000, padding: '1rem',
                            backdropFilter: 'blur(4px)'
                        }}
                        onClick={(e: any) => { if (e.target === e.currentTarget) handleCloseModal(); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="card-sanjose"
                            style={{
                                backgroundColor: 'white',
                                padding: '2.5rem',
                                width: '100%',
                                maxWidth: '520px',
                                maxHeight: '90vh',
                                overflowY: 'auto'
                            }}
                        >
                            {/* Modal header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#0ea5e9', margin: 0 }}>
                                        NUEVO CLIENTE
                                    </h2>
                                    <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px' }}>
                                        Completa los datos del cliente
                                    </p>
                                </div>
                                <button
                                    onClick={handleCloseModal}
                                    style={{ border: 'none', background: '#F1F5F9', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex' }}
                                >
                                    <X size={20} color="#475569" />
                                </button>
                            </div>

                            {/* Form fields */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                                {/* Name */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Nombre completo *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Juan García Pérez"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        style={inputStyle(!!formErrors.name)}
                                    />
                                    {formErrors.name && (
                                        <span style={{ fontSize: '0.75rem', color: '#E53E3E', marginTop: '4px', display: 'block' }}>{formErrors.name}</span>
                                    )}
                                </div>

                                {/* Phone */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Teléfono *
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="Ej. +52 555 123 4567"
                                        value={form.phone}
                                        onChange={e => setForm({ ...form, phone: e.target.value })}
                                        style={inputStyle(!!formErrors.phone)}
                                    />
                                    {formErrors.phone && (
                                        <span style={{ fontSize: '0.75rem', color: '#E53E3E', marginTop: '4px', display: 'block' }}>{formErrors.phone}</span>
                                    )}
                                </div>

                                {/* Email */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Correo electrónico *
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="Ej. cliente@empresa.com"
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        style={inputStyle(!!formErrors.email)}
                                    />
                                    {formErrors.email && (
                                        <span style={{ fontSize: '0.75rem', color: '#E53E3E', marginTop: '4px', display: 'block' }}>{formErrors.email}</span>
                                    )}
                                </div>

                                {/* Address */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Dirección
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Av. Principal 123, Col. Centro"
                                        value={form.address}
                                        onChange={e => setForm({ ...form, address: e.target.value })}
                                        style={inputStyle()}
                                    />
                                </div>

                                {/* Customer type */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                                                        padding: '10px 8px',
                                                        borderRadius: '10px',
                                                        border: selected ? `2px solid ${badge.color}` : '2px solid #E2E8F0',
                                                        backgroundColor: selected ? badge.backgroundColor : 'white',
                                                        color: selected ? badge.color : '#64748B',
                                                        fontWeight: '700',
                                                        fontSize: '0.82rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '5px',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    {getTypeIcon(type)} {type}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Offline warning */}
                                {isOffline && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        backgroundColor: '#FFF3CD', border: '1px solid #FFE082',
                                        borderRadius: '10px', padding: '12px 14px',
                                        fontSize: '0.82rem', color: '#856404'
                                    }}>
                                        <WifiOff size={16} />
                                        Sin conexión. Los datos no podrán guardarse hasta restaurar la conexión.
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                    <button
                                        onClick={handleCloseModal}
                                        className="btn-sanjose-secondary"
                                        style={{ flex: 1, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        disabled={saving}
                                    >
                                        <X size={18} /> Cancelar
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="btn-sanjose"
                                        style={{ flex: 2, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
