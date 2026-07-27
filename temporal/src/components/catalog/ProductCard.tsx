'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Package, FileText, X, MessageSquare } from 'lucide-react';
import { useCart, type Product } from '@/context/CartContext';
import CFDIModal from '../CFDIModal';
import { StarRating } from './CatalogUtils';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

// ── ProductCard ───────────────────────────────────────────────────────────────

interface ProductCardProps {
    p: Product;
    index: number;
    onOpenDetails: (p: Product) => void;
    onGenerateCFDI: (p: Product) => void;
}

/**
 * Tarjeta de producto del catálogo con stock flotante en tiempo real.
 * Muestra imagen, nombre, precio, disponibilidad y controles de cantidad.
 */
export function ProductCard({ p, onOpenDetails, onGenerateCFDI }: ProductCardProps) {
    const { addToCart, floatingStock = {} } = useCart();
    const floatHold = floatingStock[p.id] || 0;
    const availableStock = Math.max(0, p.stock - floatHold);
    const [qty, setQty] = useState(availableStock > 0 ? 1 : 0);

    useEffect(() => {
        if (availableStock > 0 && qty === 0) setQty(1);
        if (availableStock === 0 && qty > 0) setQty(0);
        if (qty > availableStock && availableStock > 0) setQty(availableStock);
    }, [availableStock, qty]);

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
                className="w-full aspect-[4/3] relative block overflow-hidden bg-black"
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
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-red-500 font-black text-xl tracking-widest z-10 border-2 border-red-500/50 m-4 rounded-xl flex-col">
                        AGOTADO
                        {floatHold > 0 && <span className="text-xs text-yellow-400 mt-2 font-normal">({floatHold} en reserva)</span>}
                    </div>
                )}
            </button>

            {/* Info */}
            <div className="p-5 flex flex-col flex-1 relative">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-[0.65rem] font-bold tracking-widest uppercase text-slate-400 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
                        {p.category}
                    </span>
                    <button
                        type="button"
                        title="Generar Factura CFDI"
                        onClick={e => { e.stopPropagation(); onGenerateCFDI(p); }}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 p-1.5 rounded-md"
                    >
                        <FileText size={16} />
                    </button>
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
                            <div className="text-2xl font-black text-white">${p.price.toLocaleString()}</div>
                            <div className={`text-xs font-bold flex items-center gap-1 mt-1 ${availableStock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                <Package size={12} />
                                {availableStock > 0 ? `${availableStock} disponibles` : 'Sin stock'}
                            </div>
                        </div>
                    </div>

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
                                availableStock === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                            }`}
                            onClick={() => { if (availableStock > 0) addToCart(p, qty); }}
                            disabled={availableStock === 0}
                        >
                            <ShoppingCart size={18} />
                            {availableStock === 0 ? 'AGOTADO' : 'AGREGAR'}
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ── ProductDetailDrawer ───────────────────────────────────────────────────────

interface ProductDetailDrawerProps {
    product: Product | null;
    onClose: () => void;
    onFacturar: (p: Product) => void;
}

/**
 * Panel lateral deslizable con detalles del producto y reseñas en tiempo real.
 * El estado del producto seleccionado vive en MarketCatalog.
 */
export function ProductDetailDrawer({ product, onClose, onFacturar }: ProductDetailDrawerProps) {
    const { addToCart } = useCart();
    const [realReviews, setRealReviews] = useState<any[]>([]);
    const [cfdiProduct, setCfdiProduct] = useState<Product | null>(null);

    useEffect(() => {
        if (!product) { setRealReviews([]); return; }
        const q = query(
            collection(db, 'reviews'),
            where('productId', '==', product.id),
            orderBy('date', 'desc')
        );
        const unsub = onSnapshot(q, snap => {
            setRealReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, err => console.error("Error loading reviews:", err));
        return unsub;
    }, [product]);

    return (
        <>
            <AnimatePresence>
                {product && (
                    <div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-end z-[1000]"
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white w-full max-w-full sm:max-w-[520px] h-full overflow-y-auto p-6 sm:p-10 relative shadow-2xl"
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
                                <div className="w-full h-[250px] sm:h-[300px] bg-slate-50 rounded-2xl overflow-hidden shadow-inner">
                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                </div>

                                <div>
                                    <span className="text-[0.7rem] text-[#0ea5e9] font-black uppercase tracking-widest">{product.category}</span>
                                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 mb-3 leading-tight">{product.name}</h2>
                                    <div className="mb-4">
                                        <StarRating rating={product.rating} count={product.reviewCount} />
                                    </div>
                                    <div className="text-3xl sm:text-4xl font-black text-[#E30613]">
                                        ${product.price.toLocaleString()} <span className="text-sm align-middle text-slate-400">MXN</span>
                                    </div>
                                </div>

                                <p className="text-slate-600 leading-relaxed text-sm sm:text-base m-0 bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                    {product.description || "Excelente solución para tu negocio. Totalmente adaptable y configurable para ajustarlo a cualquier sector de venta."}
                                </p>

                                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                                    <button
                                        onClick={() => { addToCart(product, 1); toast.success(`${product.name} agregado al carrito.`, '🛒 Carrito'); }}
                                        disabled={product.stock === 0}
                                        className={`btn-sanjose flex-1 py-4 flex justify-center items-center gap-2 rounded-xl text-sm font-bold shadow-lg ${product.stock === 0 ? 'grayscale opacity-50 cursor-not-allowed' : 'active:scale-95 transition-all'}`}
                                    >
                                        <ShoppingCart size={18} /> {product.stock === 0 ? 'PRODUCTO AGOTADO' : 'AÑADIR AL CARRITO'}
                                    </button>
                                    <button
                                        onClick={() => { onClose(); onFacturar(product); }}
                                        className="bg-emerald-500 text-white hover:bg-emerald-600 px-6 py-4 flex justify-center items-center gap-2 rounded-xl font-bold transition-all active:scale-95"
                                    >
                                        <FileText size={18} /> FACTURAR
                                    </button>
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
                                            Aún no hay opiniones. ¡Sé el primero en calificarlo tras comprar!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {cfdiProduct && <CFDIModal product={cfdiProduct} onClose={() => setCfdiProduct(null)} />}
            </AnimatePresence>
        </>
    );
}
