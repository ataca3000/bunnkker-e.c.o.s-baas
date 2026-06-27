"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@bunkker/core';
import { Trophy, Medal, Star, ShieldCheck } from 'lucide-react';

interface StaffUser {
    id: string;
    displayName: string;
    role: string;
    kpiScore: number;
}

export default function StaffRankingWidget({ tenantId }: { tenantId: string }) {
    const [staff, setStaff] = useState<StaffUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStaff = async () => {
            if (!tenantId) return;
            try {
                // Obtenemos los usuarios del tenant que no son superadmin (opcionalmente) 
                // pero como kpiScore se actualiza para los roles de staff, ordenamos por kpiScore
                const q = query(
                    collection(db, 'users'),
                    where('tenantId', '==', tenantId),
                    orderBy('kpiScore', 'desc'),
                    limit(10)
                );
                const snapshot = await getDocs(q);
                const usersData = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                    kpiScore: doc.data().kpiScore || 0
                })) as StaffUser[];
                
                // Filtramos a los dueños para ver solo el rendimiento del equipo
                setStaff(usersData.filter(u => u.role !== 'superadmin'));
            } catch (error) {
                console.error("Error al cargar KPIs del personal:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStaff();
    }, [tenantId]);

    if (loading) {
        return <div className="animate-pulse bg-white/5 h-64 rounded-2xl"></div>;
    }

    return (
        <div className="bg-[#1a1d2d] border border-white/5 rounded-2xl p-6 shadow-[0_0_20px_rgba(234,179,8,0.05)] relative overflow-hidden transition-all hover:shadow-[0_0_30px_rgba(234,179,8,0.1)]">
            {/* Decoración */}
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                <div className="bg-yellow-500/20 p-2.5 rounded-xl text-yellow-400">
                    <Trophy size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white tracking-tight">Rendimiento Operativo</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Ranking "Invisible" basado en los KPIs del personal</p>
                </div>
            </div>

            <div className="space-y-4">
                {staff.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">
                        No hay datos de rendimiento registrados aún.
                    </div>
                ) : (
                    staff.map((user, index) => (
                        <motion.div 
                            key={user.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-md
                                    ${index === 0 ? 'bg-yellow-400 text-black shadow-yellow-500/50' : 
                                      index === 1 ? 'bg-slate-300 text-black shadow-slate-400/50' : 
                                      index === 2 ? 'bg-amber-600 text-white shadow-amber-600/50' : 
                                      'bg-white/10 text-gray-400'}`}
                                >
                                    {index === 0 ? <Medal size={16} /> : index + 1}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-200 text-sm">{user.displayName || 'Usuario Desconocido'}</h4>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 uppercase tracking-wider mt-0.5">
                                        <ShieldCheck size={10} /> {user.role}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Star size={14} className={index === 0 ? "text-yellow-400" : "text-gray-600"} />
                                <span className={`font-black font-mono ${index === 0 ? 'text-yellow-400' : 'text-cyan-400'}`}>
                                    {user.kpiScore.toLocaleString()} pts
                                </span>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
