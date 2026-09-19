"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Plus, Key, Search, ChevronRight, User } from 'lucide-react';
import ClientCRMModal from '@/components/admin/ClientCRMModal';

export default function UserManagement() {
    const [users, setUsers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<any | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/users');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        // Map Prisma schema to match what UI expects: uid -> id, displayName -> name
                        setUsers(data.data.map((u: any) => ({
                            ...u,
                            uid: u.id,
                            displayName: u.name
                        })));
                    }
                }
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };

        fetchUsers();

        if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
            const socket = (window as any).__inventorySocket;
            const handleSync = (event: any) => {
                if (event.action?.includes('USER')) fetchUsers();
            };
            socket.on('sync_db_event', handleSync);
            return () => socket.off('sync_db_event', handleSync);
        }
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
        <div className="bg-transparent min-h-screen text-slate-200">
            <div className="max-w-[1200px] mx-auto p-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-white m-0 tracking-tight">EQUIPO Y CLIENTES</h1>
                        <p className="text-slate-400 mt-1">Gestión de Personal Activo y Módulo CRM</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-8">
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar empleados por nombre o correo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full py-4 pl-12 pr-4 rounded-2xl border border-slate-700 bg-slate-800 text-white text-base outline-none shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                </div>

                {/* Content: Personal */}
                <div className="flex flex-col gap-8">
                    {Object.keys(groupedStaff).length === 0 && <p className="text-slate-500">No se encontraron resultados.</p>}
                    {Object.entries(groupedStaff).map(([role, usersInRole]) => {
                        const roleUsers = usersInRole as any[];
                        const badge = getRoleBadge(role);

                        return (
                            <div key={role} className="bg-[#0f172a]/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                                <h3 className="flex items-center gap-2 m-0 mb-5 text-white text-lg uppercase font-bold">
                                    <Shield size={20} color={badge.bg} /> {badge.text} <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-sm ml-2">{roleUsers.length}</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {roleUsers.map((user: any) => (
                                        <div key={user.uid} className="flex items-center gap-4 p-4 border border-slate-700/50 rounded-2xl bg-slate-900/40">
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: badge.bg }}>
                                                {user.displayName?.charAt(0).toUpperCase() || <User size={24} />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white">{user.displayName || 'Sin Nombre'}</div>
                                                <div className="text-sm text-slate-400">{user.email}</div>
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
