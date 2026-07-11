
"use client";
import { motion } from 'framer-motion';
import { LogOut, ScanLine, ChevronRight, Clock, AlertTriangle, Users } from 'lucide-react';
import Link from 'next/link';

/* ─── 2. SALES DASHBOARD ──────────────────────────────────────────────────── */
export default function SalesDashboardWorker({ userName, greeting, formatCurrency, orders = [], signOut }: any) {
    const mySales = orders
        .filter((o: any) => o.status === 'paid' && new Date(o.date).toDateString() === new Date().toDateString())
        .reduce((sum: number, o: any) => sum + o.total, 0);

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-[#0ea5e9] uppercase tracking-tighter">ESTACIÓN DE CAJA</h1>
                    <p className="text-gray-400 font-medium text-base mt-1">{greeting}, <b className="text-white">{userName}</b>. Buen turno.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={signOut}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                >
                    <LogOut size={14} /> Cerrar Sesión
                </motion.button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <Link href="/dashboard/sales">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-8 text-white shadow-xl shadow-emerald-900/20 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <ScanLine size={48} className="mb-6 opacity-80" />
                            <h2 className="text-3xl font-black mb-2">PUNTO DE VENTA</h2>
                            <p className="text-emerald-100 text-sm font-medium">Abrir escáner, cobrar tickets y procesar carritos de clientes.</p>
                        </div>
                        <div className="mt-8 flex items-center font-bold uppercase tracking-widest text-sm">
                            Comenzar a Escanear <ChevronRight className="ml-2" />
                        </div>
                    </motion.div>
                </Link>

                <div className="bg-[#1a1d2d] border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.05)] rounded-3xl p-8 flex flex-col justify-center">
                    <h3 className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs mb-2 flex items-center gap-2">
                        <Clock size={16} /> Ventas de mi Turno (Hoy)
                    </h3>
                    <p className="text-5xl font-black text-white mb-6">{formatCurrency(mySales)}</p>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex gap-4">
                        <AlertTriangle className="text-yellow-400 shrink-0" />
                        <p className="text-yellow-100 text-sm font-medium">Recuerda hacer el <b>Corte de Caja Ciego</b> antes de retirarte e imprimir el ticket de cierre para tu supervisor.</p>
                    </div>
                </div>
            </div>

            <div className="bg-[#1a1d2d] border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.05)] rounded-3xl p-8">
                <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2">
                    <Users className="text-emerald-500" /> Tareas Rápidas
                </h3>
                <div className="grid grid-cols-1 gap-4">
                    <Link href="/dashboard/crm" className="bg-slate-800/80/5 p-4 rounded-2xl border border-white/10 font-bold text-gray-300 hover:border-[#0ea5e9] hover:text-[#0ea5e9] transition-all flex items-center gap-3 active:scale-95">
                        <Users size={20} /> Registrar Cliente
                    </Link>
                </div>
            </div>
        </main>
    );
};


