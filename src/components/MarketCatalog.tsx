"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Search, Package, FileText, PlayCircle, QrCode, Star, StarHalf, X, MessageSquare, Truck } from 'lucide-react';
import { useCart, type Product } from '@/context/CartContext';
import BarcodeScanner from './BarcodeScanner';
import CFDIModal from './CFDIModal';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

function renderStars(rating: number = 0) {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars.push(<Star key={i} size={14} fill="#FFCB05" color="#FFCB05" />);
        } else if (i === fullStars && hasHalfStar) {
            stars.push(<StarHalf key={i} size={14} fill="#FFCB05" color="#FFCB05" />);
        } else {
            stars.push(<Star key={i} size={14} color="#e2e8f0" />);
        }
    }
    return <div className="flex items-center gap-0.5">{stars}</div>;
}

function getCategoryIcon(catName: string) {
    const name = catName.toLowerCase();
    if (name.includes('core')) return '⚙️';
    if (name.includes('operacion') || name.includes('operat')) return '🏗️';
    if (name.includes('addon') || name.includes('add-on') || name.includes('plug')) return '🔌';
    if (name.includes('servicio')) return '💼';
    if (name.includes('herramienta')) return '🛠️';
    if (name.includes('material')) return '🧱';
    if (name.includes('electr')) return '⚡';
    if (name.includes('plomer')) return '🪠';
    if (name.includes('seguridad')) return '🛡️';
    if (name.includes('factura')) return '📄';
    return '🛠️';
}

