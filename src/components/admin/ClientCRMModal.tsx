"use client";

// @ts-nocheck
/* eslint-disable */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Clock, MessageCircle, AlertTriangle, Bot, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/lib/toast';

interface ClientCRMModalProps {
    client: any;
    onClose: () => void;
}

export default function ClientCRMModal({ client, onClose }: ClientCRMModalProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'history'>('history');
    
    // Info Tab State
    const [formData, setFormData] = useState({
        displayName: client.displayName || '',
        phone: client.phone || '',
        address: client.address || '',
        notes: client.notes || ''
    });
    const [saving, setSaving] = useState(false);

    // History Tab State
    const [history, setHistory] = useState<any[]>([]);
    const [newNoteType, setNewNoteType] = useState<'duda' | 'queja' | 'nota'>('nota');
    const [newNoteText, setNewNoteText] = useState('');
    const [aiThinking, setAiThinking] = useState(false);

    useEffect(() => {
        if (!client.uid) return;
        const q = query(collection(db, `users/${client.uid}/history`), orderBy('timestamp', 'desc'));
        const unsub = onSnapshot(q, (snap: any) => {
            const list: any[] = [];
            snap.forEach((doc: any) => list.push({ id: doc.id, ...doc.data() }));
            setHistory(list);
        });
        return () => unsub();
    }, [client.uid]);

    const handleSaveInfo = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', client.uid), {
                displayName: formData.displayName,
                phone: formData.phone,
                address: formData.address,
                notes: formData.notes
            });
            // Auto-log data correction
            await addDoc(collection(db, `users/${client.uid}/history`), {
                type: 'system',
                text: 'Se actualizaron los datos del perfil (CRM).',
                timestamp: serverTimestamp()
            });
            toast.success('Datos del cliente guardados correctamente.', '✅ CRM');
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar los datos. Verifica la conexión.', 'CRM');
        }
        setSaving(false);
    };

    const handleAddNote = async () => {
        if (!newNoteText.trim()) return;
        try {
            await addDoc(collection(db, `users/${client.uid}/history`), {
                type: newNoteType,
                text: newNoteText,
                status: newNoteType === 'nota' ? 'resolved' : 'pending',
                timestamp: serverTimestamp()
            });
            setNewNoteText('');
        } catch (e) {
            console.error(e);
        }
    };

    const handleAIRespond = async (item: any) => {
        setAiThinking(true);
        // Simular respuesta de IA basada en el contexto de ferretería
        setTimeout(async () => {
            let aiResponse = "";
            const lowerText = item.text.toLowerCase();
            if (lowerText.includes('retraso') || lowerText.includes('tarde')) {
                aiResponse = "Lamentamos el inconveniente. He verificado con logística y tu pedido está en ruta prioritaria. Recibirás un cupón de 10% de descuento en tu próxima compra por la molestia.";
            } else if (lowerText.includes('factura') || lowerText.includes('rfc')) {
                aiResponse = "Claro, para emitir la factura necesitamos que actualices tu RFC en la sección de facturación. Te he enviado un correo con la liga directa.";
            } else if (lowerText.includes('precio') || lowerText.includes('cotización')) {
                aiResponse = "Los precios mostrados ya incluyen IVA. Si tu compra es por volumen, contáctanos directo para aplicar el precio de mayoreo automático.";
            } else {
                aiResponse = "Hemos registrado tu solicitud. Un asesor se comunicará contigo en breve para darte seguimiento personalizado. ¡Gracias por tu preferencia!";
            }

            try {
                await updateDoc(doc(db, `users/${client.uid}/history`, item.id), {
                    status: 'resolved',
                    aiResponse: aiResponse,
                    resolvedAt: serverTimestamp()
                });
            } catch (e) {
                console.error(e);
            }
            setAiThinking(false);
        }, 1500);
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                style={{ background: '#fff', borderRadius: '24px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
            >
                {/* Header */}
                <div style={{ padding: '24px', background: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>CRM: {client.displayName || client.email}</h2>
                        <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>{client.email} | ID: {client.uid.substring(0, 8)}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={28} /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <button 
                        onClick={() => setActiveTab('history')}
                        style={{ flex: 1, padding: '16px', border: 'none', background: activeTab === 'history' ? '#fff' : 'transparent', borderBottom: activeTab === 'history' ? '3px solid #0ea5e9' : '3px solid transparent', fontWeight: activeTab === 'history' ? 'bold' : 'normal', color: activeTab === 'history' ? '#0ea5e9' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Historial y Quejas
                    </button>
                    <button 
                        onClick={() => setActiveTab('info')}
                        style={{ flex: 1, padding: '16px', border: 'none', background: activeTab === 'info' ? '#fff' : 'transparent', borderBottom: activeTab === 'info' ? '3px solid #0ea5e9' : '3px solid transparent', fontWeight: activeTab === 'info' ? 'bold' : 'normal', color: activeTab === 'info' ? '#0ea5e9' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Datos del Cliente
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
                    
                    {activeTab === 'info' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>Nombre Completo</label>
                                <input type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>Teléfono de Contacto</label>
                                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="+52..." />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>Dirección de Envío Principal</label>
                                <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '80px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>Notas Internas (Solo Staff)</label>
                                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '80px', background: '#fef3c7' }} placeholder="Cliente VIP, suele comprar cemento cruz azul..." />
                            </div>
                            <button onClick={handleSaveInfo} disabled={saving} className="btn-sanjose" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px' }}>
                                <Save size={18} /> {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Añadir nuevo ticket/nota */}
                            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1e293b' }}>Registrar Evento</h3>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                    <button onClick={() => setNewNoteType('nota')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: newNoteType === 'nota' ? '#3b82f6' : '#e2e8f0', color: newNoteType === 'nota' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 'bold' }}>Nota Interna</button>
                                    <button onClick={() => setNewNoteType('duda')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: newNoteType === 'duda' ? '#eab308' : '#e2e8f0', color: newNoteType === 'duda' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 'bold' }}>Duda del Cliente</button>
                                    <button onClick={() => setNewNoteType('queja')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: newNoteType === 'queja' ? '#ef4444' : '#e2e8f0', color: newNoteType === 'queja' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 'bold' }}>Queja</button>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <input 
                                        type="text" 
                                        value={newNoteText} 
                                        onChange={e => setNewNoteText(e.target.value)} 
                                        placeholder={`Escribe la ${newNoteType}...`} 
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} 
                                    />
                                    <button onClick={handleAddNote} className="btn-sanjose" style={{ padding: '0 24px', borderRadius: '12px', fontWeight: 'bold' }}>REGISTRAR</button>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {history.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No hay historial para este cliente.</p>}
                                {history.map(item => (
                                    <div key={item.id} style={{ background: '#fff', padding: '16px', borderRadius: '16px', borderLeft: `4px solid ${item.type === 'queja' ? '#ef4444' : item.type === 'duda' ? '#eab308' : item.type === 'system' ? '#94a3b8' : '#3b82f6'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {item.type === 'queja' && <AlertTriangle size={18} color="#ef4444" />}
                                                {item.type === 'duda' && <MessageCircle size={18} color="#eab308" />}
                                                {item.type === 'nota' && <Clock size={18} color="#3b82f6" />}
                                                {item.type === 'system' && <CheckCircle2 size={18} color="#94a3b8" />}
                                                <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', color: '#475569' }}>{item.type}</span>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : 'Justo ahora'}</span>
                                        </div>
                                        <p style={{ margin: '0 0 12px 0', color: '#1e293b' }}>{item.text}</p>
                                        
                                        {/* Status and AI Responder */}
                                        {(item.type === 'queja' || item.type === 'duda') && (
                                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                                                {item.status === 'resolved' ? (
                                                    <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontWeight: 'bold', marginBottom: '6px' }}>
                                                            <Bot size={16} /> Respuesta Automática de IA
                                                        </div>
                                                        <p style={{ margin: 0, color: '#15803d', fontSize: '0.9rem' }}>{item.aiResponse || 'Resuelto manualmente.'}</p>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleAIRespond(item)}
                                                        disabled={aiThinking}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(to right, #8b5cf6, #d946ef)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: aiThinking ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                                                    >
                                                        <Bot size={18} /> {aiThinking ? 'Generando respuesta...' : 'Responder con IA'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
