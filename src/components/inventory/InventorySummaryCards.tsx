"use client";

import { AlertTriangle, DollarSign, Package } from 'lucide-react';
import type { InventorySummary } from '@/lib/inventoryMetrics';

interface InventorySummaryCardsProps {
    summary: InventorySummary;
    totalAlerts: number;
    criticalCount: number;
    lowStockCount: number;
    formatCurrency: (amount: number) => string;
}

export default function InventorySummaryCards({
    summary,
    totalAlerts,
    criticalCount,
    lowStockCount,
    formatCurrency,
}: InventorySummaryCardsProps) {
    return (
        <section
            aria-label="Resumen de Inventario"
            data-testid="inventory-summary-cards"
            className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5"
        >
            <article
                data-testid="total-product-value-card"
                className="bg-slate-900/75 backdrop-blur-md border border-emerald-500/35 rounded-xl px-4 py-3.5 shadow-lg flex flex-col justify-between"
            >
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold text-slate-300 tracking-wide">
                        Total Product Value
                    </h2>
                    <DollarSign size={16} className="text-emerald-400 shrink-0" aria-hidden="true" />
                </div>
                <p
                    data-testid="total-product-value-amount"
                    className="text-2xl sm:text-[26px] font-black font-mono tabular-nums text-emerald-400 tracking-tight mt-1.5"
                >
                    {formatCurrency(summary.totalProductValue)}
                </p>
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5 tabular-nums">
                    <span>{summary.productCount.toLocaleString('es-MX')} productos</span>
                    <span aria-hidden="true">·</span>
                    <span>{summary.totalUnits.toLocaleString('es-MX')} unidades totales</span>
                </p>
            </article>

            <article
                data-testid="inventory-product-count-card"
                className="bg-slate-900/70 backdrop-blur-md border border-slate-700/70 rounded-xl px-4 py-3.5 shadow-lg flex flex-col justify-between"
            >
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold text-slate-300 tracking-wide">
                        Productos en Catálogo
                    </h2>
                    <Package size={16} className="text-cyan-400 shrink-0" aria-hidden="true" />
                </div>
                <p className="text-2xl sm:text-[26px] font-black font-mono tabular-nums text-white tracking-tight mt-1.5">
                    {summary.productCount.toLocaleString('es-MX')}
                </p>
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5 tabular-nums">
                    <span>{summary.inStockCount.toLocaleString('es-MX')} disponibles</span>
                    <span aria-hidden="true">·</span>
                    <span>{summary.outOfStockCount.toLocaleString('es-MX')} agotados</span>
                </p>
            </article>

            <article
                data-testid="inventory-alerts-card"
                className="bg-slate-900/70 backdrop-blur-md border border-slate-700/70 rounded-xl px-4 py-3.5 shadow-lg flex flex-col justify-between"
            >
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold text-slate-300 tracking-wide">
                        Alertas de Stock
                    </h2>
                    <AlertTriangle
                        size={16}
                        className={totalAlerts > 0 ? 'text-amber-400 shrink-0' : 'text-cyan-400 shrink-0'}
                        aria-hidden="true"
                    />
                </div>
                <p
                    className={`text-2xl sm:text-[26px] font-black font-mono tabular-nums tracking-tight mt-1.5 ${
                        totalAlerts > 0 ? 'text-amber-400' : 'text-cyan-400'
                    }`}
                >
                    {totalAlerts.toLocaleString('es-MX')}
                </p>
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5 tabular-nums">
                    <span>{criticalCount.toLocaleString('es-MX')} agotados</span>
                    <span aria-hidden="true">·</span>
                    <span>{lowStockCount.toLocaleString('es-MX')} bajo umbral</span>
                </p>
            </article>
        </section>
    );
}
