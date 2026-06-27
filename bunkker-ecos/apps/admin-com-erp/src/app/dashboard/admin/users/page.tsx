"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Plus, Key, Search, ChevronRight, User } from 'lucide-react';
import { db } from '@bunkker/core';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import ClientCRMModal from '@/components/admin/ClientCRMModal';

export default function UserManagement() {
    const [users, setUsers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<any | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsub = onSnapshot(q, (snap: any) => {
            const list: any[] = [];
            snap.forEach((doc: any) => list.push({ uid: doc.id, ...doc.data() }));
            setUsers(list);
        });
        return () => unsub();
    }, []);

    const filteredUsers = users.filter(u => {
        const matchesTab = (u.role !== 'client' && u.role !== undefined);
        const matchesSearch = (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                              (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        return matchesTab && matchesSearch;
    });

    // Group staff by role
    const groupedStaff = filteredUsers.reduce((acc, user) => {
        const role = user.role || 'node';
        if (!acc[role]) acc[role] = [];
        acc[role].push(user);
        return acc;
    }, {} as Record<string, any[]>);

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'superadmin': return { bg: '#818cf8', color: '#fff', text: 'Super Admin' };
            case 'admin': return { bg: '#3b82f6', color: '#fff', text: 'Admin' };
            case 'inventory': return { bg: '#f59e0b', color: '#fff', text: 'Almacenista' };
            case 'driver': return { bg: '#10b981', color: '#fff', text: 'Repartidor' };
            case 'sales': return { bg: '#ec4899', color: '#fff', text: 'Ventas' };
            default: return { bg: '#64748b', color: '#fff', text: role };
        }
    };

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>EQUIPO Y CLIENTES</h1>
                        <p style={{ color: '#64748b', marginTop: '4px' }}>Gestión de Personal Activo y Módulo CRM</p>
                    </div>
                </div>



                {/* Search */}
                <div style={{ position: 'relative', marginBottom: '2rem' }}>
                    <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                        type="text" 
                        placeholder={`Buscar empleados por nombre o correo...`}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: '16px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                    />
                </div>

                {/* Content: Personal */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {Object.keys(groupedStaff).length === 0 && <p>No se encontraron resultados.</p>}
                        {Object.entries(groupedStaff).map(([role, usersInRole]) => {
                            const roleUsers = usersInRole as any[];
                            const badge = getRoleBadge(role);
                            return (
                                <div key={role} style={{ background: '#fff', borderRadius: '24px', padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px rgba(0,0,0,0.02)' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 20px 0', color: '#1e293b', fontSize: '1.2rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                        <Shield size={20} color={badge.bg} /> {badge.text} <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9rem' }}>{roleUsers.length}</span>
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                        {roleUsers.map((user: any) => (
                                            <div key={user.uid} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fafaf9' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                                    {user.displayName?.charAt(0).toUpperCase() || <User size={24} />}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{user.displayName || 'Sin Nombre'}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{user.email}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
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
