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

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, QrCode } from 'lucide-react';
import { useCart, type Product } from '@/context/CartContext';
import BarcodeScanner from './BarcodeScanner';
import CFDIModal from './CFDIModal';
import { CategoryFilter, PromoBanners } from './catalog/CatalogFilters';
import { ProductCard, ProductDetailDrawer } from './catalog/ProductCard';
import { toast } from '@/lib/toast';

export default function MarketCatalog({ initialCategory, hideHeader }: { initialCategory?: string; hideHeader?: boolean }) {
    const { products: contextProducts, cart, loading, siteConfig, addToCart } = useCart();

    const [filter, setFilter]               = useState(initialCategory || 'Todos');
    const [search, setSearch]               = useState('');
    const [showScanner, setShowScanner]     = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [cfdiProduct, setCfdiProduct]     = useState<Product | null>(null);
    const [visibleCount, setVisibleCount]   = useState(6);

    // Reiniciar paginación al cambiar filtro o búsqueda
    useEffect(() => { setVisibleCount(6); }, [filter, search]);

    const handleScan = (decodedText: string) => {
        const product = contextProducts.find(p => p.id === decodedText || p.barcode === decodedText);
        if (product) {
            addToCart(product, 1);
            toast.success(`${product.name} agregado al carrito.`, '✅ Escaneo');
        } else {
            toast.error('Producto no encontrado en el catálogo.', '❌ Escaneo');
        }
        setShowScanner(false);
    };

    // Categorías únicas derivadas de los productos
    const uniqueCategories = Array.from(new Set(contextProducts.map(p => p.category))).filter(Boolean).sort() as string[];

    // Banners del Canvas Editor
    const catalogBanners = (siteConfig.layout || []).filter((b: any) => b.type === 'banner' && b.visible !== false);

    // Ordenar por productOrder del siteConfig y filtrar
    const sorted = [...contextProducts].sort((a, b) => {
        if (!siteConfig.productOrder) return 0;
        const ia = siteConfig.productOrder.indexOf(a.id);
        const ib = siteConfig.productOrder.indexOf(b.id);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });

    const filtered = sorted.filter(p => {
        const matchFilter = filter === 'Todos' || p.category === filter;
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
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
            {!hideHeader && (
                <div className="flex justify-between items-center mb-12 flex-wrap gap-6">
                    <div>
                        <h2 className="text-4xl font-black text-white tracking-tighter drop-shadow-md">MÓDULOS DEL SISTEMA</h2>
                        <p className="text-slate-400 mt-1 font-medium">Selecciona los módulos operativos y características que deseas integrar en tu ERP.</p>
                    </div>
                    <div className="flex gap-3 items-center flex-wrap">
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="btn-sanjose px-5 py-3 flex items-center gap-2 rounded-xl text-sm shadow-lg shadow-blue-900/10 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/40 transition-colors"
                        >
                            🔑 INICIAR SESIÓN
                        </button>
                        <button
                            onClick={() => setShowScanner(true)}
                            className="btn-sanjose px-5 py-3 flex items-center gap-2 rounded-xl text-sm shadow-lg shadow-blue-900/10"
                        >
                            <QrCode size={18} /> ESCANEAR
                        </button>
                        <div className="relative group">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar módulo..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-11 pr-4 py-3 rounded-xl border border-white/10 w-full sm:w-[280px] outline-none text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-slate-800/50 backdrop-blur-md placeholder-slate-500"
                            />
                        </div>
                    </div>
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
            <div className="bg-black -mx-4 sm:-mx-8 px-4 sm:px-8 py-16 mt-8 border-t border-b border-white/10">
                <div className="flex items-center gap-4 mb-10 border-l-8 border-blue-500 pl-4">
                    <h2 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter">
                        NUESTRO <span className="text-blue-400">CATÁLOGO</span>
                    </h2>
                </div>

                <motion.div layout className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6 auto-rows-auto">
                    {filtered.length > 0 ? (
                        filtered.slice(0, visibleCount).map((p, index) => (
                            <ProductCard
                                key={p.id}
                                p={p}
                                index={index}
                                onOpenDetails={setSelectedProduct}
                                onGenerateCFDI={setCfdiProduct}
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-16 text-slate-500 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-700/50 font-bold italic">
                            No se encontraron productos en esta sección.
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Cargar más */}
            {visibleCount < filtered.length && (
                <div className="flex justify-center py-12">
                    <button
                        onClick={() => setVisibleCount(prev => Math.min(prev + 12, filtered.length))}
                        className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-slate-700/50 text-slate-300 font-bold rounded-xl transition-all shadow-lg hover:-translate-y-1"
                    >
                        Cargar más productos
                    </button>
                </div>
            )}

            {/* Panel de detalle de producto */}
            <ProductDetailDrawer
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onFacturar={setCfdiProduct}
            />

            {/* Escáner QR */}
            {showScanner && (
                <BarcodeScanner onScanSuccess={handleScan} onClose={() => setShowScanner(false)} />
            )}

            {/* Modal CFDI */}
            <AnimatePresence>
                {cfdiProduct && <CFDIModal product={cfdiProduct} onClose={() => setCfdiProduct(null)} />}
            </AnimatePresence>
        </section>
    );
}
