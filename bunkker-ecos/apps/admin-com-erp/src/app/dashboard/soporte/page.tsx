"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LifeBuoy, PlusCircle, ChevronDown, ChevronUp, ArrowRight,
    AlertCircle, Clock, CheckCircle2, Tag, User, Calendar,
    Loader2, WifiOff, X, FileText, Flag
} from 'lucide-react';
import { db } from '@bunkker/core';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    onSnapshot,
    serverTimestamp,
    query,
    orderBy
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import DemoModeBanner from '@/components/DemoModeBanner';

// ─── Types ──────────────────────────────────────────────────────────────────

type Priority = 'Alta' | 'Media' | 'Baja';
type TicketStatus = 'Abierto' | 'En Proceso' | 'Resuelto';

interface SupportTicket {
    id: string;
    title: string;
    description: string;
    priority: Priority;
    status: TicketStatus;
    assignedTo: string;
    createdBy: string;
    createdByUid: string;
    createdAt: string; // ISO string for display
    updatedAt?: string;
    folio?: string;
    message?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CYCLE: Record<TicketStatus, TicketStatus> = {
    'Abierto': 'En Proceso',
    'En Proceso': 'Resuelto',
    'Resuelto': 'Abierto',
};

const STATUS_COLORS: Record<TicketStatus, { bg: string; color: string; border: string }> = {
    'Abierto':    { bg: '#f3e8ff', color: '#7e22ce', border: '#a855f7' },
    'En Proceso': { bg: '#cce5ff', color: '#004085', border: '#0ea5e9' },
    'Resuelto':             { bg: '#d4edda', color: '#155724', border: '#28a745' },
};

const PRIORITY_COLORS: Record<Priority, { bg: string; color: string }> = {
    'Alta':  { bg: '#fde8e8', color: '#c0392b' },
    'Media': { bg: '#fff8e1', color: '#b8860b' },
    'Baja':  { bg: '#f0f0f0', color: '#555' },
};

const STATUS_ICONS: Record<TicketStatus, React.ReactNode> = {
    'Abierto':    <AlertCircle size={14} />,
    'En Proceso': <Clock size={14} />,
    'Resuelto':             <CheckCircle2 size={14} />,
};

function formatDate(isoString: string): string {
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return isoString;
    }
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    count: number;
    icon: React.ReactNode;
    color: string;
    delay: number;
}

