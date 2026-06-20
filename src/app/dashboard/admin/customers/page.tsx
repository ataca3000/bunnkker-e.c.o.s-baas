"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, ChevronRight, User } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import ClientCRMModal from '@/components/admin/ClientCRMModal';

export default function CustomersCRM() {
    const [clients, setClients] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<any | null>(null);

    useEffect(() => {
        // En este ERP, los clientes se registran en "users" con role === 'client'
        // o si no tienen rol, podemos asumir que son clientes si compraron, 
        // pero para mantenerlo simple filtramos los que tienen role='client'.
        const q = query(collection(db, 'users'), where('role', '==', 'client'));
        const unsub = onSnapshot(q, (snap: any) => {
            const list: any[] = [];
            snap.forEach((doc: any) => list.push({ uid: doc.id, ...doc.data() }));
            setClients(list);
        });
        return () => unsub();
    }, []);

    const filteredClients = clients.filter(c => 
        (c.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (c.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>CRM DE CLIENTES</h1>
                        <p style={{ color: '#64748b', marginTop: '4px' }}>Historial, Quejas, Soporte y Base de Datos</p>
                    </div>
                </div>

                <div style={{ position: 'relative', marginBottom: '2rem' }}>
                    <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                        type="text" 
                        placeholder="Buscar clientes por nombre o correo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: '16px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                    {filteredClients.length === 0 && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#888', gridColumn: '1 / -1' }}>
                            <User size={48} color="#cbd5e1" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                            <p>No se encontraron clientes.</p>
                            <small>Los usuarios que se registran desde la tienda online aparecerán aquí.</small>
                        </div>
                    )}
                    {filteredClients.map(user => (
                        <motion.div 
                            key={user.uid}
                            whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                            onClick={() => setSelectedClient(user)}
                            style={{ background: '#fff', borderRadius: '24px', padding: '24px', border: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                    <Users size={28} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#0f172a' }}>{user.displayName || 'Cliente Anónimo'}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{user.email}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#0ea5e9', marginTop: '4px', fontWeight: 'bold' }}>VER CRM E HISTORIAL</div>
                                </div>
                            </div>
                            <ChevronRight size={24} color="#cbd5e1" />
                        </motion.div>
                    ))}
                </div>

                <AnimatePresence>
                    {selectedClient && (
                        <ClientCRMModal client={selectedClient} onClose={() => setSelectedClient(null)} />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
