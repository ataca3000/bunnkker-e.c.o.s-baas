'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Package, X, MessageSquare } from 'lucide-react';
import { useCart, type Product } from '@/context/CartContext';
import { StarRating } from './CatalogUtils';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

// ── ProductCard ───────────────────────────────────────────────────────────────

interface ProductCardProps {
    p: Product;
    index: number;
    onOpenDetails: (p: Product) => void;
}

/**
 * Tarjeta de producto del catálogo con stock flotante en tiempo real.
 * Muestra imagen, nombre, precio, disponibilidad y controles de cantidad.
 */
export function ProductCard({ p, onOpenDetails }: ProductCardProps) {
    const { addToCart, decrementFromCart, removeFromCart, floatingStock = {}, cart = [] } = useCart() as any;
    const cartItem = (cart || []).find((item: any) => item.id === p.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;
    const floatHold = floatingStock[p.id] || 0;
    // Stock real disponible en anaquel
    const availableStock = Math.max(0, p.stock - floatHold);
    const [qty, setQty] = useState(availableStock > 0 ? 1 : 0);

    const [prevStock, setPrevStock] = useState(availableStock);
    if (availableStock !== prevStock) {
        setPrevStock(availableStock);
        if (availableStock === 0) {
            setQty(0);
        } else if (qty === 0) {
            setQty(1);
        } else if (qty > availableStock) {
            setQty(availableStock);
        }
    }

    const handleDecrementFromCart = () => {
        if (decrementFromCart) {
            decrementFromCart(p.id);
        } else if (removeFromCart) {
            removeFromCart(p.id);
        }
        toast.info(`Apartado reducido para ${p.name}.`, '🛒 Carrito');
    };

    const handleIncrementToCart = () => {
        if (inCartQty >= availableStock) {
            toast.warning('Has alcanzado el límite de stock disponible.', '⚠️ Stock Límite');
            return;
        }
        addToCart(p, 1);
        toast.success(`+1 en tu carrito (${inCartQty + 1} total).`, '🛒 Carrito');
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-300 group relative"
        >
            {/* Imagen del Producto */}
            <button
                type="button"
                className="w-full aspect-square relative block overflow-hidden bg-slate-50 dark:bg-slate-950 text-left cursor-pointer"
                onClick={() => onOpenDetails(p)}
                aria-label={`Ver detalles de ${p.name}`}
            >
                {p.image ? (
                    <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={e => {
                            e.currentTarget.style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement | null)?.style?.setProperty('display', 'flex');
                        }}
                    />
                ) : null}
                <div className={`absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${p.image ? 'hidden' : 'flex'}`}>
                    <Package size={40} className="text-slate-400" />
                </div>

                {/* Insignia de Categoría (Superior Izquierda) */}
                <div className="absolute top-3 left-3 z-10">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-slate-700 shadow-xs">
                        {p.category || 'General'}
                    </span>
                </div>

                {/* Insignia si ya está en carrito (Superior Derecha) */}
                {inCartQty > 0 && (
                    <div className="absolute top-3 right-3 z-10">
                        <span className="text-[11px] font-bold text-white bg-[#008060] px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                            🛒 {inCartQty} en carrito
                        </span>
                    </div>
                )}

                {/* Estado Agotado */}
                {availableStock === 0 && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                        <span className="bg-red-600 text-white font-extrabold text-xs tracking-wider uppercase px-3 py-1.5 rounded-lg shadow-md">
                            Agotado
                        </span>
                    </div>
                )}
            </button>

            {/* Contenido e Información */}
            <div className="p-4 sm:p-5 flex flex-col flex-1">
                {/* Título */}
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1.5 line-clamp-2 leading-snug group-hover:text-[#008060] transition-colors">
                    <button onClick={() => onOpenDetails(p)} className="text-left w-full hover:underline">
                        {p.name}
                    </button>
                </h3>

                {/* Calificación con estrellas */}
                <div className="mb-2.5">
                    <StarRating rating={p.rating} count={p.reviewCount} />
                </div>

                {/* Precio y Stock */}
                <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex justify-between items-baseline mb-3">
                        <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                            ${p.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-[10px] font-bold text-slate-400 ml-1">MXN</span>
                        </div>

                        {/* Indicador de Stock estilo Shopify */}
                        <div className="text-right">
                            {availableStock > 5 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {availableStock} en stock
                                </span>
                            ) : availableStock > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                                    ⚡ ¡Últimas {availableStock} uds!
                                </span>
                            ) : (
                                <span className="text-[11px] font-bold text-slate-400">Sin stock</span>
                            )}
                        </div>
                    </div>

                    {/* Acciones de Carrito estilo Shopify Quick-Add */}
                    {inCartQty > 0 ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-1">
                                <button
                                    className="w-8 h-8 flex items-center justify-center text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95 rounded-lg transition-all font-bold"
                                    onClick={handleDecrementFromCart}
                                    title="Quitar 1 pieza"
                                    aria-label="Disminuir cantidad"
                                >
                                    <Minus size={14} />
                                </button>
                                <div className="text-center">
                                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100">{inCartQty} en carrito</span>
                                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold">
                                        (${(p.price * inCartQty).toFixed(2)})
                                    </span>
                                </div>
                                <button
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all font-bold ${
                                        availableStock > 0 
                                            ? 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95' 
                                            : 'text-slate-400 opacity-40 cursor-not-allowed'
                                    }`}
                                    onClick={handleIncrementToCart}
                                    disabled={availableStock <= 0}
                                    title={availableStock > 0 ? "Sumar 1 pieza" : "Sin más stock"}
                                    aria-label="Aumentar cantidad"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    if (typeof window !== 'undefined') window.location.href = '/carrito';
                                }}
                                className="w-full py-2 px-3 bg-[#008060] hover:bg-[#006e52] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98]"
                            >
                                <ShoppingCart size={14} /> Ir a Pagar · ${(p.price * inCartQty).toFixed(2)}
                            </button>
                        </div>
                    ) : (
                        <button
                            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                availableStock === 0
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                                    : 'bg-[#008060] hover:bg-[#006e52] text-white shadow-xs hover:shadow-md active:scale-[0.98]'
                            }`}
                            onClick={() => {
                                if (availableStock > 0) {
                                    addToCart(p, 1);
                                    toast.success(`${p.name} agregado al carrito.`, '🛒 Carrito');
                                }
                            }}
                            disabled={availableStock === 0}
                        >
                            <ShoppingCart size={15} />
                            {availableStock === 0 ? 'Sin Stock' : '+ Agregar al Carrito'}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── ProductDetailDrawer ───────────────────────────────────────────────────────

interface ProductDetailDrawerProps {
    product: Product | null;
    onClose: () => void;
}

/**
 * Panel lateral deslizable con detalles del producto y reseñas en tiempo real.
 * El estado del producto seleccionado vive en MarketCatalog.
 */
export function ProductDetailDrawer({ product, onClose }: ProductDetailDrawerProps) {
    const { addToCart, decrementFromCart, removeFromCart, floatingStock = {}, cart = [] } = useCart() as any;
    const [realReviews, setRealReviews] = useState<any[]>([]);

    const cartItem = product ? (cart || []).find((item: any) => item.id === product.id) : null;
    const inCartQty = cartItem ? cartItem.quantity : 0;
    const floatHold = product ? (floatingStock[product.id] || 0) : 0;
    const availableStock = product ? Math.max(0, product.stock - floatHold) : 0;

    useEffect(() => {
        if (!product) return;
        const q = query(
            collection(db, 'reviews'),
            where('productId', '==', product.id),
            orderBy('date', 'desc')
        );
        const unsub = onSnapshot(q, (snap: any) => {
            setRealReviews(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        }, (err: any) => console.error("Error loading reviews:", err));
        return unsub;
    }, [product]);

    return (
        <>
            <AnimatePresence>
                {product && (
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-end z-[1000]"
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            className="bg-white w-full max-w-full sm:max-w-[520px] h-full overflow-y-auto p-6 sm:p-10 relative shadow-2xl flex flex-col justify-between"
                        >
                            <button
                                onClick={onClose}
                                className="absolute top-5 right-5 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors z-10"
                                title="Cerrar detalles"
                                aria-label="Cerrar detalles"
                            >
                                <X size={20} className="text-slate-600" />
                            </button>

                            <div className="flex flex-col gap-6 mt-4">
                                <div className="w-full h-[250px] sm:h-[300px] bg-slate-50 rounded-2xl overflow-hidden shadow-inner relative">
                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                    {inCartQty > 0 && (
                                        <div className="absolute top-4 left-4 bg-cyan-600 text-white text-xs font-black uppercase px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                                            🛒 {inCartQty} pz en tu carrito
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <span className="text-[0.7rem] text-[#0ea5e9] font-black uppercase tracking-widest">{product.category || 'General'}</span>
                                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 mb-3 leading-tight">{product.name}</h2>
                                    <div className="mb-4">
                                        <StarRating rating={product.rating} count={product.reviewCount} />
                                    </div>
                                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                                        <div className="text-3xl sm:text-4xl font-black text-[#E30613]">
                                            ${product.price.toLocaleString()} <span className="text-sm align-middle text-slate-400">MXN</span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-xs font-bold block ${availableStock > 0 ? 'text-emerald-600' : inCartQty > 0 ? 'text-cyan-600' : 'text-red-500'}`}>
                                                {availableStock > 0 
                                                    ? `${availableStock} disponibles (${product.stock} total)`
                                                    : inCartQty > 0 
                                                        ? 'Todo tu stock apartado'
                                                        : 'Agotado'}
                                            </span>
                                            {inCartQty > 0 && (
                                                <span className="text-[11px] text-cyan-700 font-bold block">
                                                    ✓ {inCartQty} pz en tu pedido
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-slate-600 leading-relaxed text-sm sm:text-base m-0 bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                    {product.description || "Excelente solución para tu negocio. Totalmente adaptable y configurable para ajustarlo a cualquier sector de venta."}
                                </p>

                                {/* Controles de Carrito / Apartado */}
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">Cantidad en Carrito</span>
                                        <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                            <button
                                                onClick={() => {
                                                    if (inCartQty > 0) {
                                                        if (decrementFromCart) decrementFromCart(product.id);
                                                        else if (removeFromCart) removeFromCart(product.id);
                                                        toast.info(`Reducido 1 pz de ${product.name}`);
                                                    }
                                                }}
                                                disabled={inCartQty === 0}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <span className="w-8 text-center font-black text-sm text-slate-900">{inCartQty}</span>
                                            <button
                                                onClick={() => {
                                                    if (availableStock > 0) {
                                                        addToCart(product, 1);
                                                        toast.success(`+1 pz de ${product.name} apartada en tu carrito.`);
                                                    } else {
                                                        toast.warning('No hay más stock disponible para apartar.');
                                                    }
                                                }}
                                                disabled={availableStock <= 0}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {inCartQty > 0 ? (
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (typeof window !== 'undefined') window.location.href = '/carrito';
                                            }}
                                            className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                                        >
                                            <ShoppingCart size={16} /> Ver Carrito / Pagar (${Number(product.price * inCartQty).toFixed(2)})
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => { 
                                                if (availableStock > 0) {
                                                    addToCart(product, 1); 
                                                    toast.success(`${product.name} agregado al carrito.`, '🛒 Carrito'); 
                                                }
                                            }}
                                            disabled={availableStock === 0}
                                            className={`w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 ${availableStock === 0 ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <ShoppingCart size={16} /> {availableStock === 0 ? 'PRODUCTO AGOTADO' : 'APARTAR EN CARRITO'}
                                        </button>
                                    )}
                                </div>

                                {/* Reseñas */}
                                <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col gap-5">
                                    <h4 className="flex items-center gap-2 text-lg font-black text-slate-800">
                                        <MessageSquare size={20} className="text-[#0ea5e9]" /> Reseñas de Clientes
                                    </h4>
                                    {realReviews.length > 0 ? realReviews.map(rev => (
                                        <div key={rev.id} className="bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-100 flex flex-col gap-2">
                                            <div className="flex justify-between items-center flex-wrap gap-2">
                                                <strong className="text-xs text-slate-700 font-black uppercase tracking-tight">{rev.customerName}</strong>
                                                <div className="flex flex-col items-end">
                                                    <StarRating rating={rev.rating} />
                                                    <span className="text-[8px] text-slate-400 mt-1">{rev.date ? new Date(rev.date).toLocaleDateString() : ''}</span>
                                                </div>
                                            </div>
                                            {rev.comment && <p className="text-sm text-slate-600 leading-relaxed italic m-0">&quot;{rev.comment}&quot;</p>}
                                        </div>
                                    )) : (
                                        <div className="text-center py-8 text-slate-400 font-bold italic text-sm">
                                            Aún no hay opiniones.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
