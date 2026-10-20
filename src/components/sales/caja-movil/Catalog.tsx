import React, { useState, forwardRef } from 'react';
import { Search, ScanLine, Package2, Camera, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react';
import type { Product } from '@/context/CartContext';

interface CatalogProps {
  products: Product[];
  cartItems?: (Product & { quantity: number })[];
  onAddProduct: (product: Product) => void;
  onOpenScanner: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  showAisleInfo?: boolean;
}

export function Catalog({
  products,
  cartItems = [],
  onAddProduct,
  onOpenScanner,
  searchTerm,
  setSearchTerm,
  searchInputRef,
  showAisleInfo = true
}: CatalogProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      return activeCategory === 'Todos' || p.category === activeCategory;
    }
    const matchesSearch = 
      p.name.toLowerCase().includes(term) || 
      (p.barcode && p.barcode.toLowerCase().includes(term)) ||
      p.id.toLowerCase().includes(term);
    const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return;

      // Buscar coincidencia exacta por código de barras primero
      const exactMatch = products.find(p => 
        p.barcode?.toLowerCase() === term || 
        p.id.toLowerCase() === term ||
        p.name.toLowerCase() === term
      );

      if (exactMatch) {
        onAddProduct(exactMatch);
        setSearchTerm('');
        e.preventDefault();
        return;
      }

      // Si solo hay un resultado filtrado, agregarlo de inmediato
      if (filteredProducts.length === 1) {
        onAddProduct(filteredProducts[0]);
        setSearchTerm('');
        e.preventDefault();
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative text-white">
      {/* Search and Action Bar - Glassmorphism */}
      <div className="p-3 sm:p-4 border-b border-white/10 bg-black/20 backdrop-blur-md space-y-3 shrink-0 relative z-10">
        <div className="flex space-x-2">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400 group-focus-within:text-cyan-400 transition-colors" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full pl-9 sm:pl-10 pr-3 py-2.5 sm:py-3 border border-white/10 rounded-xl leading-5 bg-white/5 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 focus:bg-white/10 text-xs sm:text-sm transition-all text-white backdrop-blur-sm"
              placeholder="Buscar producto o escanear código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <button 
            className="flex min-h-12 items-center justify-center gap-2 px-4 sm:px-5 py-3 border border-cyan-400/30 rounded-xl text-white bg-cyan-500/15 hover:bg-cyan-500/30 backdrop-blur-md transition-colors shadow-[0_0_18px_rgba(34,211,238,0.12)] hover:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm font-bold"
            onClick={onOpenScanner}
            title="Escanear con Cámara (F5)"
          >
            <Camera className="h-4 w-4 sm:h-5 sm:w-5 md:mr-2 text-cyan-300" />
            <span className="hidden md:inline font-medium text-cyan-200">Cámara</span>
          </button>
        </div>

        {/* Categories */}
        <div className="flex overflow-x-auto hide-scrollbar space-x-2 pb-0.5 mask-linear-fade">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as string)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                activeCategory === cat 
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                  : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List View */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-transparent relative z-0">
        {filteredProducts.map(product => {
          const availableStock = Math.max(0, (product.stock ?? 0) - (product.reservedStock ?? 0));
          const isOutOfStock = availableStock <= 0;
          const cartItem = cartItems.find(c => c.id === product.id);
          const inCartQty = cartItem?.quantity || 0;
          const isMaxInCart = inCartQty >= availableStock;
          const aisleLocation = (product as any).location?.estante || (product as any).estante;
          const filaLocation = (product as any).location?.fila || (product as any).fila;

          return (
            <button
              key={product.id}
              onClick={() => onAddProduct(product)}
              disabled={isOutOfStock}
              className={`w-full min-h-[78px] flex items-center text-left bg-white/5 hover:bg-white/10 backdrop-blur-sm border rounded-xl overflow-hidden transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50 group p-3.5 gap-3.5 ${
                isOutOfStock
                  ? 'opacity-40 cursor-not-allowed border-red-500/20 bg-red-950/10'
                  : isMaxInCart
                    ? 'border-amber-500/30 bg-amber-950/10'
                    : 'border-white/5 hover:border-cyan-500/30'
              }`}
            >
              <div className={`h-14 w-14 sm:h-16 sm:w-16 rounded-lg flex-shrink-0 flex items-center justify-center bg-zinc-800 mix-blend-overlay opacity-70`}>
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <Package2 className="h-5 w-5 sm:h-6 sm:w-6 text-white opacity-80 group-hover:scale-110 transition-transform" />
                )}
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 line-clamp-1 leading-snug group-hover:text-cyan-300 transition-colors">
                  {product.name}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-zinc-500 font-mono">{product.barcode || product.id}</span>
                  
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${
                    isOutOfStock
                      ? 'text-red-400 bg-red-500/20 border-red-500/40'
                      : availableStock <= 3
                        ? 'text-amber-400 bg-amber-500/20 border-amber-500/40'
                        : 'text-zinc-300 bg-white/5 border-white/10'
                  }`}>
                    {isOutOfStock ? 'AGOTADO' : `Disp: ${availableStock}`}
                  </span>

                  {inCartQty > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                      isMaxInCart
                        ? 'text-amber-300 bg-amber-500/20 border-amber-500/40'
                        : 'text-cyan-300 bg-cyan-500/20 border-cyan-500/40'
                    }`}>
                      +{inCartQty} en caja
                    </span>
                  )}

                  {/* Modo Pasillo: Mostrar ubicación física en almacén / estantería */}
                  {showAisleInfo && aisleLocation && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      {aisleLocation} {filaLocation ? `(Fila ${filaLocation})` : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right pl-2 pr-1 flex flex-col justify-center items-end shrink-0">
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                  ${product.price.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase">{product.unitType || 'PZA'}</span>
              </div>
            </button>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="py-12 text-center text-zinc-500 flex flex-col items-center">
            <Package2 className="h-10 w-10 text-zinc-600 mb-2" />
            <p className="text-zinc-400 text-xs">No se encontraron productos coincidentes</p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html:`
        .mask-linear-fade {
          -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
          mask-image: linear-gradient(to right, black 85%, transparent 100%);
        }
      `}} />
    </div>
  );
}
