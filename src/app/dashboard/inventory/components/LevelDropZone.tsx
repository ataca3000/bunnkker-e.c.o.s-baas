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
      title: 'NIVEL 1',
      subtitle: 'Planta Baja / Suelo',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      borderAccent: 'border-l-blue-500',
    };
  }
  if (norm.includes('2') || norm === 'NIVEL 2') {
    return {
      title: 'NIVEL 2',
      subtitle: 'Altura Media / Carga Manual',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      borderAccent: 'border-l-emerald-500',
    };
  }
  if (norm.includes('3') || norm === 'NIVEL 3') {
    return {
      title: 'NIVEL 3',
      subtitle: 'Parte Alta / Estiba Ligera',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      borderAccent: 'border-l-amber-500',
    };
  }
  if (norm.includes('4') || norm === 'NIVEL 4') {
    return {
      title: 'NIVEL 4',
      subtitle: 'Rack Superior / Reserva',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      borderAccent: 'border-l-purple-500',
    };
  }
  return {
    title: name.toUpperCase(),
    subtitle: 'Nivel General / Base',
    badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
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

  const { title, subtitle, badgeColor, borderAccent } = getLevelDetails(levelName);
  const totalUnits = products.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)), 0);

  return (
    <div className={`flex flex-col gap-1.5 rounded-lg border-l-4 ${borderAccent} bg-slate-950/40 p-2.5 transition-colors border border-slate-800/60`}>
      {/* Encabezado del Nivel con Subtítulo */}
      <div className="flex items-center justify-between px-1">
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


