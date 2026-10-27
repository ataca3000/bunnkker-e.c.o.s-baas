import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';
import { Plus, Layers } from 'lucide-react';

interface LevelDropZoneProps {
  shelfName: string;
  levelName: string; // Ej. "Nivel 1", "Nivel 2", "Nivel 3", "GENERAL"
  products: Product[];
  onProductClick?: (product: Product) => void;
  onAddProductClick?: (shelfName: string, levelName: string) => void;
}

// Subtítulos e insignias descriptivas de cada nivel para organización física
function getLevelDetails(name: string) {
  const norm = name.toUpperCase().trim();
  if (norm.includes('1') || norm === 'NIVEL 1') {
    return {
      num: '1',
      title: 'NIVEL 1',
      subtitle: 'Planta Baja / Suelo',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      numBadge: 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.35)]',
      borderAccent: 'border-l-cyan-400',
    };
  }
  if (norm.includes('2') || norm === 'NIVEL 2') {
    return {
      num: '2',
      title: 'NIVEL 2',
      subtitle: 'Altura Media / Carga Manual',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      numBadge: 'bg-amber-500/25 text-amber-300 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.35)]',
      borderAccent: 'border-l-amber-400',
    };
  }
  if (norm.includes('3') || norm === 'NIVEL 3') {
    return {
      num: '3',
      title: 'NIVEL 3',
      subtitle: 'Parte Alta / Estiba Ligera',
      badgeColor: 'bg-slate-200/20 text-slate-100 border-slate-300/40',
      numBadge: 'bg-slate-200/25 text-white border border-slate-300/60 shadow-[0_0_12px_rgba(255,255,255,0.25)]',
      borderAccent: 'border-l-slate-300',
    };
  }
  if (norm.includes('4') || norm === 'NIVEL 4') {
    return {
      num: '4',
      title: 'NIVEL 4',
      subtitle: 'Rack Superior / Reserva',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
      numBadge: 'bg-purple-500/25 text-purple-300 border border-purple-400/60 shadow-[0_0_12px_rgba(168,85,247,0.35)]',
      borderAccent: 'border-l-purple-400',
    };
  }
  return {
    num: '•',
    title: name.toUpperCase(),
    subtitle: 'Nivel General / Base',
    badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    numBadge: 'bg-sky-500/25 text-sky-300 border border-sky-400/50',
    borderAccent: 'border-l-sky-500',
  };
}

export default function LevelDropZone({
  shelfName,
  levelName,
  products,
  onProductClick,
  onAddProductClick,
}: LevelDropZoneProps) {
  const dropId = `${shelfName}::${levelName}`;
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { type: 'Level', shelfName, levelName },
  });

  const { num, title, subtitle, badgeColor, numBadge, borderAccent } = getLevelDetails(levelName);
  const totalUnits = products.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)), 0);

  return (
    <div className={`flex flex-col gap-1.5 rounded-xl border-l-4 ${borderAccent} bg-slate-950/50 p-2.5 transition-colors border border-slate-800/60`}>
      {/* Encabezado del Nivel con Indicador Numérico y Subtítulo */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className={`w-6 h-6 rounded-md font-mono font-black text-xs flex items-center justify-center shrink-0 ${numBadge}`}>
            {num}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${badgeColor}`}>
                {title}
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold tabular-nums">
                ({products.length} {products.length === 1 ? 'prod' : 'prods'} · {totalUnits} u.)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-tight mt-0.5">
              {subtitle}
            </span>
          </div>
        </div>

        {onAddProductClick && (
          <button
            type="button"
            onClick={() => onAddProductClick(shelfName, levelName)}
            className="bg-sky-500/15 border border-sky-500/30 hover:bg-sky-500 hover:border-sky-500 hover:text-white text-sky-400 p-1.5 rounded-lg transition-all shadow-sm active:scale-95"
            title={`Agregar nuevo producto en ${title} de ${shelfName}`}
          >
            <Plus size={13} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Zona Droppable para arrastrar y reubicar */}
      <div
        ref={setNodeRef}
        className={`min-h-[85px] p-2 rounded-xl flex flex-col gap-2 transition-all border ${
          isOver
            ? 'border-sky-400 bg-sky-500/15 ring-2 ring-sky-400/40 shadow-inner'
            : 'border-dashed border-slate-800 bg-slate-900/30'
        }`}
      >
        <SortableContext
          items={products.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => onProductClick && onProductClick(product)}
            />
          ))}
        </SortableContext>

        {products.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <Layers size={18} className="text-slate-600 mb-1" />
            <span className="text-[11px] text-slate-400 font-medium">Nivel Vacío</span>
            <span className="text-[9px] text-slate-500">Arrastra productos aquí para ubicarlos</span>
          </div>
        )}
      </div>
    </div>
  );
}