function StatCard({ label, count, icon, color, delay }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            className="card-sanjose"
            style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
            <div style={{
                width: 48, height: 48, borderRadius: '12px',
                backgroundColor: color + '20',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: color, flexShrink: 0
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1a1a1a', lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: '0.8rem', color: '#777', marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            </div>
        </motion.div>
    );
}

// ─── Ticket Row ──────────────────────────────────────────────────────────────

interface TicketRowProps {
    ticket: SupportTicket;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onStatusChange: (ticket: SupportTicket) => void;
    updatingId: string | null;
    isOffline: boolean;
}

function TicketRow({ ticket, index, isExpanded, onToggle, onStatusChange, updatingId, isOffline }: TicketRowProps) {
    const statusStyle = STATUS_COLORS[ticket.status];
    const priorityStyle = PRIORITY_COLORS[ticket.priority];
    const isUpdating = updatingId === ticket.id;
    const nextStatus = STATUS_CYCLE[ticket.status];

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.07, duration: 0.35 }}
            className="card-sanjose"
            style={{ overflow: 'hidden', marginBottom: '1rem' }}
        >
            {/* Main row */}
            <div
                style={{
                    padding: '1.25rem 1.5rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '1rem',
                    alignItems: 'center',
                    cursor: 'pointer',
                }}
                onClick={onToggle}
            >
                {/* Left: title + badges */}
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <h3 style={{
                            fontSize: '1rem', fontWeight: 700, color: '#1a1a1a',
                            margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%'
                        }}>
                            {ticket.title || ticket.folio}
                        </h3>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {/* Priority badge */}
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                            backgroundColor: priorityStyle.bg, color: priorityStyle.color
                        }}>
                            <Flag size={11} /> {ticket.priority}
                        </span>
                        {/* Status badge */}
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                            backgroundColor: statusStyle.bg, color: statusStyle.color,
                            border: `1px solid ${statusStyle.border}`
                        }}>
                            {STATUS_ICONS[ticket.status]} {ticket.status}
                        </span>
                        {/* Assigned */}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#666', fontSize: '0.78rem' }}>
                            <User size={12} /> {ticket.assignedTo}
                        </span>
                        {/* Date */}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#999', fontSize: '0.78rem' }}>
                            <Calendar size={12} /> {formatDate(ticket.createdAt)}
                        </span>
                    </div>
                </div>

                {/* Right: chevron */}
                <div style={{ display: 'flex', alignItems: 'center', color: '#999', flexShrink: 0 }}>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {/* Expandable description + action */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            padding: '0 1.5rem 1.25rem 1.5rem',
                            borderTop: '1px solid #f0f0f0',
                            paddingTop: '1.25rem',
                        }}>
                            <div style={{
                                backgroundColor: '#f9f9f9', borderRadius: '10px',
                                padding: '1rem 1.25rem', marginBottom: '1rem',
                                fontSize: '0.92rem', color: '#444', lineHeight: 1.6
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#888', fontSize: '0.8rem', fontWeight: 600 }}>
                                    <FileText size={14} /> DESCRIPCIÓN
                                </div>
                                {(ticket.description || ticket.message) || <span style={{ color: '#bbb' }}>Sin descripción.</span>}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                                    Creado por: <strong style={{ color: '#666' }}>{ticket.createdBy}</strong>
                                </div>
                                <button
                                    className="btn-sanjose-secondary"
                                    disabled={isOffline || isUpdating || ticket.status === 'Resuelto' && false}
                                    onClick={(e) => { e.stopPropagation(); onStatusChange(ticket); }}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700,
                                        opacity: isUpdating ? 0.7 : 1,
                                        cursor: isUpdating ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {isUpdating
                                        ? <><Loader2 size={14} className="animate-spin" /> Actualizando...</>
                                        : <><ArrowRight size={14} /> Pasar a: {nextStatus}</>
                                    }
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── New Ticket Form Modal ────────────────────────────────────────────────────

interface NewTicketFormProps {
    onClose: () => void;
    onSave: (data: { title: string; description: string; priority: Priority; assignedTo: string }) => Promise<void>;
    saving: boolean;
}

function NewTicketForm({ onClose, onSave, saving }: NewTicketFormProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Priority>('Media');
    const [assignedTo, setAssignedTo] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!title.trim()) e.title = 'El título es obligatorio.';
        if (!description.trim()) e.description = 'La descripción es obligatoria.';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        await onSave({ title: title.trim(), description: description.trim(), priority, assignedTo: assignedTo.trim() || 'Sin asignar' });
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: '8px',
        border: '1.5px solid #ddd', fontSize: '0.95rem', outline: 'none',
        transition: 'border-color 0.2s', boxSizing: 'border-box',
        fontFamily: 'inherit',
    };
    const labelStyle: React.CSSProperties = {
        display: 'block', marginBottom: '6px', fontWeight: 700,
        fontSize: '0.82rem', color: '#444', textTransform: 'uppercase', letterSpacing: '0.4px'
    };
    const errorStyle: React.CSSProperties = {
        color: '#c0392b', fontSize: '0.78rem', marginTop: '4px'
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1rem'
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="card-sanjose"
                style={{ width: '100%', maxWidth: 560, padding: '2rem', position: 'relative' }}
                onClick={(e: any) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <LifeBuoy size={22} /> Nuevo Ticket
                    </h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px' }}
                        aria-label="Cerrar"
                    >
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {/* Title */}
                    <div>
                        <label style={labelStyle}>Título del ticket *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Ej: Error al exportar facturas..."
                            style={{ ...inputStyle, borderColor: errors.title ? '#c0392b' : '#ddd' }}
                            maxLength={100}
                        />
                        {errors.title && <p style={errorStyle}>{errors.title}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label style={labelStyle}>Descripción *</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Describe el problema con el mayor detalle posible..."
                            rows={4}
                            style={{ ...inputStyle, resize: 'vertical', borderColor: errors.description ? '#c0392b' : '#ddd' }}
                            maxLength={1000}
                        />
                        {errors.description && <p style={errorStyle}>{errors.description}</p>}
                    </div>

                    {/* Priority + Assigned */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Prioridad</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value as Priority)}
                                style={{ ...inputStyle, appearance: 'auto' }}
                            >
                                <option value="Alta">🔴 Alta</option>
                                <option value="Media">🟡 Media</option>
                                <option value="Baja">⚪ Baja</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Asignado a</label>
                            <input
                                type="text"
                                value={assignedTo}
                                onChange={e => setAssignedTo(e.target.value)}
                                placeholder="Equipo / persona"
                                style={inputStyle}
                                maxLength={60}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            className="btn-sanjose-secondary"
                            onClick={onClose}
                            disabled={saving}
                            style={{ padding: '10px 20px' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn-sanjose"
                            disabled={saving}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
                        >
                            {saving
                                ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                                : <><PlusCircle size={16} /> Crear Ticket</>
                            }
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SoportePage() {
    const { profile } = useAuth();

    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<TicketStatus | 'Todos'>('Todos');

    // ─── Load tickets from Firestore ──────────────────────────────────────────
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;

        const setup = async () => {
            try {
                const q = query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'));
                unsubscribe = onSnapshot(
                    q,
                    (snap: any) => {
                        const data = snap.docs.map((d: any) => {
                            const raw = d.data();
                            // Handle Firestore Timestamps
                            const createdAt = raw.createdAt?.toDate
                                ? raw.createdAt.toDate().toISOString()
                                : raw.createdAt || new Date().toISOString();
                            return {
                                id: d.id,
                                title: raw.title || '',
                                description: raw.description || '',
                                priority: (raw.priority as Priority) || 'Media',
                                status: (raw.status as TicketStatus) || 'Abierto',
                                assignedTo: raw.assignedTo || 'Sin asignar',
                                createdBy: raw.createdBy || 'Desconocido',
                                createdByUid: raw.createdByUid || '',
                                createdAt,
                                updatedAt: raw.updatedAt?.toDate
                                    ? raw.updatedAt.toDate().toISOString()
                                    : raw.updatedAt,
                            } as SupportTicket;
                        });
                        setTickets(data.length > 0 ? data : []);
                        setIsOffline(false);
                        setLoading(false);
                    },
                    (err: any) => {
                        console.warn('[Soporte] Firestore listener error — using demo data.', err?.code);
                        setTickets([]);
                        setIsOffline(true);
                        setLoading(false);
                    }
                );
            } catch (err) {
                console.warn('[Soporte] Firestore setup error — using demo data.', err);
                setTickets([]);
                setIsOffline(true);
                setLoading(false);
            }
        };

        setup();
        return () => { if (unsubscribe) unsubscribe(); };
    }, []);

    // ─── Create ticket ────────────────────────────────────────────────────────
    const handleCreateTicket = useCallback(async (data: {
        title: string; description: string; priority: Priority; assignedTo: string;
    }) => {
        if (isOffline) {
            // Offline: add locally with demo ID
            const local: SupportTicket = {
                id: `LOCAL-${Date.now()}`,
                title: data.title,
                description: data.description,
                priority: data.priority,
                status: 'Abierto',
                assignedTo: data.assignedTo,
                createdBy: profile?.displayName || 'Usuario',
                createdByUid: profile?.uid || 'offline',
                createdAt: new Date().toISOString(),
            };
            setTickets(prev => [local, ...prev]);
            setShowForm(false);
            return;
        }

        setSaving(true);
        try {
            await addDoc(collection(db, 'support_tickets'), {
                title: data.title,
                description: data.description,
                priority: data.priority,
                status: 'Abierto' as TicketStatus,
                assignedTo: data.assignedTo,
                createdBy: profile?.displayName || 'Usuario',
                createdByUid: profile?.uid || 'anonymous',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            setShowForm(false);
        } catch (err) {
            console.error('[Soporte] Error creating ticket:', err);
            alert('⚠️ Error al crear el ticket. Verifica tu conexión.');
        } finally {
            setSaving(false);
        }
    }, [isOffline, profile]);

    // ─── Cycle ticket status ──────────────────────────────────────────────────
    const handleStatusChange = useCallback(async (ticket: SupportTicket) => {
        const nextStatus = STATUS_CYCLE[ticket.status];

        if (isOffline) {
            setTickets(prev => prev.map(t =>
                t.id === ticket.id ? { ...t, status: nextStatus } : t
            ));
            return;
        }

        setUpdatingId(ticket.id);
        try {
            await updateDoc(doc(db, 'support_tickets', ticket.id), {
                status: nextStatus,
                updatedAt: serverTimestamp(),
            });
        } catch (err) {
            console.error('[Soporte] Error updating ticket status:', err);
            // Optimistic fallback for offline
            setTickets(prev => prev.map(t =>
                t.id === ticket.id ? { ...t, status: nextStatus } : t
            ));
        } finally {
            setUpdatingId(null);
        }
    }, [isOffline]);

    // ─── Stats ────────────────────────────────────────────────────────────────
    const stats = {
        total: tickets.length,
        abierto: tickets.filter(t => t.status === 'Abierto').length,
        enProceso: tickets.filter(t => t.status === 'En Proceso').length,
        resuelto: tickets.filter(t => t.status === 'Resuelto').length,
    };

    // ─── Filtered tickets ─────────────────────────────────────────────────────
    const filtered = filterStatus === 'Todos'
        ? tickets
        : tickets.filter(t => t.status === filterStatus);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', padding: '2.5rem 1.5rem' }}>
            <div style={{ maxWidth: '960px', margin: '0 auto' }}>
                <DemoModeBanner sectionName="Centro de Soporte y Ayuda" />

                {/* ── Header ── */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}
                >
                    <div>
                        <h1 style={{ fontSize: '2.2rem', fontWeight: 950, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                            <LifeBuoy size={34} /> SOPORTE INTERNO
                        </h1>
                        <p style={{ color: '#666', marginTop: '6px', fontSize: '0.95rem' }}>
                            Panel de tickets de soporte técnico y operativo.
                        </p>
                    </div>
                    <button
                        className="btn-sanjose"
                        onClick={() => setShowForm(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '0.9rem', fontWeight: 800, alignSelf: 'flex-start' }}
                    >
                        <PlusCircle size={20} /> NUEVO TICKET
                    </button>
                </motion.header>

                {/* ── Offline banner ── */}
                <AnimatePresence>
                    {isOffline && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{
                                backgroundColor: '#fff3cd', border: '1.5px solid #ffc107',
                                borderRadius: '10px', padding: '12px 16px',
                                display: 'flex', alignItems: 'center', gap: '10px',
                                marginBottom: '1.5rem', color: '#856404', fontSize: '0.88rem', fontWeight: 600
                            }}
                        >
                            <WifiOff size={18} />
                            Modo sin conexión — mostrando datos de demostración. Los cambios son temporales.
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Stats ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <StatCard label="Total Tickets" count={stats.total}     icon={<Tag size={22} />}          color="#0ea5e9" delay={0.05} />
                    <StatCard label="Abiertos"      count={stats.abierto}   icon={<AlertCircle size={22} />}  color="#e67e22" delay={0.10} />
                    <StatCard label="En Proceso"    count={stats.enProceso} icon={<Clock size={22} />}        color="#0ea5e9" delay={0.15} />
                    <StatCard label="Resueltos"     count={stats.resuelto}  icon={<CheckCircle2 size={22} />} color="#27ae60" delay={0.20} />
                </div>

                {/* ── Filter bar ── */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}
                >
                    {(['Todos', 'Abierto', 'En Proceso', 'Resuelto'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            style={{
                                padding: '7px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700,
                                border: '2px solid',
                                cursor: 'pointer', transition: 'all 0.2s',
                                borderColor: filterStatus === s ? '#0ea5e9' : '#ddd',
                                backgroundColor: filterStatus === s ? '#0ea5e9' : '#fff',
                                color: filterStatus === s ? '#fff' : '#555',
                            }}
                        >
                            {s}
                            {s !== 'Todos' && (
                                <span style={{ marginLeft: '6px', opacity: 0.75 }}>
                                    ({s === 'Abierto' ? stats.abierto : s === 'En Proceso' ? stats.enProceso : stats.resuelto})
                                </span>
                            )}
                        </button>
                    ))}
                </motion.div>

                {/* ── Ticket list ── */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: '#aaa' }}>
                        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                        <p>Cargando tickets...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="card-sanjose"
                        style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}
                    >
                        <LifeBuoy size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p style={{ fontSize: '1rem', fontWeight: 600 }}>
                            {filterStatus === 'Todos' ? 'No hay tickets registrados.' : `No hay tickets con estado "${filterStatus}".`}
                        </p>
                        <button
                            className="btn-sanjose"
                            onClick={() => setShowForm(true)}
                            style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px' }}
                        >
                            <PlusCircle size={16} /> Crear el primer ticket
                        </button>
                    </motion.div>
                ) : (
                    <div>
                        {filtered.map((ticket, i) => (
                            <TicketRow
                                key={ticket.id}
                                ticket={ticket}
                                index={i}
                                isExpanded={expandedId === ticket.id}
                                onToggle={() => setExpandedId(prev => prev === ticket.id ? null : ticket.id)}
                                onStatusChange={handleStatusChange}
                                updatingId={updatingId}
                                isOffline={isOffline}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── New Ticket Modal ── */}
            <AnimatePresence>
                {showForm && (
                    <NewTicketForm
                        onClose={() => setShowForm(false)}
                        onSave={handleCreateTicket}
                        saving={saving}
                    />
                )}
            </AnimatePresence>

            {/* Keyframes for spinner fallback */}
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}
