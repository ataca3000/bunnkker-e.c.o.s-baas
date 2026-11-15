"use client";

/**
 * MarketCatalog — Orquestador del catálogo público (BUNKKER E.C.O.S ERP)
 *
 * Responsabilidad única: estado de filtros, búsqueda y paginación.
 * El UI está dividido en subcomponentes especializados en /catalog/:
 *   - CategoryFilter    → pastillas de filtro por categoría
 *   - PromoBanners      → banners del Canvas Editor
 *   - ProductCard       → tarjeta individual de producto
 *   - ProductDetailDrawer → panel lateral con detalles y reseñas
 */

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, QrCode } from 'lucide-react';
import { useCart, type Product } from '@/context/CartContext';
import BarcodeScanner from './BarcodeScanner';
import { CategoryFilter, PromoBanners } from './catalog/CatalogFilters';
import { ProductCard, ProductDetailDrawer } from './catalog/ProductCard';
import { toast } from '@/lib/toast';
import { findProductByBarcodeOrCode, matchesProductSearch } from '@/lib/barcodeLookup';
import type { TimedOfferBanner, StorefrontPageId } from '@/lib/storefrontBuilder';

export default function MarketCatalog({
    initialCategory,
    hideHeader,
    timedBannersOverride,
    pageId,
    isEditMode,
    isPreview,
    onEditBanner,
}: {
    initialCategory?: string;
    hideHeader?: boolean;
    timedBannersOverride?: TimedOfferBanner[];
    pageId?: StorefrontPageId;
    isEditMode?: boolean;
    isPreview?: boolean;
    onEditBanner?: (banner: TimedOfferBanner) => void;
}) {
    const { products: contextProducts, cart, loading, siteConfig, addToCart } = useCart();
    const searchParams = useSearchParams();

    const [filter, setFilter]               = useState(initialCategory || 'Todos');
    const [search, setSearch]               = useState('');
    const [showScanner, setShowScanner]     = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [visibleCount, setVisibleCount]   = useState(24);

    // Leer parámetro ?search= de la URL (enviado por Navbar al escanear)
    const [prevUrlSearch, setPrevUrlSearch] = useState<string | null>(null);
    const urlSearch = searchParams.get('search');
    if (urlSearch && urlSearch !== prevUrlSearch) {
        setPrevUrlSearch(urlSearch);
        setSearch(urlSearch);
    }

    // Reiniciar paginación al cambiar filtro o búsqueda
    const [prevFilter, setPrevFilter] = useState(filter);
    const [prevSearch, setPrevSearch] = useState(search);
    if (filter !== prevFilter || search !== prevSearch) {
        setPrevFilter(filter);
        setPrevSearch(search);
        setVisibleCount(24);
    }

    const handleScan = (decodedText: string) => {
        const clean = decodedText.trim();
        const product = findProductByBarcodeOrCode(contextProducts, clean);
        setFilter('Todos');
        setSearch(product?.barcode || clean);
        if (product) {
            setSelectedProduct(product);
            toast.success(
                `${product.name} · $${Number(product.price || 0).toLocaleString('es-MX')} MXN (${product.stock} disp.)`,
                '🔍 Código Identificado'
            );
        } else {
            toast.warning(`No se encontró un producto con código "${clean}".`, '🔍 Búsqueda por Escáner');
        }
        setShowScanner(false);
    };

    // Categorías únicas derivadas de los productos con fallback a 'General'
    const uniqueCategories = Array.from(new Set(contextProducts.map(p => p.category || 'General'))).filter(Boolean).sort() as string[];

    // Banners del Canvas Editor
    const catalogBanners = (siteConfig.layout || []).filter((b: any) => b.type === 'banner' && b.visible !== false);

    // Ordenar por productOrder del siteConfig: los productos nuevos van al inicio para visibilidad inmediata
    const sorted = [...contextProducts].sort((a, b) => {
        if (!siteConfig.productOrder || siteConfig.productOrder.length === 0) {
            return (b.orderIndex ?? 0) - (a.orderIndex ?? 0);
        }
        const ia = siteConfig.productOrder.indexOf(a.id);
        const ib = siteConfig.productOrder.indexOf(b.id);
        if (ia === -1 && ib === -1) {
            return (b.orderIndex ?? 0) - (a.orderIndex ?? 0);
        }
        if (ia === -1) return -1; // Los productos nuevos se colocan al frente
        if (ib === -1) return 1;
        return ia - ib;
    });

    const filtered = sorted.filter(p => {
        const prodCat = p.category || 'General';
        const matchFilter = filter === 'Todos' || prodCat === filter;
        const matchSearch = matchesProductSearch(p, search);
        return matchFilter && matchSearch;
    });

    if (loading) {
        return (
            <div className="text-center py-32 text-slate-500 text-xl font-bold">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ea5e9] mr-3" />
                Iniciando ecosistema comercial...
            </div>
        );
    }

    return (
        <section id="catalogo" className="py-16 px-4 sm:px-8 w-full">

            {/* Encabezado del catálogo */}
            {!hideHeader ? (
                <div className="flex justify-between items-center mb-12 flex-wrap gap-6">
                    <div>
                        <h2 className="text-4xl font-black text-white tracking-tighter drop-shadow-md">CATÁLOGO DE PRODUCTOS & COMPRAS</h2>
                        <p className="text-slate-400 mt-1 font-medium">Explora materiales, herramientas y artículos con stock confirmado en anaquel para compra y entrega inmediata.</p>
                    </div>
                    <div className="flex gap-3 items-center flex-wrap">
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="bunkker-btn px-5 py-3 flex items-center gap-2 rounded-xl text-sm shadow-lg shadow-blue-900/10 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/40 transition-colors"
                        >
                            🔑 INICIAR SESIÓN
                        </button>
                        <button
                            onClick={() => setShowScanner(true)}
                            className="bunkker-btn px-5 py-3 flex items-center gap-2 rounded-xl text-sm shadow-lg shadow-blue-900/10"
                        >
                            <QrCode size={18} /> ESCANEAR
                        </button>
                        <div className="relative group">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar código o nombre..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-11 pr-4 py-3 rounded-xl border border-white/10 w-full sm:w-[280px] outline-none text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-slate-800/50 backdrop-blur-md placeholder-slate-500"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex justify-end items-center mb-6 gap-3">
                    <button
                        onClick={() => setShowScanner(true)}
                        className="bunkker-btn px-4 py-2 flex items-center gap-2 rounded-[27px] text-lg bg-slate-800 border border-white/10 text-white hover:bg-slate-700"
                    >
                        <QrCode size={16} /> Escanear
                    </button>
                </div>
            )}

            {/* Filtros de categoría */}
            <CategoryFilter
                categories={uniqueCategories}
                selected={filter}
                onSelect={setFilter}
            />

            {/* Banners promocionales */}
            <PromoBanners banners={catalogBanners} activeFilter={filter} />

            {/* Grid del catálogo */}
            <div className="mt-6 mb-12">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#008060] flex items-center gap-1.5 mb-1">
                            Colección Disponible
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            {filter === 'Todos' ? 'Todos los Productos' : filter}
                        </h2>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full self-start sm:self-auto">
                        {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
                    </span>
                </div>

                <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 auto-rows-auto">
                    {filtered.length > 0 ? (
                        filtered.slice(0, visibleCount).map((p, index) => (
                            <ProductCard
                                key={p.id}
                                p={p}
                                index={index}
                                onOpenDetails={setSelectedProduct}
                                timedBannersOverride={timedBannersOverride}
                                pageId={pageId}
                                isEditMode={isEditMode}
                                isPreview={isPreview}
                                onEditBanner={onEditBanner}
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 font-medium">
                            No se encontraron productos disponibles en esta categoría.
                        </div>
                    )}
                </motion.div>

                {/* Cargar más productos */}
                {visibleCount < filtered.length && (
                    <div className="flex justify-center py-8">
                        <button
                            onClick={() => setVisibleCount(prev => Math.min(prev + 12, filtered.length))}
                            className="px-6 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all shadow-xs hover:shadow-sm cursor-pointer"
                        >
                            Cargar más productos ({filtered.length - visibleCount} restantes)
                        </button>
                    </div>
                )}
            </div>

            {/* Panel de detalle de producto */}
            <ProductDetailDrawer
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
            />

            {/* Escáner QR */}
            {showScanner && (
                <BarcodeScanner onScanSuccess={handleScan} onClose={() => setShowScanner(false)} />
            )}
        </section>
    );
}
