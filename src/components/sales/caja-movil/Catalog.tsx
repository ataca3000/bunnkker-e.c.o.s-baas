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
      {/* Search and Action Bar - Glassmorphism con botones grandes táctiles */}
      <div className="p-3 sm:p-4 border-b border-white/10 bg-black/30 backdrop-blur-md space-y-3 shrink-0 relative z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Input Principal de Búsqueda con Micrófono y Limpieza rápida */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className={`h-5 w-5 transition-colors ${
                isListening ? 'text-red-400 animate-pulse' : 'text-zinc-400 group-focus-within:text-cyan-400'
              }`} />
            </div>

            <input
              ref={searchInputRef}
              type="text"
              className={`block w-full pl-11 pr-24 py-3 sm:py-3.5 border rounded-2xl leading-5 placeholder-zinc-500 focus:outline-none text-sm sm:text-base font-medium transition-all text-white backdrop-blur-md ${
                isListening
                  ? 'border-red-500 bg-red-950/30 text-red-100 ring-2 ring-red-500/40 animate-pulse'
                  : 'border-white/15 bg-white/5 focus:bg-white/10 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30'
              }`}
              placeholder={
                isListening
                  ? 'Escuchando tu voz... Di el nombre del producto'
                  : 'Buscar producto, código de barras o di por voz...'
              }
              value={isListening && transcript ? transcript : searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />

            {/* Controles internos del input (Limpiar y Micrófono) */}
            <div className="absolute right-2 inset-y-0 flex items-center gap-1">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  title="Limpiar búsqueda"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {/* Botón de Búsqueda por Voz */}
              <button
                type="button"
                onClick={handleMicClick}
                className={`p-2 rounded-xl transition-all flex items-center justify-center active:scale-90 ${
                  isListening
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/50 animate-bounce'
                    : 'text-zinc-400 hover:text-cyan-300 hover:bg-white/10'
                }`}
                title={
                  isSupported
                    ? isListening
                      ? 'Detener escucha por voz'
                      : 'Búsqueda por voz (di el nombre del producto)'
                    : 'Búsqueda por voz no soportada en este navegador'
                }
              >
                {isListening ? (
                  <Mic className="w-5 h-5 animate-pulse text-white" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Botón de Escaneo con Cámara Táctil Grande */}
          <button 
            className="flex items-center justify-center px-4 sm:px-5 py-3 sm:py-3.5 border border-cyan-500/30 rounded-2xl text-cyan-200 bg-cyan-600/20 hover:bg-cyan-600/30 backdrop-blur-md transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs sm:text-sm font-bold active:scale-95 shrink-0"
            onClick={onOpenScanner}
            title="Escanear con Cámara (F5)"
          >
            <Camera className="h-5 w-5 sm:mr-2 text-cyan-300 shrink-0" />
            <span className="hidden sm:inline">Cámara</span>
          </button>
        </div>

        {/* Banner de Resultado Único Aislado */}
        {isExactSingleMatch && (
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-zinc-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-emerald-300">Coincidencia aislada</span>
              <span className="text-zinc-400 hidden sm:inline">· Presiona Enter o clic para agregar al carrito</span>
            </div>
            <button
              onClick={() => setSearchTerm('')}
              className="text-cyan-400 hover:text-cyan-300 font-bold text-xs hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Ver todo el catálogo
            </button>
          </div>
        )}

        {/* Selector de Categorías - Botones Grandes y Táctiles */}
        <div className="flex overflow-x-auto hide-scrollbar space-x-2 pt-1 pb-0.5 mask-linear-fade">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as string)}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border active:scale-95 shadow-sm ${
                activeCategory === cat 
                  ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/30' 
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Productos con Cards Táctiles Amplias */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-transparent relative z-0">
        {filteredProducts.map(product => {
          const availableStock = Math.max(0, (product.stock ?? 0) - (product.reservedStock ?? 0));
          const isOutOfStock = availableStock <= 0;
          const cartItem = cartItems.find(c => c.id === product.id);
          const inCartQty = cartItem?.quantity || 0;
          const isMaxInCart = inCartQty >= availableStock;
          const aisleLocation = (product as any).location?.estante || (product as any).estante;
          const filaLocation = (product as any).location?.fila || (product as any).fila;

          return (
            <div
              key={product.id}
              className={`w-full flex items-center justify-between bg-white/5 hover:bg-white/10 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all group p-3 sm:p-3.5 gap-3 sm:gap-4 ${
                isOutOfStock
                  ? 'opacity-40 border-red-500/20 bg-red-950/10'
                  : isMaxInCart
                    ? 'border-amber-500/40 bg-amber-950/15'
                    : 'border-white/10 hover:border-cyan-500/40 hover:shadow-md'
              }`}
            >
              {/* Thumbnail e Información */}
              <button
                type="button"
                onClick={() => {
                  if (!isOutOfStock) {
                    playScannerBeep();
                    onAddProduct(product);
                  }
                }}
                disabled={isOutOfStock}
                className="flex-1 flex items-center gap-3 sm:gap-4 text-left min-w-0"
              >
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl flex-shrink-0 flex items-center justify-center bg-zinc-800 border border-white/10 overflow-hidden">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <Package2 className="h-6 w-6 text-zinc-400 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-100 line-clamp-1 leading-snug group-hover:text-cyan-300 transition-colors">
                    {product.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                    <span className="text-[11px] sm:text-xs text-zinc-400 font-mono">{product.barcode || product.sku || product.id}</span>
                    
                    <span className={`text-[10px] sm:text-xs uppercase font-bold px-2 py-0.5 rounded-lg border ${
                      isOutOfStock
                        ? 'text-red-400 bg-red-500/20 border-red-500/40'
                        : availableStock <= 3
                          ? 'text-amber-400 bg-amber-500/20 border-amber-500/40'
                          : 'text-zinc-300 bg-white/5 border-white/10'
                    }`}>
                      {isOutOfStock ? 'AGOTADO' : `Disp: ${availableStock}`}
                    </span>

                    {inCartQty > 0 && (
                      <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg border ${
                        isMaxInCart
                          ? 'text-amber-300 bg-amber-500/20 border-amber-500/40'
                          : 'text-cyan-300 bg-cyan-500/20 border-cyan-500/40'
                      }`}>
                        +{inCartQty} en caja
                      </span>
                    )}

                    {/* Modo Pasillo: Mostrar ubicación física en almacén / estantería */}
                    {showAisleInfo && aisleLocation && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {aisleLocation} {filaLocation ? `(Fila ${filaLocation})` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Precio y Botón Táctil de Agregar */}
              <div className="flex items-center gap-2 sm:gap-3 pl-2 shrink-0">
                <div className="text-right flex flex-col justify-center items-end">
                  <span className="text-sm sm:text-base font-black text-white group-hover:text-cyan-300 transition-colors">
                    ${product.price.toFixed(2)}
                  </span>
                  <span className="text-[10px] sm:text-xs text-zinc-400 uppercase font-bold">{product.unitType || 'PZA'}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!isOutOfStock) {
                      playScannerBeep();
                      onAddProduct(product);
                    }
                  }}
                  disabled={isOutOfStock}
                  className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-sm ${
                    isOutOfStock
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-cyan-500/50'
                  }`}
                  title={isOutOfStock ? 'Producto sin existencias' : 'Agregar 1 unidad al carrito'}
                >
                  <Plus className="w-4 h-4 font-black" />
                  <span className="hidden sm:inline">AGREGAR</span>
                </button>
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
