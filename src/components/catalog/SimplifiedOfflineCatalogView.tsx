'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ShieldCheck, 
    AlertTriangle, 
    XCircle, 
    WifiOff, 
    Wifi, 
    MapPin, 
    Barcode, 
    Plus, 
    Minus, 
    ShoppingCart, 
    Check, 
    Clock, 
    Layers, 
    CheckCircle2, 
    Package, 
    Sparkles,
    Filter,
    RefreshCw
} from 'lucide-react';
import { useCart, type Product } from '@/context/CartContext';
import { 
    getProductAvailabilityInfo, 
    filterCatalogByAvailability, 
    getOfflineCatalogSummary, 
    formatLastSyncTimestamp, 
    type AvailabilityFilterOption 
} from '@/lib/offlineAvailability';
import { toast } from '@/lib/toast';

interface SimplifiedOfflineCatalogViewProps {
    products: Product[];
    onOpenDetails: (product: Product) => void;
    isSimulatedOffline: boolean;
    onToggleSimulatedOffline: () => void;
    isDeviceOnline: boolean;
    lastSyncTimestamp?: string | number | null;
}

export function SimplifiedOfflineCatalogView({
    products,
    onOpenDetails,
    isSimulatedOffline,
    onToggleSimulatedOffline,
    isDeviceOnline,
    lastSyncTimestamp,
}: SimplifiedOfflineCatalogViewProps) {
    const { addToCart, decrementFromCart, removeFromCart, floatingStock = {}, cart = [] } = useCart() as any;
    const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilterOption>('all');
    const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

    const isEffectiveOffline = !isDeviceOnline || isSimulatedOffline;

    // Métricas globales del catálogo
    const summary = getOfflineCatalogSummary(products, floatingStock);

    // Filtrar según el botón de disponibilidad seleccionado
    const filteredProducts = filterCatalogByAvailability(products, availabilityFilter, floatingStock);

    const handleCopyBarcode = (barcode: string) => {
        if (!barcode) return;
        navigator.clipboard.writeText(barcode);
        setCopiedBarcode(barcode);
        toast.info(`Código ${barcode} copiado al portapapeles.`);
        setTimeout(() => setCopiedBarcode(null), 2000);
    };

    return (
        <div className="space-y-6">
            {/* ── BANNER OFFLINE Y DISPONIBILIDAD GARANTIZADA ── */}
            <div className={`rounded-2xl p-4 sm:p-5 border transition-all duration-300 shadow-xs ${
                isEffectiveOffline 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100' 
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
            }`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                            isEffectiveOffline 
                                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' 
                                : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        }`}>
                            {isEffectiveOffline ? <WifiOff size={22} /> : <ShieldCheck size={22} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight">
                                    {isEffectiveOffline 
                                        ? 'Modo Offline: Disponibilidad Garantizada en Anaquel' 
                                        : 'Catálogo Sincronizado: Disponibilidad Física Confirmada'}
                                </h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    isEffectiveOffline 
                                        ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200' 
                                        : 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                                }`}>
                                    {isEffectiveOffline ? 'Sin Conexión (Caché Local)' : 'Sincronizado'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                                {isEffectiveOffline 
                                    ? 'La disponibilidad se calcula directamente sobre el último estado sincronizado y verificado en la base de datos local. Los pedidos agregados se encolan automáticamente para garantizar entrega y cobro inmediato en tienda.' 
                                    : 'Información verificada con el registro físico de anaqueles y sincronizada en tiempo real con el servidor central.'}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                <Clock size={13} className="shrink-0" />
                                <span>Último corte sincronizado: <strong>{formatLastSyncTimestamp(lastSyncTimestamp)}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Botón de control: Simular Modo Offline */}
                    <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                        <button
                            onClick={onToggleSimulatedOffline}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                                isSimulatedOffline 
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-600 shadow-sm' 
                                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                            }`}
                            title="Alterna entre vista en línea y vista simulada sin internet"
                            aria-label="Alternar simulación de modo sin conexión"
                        >
                            {isSimulatedOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
                            <span>{isSimulatedOffline ? 'Simulando: Sin Conexión' : 'Simular Sin Conexión'}</span>
                        </button>
                    </div>
                </div>

                {/* Métricas rápidas de disponibilidad */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                    <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-2.5 border border-slate-200/50 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Total en Catálogo</span>
                        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{summary.total}</span>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-2.5 border border-emerald-500/30">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck size={11} /> Garantizados ({summary.guaranteedPercentage}%)
                        </span>
                        <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400">{summary.guaranteed}</span>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-2.5 border border-amber-500/30">
                        <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle size={11} /> Últimas Piezas
                        </span>
                        <span className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-400">{summary.limited}</span>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-2.5 border border-rose-500/30">
                        <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                            <XCircle size={11} /> Sin Stock
                        </span>
                        <span className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-400">{summary.outOfStock}</span>
                    </div>
                </div>
            </div>

            {/* ── BARRA DE FILTROS DE DISPONIBILIDAD ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                        <Filter size={13} /> Filtrar por:
                    </span>
                    <button
                        onClick={() => setAvailabilityFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            availabilityFilter === 'all'
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        Todos ({summary.total})
                    </button>
                    <button
                        onClick={() => setAvailabilityFilter('guaranteed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            availabilityFilter === 'guaranteed'
                                ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/30'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/50'
                        }`}
                    >
                        <ShieldCheck size={13} /> Solo Garantizados ({summary.guaranteed})
                    </button>
                    <button
                        onClick={() => setAvailabilityFilter('limited')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            availabilityFilter === 'limited'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/50'
                        }`}
                    >
                        <AlertTriangle size={13} /> Últimas Piezas ({summary.limited})
                    </button>
                    <button
                        onClick={() => setAvailabilityFilter('in_stock')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            availabilityFilter === 'in_stock'
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 hover:bg-sky-100 border border-sky-200 dark:border-sky-800/50'
                        }`}
                    >
                        <CheckCircle2 size={13} /> Todo en Existencia ({summary.guaranteed + summary.limited})
                    </button>
                </div>

                <div className="text-xs font-bold text-slate-500">
                    Mostrando <strong>{filteredProducts.length}</strong> de {products.length} productos
                </div>
            </div>

            {/* ── LISTADO SIMPLIFICADO DE PRODUCTOS CON DISPONIBILIDAD GARANTIZADA ── */}
            {filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-500">
                    <ShieldCheck size={36} className="mx-auto text-slate-400 mb-2" />
                    <p className="font-bold text-slate-700 dark:text-slate-300">No se encontraron productos con el filtro seleccionado.</p>
                    <button 
                        onClick={() => setAvailabilityFilter('all')}
                        className="mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                        Restablecer filtros
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredProducts.map((p) => {
                        const hold = floatingStock[p.id] || 0;
                        const info = getProductAvailabilityInfo(p, hold);
                        const cartItem = (cart || []).find((item: any) => item.id === p.id);
                        const inCartQty = cartItem ? cartItem.quantity : 0;

                        return (
                            <motion.div
                                key={p.id}
                                layout
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
                                    info.isGuaranteed
                                        ? 'bg-white dark:bg-slate-900 border-emerald-500/40 hover:border-emerald-500 shadow-xs'
                                        : info.level === 'limited'
                                            ? 'bg-white dark:bg-slate-900 border-amber-500/40 hover:border-amber-500 shadow-xs'
                                            : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 opacity-75'
                                }`}
                            >
                                <div className="flex items-start gap-3.5">
                                    {/* Miniatura compacta */}
                                    <button
                                        type="button"
                                        onClick={() => onOpenDetails(p)}
                                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 relative text-left cursor-pointer group"
                                        aria-label={`Ver detalles de ${p.name}`}
                                    >
                                        {p.image ? (
                                            <img
                                                src={p.image}
                                                alt={p.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                <Package size={24} />
                                            </div>
                                        )}
                                        {inCartQty > 0 && (
                                            <span className="absolute top-1 right-1 bg-[#008060] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                                                {inCartQty}
                                            </span>
                                        )}
                                    </button>

                                    {/* Información central */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                {p.category || 'General'}
                                            </span>

                                            {/* Sello de Disponibilidad Garantizada */}
                                            {info.isGuaranteed ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-400/50 px-2 py-0.5 rounded-md">
                                                    <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                    Disponibilidad Garantizada
                                                </span>
                                            ) : info.level === 'limited' ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 border border-amber-400/50 px-2 py-0.5 rounded-md">
                                                    <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                                    Disponibilidad Limitada
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/70 border border-rose-400/40 px-2 py-0.5 rounded-md">
                                                    <XCircle size={12} className="text-rose-500 shrink-0" />
                                                    Agotado en corte
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug truncate">
                                            <button 
                                                onClick={() => onOpenDetails(p)} 
                                                className="hover:underline text-left cursor-pointer"
                                            >
                                                {p.name}
                                            </button>
                                        </h4>

                                        {/* Ubicación en anaquel y código de barras */}
                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                                            <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/60 font-medium">
                                                <MapPin size={11} className="text-[#0ea5e9] shrink-0" />
                                                <span>{info.locationLabel}</span>
                                            </span>

                                            {p.barcode && (
                                                <button
                                                    onClick={() => handleCopyBarcode(p.barcode!)}
                                                    className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 font-mono text-[11px] transition-colors cursor-pointer"
                                                    title="Copiar código de barras"
                                                >
                                                    <Barcode size={12} className="shrink-0" />
                                                    <span>{p.barcode}</span>
                                                    {copiedBarcode === p.barcode && <Check size={11} className="text-emerald-500" />}
                                                </button>
                                            )}
                                        </div>

                                        {/* Detalle del stock garantizado */}
                                        <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                            <span>Existencia confirmada: </span>
                                            <strong className={info.availableStock > 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}>
                                                {info.availableStock} piezas
                                            </strong>
                                            {hold > 0 && (
                                                <span className="text-amber-600 text-[10px] ml-1.5 font-semibold">
                                                    ({hold} apartadas en cola)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Pie de tarjeta: Precio y Acciones Rápidas */}
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-lg font-black text-slate-900 dark:text-white leading-none">
                                            ${p.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            <span className="text-[10px] font-bold text-slate-400 ml-1">MXN</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-400 block mt-0.5">
                                            {isEffectiveOffline ? 'Precio guardado en corte offline' : 'Precio de catálogo en tiempo real'}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {inCartQty > 0 ? (
                                            <div className="inline-flex items-center bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-xl overflow-hidden p-0.5">
                                                <button
                                                    onClick={() => decrementFromCart ? decrementFromCart(p.id) : removeFromCart(p.id)}
                                                    className="w-7 h-7 flex items-center justify-center text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200/50 rounded-lg transition-colors cursor-pointer"
                                                    aria-label="Disminuir cantidad"
                                                >
                                                    <Minus size={13} />
                                                </button>
                                                <span className="w-7 text-center text-xs font-bold text-emerald-950 dark:text-emerald-100">
                                                    {inCartQty}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        if (inCartQty < info.availableStock) {
                                                            addToCart(p, 1);
                                                        } else {
                                                            toast.warning('Límite de disponibilidad garantizada alcanzado.');
                                                        }
                                                    }}
                                                    disabled={inCartQty >= info.availableStock}
                                                    className="w-7 h-7 flex items-center justify-center text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200/50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                                                    aria-label="Aumentar cantidad"
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (info.availableStock > 0) {
                                                        addToCart(p, 1);
                                                        toast.success(`${p.name} agregado al carrito offline.`);
                                                    }
                                                }}
                                                disabled={info.availableStock <= 0}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                                    info.availableStock > 0
                                                        ? 'bg-[#008060] hover:bg-[#006e52] text-white shadow-emerald-900/10 active:scale-95'
                                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                                }`}
                                            >
                                                <ShoppingCart size={13} />
                                                <span>{info.availableStock > 0 ? 'Agregar' : 'Sin stock'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
