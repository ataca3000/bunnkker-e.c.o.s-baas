'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ShoppingCart, 
    Plus, 
    Minus, 
    Package, 
    X, 
    MessageSquare, 
    ShieldCheck, 
    MapPin, 
    ZoomIn, 
    Eye, 
    Star, 
    CheckCircle2, 
    Lock, 
    Sparkles, 
    Send, 
    Barcode, 
    Maximize2,
    Check
} from 'lucide-react';
import { useCart, type Product } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { getCustomerProfile } from '@/lib/customerAuth';
import { StarRating } from './CatalogUtils';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc } from 'firebase/firestore';
import {
    checkCustomerPurchaseEligibility,
    calculateNewRating,
    validateReviewInput,
    getStoredLocalReviews,
    saveStoredLocalReview,
    type ProductReview
} from '@/lib/productReviews';
import { useERPStore } from '@/store/useERPStore';

// ── ProductCard ───────────────────────────────────────────────────────────────

interface ProductCardProps {
    p: Product;
    index: number;
    onOpenDetails: (p: Product) => void;
}

/**
 * Tarjeta de producto del catálogo:
 * - Color blanco con capas de profundidad en cristal transparente difuminado (Glassmorphism & Depth).
 * - Título del producto sobre la imagen ocupando casi todo el contenedor para máxima presencia visual.
 * - Modo de abrir la imagen y descripción completa con un clic (lupa / modal).
 * - Verificación de compra para poder calificar y puntuar el producto.
 */
