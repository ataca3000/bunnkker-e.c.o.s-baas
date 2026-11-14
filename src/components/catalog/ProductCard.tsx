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
import { ImageCardOfferOverlay } from '@/components/marketing/TimedOfferBanners';
import type { TimedOfferBanner, StorefrontPageId } from '@/lib/storefrontBuilder';

// ── ProductCard ───────────────────────────────────────────────────────────────

interface ProductCardProps {
    p: Product;
    index: number;
    onOpenDetails: (p: Product) => void;
    timedBannersOverride?: TimedOfferBanner[];
    pageId?: StorefrontPageId;
    isEditMode?: boolean;
    isPreview?: boolean;
    onEditBanner?: (banner: TimedOfferBanner) => void;
}

/**
 * Tarjeta de producto del catálogo:
 * - Color blanco con capas de profundidad en cristal transparente difuminado (Glassmorphism & Depth).
 * - Título del producto sobre la imagen ocupando casi todo el contenedor para máxima presencia visual.
 * - Modo de abrir la imagen y descripción completa con un clic (lupa / modal).
 * - Verificación de compra para poder calificar y puntuar el producto.
 */
export function ProductCard({
    p,
    onOpenDetails,
    timedBannersOverride,
    pageId = 'catalogo',
    isEditMode = false,
    isPreview = false,
    onEditBanner,
}: ProductCardProps) {
    const { addToCart, decrementFromCart, removeFromCart, floatingStock = {}, cart = [], siteConfig } = useCart() as any;
    const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
    const [isPressedOrTouched, setIsPressedOrTouched] = useState(false);
    const activeTimedBanners: TimedOfferBanner[] = timedBannersOverride ?? siteConfig?.timedBanners ?? [];

    const cartItem = (cart || []).find((item: any) => item.id === p.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;
    const floatHold = floatingStock[p.id] || 0;
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                onTouchStart={() => setIsPressedOrTouched(true)}
                onTouchEnd={() => setIsPressedOrTouched(false)}
                onTouchCancel={() => setIsPressedOrTouched(false)}
                onPointerDown={() => setIsPressedOrTouched(true)}
                onPointerUp={() => setIsPressedOrTouched(false)}
                onPointerCancel={() => setIsPressedOrTouched(false)}
                onClick={() => onOpenDetails(p)}
                className={`group relative flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer select-none ${
                    isPressedOrTouched
                        ? 'border-emerald-400/80 shadow-[0_20px_42px_-8px_rgba(0,128,96,0.28)]'
                        : 'border-slate-200/90 dark:border-slate-800 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_22px_44px_-8px_rgba(0,0,0,0.18)] hover:border-slate-300 dark:hover:border-slate-600'
                }`}
            >
                {/* ── 1. CONTENEDOR DOMINANTE DE IMAGEN CON CONTROLES SUPERPUESTOS ── */}
                <div className="relative w-full h-[300px] sm:h-[340px] overflow-hidden bg-slate-900">
                    {p.image ? (
                        <img
                            src={p.image}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            className={`w-full h-full object-cover transition-transform duration-300 ease-out will-change-transform group-hover:scale-110 ${
                                isPressedOrTouched ? 'scale-105' : 'scale-100'
                            }`}
                            onError={e => {
                                e.currentTarget.style.display = 'none';
                                (e.currentTarget.nextElementSibling as HTMLElement | null)?.style?.setProperty('display', 'flex');
                            }}
                        />
                    ) : null}

                    {/* div:nth-of-type(1) Fallback visual */}
                    <div className={`absolute inset-0 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 ${p.image ? 'hidden' : 'flex'}`}>
                        <Package size={48} className="text-slate-500" />
                    </div>

                    {/* div:nth-of-type(2) Scrim superior/inferior medido + brillo reactivo al cursor/dedo */}
                    <div
                        className={`absolute inset-0 pointer-events-none transition-opacity duration-200 bg-gradient-to-t from-slate-950/95 via-slate-950/35 to-black/25 ${
                            isPressedOrTouched ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'
                        }`}
                    />

                    {/* div:nth-of-type(3) Metadato superior izquierdo sin pill excesivo */}
                    <div className="absolute top-3 left-3 right-14 z-20 pointer-events-none flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                        <span className="truncate">{p.category || 'General'}</span>
                        {(p.rating ?? 0) > 0 && (
                            <>
                                <span aria-hidden="true" className="text-white/60">·</span>
                                <span className="inline-flex items-center gap-0.5 text-amber-300 tabular-nums shrink-0">
                                    <Star size={11} className="fill-amber-300" /> {Number(p.rating).toFixed(1)}
                                </span>
                            </>
                        )}
                    </div>

                    {/* div:nth-of-type(4) Botones rápidos flotantes sobre imagen (Zoom y Detalles) */}
                    <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsImageLightboxOpen(true);
                            }}
                            className={`w-10 h-10 rounded-xl backdrop-blur-md border border-white/25 text-white flex items-center justify-center transition-all duration-150 cursor-pointer shadow-lg ${
                                isPressedOrTouched
                                    ? 'bg-emerald-500/85 scale-105 border-emerald-300'
                                    : 'bg-slate-950/55 hover:bg-white hover:text-slate-950 hover:scale-110 active:scale-95'
                            }`}
                            title="Ampliar imagen"
                            aria-label={`Ampliar imagen de ${p.name}`}
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    {/* div:nth-of-type(5) Superposición inferior sobre imagen (201.714px) con título y botones táctiles/hover */}
                    <div
                        style={{ height: '201.714px' }}
                        className="absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end p-3 sm:p-3.5 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-transparent"
                    >
                        <div className="mb-2.5 transition-transform duration-200 group-hover:-translate-y-0.5">
                            <h3 className="text-white font-bold text-sm sm:text-[15px] leading-snug line-clamp-2 tracking-tight drop-shadow-sm group-hover:text-emerald-300 transition-colors">
                                {p.name}
                            </h3>
                            {(p.estante || p.fila || p.location?.estante) && (
                                <p className="mt-0.5 text-[11px] text-slate-300/90 flex items-center gap-1 truncate">
                                    <MapPin size={11} className="text-slate-400 shrink-0" />
                                    <span className="truncate">
                                        {p.estante || p.location?.estante || 'A-1'} · {p.fila || p.location?.fila || 'N1'}
                                    </span>
                                </p>
                            )}
                        </div>

                        {/* Botones interactivos directamente sobre la imagen */}
                        {inCartQty > 0 ? (
                            <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between gap-1 bg-slate-900/80 backdrop-blur-md border border-white/25 rounded-xl p-1 shadow-lg transition-all duration-150 group-hover:border-emerald-400/60">
                                    <button
                                        type="button"
                                        className="w-10 h-9 flex items-center justify-center text-white bg-white/10 hover:bg-white/25 active:scale-90 rounded-lg transition-all cursor-pointer"
                                        onClick={handleDecrementFromCart}
                                        title="Quitar 1 pieza"
                                        aria-label="Disminuir cantidad"
                                    >
                                        <Minus size={15} />
                                    </button>
                                    <span className="text-xs font-bold text-white tabular-nums px-1 whitespace-nowrap">
                                        {inCartQty} en bolsa
                                    </span>
                                    <button
                                        type="button"
                                        className={`w-10 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                                            availableStock > 0
                                                ? 'text-white bg-emerald-500/80 hover:bg-emerald-400 hover:text-slate-950 active:scale-90'
                                                : 'text-slate-400 opacity-40 cursor-not-allowed'
                                        }`}
                                        onClick={handleIncrementToCart}
                                        disabled={availableStock <= 0}
                                        title={availableStock > 0 ? 'Sumar 1 pieza' : 'Sin más stock disponible'}
                                        aria-label="Aumentar cantidad"
                                    >
                                        <Plus size={15} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (typeof window !== 'undefined') window.location.href = '/carrito';
                                        }}
                                        className="flex-1 h-10 px-3 bg-[#008060] hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition-all duration-150 whitespace-nowrap cursor-pointer"
                                    >
                                        <ShoppingCart size={14} /> Pagar (${(p.price * inCartQty).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenDetails(p);
                                        }}
                                        className="w-10 h-10 shrink-0 rounded-xl bg-white/15 hover:bg-white hover:text-slate-950 active:scale-90 text-white backdrop-blur-md border border-white/25 flex items-center justify-center transition-all duration-150 cursor-pointer"
                                        title="Ver ficha completa"
                                        aria-label={`Ver detalles de ${p.name}`}
                                    >
                                        <Eye size={15} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className={`flex-1 h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 whitespace-nowrap cursor-pointer shadow-lg ${
                                        availableStock === 0
                                            ? 'bg-slate-800/85 text-slate-400 cursor-not-allowed border border-white/10'
                                            : isPressedOrTouched
                                                ? 'bg-emerald-500 text-slate-950 scale-[1.02]'
                                                : 'bg-[#008060]/95 hover:bg-emerald-500 hover:text-slate-950 active:scale-95 text-white backdrop-blur-md border border-emerald-400/40 group-hover:shadow-emerald-500/30'
                                    }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (availableStock > 0) {
                                            addToCart(p, 1);
                                            toast.success(`${p.name} agregado al carrito.`, '🛒 Carrito');
                                        }
                                    }}
                                    disabled={availableStock === 0}
                                >
                                    <ShoppingCart size={14} />
                                    <span>{availableStock === 0 ? 'Agotado' : 'Agregar'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenDetails(p);
                                    }}
                                    className={`w-10 h-10 shrink-0 rounded-xl backdrop-blur-md border border-white/25 flex items-center justify-center transition-all duration-150 cursor-pointer ${
                                        isPressedOrTouched
                                            ? 'bg-white text-slate-950 scale-105'
                                            : 'bg-slate-950/60 hover:bg-white hover:text-slate-950 active:scale-90 text-white'
                                    }`}
                                    title="Ver detalles y reseñas"
                                    aria-label={`Ver detalles de ${p.name}`}
                                >
                                    <Eye size={15} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Estado Agotado */}
                    {availableStock === 0 && (
                        <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
                            <span className="bg-red-600/95 text-white font-bold text-xs tracking-wider uppercase px-3 py-1 rounded-lg shadow-lg border border-red-400/40">
                                Agotado
                            </span>
                        </div>
                    )}

                    {/* Banner Dinámico de Oferta Superpuesto sobre la Imagen del Producto */}
                    {activeTimedBanners.length > 0 && (
                        <ImageCardOfferOverlay
                            banners={activeTimedBanners}
                            surface="catalog_product"
                            pageId={pageId}
                            category={p.category || 'General'}
                            isEditMode={isEditMode}
                            isPreview={isPreview}
                            onEditBanner={onEditBanner}
                            compact
                        />
                    )}
                </div>

                {/* ── 2. FRANJA INFERIOR COMPACTA (54.93px): PRECIO Y DISPONIBILIDAD ── */}
                <div
                    style={{ height: '54.93px' }}
                    className="px-3.5 sm:px-4 flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
                >
                    <div className="text-base sm:text-lg font-black text-slate-950 dark:text-white tracking-tight tabular-nums truncate">
                        ${p.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-[10px] font-bold text-slate-400 ml-1">MXN</span>
                    </div>

                    <div className="shrink-0 text-right">
                        {availableStock >= 3 ? (
                            <span
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap"
                                title="Disponibilidad física garantizada en anaquel"
                            >
                                <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                {availableStock} disp.
                            </span>
                        ) : availableStock > 0 ? (
                            <span
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 tabular-nums whitespace-nowrap"
                                title="Últimas piezas en anaquel"
                            >
                                Últ. {availableStock}
                            </span>
                        ) : (
                            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">Sin stock</span>
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
