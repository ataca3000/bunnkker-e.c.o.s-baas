"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, AlertTriangle, CheckCircle, Search, Calendar, ChevronLeft, User, DollarSign } from 'lucide-react';
import Link from 'next/link';

interface CashRegisterLog {
    id: string;
    cashierName: string;
    declaredAmount: number;
    expectedAmount: number;
    discrepancy: number;
    createdAt: string;
}

export default function CashRegistersAuditPage() {
    const [logs, setLogs] = useState<CashRegisterLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetch('/api/reports/cash-registers')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setLogs(data.data);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filteredLogs = logs.filter(log => 
        log.cashierName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#0f111a] p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                    <div>
                        <Link href="/dashboard/reports" className="flex items-center gap-2 text-sky-400 hover:text-sky-300 font-bold mb-2 text-sm transition-colors">
                            <ChevronLeft size={16} /> Volver a Reportes
                        </Link>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                            <Calculator size={32} className="text-rose-500" />
                            Auditoría de Cortes de Caja
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Historial inmutable de cortes ciegos. Detecta faltantes y monitorea el rendimiento de tus cajeros.
                        </p>
                    </div>

                    <div className="relative w-full md:w-72">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Buscar cajero..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-rose-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                        <p className="font-bold">Cargando bitácora de auditoría...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="py-20 text-center bg-white/5 rounded-3xl border border-white/5">
                        <Calculator size={48} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Sin Registros</h3>
                        <p className="text-slate-400">No hay cortes de caja registrados que coincidan con la búsqueda.</p>
                    </div>
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-widest border-b border-slate-800">
                                        <th className="p-4 font-bold">Fecha / Hora</th>
                                        <th className="p-4 font-bold">Cajero</th>
                                        <th className="p-4 font-bold text-right">Efectivo Físico</th>
                                        <th className="p-4 font-bold text-right">Efectivo Sistema</th>
                                        <th className="p-4 font-bold text-right">Descuadre</th>
                                        <th className="p-4 font-bold text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map((log) => {
                                        const isMismatch = log.discrepancy < 0;
                                        const date = new Date(log.createdAt);
                                        
                                        return (
                                            <motion.tr 
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                key={log.id} 
                                                className="border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors"
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                                                        <Calendar size={14} className="text-slate-500"/> 
                                                        {date.toLocaleDateString('es-MX')}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5 ml-6">
                                                        {date.toLocaleTimeString('es-MX')}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2 text-white font-bold">
                                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                                            <User size={14} className="text-sky-400" />
                                                        </div>
                                                        {log.cashierName}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-bold text-slate-200">${log.declaredAmount.toFixed(2)}</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-mono text-slate-500">${log.expectedAmount.toFixed(2)}</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className={`inline-flex items-center gap-1 font-black px-2 py-1 rounded-lg ${isMismatch ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'text-slate-400'}`}>
                                                        {log.discrepancy < 0 ? '-' : (log.discrepancy > 0 ? '+' : '')}${Math.abs(log.discrepancy).toFixed(2)}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {isMismatch ? (
                                                        <div className="inline-flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                                                            <AlertTriangle size={12} /> FALTANTE
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                                            <CheckCircle size={12} /> OK
                                                        </div>
                                                    )}
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
