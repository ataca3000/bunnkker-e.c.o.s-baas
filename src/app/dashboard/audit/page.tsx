"use client";
/* hint-disable no-inline-styles */

import { useMemo, useState, useEffect, useCallback, memo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import VirtualizedAuditList, { type AuditRowData } from '@/components/VirtualizedAuditList';
import { type AuditLog } from '@/types/audit';
// @ts-expect-error - react-window types not resolved
import { areEqual, type ListChildComponentProps } from 'react-window';
import Link from 'next/link';
import { Settings, ShieldCheck, Camera, PenTool, CheckCircle2, Clock, Eye, X, Package, FileText } from 'lucide-react';

const isNode = typeof window === 'undefined' || !!(window as any).electronAPI;

// 2. Extraemos el componente Row fuera y lo optimizamos con memo
const Row = memo(({ index, style, data }: ListChildComponentProps<AuditRowData>) => {
    const { logs, loading, hasMore } = data;

    if (index === logs.length && hasMore) {
        return (
            <div style={style} className="flex items-center justify-center text-white/50 text-sm">
                {loading ? "Cargando más..." : "Desliza para cargar más"}
            </div>
        );
    }

    const log = logs[index];
    if (!log) return null;
    
    return (
        <div style={style} className="border-b border-white/5 px-4 flex items-center gap-[8px] text-xs">
            <span className={`font-mono ${log.isLocal ? 'text-amber-400' : 'text-blue-400'}`}>
                [{log.isLocal ? 'LOCAL' : log.type}]
            </span>
            <span className="flex-1 truncate">{log.description}</span>
            <span className="text-white/40">
                {log.isoDate ? new Date(log.isoDate).toLocaleTimeString() : (log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString() : 'N/A')}
            </span>
        </div>
    );
}, areEqual);

Row.displayName = "AuditLogRow";

export default function RadarAuditPage() {
    const { profile, signOut } = useAuth();
    const [viewTab, setViewTab] = useState<'logs' | 'traceability'>('traceability');
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [selectedOrderEvidence, setSelectedOrderEvidence] = useState<any | null>(null);
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [userRole, setUserRole] = useState<string | null>(null);

    const LOGS_PER_PAGE = 20;

    useEffect(() => {
        if (profile?.role) {
            setUserRole(profile.role);
        }
    }, [profile]);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await fetch('/api/orders');
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setOrders(data.data || []);
                }
            }
        } catch { }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);


    const fetchLogs = useCallback(async (isReset = false) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/audit${filterType !== 'ALL' ? `?action=${filterType}` : ''}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    const mapped = data.data.map((l: any) => ({
                        id: l.id,
                        type: l.action,
                        description: l.details || l.action,
                        timestamp: { seconds: new Date(l.timestamp).getTime() / 1000 },
                        isoDate: l.timestamp,
                        isLocal: true,
                        userId: l.userId
                    }));
                    
                    let finalLogs = mapped;
                    if (startDate) {
                        const startTs = new Date(startDate + "T00:00:00").getTime();
                        finalLogs = finalLogs.filter((l: any) => new Date(l.isoDate).getTime() >= startTs);
                    }
                    if (endDate) {
                        const endTs = new Date(endDate + "T23:59:59").getTime();
                        finalLogs = finalLogs.filter((l: any) => new Date(l.isoDate).getTime() <= endTs);
                    }

                    if (searchTerm) {
                        const lowerSearch = searchTerm.toLowerCase();
                        finalLogs = finalLogs.filter((l: any) => 
                            l.description?.toLowerCase().includes(lowerSearch) || 
                            l.type?.toLowerCase().includes(lowerSearch)
                        );
                    }

                    setLogs(finalLogs);
                    setHasMore(false);
                }
            }
        } catch (e) {
            console.error("Error fetching local audit logs:", e);
        } finally {
            setLoading(false);
        }
    }, [loading, hasMore, filterType, startDate, endDate]);

    // Reset and fetch when filter changes
    useEffect(() => {
        setHasMore(true);
        fetchLogs(true);
    }, [filterType, startDate, endDate]);

    // Client-side filtering for the search term
    const filteredLogs = useMemo(() => {
        let result = logs;
        if (filterType === 'LOCAL_ONLY') {
            result = result.filter(log => log.isLocal);
        }
        if (!searchTerm) return result;
        const lowerSearch = searchTerm.toLowerCase();
        return result.filter(log => 
            log.description.toLowerCase().includes(lowerSearch) || 
            log.type.toLowerCase().includes(lowerSearch)
        );
    }, [logs, searchTerm, filterType]);

    return (
        <div className="bg-[#0a0a0c] min-h-screen p-8 text-white">
            <header className="flex justify-between items-center mb-10">
                <h1 className="text-2xl font-black italic tracking-tighter">RADAR DE AUDITORÍA</h1>
                <div className="flex flex-wrap items-center gap-[8px]">
                    <div className="flex bg-slate-800/80/5 border border-white/10 rounded-lg px-3 py-1 items-center gap-[8px]">
                        <div className="flex items-center gap-2">
                            <span className="text-[0.6rem] text-white/40 font-bold uppercase">Desde:</span>
                            <input 
                                type="date" 
                                title="Fecha de inicio para el filtro"
                                aria-label="Fecha de inicio"
                                className="bg-transparent border-none outline-none text-xs text-blue-400 [color-scheme:dark]"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[0.6rem] text-white/40 font-bold uppercase">Hasta:</span>
                            <input 
                                type="date" 
                                title="Fecha de fin para el filtro"
                                aria-label="Fecha de fin"
                                className="bg-transparent border-none outline-none text-xs text-blue-400 [color-scheme:dark]"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <input 
                            type="text" 
                            title="Buscar por descripción o tipo"
                            aria-label="Buscar en descripción"
                            placeholder="Buscar en descripción..." 
                            className="bg-transparent border-none outline-none text-xs w-48 text-white placeholder:text-white/30"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <select 
                            title="Filtrar por tipo de registro"
                            aria-label="Filtrar por tipo de log"
                            className="bg-transparent border-none outline-none text-[0.6rem] font-bold uppercase text-blue-400 cursor-pointer"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="ALL">TODOS</option>
                            <option value="LOCAL_ONLY">SÓLO LOCALES (PENDIENTES)</option>
                            <option value="LOGIN">LOGIN</option>
                            <option value="USER_CREATE">REGISTROS</option>
                            <option value="PRICE_CHANGE">PRECIOS</option>
                            <option value="ORDER_CREATE">PEDIDOS</option>
                            <option value="ORDER_DELIVERED">ENTREGAS (FOTO Y FIRMA)</option>
                            <option value="CONFIG_UPDATE">CONFIGURACIONES</option>
                        </select>
                    </div>
                    {userRole === 'superadmin' && (
                        <Link 
                            href="/dashboard/settings/history" 
                            className="flex items-center gap-2 bg-[#0ea5e9] hover:bg-[#003d80] text-white text-[0.6rem] font-bold py-2 px-4 rounded-lg transition-all uppercase tracking-widest border border-white/10"
                        >
                            <Settings size={14} /> Historial Config
                        </Link>
                    )}
                    <button onClick={signOut} className="text-white/20 hover:text-[#ff4d4d] text-[0.6rem] font-bold uppercase transition-colors">Cerrar Sesión Local</button>
                </div>
            </header>
            
            {/* Selector de Pestañas de Auditoría */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setViewTab('traceability')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        viewTab === 'traceability' 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' 
                            : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/10'
                    }`}
                >
                    <ShieldCheck size={16} /> Trazabilidad de Ciclo de Pedidos & Entregas (PoD)
                </button>
                <button
                    onClick={() => setViewTab('logs')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        viewTab === 'logs' 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' 
                            : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/10'
                    }`}
                >
                    <FileText size={16} /> Registro Inmutable de Eventos (Logs)
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[8px] mb-8">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-[8px] rounded-[5px]">
                    <h3 className="text-emerald-400 font-bold text-xs uppercase tracking-widest mb-2">Ventas de Hoy</h3>
                    <p className="text-3xl font-black text-white">
                        ${filteredLogs.filter(l => l.type === 'ORDER_CREATE').reduce((acc, l) => acc + (l.metadata?.total || 0), 0).toFixed(2)}
                    </p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-[8px] rounded-[5px]">
                    <h3 className="text-red-400 font-bold text-xs uppercase tracking-widest mb-2">Cancelaciones</h3>
                    <p className="text-3xl font-black text-white">
                        {filteredLogs.filter(l => l.type === 'ORDER_CANCEL').length}
                    </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 p-[8px] rounded-[5px]">
                    <h3 className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-2">Total Pedidos en Sistema</h3>
                    <p className="text-3xl font-black text-white">
                        {orders.length}
                    </p>
                </div>
            </div>

            {viewTab === 'traceability' ? (
                <div className="bg-slate-900/80 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/60">
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <ShieldCheck className="text-emerald-400" size={18} /> Auditoría Forense de Pedidos: Enlistado → Almacén → Cobro → Entrega PoD
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Verificación inmutable del operador que enlistó, preparó en almacén, cobró en caja y entregó con foto y firma.
                            </p>
                        </div>
                        <button 
                            onClick={fetchOrders}
                            className="text-xs text-blue-400 hover:text-blue-300 font-bold bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20"
                        >
                            Actualizar Pedidos
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-zinc-300">
                            <thead className="bg-black/40 text-zinc-400 uppercase text-[10px] font-bold border-b border-white/5">
                                <tr>
                                    <th className="py-3 px-4">Folio</th>
                                    <th className="py-3 px-4">Cliente</th>
                                    <th className="py-3 px-4">Estado</th>
                                    <th className="py-3 px-4">1. Enlistado (Caja)</th>
                                    <th className="py-3 px-4">2. Almacén (Surtido)</th>
                                    <th className="py-3 px-4">3. Cobro (Caja)</th>
                                    <th className="py-3 px-4 text-center">4. Evidencia PoD</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-zinc-500">
                                            No hay órdenes registradas para auditar.
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map((o) => (
                                        <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-white">
                                                {o.id}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-zinc-200">{o.customer?.name || o.customerName || 'Cliente Mostrador'}</div>
                                                <div className="text-[10px] text-zinc-500">{o.customer?.phone || ''}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                                    o.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                    o.isLoaded ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                }`}>
                                                    {o.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-zinc-300 font-medium">{o.vendedorName || 'Piso'}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {o.isLoaded ? (
                                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                        <CheckCircle2 size={13} /> {o.loadedBy || 'Listo'}
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-400 font-medium flex items-center gap-1">
                                                        <Clock size={13} /> {o.loadedBy ? `Preparando (${o.loadedBy})` : 'En espera'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {o.confirmedAt ? (
                                                    <span className="text-emerald-400 font-bold">
                                                        ✓ ${Number(o.total || 0).toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-500">
                                                        Pendiente (${Number(o.total || 0).toFixed(2)})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {(o.photoData || o.signatureData) ? (
                                                    <button
                                                        onClick={() => setSelectedOrderEvidence(o)}
                                                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-lg font-bold text-[11px] flex items-center gap-1.5 mx-auto transition-all"
                                                    >
                                                        <Eye size={12} /> Ver Foto & Firma
                                                    </button>
                                                ) : (
                                                    <span className="text-zinc-600 text-[10px]">Sin evidencia</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div id="tour-audit-loglist" className="bg-slate-800/80/5 rounded-lg overflow-hidden border border-white/10 shadow-2xl">
                    <VirtualizedAuditList 
                        logs={filteredLogs}
                        loading={loading}
                        hasMore={hasMore}
                        onLoadMore={fetchLogs}
                        RowComponent={Row}
                        itemSize={40}
                        height={600}
                        theme="dark"
                    />
                    {filteredLogs.length === 0 && !loading && (
                        <div className="p-20 text-center text-white/20 italic text-sm">
                            No se encontraron registros con los filtros actuales.
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Detalle de Evidencia PoD para Administrador */}
            {selectedOrderEvidence && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative text-white max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setSelectedOrderEvidence(null)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                                <ShieldCheck size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">Constancia de Entrega & Firma</h3>
                                <p className="text-xs text-zinc-400">Folio: <strong className="text-emerald-400 font-mono">{selectedOrderEvidence.id}</strong></p>
                            </div>
                        </div>

                        {/* Trazabilidad de Actores */}
                        <div className="bg-zinc-900 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs text-zinc-300 mb-4">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Cliente:</span>
                                <strong className="text-white">{selectedOrderEvidence.customer?.name || 'Cliente Mostrador'}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Caja / Cobro:</span>
                                <strong className="text-white">{selectedOrderEvidence.vendedorName || 'Piso'}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Almacén / Preparación:</span>
                                <strong className="text-white">{selectedOrderEvidence.loadedBy || 'Almacén'}</strong>
                            </div>
                            {selectedOrderEvidence.completedAt && (
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Fecha de Entrega:</span>
                                    <strong className="text-white">{new Date(selectedOrderEvidence.completedAt).toLocaleString('es-MX')}</strong>
                                </div>
                            )}
                        </div>

                        {/* Evidencia Fotográfica */}
                        {selectedOrderEvidence.photoData && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                                    <Camera size={14} className="text-emerald-400" /> Foto de Entrega (Producto / Paquete)
                                </label>
                                <div className="rounded-xl overflow-hidden border border-white/10 bg-black max-h-60 flex items-center justify-center">
                                    <img src={selectedOrderEvidence.photoData} alt="Evidencia" className="max-h-60 w-auto object-contain" />
                                </div>
                            </div>
                        )}

                        {/* Firma del Cliente */}
                        {selectedOrderEvidence.signatureData && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                                    <PenTool size={14} className="text-emerald-400" /> Firma Digital del Receptor
                                </label>
                                <div className="rounded-xl overflow-hidden border border-white/10 bg-white p-2 text-center">
                                    <img src={selectedOrderEvidence.signatureData} alt="Firma" className="h-20 mx-auto object-contain" />
                                </div>
                            </div>
                        )}

                        {/* Artículos Entregados */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                                Artículos Entregados ({selectedOrderEvidence.items?.length || 0})
                            </label>
                            <div className="bg-zinc-900 rounded-xl p-3 border border-white/5 max-h-36 overflow-y-auto space-y-1 text-xs">
                                {(selectedOrderEvidence.items || []).map((it: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-zinc-300">
                                        <span>{it.quantity ?? it.cantidad ?? 1}x {it.name || it.product?.name || 'Producto'}</span>
                                        <span className="font-mono text-zinc-400">${Number((it.price ?? it.precio ?? 0) * (it.quantity ?? it.cantidad ?? 1)).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedOrderEvidence(null)}
                            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs transition-colors"
                        >
                            Cerrar Visor
                        </button>
                    </div>
                </div>
            )}

            <footer className="mt-4 flex justify-between text-[0.6rem] text-white/20 font-mono uppercase tracking-widest">
                <span>Registros cargados: {logs.length}</span>
                <span>Resultados filtrados: {filteredLogs.length}</span>
                <span>Estado: {loading ? 'Sincronizando...' : 'Conectado'}</span>
            </footer>
        </div>
    );
}

