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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col bg-[#050505] rounded-[24px] overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300 group"
        >
            {/* Imagen */}
            <button
                type="button"
                className="w-full aspect-[4/3] relative block overflow-hidden bg-black text-left"
                onClick={() => onOpenDetails(p)}
                aria-label={`Ver detalles de ${p.name}`}
            >
                {p.image ? (
                    <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                        onError={e => {
                            e.currentTarget.style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement | null)?.style?.setProperty('display', 'flex');
                        }}
                    />
                ) : null}
                <div className={`absolute inset-0 flex items-center justify-center bg-slate-900/50 ${p.image ? 'hidden' : 'flex'}`}>
                    <Package size={48} className="text-slate-700/50" />
                </div>
                {availableStock === 0 && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center text-red-500 font-black text-xl tracking-widest z-10 border-2 border-red-500/50 m-4 rounded-xl flex-col">
                        AGOTADO
                        {floatHold > 0 && <span className="text-xs text-yellow-400 mt-2 font-normal">({floatHold} en reserva)</span>}
                    </div>
                )}
            </button>

            {/* Info */}
            <div className="p-5 flex flex-col flex-1 relative">
                <div className="flex justify-between items-center mb-3 flex-wrap gap-1">
                    <span className="text-[0.65rem] font-bold tracking-widest uppercase text-slate-400 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
                        {p.category || 'General'}
                    </span>
                    {inCartQty > 0 && (
                        <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-400/20 px-2 py-0.5 rounded-full">
                            🛒 {inCartQty} en carrito
                        </span>
                    )}
                </div>

                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                    <button onClick={() => onOpenDetails(p)} className="text-left w-full">{p.name}</button>
                </h3>

                <div className="mb-4 mt-auto">
                    <StarRating rating={p.rating} count={p.reviewCount} />
                </div>

                <div>
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <div className="text-2xl font-black text-white">${p.price.toLocaleString()} <span className="text-xs font-normal text-slate-400">MXN</span></div>
                            <div className="flex flex-col gap-0.5 mt-1">
                                <div className={`text-xs font-bold flex items-center gap-1 ${availableStock > 0 ? 'text-emerald-400' : inCartQty > 0 ? 'text-cyan-400' : 'text-red-500'}`}>
                                    <Package size={12} />
                                    {availableStock > 0 
                                        ? `${availableStock} disponibles ${inCartQty > 0 ? `(${p.stock} total)` : ''}`
                                        : inCartQty > 0 
                                            ? `Todo tu stock (${inCartQty} pz) apartado`
                                            : 'Sin stock disponible'}
                                </div>
                                {inCartQty > 0 && (
                                    <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                                        ✓ Apartadas por ti: {inCartQty} pz
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Controles Dinámicos: Si ya tiene en carrito vs si no tiene aún */}
                    {inCartQty > 0 ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-1.5">
                                <button
                                    className="w-9 h-9 flex items-center justify-center text-cyan-300 hover:bg-cyan-500/20 active:scale-95 rounded-lg transition-all font-black text-base"
                                    onClick={handleDecrementFromCart}
                                    title="Quitar 1 pieza de tu carrito"
                                >
                                    <Minus size={16} />
                                </button>
                                <div className="text-center">
                                    <span className="text-xs font-black text-white">{inCartQty} en Carrito</span>
                                    <span className="text-[9px] text-cyan-300 block">(${Number(p.price * inCartQty).toFixed(2)})</span>
                                </div>
                                <button
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all font-black text-base ${
                                        availableStock > 0 
                                            ? 'text-cyan-300 hover:bg-cyan-500/20 active:scale-95' 
                                            : 'text-slate-600 opacity-40 cursor-not-allowed'
                                    }`}
                                    onClick={handleIncrementToCart}
                                    disabled={availableStock <= 0}
                                    title={availableStock > 0 ? "Apartar 1 pieza más" : "No queda más stock"}
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    if (typeof window !== 'undefined') window.location.href = '/carrito';
                                }}
                                className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
                            >
                                <ShoppingCart size={15} /> Ver Carrito / Liquidar (${Number(p.price * inCartQty).toFixed(2)})
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
                                <button
                                    className={`w-8 h-8 flex items-center justify-center text-white transition-all rounded-lg ${qty <= 1 || availableStock === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 active:scale-95'}`}
                                    onClick={() => setQty(Math.max(1, qty - 1))}
                                    disabled={qty <= 1 || availableStock === 0}
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="font-bold w-6 text-center text-sm text-white">{qty}</span>
                                <button
                                    className={`w-8 h-8 flex items-center justify-center text-white transition-all rounded-lg ${qty >= availableStock || availableStock === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 active:scale-95'}`}
                                    onClick={() => setQty(Math.min(availableStock, qty + 1))}
                                    disabled={qty >= availableStock || availableStock === 0}
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            <button
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${
                                    availableStock === 0
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                                }`}
                                onClick={() => {
                                    if (availableStock > 0) {
                                        addToCart(p, qty);
                                        toast.success(`${qty}x ${p.name} apartado en tu carrito.`, '🛒 Apartado');
                                    }
                                }}
                                disabled={availableStock === 0}
                            >
                                <ShoppingCart size={18} />
                                {availableStock === 0 ? 'AGOTADO' : `APARTAR (${qty})`}
                            </button>
                        </div>
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