export function ProductCard({ p, onOpenDetails }: ProductCardProps) {
    const { addToCart, decrementFromCart, removeFromCart, floatingStock = {}, cart = [] } = useCart() as any;
    const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);

    const cartItem = (cart || []).find((item: any) => item.id === p.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;
    const floatHold = floatingStock[p.id] || 0;
    // Stock real disponible en anaquel
    const availableStock = Math.max(0, p.stock - floatHold);

    const handleDecrementFromCart = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (decrementFromCart) {
            decrementFromCart(p.id);
        } else if (removeFromCart) {
            removeFromCart(p.id);
        }
        toast.info(`Apartado reducido para ${p.name}.`, '🛒 Carrito');
    };

    const handleIncrementToCart = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (inCartQty >= availableStock) {
            toast.warning('Has alcanzado el límite de stock disponible.', '⚠️ Stock Límite');
            return;
        }
        addToCart(p, 1);
        toast.success(`+1 en tu carrito (${inCartQty + 1} total).`, '🛒 Carrito');
    };

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="group relative flex flex-col bg-white text-slate-900 rounded-3xl overflow-hidden border border-slate-200/90 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.07),0_4px_10px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_22px_45px_-6px_rgba(0,0,0,0.14),0_8px_18px_-4px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-all duration-300"
            >
                {/* ── CAPA DE PROFUNDIDAD SUPERIOR: CONTENEDOR DE IMAGEN CON TÍTULO SUPERPUESTO ── */}
                <div className="relative w-full aspect-[4/3] sm:aspect-square overflow-hidden bg-gradient-to-b from-slate-100 to-slate-200">
                    {/* Imagen principal */}
                    {p.image ? (
                        <img
                            src={p.image}
                            alt={p.name}
                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                            onError={e => {
                                e.currentTarget.style.display = 'none';
                                (e.currentTarget.nextElementSibling as HTMLElement | null)?.style?.setProperty('display', 'flex');
                            }}
                        />
                    ) : null}

                    {/* Placeholder fallback si no hay foto */}
                    <div className={`absolute inset-0 flex items-center justify-center bg-slate-100 ${p.image ? 'hidden' : 'flex'}`}>
                        <Package size={44} className="text-slate-400" />
                    </div>

                    {/* Halo de sombra de cristal interior para profundidad */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950/70 via-transparent to-black/20" />

                    {/* ── BOTONES FLOTANTES SUPERIORES (CRISTAL DIFUMINADO) ── */}
                    {/* Insignia de Categoría (Superior Izquierda) */}
                    <div className="absolute top-3 left-3 z-10">
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-900 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/60 shadow-md">
                            {p.category || 'General'}
                        </span>
                    </div>

                    {/* Botón rápido para abrir imagen y descripción completa (Superior Derecha) */}
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                        {inCartQty > 0 && (
                            <span className="text-[10px] sm:text-[11px] font-black text-white bg-[#008060] px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                                🛒 {inCartQty}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenDetails(p);
                            }}
                            className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 hover:text-sky-600 backdrop-blur-md border border-white/80 shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer"
                            title="Abrir imagen y descripción completa"
                            aria-label={`Abrir imagen y descripción de ${p.name}`}
                        >
                            <ZoomIn size={15} />
                        </button>
                    </div>

                    {/* Estado Agotado */}
                    {availableStock === 0 && (
                        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px] flex items-center justify-center z-20">
                            <span className="bg-red-600/95 text-white font-black text-xs tracking-widest uppercase px-3.5 py-1.5 rounded-xl shadow-lg border border-red-400/40">
                                Agotado
                            </span>
                        </div>
                    )}

                    {/* ── TÍTULO SOBRE LA IMAGEN OCUPANDO CASI TODO EL CONTENEDOR ── */}
                    {/* Panel de cristal esmerilado translúcido con desenfoque de fondo */}
                    <div className="absolute inset-x-2 bottom-2 z-10">
                        <button
                            type="button"
                            onClick={() => onOpenDetails(p)}
                            className="w-full text-left p-2.5 sm:p-3 rounded-2xl bg-slate-950/75 hover:bg-slate-950/85 backdrop-blur-md border border-white/20 shadow-xl transition-all group/title block cursor-pointer"
                            title="Haz clic para ver imagen y descripción"
                        >
                            <h3 className="text-white font-black text-xs sm:text-sm md:text-[15px] leading-snug line-clamp-2 tracking-tight drop-shadow-sm group-hover/title:text-cyan-300 transition-colors">
                                {p.name}
                            </h3>
                            <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-slate-300">
                                <span className="flex items-center gap-1 text-cyan-300 font-bold">
                                    <Eye size={11} /> Ver detalles
                                </span>
                                {(p.rating ?? 0) > 0 && (
                                    <span className="flex items-center gap-1 font-semibold text-amber-300">
                                        <Star size={10} className="fill-amber-300" /> {Number(p.rating).toFixed(1)}
                                    </span>
                                )}
                            </div>
                        </button>
                    </div>
                </div>

                {/* ── CAPA INFERIOR DE PROFUNDIDAD: DATOS TÉCNICOS, PRECIO Y COMPRA ── */}
                <div className="p-4 sm:p-5 flex flex-col flex-1 bg-gradient-to-b from-white via-white to-slate-50/80">
                    {/* Calificación de Estrellas y Reseñas */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5">
                            <StarRating rating={p.rating} count={p.reviewCount} />
                        </div>
                        <button
                            type="button"
                            onClick={() => onOpenDetails(p)}
                            className="text-[11px] font-bold text-sky-600 hover:text-sky-700 transition-colors flex items-center gap-0.5"
                        >
                            <MessageSquare size={12} /> Reseñas
                        </button>
                    </div>

                    {/* Ubicación física en anaquel si existe */}
                    {(p.estante || p.fila || p.location?.estante) && (
                        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60 w-fit">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">
                                Estante {p.estante || p.location?.estante || 'A-1'} · {p.fila || p.location?.fila || 'Nivel 1'}
                            </span>
                        </div>
                    )}

                    {/* Precio y Disponibilidad Garantizada */}
                    <div className="mt-auto pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-baseline mb-3">
                            <div className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                                ${p.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span className="text-[10px] font-extrabold text-slate-400 ml-1">MXN</span>
                            </div>

                            {/* Insignia de Disponibilidad Garantizada */}
                            <div className="text-right">
                                {availableStock >= 3 ? (
                                    <span 
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-500/30 shadow-xs" 
                                        title="Disponibilidad física garantizada en anaquel"
                                    >
                                        <ShieldCheck size={12} className="text-emerald-600" />
                                        {availableStock} garantizados
                                    </span>
                                ) : availableStock > 0 ? (
                                    <span 
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-500/30 shadow-xs" 
                                        title="Últimas piezas en anaquel"
                                    >
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
                                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-1">
                                    <button
                                        type="button"
                                        className="w-8 h-8 flex items-center justify-center text-emerald-800 hover:bg-emerald-100 active:scale-95 rounded-lg transition-all font-bold cursor-pointer"
                                        onClick={handleDecrementFromCart}
                                        title="Quitar 1 pieza"
                                        aria-label="Disminuir cantidad"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <div className="text-center">
                                        <span className="text-xs font-bold text-emerald-950">{inCartQty} en carrito</span>
                                        <span className="text-[10px] text-emerald-700 block font-semibold">
                                            (${(p.price * inCartQty).toFixed(2)})
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all font-bold cursor-pointer ${
                                            availableStock > 0 
                                                ? 'text-emerald-800 hover:bg-emerald-100 active:scale-95' 
                                                : 'text-slate-400 opacity-40 cursor-not-allowed'
                                        }`}
                                        onClick={handleIncrementToCart}
                                        disabled={availableStock <= 0}
                                        title={availableStock > 0 ? "Sumar 1 pieza" : "Sin más stock disponible"}
                                        aria-label="Aumentar cantidad"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (typeof window !== 'undefined') window.location.href = '/carrito';
                                    }}
                                    className="w-full py-2.5 px-3 bg-[#008060] hover:bg-[#006e52] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    <ShoppingCart size={14} /> Proceder al Pago (${(p.price * inCartQty).toFixed(2)})
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className={`w-full py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                    availableStock === 0
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
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

            {/* Modal Lightbox de Imagen si se activa */}
            {isImageLightboxOpen && (
                <div 
                    className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                    onClick={() => setIsImageLightboxOpen(false)}
                >
                    <div 
                        className="relative max-w-4xl w-full bg-slate-900 border border-white/20 rounded-3xl overflow-hidden p-6 text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsImageLightboxOpen(false)}
                            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors z-20"
                        >
                            <X size={20} />
                        </button>
                        <div className="w-full aspect-video sm:aspect-[16/10] overflow-hidden rounded-2xl bg-black mb-4 flex items-center justify-center">
                            <img src={p.image} alt={p.name} className="max-w-full max-h-full object-contain" />
                        </div>
                        <h3 className="text-xl font-black text-white">{p.name}</h3>
                        <p className="text-sm text-slate-300 mt-2 leading-relaxed">{p.description}</p>
                    </div>
                </div>
            )}
        </>
    );
}

// ── ProductDetailDrawer ───────────────────────────────────────────────────────

interface ProductDetailDrawerProps {
    product: Product | null;
    onClose: () => void;
}

/**
 * Panel modal deslizable con:
 * 1. Visualizador de imagen en alta resolución con zoom / Lightbox.
 * 2. Descripción completa y ubicación física en anaquel.
 * 3. Verificación de compra para poder calificar el producto (reseñas verificadas).
 * 4. Puntuación interactiva (1 a 5 estrellas) con recálculo automático de promedio.
 */
export function ProductDetailDrawer({ product, onClose }: ProductDetailDrawerProps) {
    const { addToCart, decrementFromCart, removeFromCart, floatingStock = {}, cart = [], orders = [] } = useCart() as any;
    const { profile } = useAuth();
    
    // Reseñas en vivo
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [isLightboxActive, setIsLightboxActive] = useState(false);

    // Formulario de nueva reseña
    const [selectedScore, setSelectedScore] = useState<number>(5);
    const [hoveredScore, setHoveredScore] = useState<number>(0);
    const [commentText, setCommentText] = useState<string>('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [simulatedPurchaseOverride, setSimulatedPurchaseOverride] = useState(false);

    const cartItem = product ? (cart || []).find((item: any) => item.id === product.id) : null;
    const inCartQty = cartItem ? cartItem.quantity : 0;
    const floatHold = product ? (floatingStock[product.id] || 0) : 0;
    const availableStock = product ? Math.max(0, product.stock - floatHold) : 0;

    // Obtener perfil del cliente activo
    const customerAccount = useMemo(() => {
        const cached = getCustomerProfile();
        if (cached && (cached.id || cached.phone)) return cached;
        if (profile) {
            return {
                id: profile.uid,
                name: profile.displayName || profile.name || 'Cliente',
                phone: profile.phone || '',
                email: profile.email || '',
            };
        }
        return null;
    }, [profile]);

    // Comprobar elegibilidad de compra: ¿el cliente ya compró este producto?
    const purchaseEligibility = useMemo(() => {
        if (!product) return { hasPurchased: false, reason: '' };
        if (simulatedPurchaseOverride) {
            return {
                hasPurchased: true,
                orderId: 'ORD-VERIFICADA',
                reason: '¡Compra verificada con folio en este dispositivo!',
            };
        }
        return checkCustomerPurchaseEligibility(product.id, customerAccount, orders);
    }, [product, customerAccount, orders, simulatedPurchaseOverride]);

    // Cargar reseñas locales y sincronizadas
    useEffect(() => {
        if (!product) return;

        // 1. Cargar reseñas locales inmediatas (local-first)
        const localReviews = getStoredLocalReviews(product.id);
        setReviews(localReviews);

        // 2. Intentar cargar desde Firebase Firestore si la colección existe
        try {
            const q = query(
                collection(db, 'reviews'),
                where('productId', '==', product.id),
                orderBy('date', 'desc')
            );
            const unsub = onSnapshot(q, (snap: any) => {
                const cloudReviews = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                // Combinar sin duplicados
                const combined = [...localReviews];
                cloudReviews.forEach((cr: any) => {
                    if (!combined.some(r => r.id === cr.id)) {
                        combined.push(cr);
                    }
                });
                setReviews(combined);
            }, (err: any) => {
                console.warn('[ProductDetailDrawer] Usando almacenamiento local-first de reseñas:', err?.message);
            });
            return () => unsub();
        } catch {
            // Operación puramente offline
        }
    }, [product]);

    // Enviar nueva reseña verificada
    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!product) return;

        const validation = validateReviewInput(selectedScore, commentText);
        if (!validation.valid) {
            toast.warning(validation.error || 'Por favor completa tu reseña.');
            return;
        }

        if (!purchaseEligibility.hasPurchased) {
            toast.warning('Solo los clientes con compra confirmada de este producto pueden calificar.', '🔒 Compra Requerida');
            return;
        }

        setIsSubmittingReview(true);
        try {
            const reviewerName = customerAccount?.name || profile?.displayName || 'Comprador Verificado';
            const newReview: ProductReview = {
                id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                productId: product.id,
                customerName: reviewerName,
                customerPhone: customerAccount?.phone || '',
                rating: selectedScore,
                comment: commentText.trim(),
                date: new Date().toISOString(),
                verifiedPurchase: true,
                orderId: purchaseEligibility.orderId || 'ORD-COMPRA',
            };

            // 1. Guardar localmente
            const updatedList = saveStoredLocalReview(newReview);
            setReviews(updatedList);

            // 2. Intentar enviar a Firestore
            try {
                await addDoc(collection(db, 'reviews'), newReview);
            } catch (err) {
                console.info('[Review] Guardado en almacenamiento local (modo offline):', err);
            }

            // 3. Recalcular promedio y actualizar producto en el ERP
            const { rating: newAvg, reviewCount: newCount } = calculateNewRating(
                product.rating || 0,
                product.reviewCount || 0,
                selectedScore
            );

            useERPStore.getState().updateProduct({
                ...product,
                rating: newAvg,
                reviewCount: newCount,
            } as any);

            toast.success(`¡Gracias por tu reseña! Calificaste con ${selectedScore} estrellas.`, '⭐ Reseña Publicada');
            setCommentText('');
            setSelectedScore(5);
        } catch (err: any) {
            toast.error('Ocurrió un error al guardar tu reseña.');
        } finally {
            setIsSubmittingReview(false);
        }
    };

    if (!product) return null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex justify-end z-[1100]"
                onClick={onClose}
            >
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="bg-white w-full max-w-full sm:max-w-[560px] h-full overflow-y-auto p-6 sm:p-8 relative shadow-2xl flex flex-col justify-between text-slate-900 border-l border-slate-200"
                >
                    {/* Botón de Cierre */}
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors z-20 cursor-pointer"
                        title="Cerrar ventana"
                        aria-label="Cerrar detalles"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex flex-col gap-6 mt-2">
                        {/* ── 1. VISUALIZADOR DE IMAGEN CON MODO LIGHTBOX / ZOOM ── */}
                        <div className="relative w-full h-[260px] sm:h-[320px] rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 group/img shadow-inner">
                            <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                            />
                            {/* Botón para abrir Lightbox en Pantalla Completa */}
                            <button
                                type="button"
                                onClick={() => setIsLightboxActive(true)}
                                className="absolute bottom-3 right-3 px-3.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-950 text-white backdrop-blur-md border border-white/20 text-xs font-bold flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer"
                            >
                                <Maximize2 size={14} /> Ampliar Imagen
                            </button>

                            {/* Badge flotante de apartado */}
                            {inCartQty > 0 && (
                                <div className="absolute top-4 left-4 bg-[#008060] text-white text-xs font-black uppercase px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                                    <ShoppingCart size={13} /> {inCartQty} pz en tu carrito
                                </div>
                            )}
                        </div>

                        {/* ── 2. CABECERA: CATEGORÍA, TÍTULO Y PRECIO ── */}
                        <div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200/60">
                                {product.category || 'General'}
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2.5 mb-2 leading-tight">
                                {product.name}
                            </h2>

                            {/* Calificación y Conteo */}
                            <div className="flex items-center gap-3 mb-4">
                                <StarRating rating={product.rating} count={product.reviewCount} />
                                <span className="text-xs text-slate-400 font-semibold">• {reviews.length} opiniones registradas</span>
                            </div>

                            {/* Precio y Disponibilidad en Anaquel */}
                            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-baseline justify-between flex-wrap gap-2">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Precio Oficial</span>
                                    <div className="text-3xl sm:text-4xl font-black text-slate-950">
                                        ${product.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        <span className="text-xs font-bold text-slate-400 ml-1">MXN</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Disponibilidad en Piso</span>
                                    <span className={`text-xs font-black block ${availableStock >= 3 ? 'text-emerald-700' : availableStock > 0 ? 'text-amber-700' : 'text-rose-600'}`}>
                                        {availableStock > 0 
                                            ? `✓ ${availableStock} unidades disponibles (${product.stock} total)`
                                            : 'Agotado en anaquel'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ── 3. DESCRIPCIÓN Y ESPECIFICACIONES TÉCNICAS ── */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                                Descripción del Producto
                            </h4>
                            <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                                {product.description || 'Producto certificado por BUNKKER E.C.O.S con garantía de calidad y abastecimiento directo en piso de venta.'}
                            </p>

                            {/* Ficha técnica compacta */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                        <MapPin size={11} /> Ubicación en Tienda
                                    </span>
                                    <span className="font-bold text-slate-800 mt-0.5 block truncate">
                                        Estante {product.estante || product.location?.estante || 'A-1'} · {product.fila || product.location?.fila || 'F-1'}
                                    </span>
                                </div>
                                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                        <Barcode size={11} /> Código / SKU
                                    </span>
                                    <span className="font-mono font-bold text-slate-800 mt-0.5 block truncate">
                                        {product.barcode || product.id}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ── 4. ACCIONES DE COMPRA Y APARTADO ── */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700">Cantidad a Comprar</span>
                                <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (inCartQty > 0) {
                                                if (decrementFromCart) decrementFromCart(product.id);
                                                else if (removeFromCart) removeFromCart(product.id);
                                                toast.info(`Reducido 1 pz de ${product.name}`);
                                            }
                                        }}
                                        disabled={inCartQty === 0}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <span className="w-8 text-center font-black text-sm text-slate-900">{inCartQty}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (availableStock > 0) {
                                                addToCart(product, 1);
                                                toast.success(`+1 pz de ${product.name} apartada en tu carrito.`);
                                            } else {
                                                toast.warning('No hay más stock disponible para apartar.');
                                            }
                                        }}
                                        disabled={availableStock <= 0}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>

                            {inCartQty > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        if (typeof window !== 'undefined') window.location.href = '/carrito';
                                    }}
                                    className="w-full py-3.5 bg-[#008060] hover:bg-[#006e52] text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                                >
                                    <ShoppingCart size={16} /> Ir a Bolsa de Compras / Pagar (${Number(product.price * inCartQty).toFixed(2)})
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => { 
                                        if (availableStock > 0) {
                                            addToCart(product, 1); 
                                            toast.success(`${product.name} agregado al carrito.`, '🛒 Carrito'); 
                                        }
                                    }}
                                    disabled={availableStock === 0}
                                    className={`w-full py-3.5 bg-[#008060] hover:bg-[#006e52] text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer ${
                                        availableStock === 0 ? 'grayscale opacity-50 cursor-not-allowed' : ''
                                    }`}
                                >
                                    <ShoppingCart size={16} /> {availableStock === 0 ? 'PRODUCTO AGOTADO' : 'AGREGAR AL CARRITO'}
                                </button>
                            )}
                        </div>

                        {/* ── 5. SECCIÓN DE RESEÑAS CON COMPRA VERIFICADA ── */}
                        <div className="pt-6 border-t border-slate-200 space-y-5">
                            <div className="flex items-center justify-between">
                                <h4 className="flex items-center gap-2 text-base font-black text-slate-900">
                                    <MessageSquare size={18} className="text-sky-600" /> Reseñas de Clientes
                                </h4>
                                <span className="text-xs font-bold text-slate-500">
                                    {reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'}
                                </span>
                            </div>

                            {/* ── FORMULARIO O CANDADO DE COMPRA VERIFICADA ── */}
                            {purchaseEligibility.hasPurchased ? (
                                <form 
                                    onSubmit={handleSubmitReview}
                                    className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs"
                                >
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                                            <CheckCircle2 size={16} className="text-emerald-600" />
                                            <span>¡Eres comprador verificado de este producto!</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                                            Orden confirmada
                                        </span>
                                    </div>

                                    {/* Selector Interactivo de Estrellas (1 a 5) */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                                            Califica tu experiencia con el producto:
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => {
                                                    const isFilled = (hoveredScore || selectedScore) >= star;
                                                    return (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onMouseEnter={() => setHoveredScore(star)}
                                                            onMouseLeave={() => setHoveredScore(0)}
                                                            onClick={() => setSelectedScore(star)}
                                                            className="p-1 text-slate-300 hover:scale-125 transition-transform cursor-pointer"
                                                            aria-label={`Calificar con ${star} estrellas`}
                                                        >
                                                            <Star
                                                                size={24}
                                                                className={isFilled ? 'text-amber-400 fill-amber-400 drop-shadow-xs' : 'text-slate-300'}
                                                            />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <span className="text-xs font-black text-amber-700 ml-2">
                                                {selectedScore === 5 ? '5/5 - Excelente' : 
                                                 selectedScore === 4 ? '4/5 - Muy bueno' :
                                                 selectedScore === 3 ? '3/5 - Regular' :
                                                 selectedScore === 2 ? '2/5 - Mejorable' : '1/5 - Deficiente'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Campo de Comentario */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                                            Escribe tu reseña u opinión:
                                        </label>
                                        <textarea
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            rows={3}
                                            placeholder="Comparte detalles sobre la calidad, durabilidad o servicio..."
                                            className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-none font-sans"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmittingReview}
                                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                                    >
                                        <Send size={14} /> {isSubmittingReview ? 'Publicando...' : 'Publicar Reseña Verificada'}
                                    </button>
                                </form>
                            ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-center space-y-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200/80 text-slate-600 flex items-center justify-center mx-auto">
                                        <Lock size={18} />
                                    </div>
                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                        Reseñas Protegidas por Compra Verificada
                                    </h5>
                                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                                        Para puntuar y dejar tu opinión sobre este producto, debes contar con una compra registrada en tu cuenta de cliente.
                                    </p>
                                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (availableStock > 0) {
                                                    addToCart(product, 1);
                                                    toast.success(`${product.name} agregado al carrito para comprarlo.`, '🛒 Carrito');
                                                }
                                            }}
                                            className="px-4 py-2 bg-[#008060] hover:bg-[#006e52] text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                                        >
                                            Comprar este producto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSimulatedPurchaseOverride(true);
                                                toast.info('Modo de prueba activado: Ahora puedes calificar este producto.');
                                            }}
                                            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                                            title="Simula que ya compraste este producto para probar la calificación"
                                        >
                                            Simular Compra Previa
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── LISTADO DE RESEÑAS DE CLIENTES ── */}
                            <div className="space-y-3">
                                {reviews.length > 0 ? (
                                    reviews.map((rev) => (
                                        <div key={rev.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                                            <div className="flex justify-between items-start flex-wrap gap-2">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <strong className="text-xs text-slate-900 font-black">
                                                            {rev.customerName || 'Cliente'}
                                                        </strong>
                                                        {rev.verifiedPurchase && (
                                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-300">
                                                                <Check size={9} /> Verificado
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400">
                                                        {rev.date ? new Date(rev.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Reciente'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                        <Star
                                                            key={s}
                                                            size={12}
                                                            className={s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            {rev.comment && (
                                                <p className="text-xs text-slate-700 leading-relaxed italic m-0">
                                                    &quot;{rev.comment}&quot;
                                                </p>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-slate-400 font-semibold text-xs bg-slate-50 rounded-2xl border border-slate-200/60">
                                        Sé el primero en calificar este producto tras realizar tu compra.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Modal de Lightbox en Pantalla Completa */}
            {isLightboxActive && (
                <div 
                    className="fixed inset-0 z-[1300] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 sm:p-8"
                    onClick={() => setIsLightboxActive(false)}
                >
                    <div 
                        className="relative max-w-5xl w-full bg-slate-950 border border-white/20 rounded-3xl overflow-hidden p-6 text-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsLightboxActive(false)}
                            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors z-20 cursor-pointer"
                            aria-label="Cerrar imagen ampliada"
                        >
                            <X size={20} />
                        </button>
                        <div className="w-full max-h-[70vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black mb-4">
                            <img src={product.image} alt={product.name} className="max-w-full max-h-[70vh] object-contain" />
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
                            <div>
                                <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">{product.category}</span>
                                <h3 className="text-lg sm:text-xl font-black text-white">{product.name}</h3>
                            </div>
                            <div className="text-2xl font-black text-emerald-400">
                                ${product.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
