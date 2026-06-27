"use client";
import { motion } from 'framer-motion';
import { Package, LogOut, PackageCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

/* ─── 3. INVENTORY DASHBOARD ──────────────────────────────────────────────── */
export default function InventoryDashboardWorker({ userName, greeting, products = [], signOut, formatCurrency }: any) {
    const lowStockProducts = products.filter((p: any) => p.stock < 10);
    const lowStockCount    = lowStockProducts.length;

    const totalPieces = products.reduce((acc: number, p: any) => acc + (Number(p.stock) || 0), 0);
    const totalInvestment = products.reduce((acc: number, p: any) => acc + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);

    return (
        <main className="p-8 max-w-5xl mx-auto min-h-screen bg-[#0f111a] text-white">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-6 bg-[#1a1d2d] p-6 rounded-3xl border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-[900] text-rose-500 uppercase tracking-tighter flex items-center gap-2 justify-center sm:justify-start">
                        <Package size={32} /> CENTRAL DE INVENTARIO
                    </h1>
                    <p className="text-gray-400 font-medium text-base mt-1">{greeting}, <b>{userName}</b>. Almacén activo en red local.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/dashboard/inventory" className="bg-[#0ea5e9] hover:bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2">
                        <Package size={16} /> Abrir Inventario
                    </Link>
                    <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={signOut}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-all shadow-md"
                    >
                        <LogOut size={14} /> Cerrar Sesión
                    </motion.button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-gradient-to-br from-rose-500 to-red-700 rounded-3xl p-6 text-white shadow-lg shadow-rose-900/10 flex flex-col justify-between min-h-[140px]">
                    <div>
                        <PackageCheck size={36} className="mb-2 opacity-80" />
                        <h4 className="font-bold text-sm text-rose-100 uppercase tracking-widest">Estantes Físicos</h4>
                        <p className="text-xs text-rose-50">Gestor de productos en carpetas organizadas.</p>
                    </div>
                    <Link href="/dashboard/inventory" className="text-xs font-black uppercase tracking-wider text-white underline mt-4 block">
                        Gestionar Bodega →
                    </Link>
                </div>

                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Alertas de Stock Bajo</h4>
                    <p className={`text-4xl font-black ${lowStockCount > 0 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`}>{lowStockCount}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Productos con menos de 10 piezas.</p>
                </div>

                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Total de Artículos</h4>
                    <p className="text-4xl font-black text-white">{products.length}</p>
                    <p className="text-gray-500 text-[11px] mt-1">{totalPieces} px en stock.</p>
                </div>

                <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                    <h4 className="text-gray-400 font-black uppercase tracking-widest text-[10px] mb-1">Inversión en Inventario</h4>
                    <p className="text-4xl font-black text-emerald-500">{formatCurrency(totalInvestment)}</p>
                    <p className="text-gray-500 text-[11px] mt-1">Valor total estimado de las mercancías.</p>
                </div>
            </div>

            <div className="bg-[#1a1d2d] border border-white/5 rounded-3xl p-6">
                <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-rose-500" /> Productos con Bajo Inventario
                </h3>
                <div className="grid gap-3">
                    {lowStockProducts.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <CheckCircle size={40} className="mx-auto text-emerald-500 mb-2" />
                            <h4 className="font-bold uppercase text-xs tracking-wider">Inventario Óptimo</h4>
                            <p className="text-xs text-gray-500 mt-1">No hay productos con stock menor a 10 unidades.</p>
                        </div>
                    ) : (
                        lowStockProducts.map((p: any) => (
                            <div key={p.id} className="flex justify-between items-center bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20">
                                <div>
                                    <h4 className="font-bold text-white text-sm uppercase">{p.name}</h4>
                                    <p className="text-xs text-gray-400">Categoría: {p.category} | Ubicación: Estante {p.location?.estante || 'N/A'}, Fila {p.location?.fila || 'N/A'}</p>
                                </div>
                                <span className="bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full text-xs font-black">{p.stock} pzas</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}
