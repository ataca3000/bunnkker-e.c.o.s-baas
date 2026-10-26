"use client";

import React, { useState, useMemo } from 'react';
import { Search, ScanLine, Package2, Camera, AlertTriangle, CheckCircle2, MapPin, Mic, MicOff, X, Plus } from 'lucide-react';
import type { Product } from '@/context/CartContext';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { playScannerBeep } from '@/lib/scannerAudio';

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

  // Hook de búsqueda por voz integrado del escáner retail
  const { isListening, transcript, isSupported, startListening, stopListening } = useVoiceSearch({
    onResult: (spokenText) => {
      playScannerBeep();
      setSearchTerm(spokenText);
    },
  });

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = useMemo(() => {
    const term = (isListening && transcript ? transcript : searchTerm).toLowerCase().trim();
    if (!term) {
      return activeCategory === 'Todos' ? products : products.filter(p => p.category === activeCategory);
    }
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(term) || 
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        p.id.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term));
      const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategory, isListening, transcript]);

  // Detector de coincidencia exacta o resultado único aislado
  const isExactSingleMatch = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q || q.length < 2) return false;
    return filteredProducts.length === 1;
  }, [searchTerm, filteredProducts]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return;

      // Buscar coincidencia exacta por código de barras primero
      const exactMatch = products.find(p => 
        p.barcode?.toLowerCase() === term || 
        p.id.toLowerCase() === term ||
        p.name.toLowerCase() === term ||
        (p.sku && p.sku.toLowerCase() === term)
      );

      if (exactMatch) {
        playScannerBeep();
        onAddProduct(exactMatch);
        setSearchTerm('');
        e.preventDefault();
        return;
      }

      // Si solo hay un resultado filtrado, agregarlo de inmediato
      if (filteredProducts.length === 1) {
        playScannerBeep();
        onAddProduct(filteredProducts[0]);
        setSearchTerm('');
        e.preventDefault();
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative text-white">
      {/* Search and Action Bar - Compact Glassmorphism */}
      <div className="p-2.5 sm:p-3 border-b border-white/10 bg-black/40 backdrop-blur-md space-y-2 shrink-0 relative z-10">
        <div className="flex items-center gap-2">
          {/* Input Principal de Búsqueda */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className={`h-4 w-4 transition-colors ${
                isListening ? 'text-red-400 animate-pulse' : 'text-zinc-400 group-focus-within:text-cyan-400'
              }`} />
            </div>

            <input
              ref={searchInputRef}
              type="text"
              className={`block w-full pl-9 pr-20 py-2 sm:py-2.5 border rounded-xl leading-5 placeholder-zinc-500 focus:outline-none text-xs sm:text-sm font-medium transition-all text-white backdrop-blur-md ${
                isListening
                  ? 'border-red-500 bg-red-950/30 text-red-100 ring-2 ring-red-500/40 animate-pulse'
                  : 'border-white/15 bg-white/5 focus:bg-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/30'
              }`}
              placeholder={
                isListening
                  ? 'Escuchando tu voz...'
                  : 'Buscar producto, código o di por voz...'
              }
              value={isListening && transcript ? transcript : searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />

            <div className="absolute right-1.5 inset-y-0 flex items-center gap-1">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg transition-all"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={handleMicClick}
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center active:scale-90 ${
                  isListening
                    ? 'bg-red-600 text-white shadow-md animate-bounce'
                    : 'text-zinc-400 hover:text-cyan-300 hover:bg-white/10'
                }`}
                title={isListening ? 'Detener escucha' : 'Buscar por voz'}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Botón de Escaneo con Cámara */}
          <button 
            className="flex min-h-12 shrink-0 items-center justify-center gap-2 px-4 py-3 sm:px-5 border border-cyan-400/30 rounded-xl text-white bg-cyan-500/15 hover:bg-cyan-500/30 backdrop-blur-md transition-colors shadow-[0_0_18px_rgba(34,211,238,0.12)] hover:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm font-bold"
            onClick={onOpenScanner}
            title="Escanear con Cámara (F5)"
          >
            <Camera className="h-4 w-4 text-cyan-300 shrink-0" />
            <span className="hidden sm:inline">Cámara</span>
          </button>
        </div>

        {/* Banner de Coincidencia Única */}
        {isExactSingleMatch && (
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-1.5 text-zinc-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-emerald-300 text-[11px]">1 resultado exacto</span>
              <span className="text-zinc-400 text-[10px] hidden sm:inline">· Presiona Enter para agregar</span>
            </div>
            <button
              onClick={() => setSearchTerm('')}
              className="text-cyan-400 hover:text-cyan-300 font-bold text-[10px] hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Ver catálogo completo
            </button>
          </div>
        )}

        {/* Categorías: Barra Slim de 1 sola línea */}
        <div className="flex overflow-x-auto hide-scrollbar space-x-1.5 pt-0.5 mask-linear-fade">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as string)}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all border active:scale-95 shadow-sm ${
                activeCategory === cat 
                  ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.25)]' 
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grilla de Productos en 4 Columnas (Grid Ergonómico 1 | 2 | 3 | 4) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3 bg-transparent relative z-0 auto-rows-max">
        {filteredProducts.map(product => {
          const availableStock = Math.max(0, (product.stock ?? 0) - (product.reservedStock ?? 0));
          const isOutOfStock = availableStock <= 0;
          const cartItem = cartItems.find(c => c.id === product.id);
          const inCartQty = cartItem?.quantity || 0;
          const isMaxInCart = inCartQty >= availableStock;
          const aisleLocation = (product as any).location?.estante || (product as any).estante;

          return (
            <div
              key={product.id}
              onClick={() => {
                if (!isOutOfStock) {
                  playScannerBeep();
                  onAddProduct(product);
                }
              }}
              className={`flex flex-col justify-between bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-sm border rounded-2xl overflow-hidden transition-all group p-3 text-left relative cursor-pointer select-none active:scale-[0.98] ${
                isOutOfStock
                  ? 'opacity-40 border-red-500/20 bg-red-950/10 cursor-not-allowed'
                  : isMaxInCart
                    ? 'border-amber-500/40 bg-amber-950/15 ring-1 ring-amber-500/30'
                    : 'border-white/10 hover:border-cyan-400/50 hover:shadow-[0_4px_20px_rgba(6,182,212,0.15)]'
              }`}
            >
              {/* Top: Foto / Thumbnail con Badge de Carrito y Stock */}
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900 border border-white/10 mb-2.5 flex items-center justify-center">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                ) : (
                  <Package2 className="h-10 w-10 text-zinc-600 group-hover:scale-110 transition-transform" />
                )}

                {/* Badge de cantidad en carrito */}
                {inCartQty > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-cyan-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full shadow-lg border border-cyan-200 animate-pulse">
                    +{inCartQty}
                  </span>
                )}

                {/* Badge de Stock */}
                {isOutOfStock ? (
                  <span className="absolute bottom-1.5 left-1.5 bg-red-600/90 text-white font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Agotado
                  </span>
                ) : availableStock <= 3 ? (
                  <span className="absolute bottom-1.5 left-1.5 bg-amber-500/90 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Disp: {availableStock}
                  </span>
                ) : null}
              </div>

              {/* Información Central */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-2 leading-snug group-hover:text-cyan-300 transition-colors mb-1">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 mb-2 truncate">
                    <span>{product.barcode || product.sku || product.id}</span>
                    {showAisleInfo && aisleLocation && (
                      <span className="text-indigo-300 truncate">· {aisleLocation}</span>
                    )}
                  </div>
                </div>

                {/* Precio y Botón Táctil de Agregar */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-auto">
                  <div>
                    <span className="text-sm sm:text-base font-black text-white font-mono group-hover:text-cyan-300">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">{product.unitType || 'PZA'}</span>
                  </div>

                  <button
                    type="button"
                    disabled={isOutOfStock}
                    className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-black flex items-center gap-1 transition-all ${
                      isOutOfStock
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                        : 'bg-cyan-500/20 text-cyan-300 group-hover:bg-cyan-500 group-hover:text-slate-950 border border-cyan-500/40'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">AGREGAR</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="py-16 text-center text-zinc-500 flex flex-col items-center">
            <Package2 className="h-12 w-12 text-zinc-600 mb-3" />
            <p className="text-zinc-300 text-sm font-bold">No se encontraron productos coincidentes</p>
            <p className="text-zinc-500 text-xs mt-1">Intenta con otro término o limpia la búsqueda</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-cyan-300 text-xs font-bold border border-white/10 transition-colors"
              >
                Limpiar Búsqueda
              </button>
            )}
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
