import React, { useState } from 'react';
import { Search, ScanLine, Package2, Camera } from 'lucide-react';
import type { Product } from '@/context/CartContext';

interface CatalogProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onOpenScanner: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export function Catalog({ products, onAddProduct, onOpenScanner, searchTerm, setSearchTerm }: CatalogProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.toLowerCase().includes(term));
    const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden relative text-white">
      {/* Search and Action Bar - Glassmorphism */}
      <div className="p-4 border-b border-white/10 bg-black/20 backdrop-blur-md space-y-4 shrink-0 relative z-10">
        <div className="flex space-x-2">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-zinc-400 group-focus-within:text-blue-400 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl leading-5 bg-white/5 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white/10 sm:text-sm transition-all text-white backdrop-blur-sm"
              placeholder="Buscar producto o escanear código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            className="flex items-center justify-center px-4 py-3 border border-white/10 rounded-xl text-white bg-blue-600/20 hover:bg-blue-600/40 backdrop-blur-md transition-colors shadow-[0_0_15px_rgba(37,99,235,0.1)] hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={onOpenScanner}
          >
            <Camera className="h-5 w-5 md:mr-2 text-blue-300" />
            <span className="hidden md:inline font-medium text-blue-200">Cámara</span>
          </button>
        </div>

        {/* Categories */}
        <div className="flex overflow-x-auto hide-scrollbar space-x-2 pb-1 mask-linear-fade">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as string)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                activeCategory === cat 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                  : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List View - Smaller items for mobile/scroll */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-transparent relative z-0">
        {filteredProducts.map(product => (
          <button
            key={product.id}
            onClick={() => onAddProduct(product)}
            disabled={product.stock <= 0}
            className={`w-full flex items-center text-left bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/5 hover:border-blue-500/30 rounded-xl overflow-hidden transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 group p-2.5 gap-3 ${product.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className={`h-12 w-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-zinc-800 mix-blend-overlay opacity-60`}>
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <Package2 className="h-6 w-6 text-white opacity-80 group-hover:scale-110 transition-transform" />
              )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1 leading-snug group-hover:text-blue-300 transition-colors">{product.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-500 font-mono">{product.barcode || 'SIN CODIGO'}</span>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${product.stock <= 0 ? 'text-red-400 bg-red-400/10 border-red-400/20' : 'text-zinc-400 bg-white/5 border-white/5'}`}>
                  Stock: {product.stock}
                </span>
              </div>
            </div>

            <div className="text-right pl-2 pr-1 flex flex-col justify-center items-end">
              <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">${product.price.toFixed(2)}</span>
            </div>
          </button>
        ))}
        {filteredProducts.length === 0 && (
          <div className="py-12 text-center text-zinc-500 flex flex-col items-center">
            <Package2 className="h-12 w-12 text-zinc-600 mb-3" />
            <p className="text-zinc-400">No se encontraron productos</p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html:`
        .mask-linear-fade {
          -webkit-mask-image: linear-gradient(to right, black 80%, transparent 100%);
          mask-image: linear-gradient(to right, black 80%, transparent 100%);
        }
      `}} />
    </div>
  );
}
