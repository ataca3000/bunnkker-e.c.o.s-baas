"use client";

import { useState, useMemo } from 'react';
import type { Product } from '@/context/CartContext';
import { 
    FileSpreadsheet, CheckCircle2, AlertTriangle, TrendingDown, TrendingUp, 
    RefreshCw, Zap, Shield, Search, Filter, Package, MapPin, Edit3, Trash2, ArrowRight
} from 'lucide-react';
import { exportToExcel } from '@/lib/excelExport';
import { toast } from '@/lib/toast';

interface AuditDifferencesTableProps {
    products: Product[];
    auditCounts: Record<string, number | null>;
    onUpdateCount: (productId: string, count: number | null) => void;
    onResetAudit: () => void;
    onFillTheoretical: () => void;
    onApplySingleAdjustment: (productId: string, auditedStock: number) => Promise<void>;
    onApplyAllAdjustments: (adjustments: Array<{ productId: string; auditedStock: number }>) => Promise<void>;
    onReportShrinkage: (productId: string, missingQty: number) => void;
    isReadOnly?: boolean;
    profile?: any;
    formatCurrency: (val: number) => string;
    allEstantes: string[];
}

export default function AuditDifferencesTable({
    products,
    auditCounts,
    onUpdateCount,
    onResetAudit,
    onFillTheoretical,
    onApplySingleAdjustment,
    onApplyAllAdjustments,
    onReportShrinkage,
    isReadOnly,
    profile,
    formatCurrency,
    allEstantes,
}: AuditDifferencesTableProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEstante, setSelectedEstante] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'discrepancy' | 'missing' | 'surplus' | 'match' | 'pending'>('discrepancy');
    const [isApplyingAll, setIsApplyingAll] = useState(false);
    const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

    // Calcular diferencias para cada producto
    const auditData = useMemo(() => {
        return products.map(p => {
            const theoretical = p.stock || 0;
            const audited = auditCounts[p.id]; // number or null/undefined
            const isAudited = audited !== undefined && audited !== null;
            const auditedQty = isAudited ? audited : 0;
            const diff = isAudited ? (auditedQty - theoretical) : 0;
            const diffValue = diff * (p.price || 0);

            let status: 'pending' | 'match' | 'missing' | 'surplus' = 'pending';
            if (isAudited) {
                if (diff < 0) status = 'missing';
                else if (diff > 0) status = 'surplus';
                else status = 'match';
            }

            const estante = (p.location?.estante || p.estante || 'SIN ASIGNAR').toUpperCase().trim();
            const fila = p.location?.fila || p.fila || 'N/A';

            return {
                product: p,
                id: p.id,
                name: p.name,
                barcode: p.barcode || 'N/A',
                estante,
                fila,
                price: p.price || 0,
                unitType: p.unitType || 'PZA',
                theoretical,
                auditedQty: isAudited ? auditedQty : null,
                isAudited,
                diff,
                diffValue,
                status
            };
        });
    }, [products, auditCounts]);

    // Resumen estadístico KPIs
    const stats = useMemo(() => {
        let totalItems = auditData.length;
        let totalAudited = 0;
        let totalDiscrepancies = 0;
        let totalMissingValue = 0;
        let totalSurplusValue = 0;
        let totalMissingQty = 0;
        let totalSurplusQty = 0;

        auditData.forEach(item => {
            if (item.isAudited) {
                totalAudited++;
                if (item.diff !== 0) {
                    totalDiscrepancies++;
                    if (item.diff < 0) {
                        totalMissingQty += Math.abs(item.diff);
                        totalMissingValue += Math.abs(item.diffValue);
                    } else {
                        totalSurplusQty += item.diff;
                        totalSurplusValue += item.diffValue;
                    }
                }
            }
        });

        const netDifferenceValue = totalSurplusValue - totalMissingValue;

        return {
            totalItems,
            totalAudited,
            totalDiscrepancies,
            totalMissingQty,
            totalSurplusQty,
            totalMissingValue,
            totalSurplusValue,
            netDifferenceValue
        };
    }, [auditData]);

    // Filtrar datos para la tabla
    const filteredData = useMemo(() => {
        return auditData.filter(item => {
            // Filtro por término de búsqueda
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchName = item.name.toLowerCase().includes(term);
                const matchCode = item.barcode.toLowerCase().includes(term);
                const matchEstante = item.estante.toLowerCase().includes(term);
                if (!matchName && !matchCode && !matchEstante) return false;
            }

            // Filtro por Estante
            if (selectedEstante !== 'all') {
                if (item.estante !== selectedEstante) return false;
            }

            // Filtro por Estado
            if (selectedStatus === 'discrepancy') {
                return item.isAudited && item.diff !== 0;
            } else if (selectedStatus === 'missing') {
                return item.isAudited && item.diff < 0;
            } else if (selectedStatus === 'surplus') {
                return item.isAudited && item.diff > 0;
            } else if (selectedStatus === 'match') {
                return item.isAudited && item.diff === 0;
            } else if (selectedStatus === 'pending') {
                return !item.isAudited;
            }

            return true;
        });
    }, [auditData, searchTerm, selectedEstante, selectedStatus]);

    // Exportar tabla a Excel
    const handleExportAuditExcel = () => {
        const rows = filteredData.map(item => ({
            'Código / Barcode': item.barcode,
            'Producto': item.name,
            'Estante / Ubicación': `${item.estante} (${item.fila})`,
            'Stock Teórico (Sistema)': item.theoretical,
            'Stock Auditado (Físico)': item.isAudited ? item.auditedQty : 'PENDIENTE',
            'Diferencia (Piezas)': item.isAudited ? item.diff : 'N/A',
            'Precio Unitario ($)': item.price,
            'Valor Diferencia ($)': item.isAudited ? item.diffValue : 'N/A',
            'Estado': item.isAudited 
                ? (item.status === 'missing' ? 'FALTANTE' : item.status === 'surplus' ? 'SOBRANTE' : 'CORRECTO') 
                : 'PENDIENTE DE CONTEO'
        }));

        exportToExcel(`Auditoria_Diferencias_Stock_${new Date().toISOString().split('T')[0]}`, rows);
        toast.success('Reporte de Auditoría descargado con éxito', '📊 Excel Generado');
    };

    // Aplicar todos los ajustes
    const handleApplyAllWithConfirm = async () => {
        const itemsToAdjust = auditData.filter(i => i.isAudited && i.diff !== 0);
        if (itemsToAdjust.length === 0) {
            toast.info('No hay discrepancias pendientes para ajustar.');
            return;
        }

        if (confirm(`¿Confirmas aplicar ${itemsToAdjust.length} ajustes de stock en el sistema para coincidir con la auditoría física real?`)) {
            setIsApplyingAll(true);
            try {
                const adjustments = itemsToAdjust.map(i => ({
                    productId: i.id,
                    auditedStock: i.auditedQty!
                }));
                await onApplyAllAdjustments(adjustments);
            } finally {
                setIsApplyingAll(false);
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Header explicativo */}
            <div className="bg-slate-900/80 border border-cyan-500/30 p-6 rounded-2xl shadow-xl backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="bg-cyan-950/80 p-2.5 rounded-xl border border-cyan-500/40 text-cyan-400">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">
                                Auditoría de Stock en Tiempo Real
                            </h2>
                            <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                Comparación de Conteo Físico vs. Stock Teórico Registrado
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acciones Rápidas Bóveda */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={onFillTheoretical}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2"
                        title="Inicia la auditoría pre-llenando los valores teóricos actuales para acelerar revisiones rápidas"
                    >
                        <RefreshCw size={14} className="text-cyan-400" /> Pre-llenar Teóricos
                    </button>

                    <button
                        onClick={onResetAudit}
                        className="bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2"
                    >
                        <Trash2 size={14} /> Reiniciar Auditoría
                    </button>

                    <button
                        onClick={handleExportAuditExcel}
                        className="bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/30"
                    >
                        <FileSpreadsheet size={16} /> Exportar Reporte (.xlsx)
                    </button>
                </div>
            </div>

            {/* Tarjetas KPI de Auditoría */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <span>Avance de Conteo</span>
                        <Package size={18} className="text-cyan-400" />
                    </div>
                    <div className="text-2xl font-black text-white">
                        {stats.totalAudited} / {stats.totalItems} <span className="text-xs font-bold text-slate-400">ítems</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                        <div 
                            className="bg-cyan-500 h-full transition-all duration-500" 
                            style={{ width: `${stats.totalItems > 0 ? (stats.totalAudited / stats.totalItems) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <span>Discrepancias Totales</span>
                        <AlertTriangle size={18} className="text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-amber-400">
                        {stats.totalDiscrepancies} <span className="text-xs font-bold text-slate-400">productos</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 font-medium">
                        {stats.totalMissingQty} faltantes / {stats.totalSurplusQty} sobrantes
                    </p>
                </div>

                <div className="bg-slate-900/60 border border-rose-900/40 p-5 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <span>Pérdida por Faltante</span>
                        <TrendingDown size={18} />
                    </div>
                    <div className="text-2xl font-black text-rose-400">
                        -{formatCurrency(stats.totalMissingValue)}
                    </div>
                    <p className="text-[11px] text-rose-300/70 mt-2 font-medium">
                        Valor total de unidades no encontradas
                    </p>
                </div>

                <div className="bg-slate-900/60 border border-emerald-900/40 p-5 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <span>Impacto Neto Bóveda</span>
                        <Zap size={18} />
                    </div>
                    <div className={`text-2xl font-black ${stats.netDifferenceValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stats.netDifferenceValue >= 0 ? '+' : ''}{formatCurrency(stats.netDifferenceValue)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 font-medium">
                        Sobrantes: +{formatCurrency(stats.totalSurplusValue)}
                    </p>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex-1 relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Filtrar por nombre, barcode o estante..."
                        className="w-full bg-slate-950 border border-slate-800 pl-11 pr-4 py-2.5 rounded-xl text-xs font-medium text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-all"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Filtro Estante */}
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                        <MapPin size={14} className="text-cyan-400" />
                        <select
                            value={selectedEstante}
                            onChange={(e) => setSelectedEstante(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-300 outline-none uppercase cursor-pointer"
                        >
                            <option value="all">🎯 Todos los Estantes</option>
                            {allEstantes.map(e => (
                                <option key={e} value={e}>Estante: {e}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Estado */}
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                        <Filter size={14} className="text-cyan-400" />
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value as any)}
                            className="bg-transparent text-xs font-bold text-slate-300 outline-none uppercase cursor-pointer"
                        >
                            <option value="discrepancy">⚠️ Discrepancias ({stats.totalDiscrepancies})</option>
                            <option value="all">📋 Todos los Productos ({stats.totalItems})</option>
                            <option value="missing">🔴 Solo Faltantes</option>
                            <option value="surplus">🟡 Solo Sobrantes</option>
                            <option value="match">🟢 Sin Diferencia (Coincidentes)</option>
                            <option value="pending">⚪ Pendientes de Conteo</option>
                        </select>
                    </div>

                    {/* Botón Aplicar Todos los Ajustes */}
                    {stats.totalDiscrepancies > 0 && (
                        <button
                            onClick={handleApplyAllWithConfirm}
                            disabled={isApplyingAll || isReadOnly}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-600/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            <Zap size={14} /> {isApplyingAll ? 'Aplicando...' : `Ajustar Todos (${stats.totalDiscrepancies})`}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabla Principal de Diferencias */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-950/80 text-slate-400 font-black uppercase tracking-wider border-b border-slate-800">
                                <th className="p-4">Producto & Código</th>
                                <th className="p-4">Ubicación</th>
                                <th className="p-4 text-center">Stock Teórico</th>
                                <th className="p-4 text-center">Stock Auditado (Físico)</th>
                                <th className="p-4 text-center">Diferencia (Piezas)</th>
                                <th className="p-4 text-right">Impacto Financiero</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4 text-right">Resolución Pronta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-400">
                                        <div className="max-w-md mx-auto space-y-2">
                                            <CheckCircle2 size={40} className="text-emerald-400 mx-auto opacity-80" />
                                            <p className="font-bold text-white text-sm uppercase">Sin discrepancias bajo los filtros seleccionados</p>
                                            <p className="text-xs text-slate-500">
                                                No se encontraron diferencias de stock con los criterios actuales. Puedes cambiar el filtro de estado a "Todos los Productos" para revisar todo el catálogo.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map(item => {
                                    const isLoading = loadingProductId === item.id;
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                                            {/* Producto */}
                                            <td className="p-4">
                                                <div className="font-bold text-white uppercase">{item.name}</div>
                                                <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
                                                    Barcode: {item.barcode}
                                                </div>
                                            </td>

                                            {/* Ubicación */}
                                            <td className="p-4">
                                                <span className="bg-slate-800 text-slate-300 font-bold text-[10px] uppercase px-2 py-1 rounded-md border border-slate-700 inline-block">
                                                    📍 {item.estante} ({item.fila})
                                                </span>
                                            </td>

                                            {/* Stock Teórico */}
                                            <td className="p-4 text-center font-bold text-slate-300">
                                                {item.theoretical} {item.unitType}
                                            </td>

                                            {/* Stock Auditado (Input Editable) */}
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={item.isAudited ? item.auditedQty! : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            onUpdateCount(item.id, val === '' ? null : parseFloat(val));
                                                        }}
                                                        placeholder="N/A"
                                                        className={`w-24 text-center font-black text-sm px-2 py-1.5 rounded-lg border outline-none transition-all ${
                                                            item.isAudited
                                                                ? (item.diff === 0 
                                                                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 focus:ring-2 focus:ring-emerald-500' 
                                                                    : (item.diff < 0 
                                                                        ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 focus:ring-2 focus:ring-rose-500' 
                                                                        : 'bg-amber-950/40 border-amber-500/50 text-amber-300 focus:ring-2 focus:ring-amber-500'))
                                                                : 'bg-slate-950 border-slate-800 text-slate-500 focus:border-cyan-500'
                                                        }`}
                                                    />
                                                    <span className="text-[10px] text-slate-500 font-bold">{item.unitType}</span>
                                                </div>
                                            </td>

                                            {/* Diferencia Cantidad */}
                                            <td className="p-4 text-center font-black">
                                                {!item.isAudited ? (
                                                    <span className="text-slate-500 font-mono">-</span>
                                                ) : item.diff === 0 ? (
                                                    <span className="text-emerald-400">0 PZA</span>
                                                ) : item.diff < 0 ? (
                                                    <span className="text-rose-400">{item.diff} PZA</span>
                                                ) : (
                                                    <span className="text-amber-400">+{item.diff} PZA</span>
                                                )}
                                            </td>

                                            {/* Impacto Financiero */}
                                            <td className="p-4 text-right font-black">
                                                {!item.isAudited ? (
                                                    <span className="text-slate-500 font-mono">-</span>
                                                ) : item.diff === 0 ? (
                                                    <span className="text-emerald-400/80">$0.00</span>
                                                ) : item.diff < 0 ? (
                                                    <span className="text-rose-400">-{formatCurrency(Math.abs(item.diffValue))}</span>
                                                ) : (
                                                    <span className="text-amber-400">+{formatCurrency(item.diffValue)}</span>
                                                )}
                                            </td>

                                            {/* Estado Badge */}
                                            <td className="p-4 text-center">
                                                {!item.isAudited ? (
                                                    <span className="bg-slate-800 text-slate-400 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border border-slate-700">
                                                        ⚪ Pendiente
                                                    </span>
                                                ) : item.diff === 0 ? (
                                                    <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full">
                                                        ✅ Correcto
                                                    </span>
                                                ) : item.diff < 0 ? (
                                                    <span className="bg-rose-950/80 text-rose-300 border border-rose-500/40 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full animate-pulse">
                                                        🚨 Faltante
                                                    </span>
                                                ) : (
                                                    <span className="bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full">
                                                        🟡 Sobrante
                                                    </span>
                                                )}
                                            </td>

                                            {/* Acciones de Resolución Pronta */}
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {item.isAudited && item.diff !== 0 && (
                                                        <>
                                                            {/* Ajustar Stock directamente */}
                                                            <button
                                                                onClick={async () => {
                                                                    setLoadingProductId(item.id);
                                                                    try {
                                                                        await onApplySingleAdjustment(item.id, item.auditedQty!);
                                                                    } finally {
                                                                        setLoadingProductId(null);
                                                                    }
                                                                }}
                                                                disabled={isLoading || isReadOnly}
                                                                className="bg-emerald-600/30 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                                                title="Actualizar stock en sistema para coincidir con el físico"
                                                            >
                                                                <Zap size={12} /> {isLoading ? '...' : 'Ajustar'}
                                                            </button>

                                                            {/* Reportar Merma si faltante */}
                                                            {item.diff < 0 && (
                                                                <button
                                                                    onClick={() => onReportShrinkage(item.id, Math.abs(item.diff))}
                                                                    className="bg-rose-600/30 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                                                    title="Registrar esta pérdida en el Baúl de Robo Hormiga"
                                                                >
                                                                    <AlertTriangle size={12} /> Merma
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
