"use client";

import { useState } from 'react';
import { ShieldAlert, ServerCrash, ChevronLeft, Zap, RefreshCw, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import ConcurrencyInstructivo from '@/components/dashboard/tests/ConcurrencyInstructivo';
import LoadTestVisualizer from '@/components/dashboard/tests/LoadTestVisualizer';
import { motion, AnimatePresence } from 'framer-motion';

export default function TestsDashboard() {
    const [activeTab, setActiveTab] = useState<'concurrency' | 'load'>('concurrency');
    const [isCleaning, setIsCleaning] = useState(false);
    const [cleanLog, setCleanLog] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    // Limpieza de Datos
    const cleanTestData = async () => {
        setIsCleaning(true);
        setCleanLog(null);
        try {
            const res = await fetch('/api/tests/cleanup', { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setCleanLog({ message: `Limpieza completada. Pedidos eliminados: ${data.count}`, type: 'success' });
            } else {
                setCleanLog({ message: `Error en limpieza: ${data.error}`, type: 'error' });
            }
        } catch (error: any) {
            setCleanLog({ message: `Fallo de conexión al limpiar: ${error.message}`, type: 'error' });
        }
        setIsCleaning(false);
        setTimeout(() => setCleanLog(null), 5000);
    };

    return (
        <main className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-[#0f172a] text-white font-sans">
            <header className="mb-8 border-b border-white/10 pb-6">
                <Link href="/dashboard" className="text-slate-500 hover:text-white flex items-center gap-2 mb-4 transition-colors w-fit font-bold text-sm">
                    <ChevronLeft size={16} /> Volver al Panel Maestro
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-500/20 text-red-500 p-4 rounded-2xl border border-red-500/30">
                            <ServerCrash size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-white mb-1">Laboratorio de Estrés</h1>
                            <p className="text-slate-400 text-sm">Chaos Engineering & Pruebas de Carga Locales</p>
                        </div>
                    </div>

                    <button 
                        onClick={cleanTestData} disabled={isCleaning}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-red-900/40 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/50 py-2 px-4 rounded-xl transition-all text-sm font-bold"
                    >
                        <Trash2 size={16} /> {isCleaning ? "Limpiando..." : "Limpiar Datos Basura"}
                    </button>
                </div>
                
                <AnimatePresence>
                    {cleanLog && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm font-bold border ${cleanLog.type === 'success' ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-red-900/20 border-red-500/30 text-red-400'}`}
                        >
                            {cleanLog.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                            {cleanLog.message}
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* Pestañas (Tabs) */}
            <div className="flex bg-slate-900/50 p-1 rounded-2xl gap-2 mb-8 border border-slate-800 w-fit">
                <button
                    onClick={() => setActiveTab('concurrency')}
                    className={`flex items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
                        activeTab === 'concurrency'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <Zap size={18} /> Instructivo: Concurrencia
                </button>
                <button
                    onClick={() => setActiveTab('load')}
                    className={`flex items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
                        activeTab === 'load'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <RefreshCw size={18} /> Visual: Avalancha de Carga
                </button>
            </div>

            {/* Contenido Dinámico */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'concurrency' ? <ConcurrencyInstructivo /> : <LoadTestVisualizer />}
                </motion.div>
            </AnimatePresence>
        </main>
    );
}
