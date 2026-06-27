"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Download, Package } from 'lucide-react';

export default function RestockAlertWidget({ products, formatCurrency }: { products: any[], formatCurrency: (val: number) => string }) {
    // Filtrar productos con stock menor a 20
    const lowStockProducts = products.filter(p => Number(p.stock) < 20).sort((a, b) => Number(a.stock) - Number(b.stock));

    const exportToCSV = () => {
        const headers = ['SKU', 'Nombre', 'Stock Actual', 'Costo Unitario', 'Valor Faltante (aprox)'];
        const rows = lowStockProducts.map(p => {
            const stock = Number(p.stock) || 0;
            const price = Number(p.price) || 0;
            // Cálculo estimado para llegar a 50 unidades
            const toOrder = Math.max(0, 50 - stock);
            const costToOrder = toOrder * price;
            
            return [
                p.sku || p.barcode || 'N/A',
                `"${p.name}"`,
                stock.toString(),
                price.toFixed(2),
                costToOrder.toFixed(2)
            ];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Alerta_Reabastecimiento_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-[#1a1d2d] border border-red-500/20 rounded-2xl p-6 shadow-[0_0_20px_rgba(239,68,68,0.05)] relative overflow-hidden transition-all hover:shadow-[0_0_30px_rgba(239,68,68,0.1)]">
            <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-red-500/20 p-2.5 rounded-xl text-red-500 animate-pulse">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                            Alerta de Reabastecimiento
                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {lowStockProducts.length} críticos
                            </span>
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">Productos con menos de 20 unidades en piso</p>
                    </div>
                </div>
                {lowStockProducts.length > 0 && (
                    <button 
                        onClick={exportToCSV}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold py-2 px-4 rounded-xl transition-colors"
                    >
                        <Download size={16} /> Exportar
                    </button>
                )}
            </div>

            <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {lowStockProducts.length === 0 ? (
                    <div className="text-center py-8 text-emerald-400 flex flex-col items-center gap-3">
                        <Package size={32} className="opacity-50" />
                        <span className="font-bold text-sm">Inventario Saludable</span>
                        <span className="text-xs text-gray-400">Todos los productos tienen más de 20 unidades.</span>
                    </div>
                ) : (
                    lowStockProducts.map((p, i) => (
                        <motion.div 
                            key={p.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/30 transition-colors"
                        >
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-200 text-sm truncate max-w-[200px]">{p.name}</span>
                                <span className="text-[10px] text-gray-500 uppercase">{p.sku || p.barcode || 'Sin SKU'}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`font-black text-lg leading-tight ${Number(p.stock) <= 5 ? 'text-red-500' : 'text-orange-400'}`}>
                                    {p.stock} <span className="text-xs font-normal text-gray-500">pz</span>
                                </span>
                                <span className="text-[10px] text-gray-400">P.V: {formatCurrency(p.price)}</span>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
