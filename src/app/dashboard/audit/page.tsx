"use client";
/* hint-disable no-inline-styles */

import { useMemo, useState, useEffect, useCallback, memo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import VirtualizedAuditList, { type AuditRowData } from '@/components/VirtualizedAuditList';
import { type AuditLog } from '@/types/audit';
// @ts-expect-error - react-window types not resolved
import { areEqual, type ListChildComponentProps } from 'react-window';
import Link from 'next/link';
import { Settings } from 'lucide-react';

const isNode = typeof window === 'undefined' || !!(window as any).electronAPI;

// 2. Extraemos el componente Row fuera y lo optimizamos con memo
const Row = memo(({ index, style, data }: ListChildComponentProps<AuditRowData>) => {
    const { logs, loading, hasMore } = data;

    // Indicador de carga al final de la lista
    // El objeto 'style' es inyectado por react-window para el posicionamiento absoluto
    // necesario en la virtualización, por lo que el uso de estilos inline es requerido aquí.
    if (index === logs.length && hasMore) {
        // hint-disable-next-line no-inline-styles
        return (
            <div style={style} className="flex items-center justify-center text-white/50 text-sm">
                {loading ? "Cargando más..." : "Desliza para cargar más"}
            </div>
        );
    }

    const log = logs[index];
    if (!log) return null;
    
    return (
        // hint-disable-next-line no-inline-styles
        <div style={style} className="border-b border-white/5 px-4 flex items-center gap-4 text-xs">
            <span className={`font-mono ${log.isLocal ? 'text-amber-400' : 'text-blue-400'}`}>
                [{log.isLocal ? 'LOCAL' : log.type}]
            </span>
            <span className="flex-1 truncate">{log.description}</span>
            <span className="text-white/40">
                {log.isoDate ? new Date(log.isoDate).toLocaleTimeString() : (log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString() : 'N/A')}
            </span>
        </div>
    );
}, areEqual); // 3. areEqual compara cambios en props (incluyendo el objeto style inyectado)

Row.displayName = "AuditLogRow";

export default function RadarAuditPage() {
    const { signOut } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastVisible, setLastVisible] = useState<any>(null);
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [userRole, setUserRole] = useState<string | null>(null);

    const LOGS_PER_PAGE = 20; // Define how many logs to fetch at once

    useEffect(() => {
        if (profile?.role) {
            setUserRole(profile.role);
        }
    }, [profile]);


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
    }, [loading, hasMore, lastVisible, filterType, startDate, endDate]);

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
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex bg-slate-800/80/5 border border-white/10 rounded-lg px-3 py-1 items-center gap-4">
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl">
                    <h3 className="text-emerald-400 font-bold text-xs uppercase tracking-widest mb-2">Ventas de Hoy</h3>
                    <p className="text-3xl font-black text-white">
                        {/* Mock calculation for the demo based on logs */}
                        ${filteredLogs.filter(l => l.type === 'ORDER_CREATE').reduce((acc, l) => acc + (l.metadata?.total || 0), 0).toFixed(2)}
                    </p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl">
                    <h3 className="text-red-400 font-bold text-xs uppercase tracking-widest mb-2">Cancelaciones</h3>
                    <p className="text-3xl font-black text-white">
                        {filteredLogs.filter(l => l.type === 'ORDER_CANCEL').length}
                    </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-2xl">
                    <h3 className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-2">Total Operaciones</h3>
                    <p className="text-3xl font-black text-white">
                        {filteredLogs.length}
                    </p>
                </div>
            </div>

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
            <footer className="mt-4 flex justify-between text-[0.6rem] text-white/20 font-mono uppercase tracking-widest">
                <span>Registros cargados: {logs.length}</span>
                <span>Resultados filtrados: {filteredLogs.length}</span>
                <span>Estado: {loading ? 'Sincronizando...' : 'Conectado'}</span>
            </footer>
        </div>
    );
}
