
"use client";
import { motion } from 'framer-motion';
import { Share2, LogOut, Palette, ChevronRight, QrCode, TrendingUp } from 'lucide-react';
import Link from 'next/link';

/* ─── 3.8. MARKETING DASHBOARD ────────────────────────────────────────────── */
export default function MarketingDashboardWorker({ userName, greeting, orders = [], signOut, formatCurrency }: any) {
    const totalSales = orders.filter((o: any) => o.status === 'paid').reduce((sum: number, o: any) => sum + o.total, 0);

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-purple-500 uppercase tracking-tighter flex items-center gap-2 justify-center sm:justify-start">
                        <Share2 size={32} /> PORTAL DE MARKETING Y DISEÑO
                    </h1>
                    <p className="text-gray-400 font-medium text-base mt-1">{greeting}, <b>{userName}</b>. Editor y Publicidad de la Tienda.</p>
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
                <Link href="/dashboard/design">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-gradient-to-br from-indigo-500 to-purple-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-900/20 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <Palette size={48} className="mb-6 opacity-80" />
                            <h2 className="text-3xl font-black mb-2 uppercase">Canvas de la Tienda</h2>
                            <p className="text-indigo-100 text-sm font-medium">Edita la apariencia de la tienda, colores de botones, fondos, textos y reubica elementos en el catálogo.</p>
                        </div>
                        <div className="mt-8 flex items-center font-bold uppercase tracking-widest text-sm">
                            Abrir Editor Canvas <ChevronRight className="ml-2" />
                        </div>
                    </motion.div>
                </Link>

                <Link href="/dashboard/marketing">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl p-8 text-white shadow-xl shadow-purple-900/20 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <QrCode size={48} className="mb-6 opacity-80" />
                            <h2 className="text-3xl font-black mb-2 uppercase">Campañas y Códigos QR</h2>
                            <p className="text-purple-100 text-sm font-medium">Genera flyers y fichas de precios con códigos QR únicos para que los clientes compren directamente.</p>
                        </div>
                        <div className="mt-8 flex items-center font-bold uppercase tracking-widest text-sm">
                            Ver Herramientas QR <ChevronRight className="ml-2" />
                        </div>
                    </motion.div>
                </Link>
            </div>

            <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-8">
                <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="text-purple-500" /> Impacto de Campañas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-[#0f111a] p-6 rounded-2xl border border-white/5">
                        <h4 className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Ventas Totales</h4>
                        <p className="text-2xl font-black text-white">{formatCurrency(totalSales)}</p>
                    </div>
                    <div className="bg-[#0f111a] p-6 rounded-2xl border border-white/5">
                        <h4 className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Escaneos QR Recientes</h4>
                        <p className="text-2xl font-black text-purple-400">142</p>
                    </div>
                    <div className="bg-[#0f111a] p-6 rounded-2xl border border-white/5">
                        <h4 className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Conversión de Diseño</h4>
                        <p className="text-2xl font-black text-emerald-500">4.8%</p>
                    </div>
                </div>
            </div>
        </main>
    );
};


