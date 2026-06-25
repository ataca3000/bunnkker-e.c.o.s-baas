"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, ChevronRight, User } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import dynamic from 'next/dynamic';

const ClientCRMModal = dynamic(() => import('@/components/admin/ClientCRMModal'), { ssr: false });

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
        <div className="bg-[#0f172a] min-h-screen text-slate-200">
            <div className="max-w-[1200px] mx-auto p-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-white m-0 tracking-tight">CRM DE CLIENTES</h1>
                        <p className="text-slate-400 mt-1">Historial, Quejas, Soporte y Base de Datos</p>
                    </div>
                </div>

                <div className="relative mb-8">
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar clientes por nombre o correo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full py-4 pl-12 pr-4 rounded-2xl border border-slate-700 bg-slate-800 text-white text-base outline-none shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredClients.length === 0 && (
                        <div className="col-span-full p-8 text-center text-slate-500">
                            <User size={48} className="mx-auto mb-3 text-slate-600" />
                            <p>No se encontraron clientes.</p>
                            <small>Los usuarios que se registran desde la tienda online aparecerán aquí.</small>
                        </div>
                    )}
                    {filteredClients.map(user => (
                        <motion.div 
                            key={user.uid}
                            whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}
                            onClick={() => setSelectedClient(user)}
                            className="bg-slate-800 rounded-3xl p-6 border border-slate-700 cursor-pointer flex justify-between items-center transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400">
                                    <Users size={28} />
                                </div>
                                <div>
                                    <div className="font-bold text-lg text-white">{user.displayName || 'Cliente Anónimo'}</div>
                                    <div className="text-sm text-slate-400">{user.email}</div>
                                    <div className="text-xs text-sky-400 mt-1 font-bold">VER CRM E HISTORIAL</div>
                                </div>
                            </div>
                            <ChevronRight size={24} className="text-slate-500" />
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
