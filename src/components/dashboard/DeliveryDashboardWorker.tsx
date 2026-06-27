
"use client";
import { motion } from 'framer-motion';
import { LogOut, Route, ChevronRight, Truck, MapPin } from 'lucide-react';
import Link from 'next/link';

/* ─── 4. DELIVERY DASHBOARD ───────────────────────────────────────────────── */
export default function DeliveryDashboardWorker({ userName, greeting, orders = [], signOut }: any) {
    const pendingDeliveries = orders.filter((o: any) => o.status === 'processing' || o.status === 'shipping' || o.status === 'ready_for_delivery');

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-blue-500 uppercase tracking-tighter">RUTA Y ENTREGAS</h1>
                    <p className="text-gray-400 font-medium text-lg mt-1">{greeting}, <b>{userName}</b>. Conduce con cuidado.</p>
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
                <Link href="/dashboard/delivery">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-gradient-to-br from-blue-500 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-900/20 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <Route size={48} className="mb-6 opacity-80" />
                            <h2 className="text-3xl font-black mb-2">MAPA DE ENTREGAS</h2>
                            <p className="text-blue-100 text-sm font-medium">Ver rutas pendientes, escanear paquetes cargados y marcar como entregados.</p>
                        </div>
                        <div className="mt-8 flex items-center font-bold uppercase tracking-widest text-sm">
                            Iniciar Ruta <ChevronRight className="ml-2" />
                        </div>
                    </motion.div>
                </Link>

                <div className="bg-slate-800/80 rounded-3xl p-8 border border-slate-700/50 shadow-lg flex flex-col justify-center">
                    <h3 className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs mb-2 flex items-center gap-2">
                        <Truck size={16} className="text-blue-500" /> Entregas Pendientes Hoy
                    </h3>
                    <p className="text-5xl font-black text-white mb-6">{pendingDeliveries.length}</p>
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4">
                        <MapPin className="text-blue-500 shrink-0" />
                        <p className="text-blue-800 text-sm font-medium">Asegúrate de llevar contigo los remitos impresos o recolectar firma digital en la app de entregas.</p>
                    </div>
                </div>
            </div>
        </main>
    );
};