function ProductCard({ p, index, onOpenDetails, onGenerateCFDI }: { p: Product, index: number, onOpenDetails: (p: Product) => void, onGenerateCFDI: (p: Product) => void }) {
    const { addToCart } = useCart();
    const [qty, setQty] = useState(p.stock > 0 ? 1 : 0);

    useEffect(() => {
        if (p.stock > 0 && qty === 0) setQty(1);
        if (p.stock === 0 && qty > 0) setQty(0);
    }, [p.stock, qty]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col bg-[#13111C] rounded-[24px] overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all duration-300 group"
        >
            {/* Imagen principal con fallback */}
            <button 
                type="button"
                className="w-full aspect-[4/3] relative block overflow-hidden bg-[#0A0810]" 
                onClick={() => onOpenDetails(p)}
                aria-label={`Ver detalles de ${p.name}`}
            >
                {p.image ? (
                    <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                        }}
                    />
                ) : null}
                
                {/* Fallback en caso de no haber imagen o error */}
                <div className={`absolute inset-0 flex items-center justify-center bg-slate-900/50 ${p.image ? 'hidden' : 'flex'}`}>
                    <Package size={48} className="text-slate-700/50" />
                </div>

                {p.stock === 0 && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-red-500 font-black text-xl tracking-widest z-10 border-2 border-red-500/50 m-4 rounded-xl">
                        AGOTADO
                    </div>
                )}
            </button>

            <div className="p-5 flex flex-col flex-1 relative">
                {/* CFDI y Categoría reacomodados para no encimarse */}
                <div className="flex justify-between items-center mb-3">
                    <span className="text-[0.65rem] font-bold tracking-widest uppercase text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">
                        {p.category}
                    </span>
                    <div className="flex gap-2">
                        <button 
                            type="button"
                            title="Generar Factura CFDI" 
                            onClick={(e) => { e.stopPropagation(); onGenerateCFDI(p); }} 
                            className="text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 p-1.5 rounded-md"
                        >
                            <FileText size={16} />
                        </button>
                    </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-purple-400 transition-colors">
                    <button onClick={() => onOpenDetails(p)} className="text-left w-full">
                        {p.name}
                    </button>
                </h3>
                
                <div className="flex items-center gap-2 mb-4 mt-auto">
                    <div className="flex text-yellow-500">
                        {renderStars(p.rating)}
                    </div>
                    <span className="text-xs text-slate-500">({p.reviewCount || 0})</span>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <div className="text-2xl font-black text-white">
                                ${p.price.toLocaleString()}
                            </div>
                            <div className={`text-xs font-bold flex items-center gap-1 mt-1 ${p.stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                <Package size={12} />
                                {p.stock > 0 ? `${p.stock} disponibles` : 'Sin stock'}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
                            <button
                                className={`w-8 h-8 flex items-center justify-center text-white transition-all rounded-lg ${(qty <= 1 || p.stock === 0) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 active:scale-95'}`}
                                onClick={() => setQty(Math.max(1, qty - 1))}
                                disabled={qty <= 1 || p.stock === 0}
                            >
                                <Minus size={14} />
                            </button>
                            <span className="font-bold w-6 text-center text-sm text-white">{qty}</span>
                            <button
                                className={`w-8 h-8 flex items-center justify-center text-white transition-all rounded-lg ${(qty >= p.stock || p.stock === 0) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 active:scale-95'}`}
                                onClick={() => setQty(Math.min(p.stock, qty + 1))}
                                disabled={qty >= p.stock || p.stock === 0}
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        <button
                            onClick={() => addToCart(p, qty)}
                            disabled={p.stock === 0 || qty === 0}
                            className={`flex-1 flex items-center justify-center py-2.5 rounded-xl font-bold transition-all ${p.stock === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 active:scale-95'}`}
                        >
                            <ShoppingCart size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default function MarketCatalog({ initialCategory, hideHeader }: { initialCategory?: string, hideHeader?: boolean }) {
    const { products: contextProducts, cart, loading, siteConfig, addToCart } = useCart();

    const [filter, setFilter] = useState(initialCategory || 'Todos');
    const [search, setSearch] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [cfdiProduct, setCfdiProduct] = useState<Product | null>(null);
    const [realReviews, setRealReviews] = useState<any[]>([]);

    useEffect(() => {
        if (!selectedProduct) {
            setRealReviews([]);
            return;
        }
        const qReviews = query(
            collection(db, 'reviews'),
            where('productId', '==', selectedProduct.id),
            orderBy('date', 'desc')
        );
        const unsubscribe = onSnapshot(qReviews, (snap: any) => {
            const list: any[] = [];
            snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
            setRealReviews(list);
        }, (err: any) => {
            console.error("Error loading reviews:", err);
        });
        return () => unsubscribe();
    }, [selectedProduct]);

    const handleScan = (decodedText: string) => {
        const product = contextProducts.find(p => p.id === decodedText || p.barcode === decodedText);
        if (product) {
            addToCart(product, 1);
            alert(`✅ Agregado: ${product.name}`);
            setShowScanner(false);
        } else {
            alert("❌ Producto no encontrado en el catálogo");
            setShowScanner(false);
        }
    };

    const currentSection = siteConfig.sections.find(s => s.id === filter);

    const sorted = [...contextProducts].sort((a, b) => {
        if (!siteConfig.productOrder) return 0;
        const idxA = siteConfig.productOrder.indexOf(a.id);
        const idxB = siteConfig.productOrder.indexOf(b.id);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });

    const filtered = sorted.filter(p => {
        const matchesFilter = filter === 'Todos' || p.category === filter;
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const [visibleCount, setVisibleCount] = useState(6);

    useEffect(() => {
        setVisibleCount(6);
    }, [filter, search]);

    // Simulated Delivery Load Capacity Calculator (Universal)
    // Generic products weigh 5 units, services weigh 0 units. Maximum delivery unit limit is 120 units.
    const loadWeight = cart.reduce((sum, item) => {
        let itemWeight = 5;
        if (item.category === 'Servicios') itemWeight = 0;
        return sum + (itemWeight * item.quantity);
    }, 0);
    const maxWeightLimit = 120;
    const progressPercent = Math.min((loadWeight / maxWeightLimit) * 100, 100);

    const progressColorClass = progressPercent > 80 ? 'text-red-500' : progressPercent > 50 ? 'text-amber-500' : 'text-emerald-500';
    const progressBgClass = progressPercent > 80 ? 'bg-red-500' : progressPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500';

    if (loading) {
        return (
            <div className="text-center py-32 text-slate-500 text-xl font-bold">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ea5e9] mr-3"></div>
                Iniciando ecosistema comercial...
            </div>
        );
    }

    return (
        <section id="catalogo" className="py-16 px-4 sm:px-8 w-full">
            
            {/* Real-time Delivery Capacity Simulator (Option B Widget) */}
            <AnimatePresence>
            </AnimatePresence>

            {/* Catalog Header */}
            {!hideHeader && (
                <div className="flex justify-between items-center mb-12 flex-wrap gap-6">
                    <div>
                        <h2 className="text-4xl font-black text-white tracking-tighter drop-shadow-md">MÓDULOS DEL SISTEMA</h2>
                        <p className="text-slate-400 mt-1 font-medium">Selecciona los módulos operativos y características que deseas integrar en tu ERP.</p>
                    </div>

                    <div className="flex gap-3 items-center flex-wrap">
                        <button
                            onClick={() => setShowScanner(true)}
                            className="btn-sanjose px-5 py-3 flex items-center gap-2 rounded-xl text-sm shadow-lg shadow-blue-900/10">
                            <QrCode size={18} /> ESCANEAR
                        </button>
                        <div className="relative group">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar módulo..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-11 pr-4 py-3 rounded-xl border border-white/10 w-full sm:w-[280px] outline-none text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all bg-slate-800/50 backdrop-blur-md placeholder-slate-500"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Categories filters (Mercado Libre Style) */}
            <div className="flex gap-6 justify-start md:justify-center items-start w-full mb-14 overflow-x-auto py-4 scrollbar-hide no-scrollbar select-none px-4">
                <button 
                    onClick={() => setFilter('Todos')}
                    className="flex flex-col items-center gap-3 group cursor-pointer focus:outline-none shrink-0 transition-transform active:scale-95"
                >
                    <div className={`w-16 h-16 shrink-0 rounded-full border-2 flex items-center justify-center text-2xl transition-all duration-300 shadow-md ${filter === 'Todos' ? 'border-amber-400 bg-gradient-to-br from-amber-400 to-amber-600 text-white scale-110 shadow-amber-900/20' : 'bg-slate-800/60 border-white/10 text-slate-300 hover:border-amber-500/50 hover:bg-slate-700/60'}`}>
                        📦
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest text-center transition-colors max-w-[80px] break-words leading-tight ${filter === 'Todos' ? 'text-amber-400 font-extrabold' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        TODOS
                    </span>
                </button>
                {siteConfig.sections.map(s => {
                    const icon = getCategoryIcon(s.title);
                    const isSelected = filter === s.id;
                    return (
                        <button 
                            key={s.id} 
                            onClick={() => setFilter(s.id)}
                            className="flex flex-col items-center gap-3 group cursor-pointer focus:outline-none shrink-0 transition-transform active:scale-95"
                        >
                            <div className={`w-16 h-16 shrink-0 rounded-full border-2 flex items-center justify-center text-2xl transition-all duration-300 shadow-md ${isSelected ? 'border-amber-400 bg-gradient-to-br from-amber-400 to-amber-600 text-white scale-110 shadow-amber-900/20' : 'bg-slate-800/60 border-white/10 text-slate-300 hover:border-amber-500/50 hover:bg-slate-700/60'}`}>
                                {icon}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest text-center transition-colors max-w-[80px] break-words leading-tight ${isSelected ? 'text-amber-400 font-extrabold' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                {s.title}
                            </span>
                        </button>
                    );
                })}
            </div>

            {currentSection && (currentSection.mediaUrl || currentSection.description) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={currentSection.id}
                    className="mb-12 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[220px] bg-slate-800/60 backdrop-blur-xl"
                >
                    {currentSection.mediaUrl && (
                        <div className="flex-[1_1_300px] min-h-[220px] relative">
                            {currentSection.mediaType === 'video' ? (
                                <video src={currentSection.mediaUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                            ) : (
                                <img src={currentSection.mediaUrl} alt={currentSection.title} className="w-full h-full object-cover opacity-80" />
                            )}
                        </div>
                    )}
                    <div className="flex-[2_1_400px] p-10 flex flex-col justify-center">
                        <h3 className="text-2xl font-black text-purple-400 mb-3">{currentSection.title}</h3>
                        <p className="text-slate-300 text-lg leading-relaxed m-0">{currentSection.description}</p>
                    </div>
                </motion.div>
            )}

            {/* Fondo negro perimetral exclusivo para el grid del catálogo */}
            <div className="bg-[#050505] -mx-4 sm:-mx-8 px-4 sm:px-8 py-16 mt-8 border-t border-b border-white/10">
                <div className="flex items-center gap-4 mb-10 border-l-8 border-purple-500 pl-4">
                    <h2 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter">
                        NUESTRO <span className="text-purple-400">CATÁLOGO</span>
                    </h2>
                </div>

                <motion.div layout className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6 auto-rows-auto">
                    {filtered.length > 0 ? (
                        filtered.slice(0, visibleCount).map((p, index) => (
                            <ProductCard key={p.id} p={p} index={index} onOpenDetails={setSelectedProduct} onGenerateCFDI={setCfdiProduct} />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-16 text-slate-500 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-700/50 font-bold italic">
                            No se encontraron productos en esta sección.
                        </div>
                    )}
                </motion.div>
            </div>

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

            {/* Slide-out Product Details Drawer */}
            <AnimatePresence>
                {selectedProduct && (
                    <div 
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-end z-[1000]"
                        onClick={() => setSelectedProduct(null)}
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            className="bg-white w-full max-w-full sm:max-w-[520px] h-full overflow-y-auto p-6 sm:p-10 relative shadow-2xl"
                        >
                            <button 
                                onClick={() => setSelectedProduct(null)} 
                                className="absolute top-5 right-5 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors z-10 flex items-center justify-center"
                                title="Cerrar detalles"
                                aria-label="Cerrar detalles"
                            >
                                <X size={20} className="text-slate-600" />
                            </button>

                            <div className="flex flex-col gap-6 mt-4">
                                <div className="w-full h-[250px] sm:h-[300px] bg-slate-50 rounded-2xl overflow-hidden shadow-inner">
                                    <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                                </div>
                                
                                <div>
                                    <span className="text-[0.7rem] text-[#0ea5e9] font-black uppercase tracking-widest">{selectedProduct.category}</span>
                                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 mb-3 leading-tight">{selectedProduct.name}</h2>
                                    
                                    <div className="flex items-center gap-2.5 mb-4">
                                        {renderStars(selectedProduct.rating)}
                                        <span className="text-xs text-slate-500 font-semibold">({selectedProduct.reviewCount || 0} valoraciones)</span>
                                    </div>

                                    <div className="text-3xl sm:text-4xl font-black text-[#E30613]">
                                        ${selectedProduct.price.toLocaleString()} <span className="text-sm align-middle text-slate-400">MXN</span>
                                    </div>
                                </div>

                                <p className="text-slate-600 leading-relaxed text-sm sm:text-base m-0 bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                    {selectedProduct.description || "Excelente solución para tu negocio. Totalmente adaptable y configurable para ajustarlo a cualquier sector de venta."}
                                </p>

                                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                                    <button
                                        onClick={() => {
                                            addToCart(selectedProduct, 1);
                                            alert(`✅ ${selectedProduct.name} agregado al carrito.`);
                                        }}
                                        disabled={selectedProduct.stock === 0}
                                        className={`btn-sanjose flex-1 py-4 flex justify-center items-center gap-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-900/10 ${selectedProduct.stock === 0 ? 'grayscale opacity-50 cursor-not-allowed' : 'active:scale-95 transition-all'}`}
                                    >
                                        <ShoppingCart size={18} /> {selectedProduct.stock === 0 ? 'PRODUCTO AGOTADO' : 'AÑADIR AL CARRITO'}
                                    </button>

                                    <button
                                        onClick={() => {
                                            setSelectedProduct(null);
                                            setCfdiProduct(selectedProduct);
                                        }}
                                        className="bg-emerald-500 text-white hover:bg-emerald-600 px-6 py-4 flex justify-center items-center gap-2 cursor-pointer rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/10"
                                    >
                                        <FileText size={18} /> FACTURAR
                                    </button>
                                </div>

                                {/* Real Reviews Module */}
                                <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col gap-5">
                                    <h4 className="flex items-center gap-2 text-lg font-black text-slate-800">
                                        <MessageSquare size={20} className="text-[#0ea5e9]" /> Reseñas de Clientes
                                    </h4>
                                    {realReviews.length > 0 ? (
                                        realReviews.map((rev) => (
                                            <div key={rev.id} className="bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-100 flex flex-col gap-2">
                                                <div className="flex justify-between items-center flex-wrap gap-2">
                                                    <strong className="text-xs text-slate-700 font-black uppercase tracking-tight">{rev.customerName}</strong>
                                                    <div className="flex flex-col items-end">
                                                        {renderStars(rev.rating)}
                                                        <span className="text-[8px] text-slate-400 mt-1">{rev.date ? new Date(rev.date).toLocaleDateString() : ''}</span>
                                                    </div>
                                                </div>
                                                {rev.comment && (
                                                    <p className="text-sm text-slate-600 leading-relaxed italic m-0">"{rev.comment}"</p>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-slate-400 font-bold italic text-sm">
                                            Aún no hay opiniones de este producto. ¡Sé el primero en calificarlo tras comprar!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {showScanner && (
                <BarcodeScanner
                    onScanSuccess={handleScan}
                    onClose={() => setShowScanner(false)}
                />
            )}

            <AnimatePresence>
                {cfdiProduct && (
                    <CFDIModal product={cfdiProduct} onClose={() => setCfdiProduct(null)} />
                )}
            </AnimatePresence>
        </section>
    );
}
