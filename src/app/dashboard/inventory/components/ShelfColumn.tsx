import React, { useState, useEffect, useRef } from 'react';
import type { Product } from '@/lib/types';
import LevelDropZone from './LevelDropZone';
import { Plus, MapPin, Layers, Cpu } from 'lucide-react';

interface ShelfColumnProps {
  key?: React.Key;
  id?: string;
  chunkIndex?: number;
  shelfName: string;
  products: Product[];
  onProductClick?: (product: Product) => void;
  onAddProductClick?: (shelfName: string, levelName: string) => void;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  isDirtyChunk?: boolean;
  dirtySlotsCount?: number;
  onSelectShelf?: (shelfName: string) => void;
  onChunkRenderStateChange?: (shelfName: string, isHydrated: boolean) => void;
}

export default function ShelfColumn({
  id,
  chunkIndex = 0,
  shelfName,
  products,
  onProductClick,
  onAddProductClick,
  isHighlighted = false,
  isDimmed = false,
  isDirtyChunk = false,
  dirtySlotsCount = 0,
  onSelectShelf,
  onChunkRenderStateChange,
}: ShelfColumnProps) {
  const columnRef = useRef<HTMLDivElement | null>(null);
  // Render Distance: First 4 chunks or highlighted chunks start hydrated immediately;
  // distant chunks start in lightweight Mock mode and hydrate automatically via IntersectionObserver (with 380px preload margin).
  const [isInRenderDistance, setIsInRenderDistance] = useState<boolean>(
    chunkIndex < 4 || isHighlighted
  );

  useEffect(() => {
    if (isHighlighted) {
      setIsInRenderDistance(true);
    }
  }, [isHighlighted]);

  useEffect(() => {
    const node = columnRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsInRenderDistance(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const shouldHydrate = entry.isIntersecting || isHighlighted;
        setIsInRenderDistance(shouldHydrate);
      },
      {
        root: null,
        // Pre-load 1 neighbor chunk (380px) ahead of horizontal scroll for 60fps zero-pop-in
        rootMargin: '200px 380px 200px 380px',
        threshold: 0.01,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isHighlighted]);

  useEffect(() => {
    onChunkRenderStateChange?.(shelfName, isInRenderDistance);
  }, [shelfName, isInRenderDistance, onChunkRenderStateChange]);

  // Agrupar productos dinámicamente por su nivel / fila (Capas Y del Chunk X)
  const levelsMap: Record<string, Product[]> = {
    'Nivel 1': [],
    'Nivel 2': [],
    'Nivel 3': [],
  };

  products.forEach((p) => {
    const rawFila = p.location?.fila || 'Nivel 1';
    const fila = rawFila === 'GENERAL' ? 'Nivel 1' : rawFila;
    if (!levelsMap[fila]) levelsMap[fila] = [];
    levelsMap[fila].push(p);
  });

  const sortedLevels = Object.keys(levelsMap).sort((a, b) => {
    // Ordenar Nivel 1, Nivel 2, Nivel 3 primero
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
  const displayShelfName = shelfName === 'Sin Asignar' ? 'BODEGA GENERAL' : shelfName;
  const totalPhysicalUnits = products.reduce((acc, item) => acc + Math.max(0, Number(item.stock || 0)), 0);

  return (
    <div
      id={id}
      ref={columnRef}
      onClick={() => {
        if (isDimmed && onSelectShelf) {
          onSelectShelf(shelfName);
        }
      }}
      className={`w-[350px] flex-shrink-0 flex flex-col rounded-2xl h-full border transition-all duration-200 overflow-hidden select-none shadow-2xl ${
        isHighlighted
          ? 'bg-slate-900 border-sky-400 ring-2 ring-sky-400/50 shadow-[0_0_28px_rgba(14,165,233,0.3)] z-20 opacity-100'
          : isDimmed
          ? 'bg-slate-950/60 border-slate-800/50 opacity-30 hover:opacity-65 cursor-pointer'
          : 'bg-slate-900/90 border-slate-800 shadow-xl opacity-100'
      }`}
    >
      <div
        className={`p-4 border-b flex justify-between items-center sticky top-0 z-10 transition-colors ${
          isHighlighted
            ? 'bg-sky-950/70 border-sky-500/40'
            : 'bg-slate-800/80 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-mono font-black text-sm flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            {chunkIndex + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectShelf?.(shelfName);
                }}
                className="text-left group flex items-center gap-1.5 focus:outline-none"
                title={isHighlighted ? 'Quitar enfoque de este estante' : 'Enfocar este estante físicamente'}
              >
                <MapPin
                  size={15}
                  className={`shrink-0 transition-colors ${
                    isHighlighted
                      ? 'text-sky-400'
                      : 'text-slate-500 group-hover:text-sky-400'
                  }`}
                />
                <h2 className="text-base font-black text-white uppercase tracking-tight truncate group-hover:text-sky-300 transition-colors">
                  {displayShelfName}
                </h2>
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
              <span>Estante #{chunkIndex + 1}</span>
              <span aria-hidden="true">·</span>
              <span>{sortedLevels.length} {sortedLevels.length === 1 ? 'nivel' : 'niveles'}</span>
              <span aria-hidden="true">·</span>
              <span>{totalPhysicalUnits} u.</span>
              {isDirtyChunk && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400 font-semibold inline-flex items-center gap-1" title="Cambios pendientes de guardar en base de datos">
                    <Layers size={11} /> Pendiente ({dirtySlotsCount})
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xs font-mono tabular-nums text-sky-400 font-bold whitespace-nowrap">
            {products.length} {products.length === 1 ? 'prod' : 'prods'}
          </span>
          {onAddProductClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddProductClick(shelfName, sortedLevels[0] || 'GENERAL');
              }}
              className="min-h-10 px-3 py-2 bg-[#0ea5e9] hover:bg-sky-400 text-white rounded-lg transition-colors active:scale-95 inline-flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wide whitespace-nowrap shrink-0"
              title={`Nuevo Ingreso en ${shelfName}`}
            >
              <Plus size={16} strokeWidth={3} />
              <span className="hidden sm:inline">Agregar</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-[8px] hide-scrollbar relative bg-slate-900/40">
        {isInRenderDistance ? (
          sortedLevels.map((level) => (
            <LevelDropZone
              key={level}
              shelfName={shelfName}
              levelName={level}
              products={levelsMap[level]}
              onProductClick={onProductClick}
              onAddProductClick={onAddProductClick}
            />
          ))
        ) : (
          /* LIGHTWEIGHT MOCK MODE (Frustum Culled / Outside Render Distance) */
          <div className="flex flex-col gap-3 py-2">
            <div className="px-3 py-2 rounded border border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Cpu size={13} className="text-slate-500" />
                En espera (Fuera de vista)
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsInRenderDistance(true);
                }}
                className="text-sky-400 hover:text-sky-300 font-semibold whitespace-nowrap"
              >
                Cargar
              </button>
            </div>
            {sortedLevels.map((level) => {
              const levelItems = levelsMap[level] || [];
              return (
                <div
                  key={level}
                  className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                    <span className="font-bold text-slate-300">{level}</span>
                    <span>{levelItems.length} slots en memoria</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {levelItems.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs text-slate-400 py-1 px-2 rounded bg-slate-900/60 truncate font-mono tabular-nums"
                      >
                        <span className="truncate pr-2 font-sans text-slate-300">{item.name}</span>
                        <span className="shrink-0 text-sky-400">{item.stock}</span>
                      </div>
                    ))}
                    {levelItems.length > 4 && (
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums px-2 pt-0.5">
                        +{levelItems.length - 4} productos más en este nivel
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

