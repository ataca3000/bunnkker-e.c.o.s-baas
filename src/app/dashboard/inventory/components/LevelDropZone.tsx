import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';
import { Plus, Layers } from 'lucide-react';

interface LevelDropZoneProps {
  shelfName: string;
  levelName: string; // Ej. "Nivel 1", "Nivel 2", "Nivel 3", "GENERAL"
  levelIndex?: number;
  products: Product[];
  onProductClick?: (product: Product) => void;
  onAddProductClick?: (shelfName: string, levelName: string) => void;
}

// Paleta cíclica de 8 colores vibrantes para niveles en scroll infinito hacia abajo
const LEVEL_PALETTES = [
  {
    // Nivel 1 (Cian neón)
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50',
    numBadge: 'bg-cyan-500 text-slate-950 font-black border border-cyan-300 shadow-[0_0_14px_rgba(6,182,212,0.6)]',
    borderAccent: 'border-l-cyan-400',
    subtitle: 'Nivel 1 / Suelo / Planta Baja',
  },
  {
    // Nivel 2 (Amarillo neón)
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50',
    numBadge: 'bg-yellow-400 text-slate-950 font-black border border-yellow-200 shadow-[0_0_14px_rgba(250,204,21,0.6)]',
    borderAccent: 'border-l-yellow-400',
    subtitle: 'Nivel 2 / Altura Media / Carga Manual',
  },
  {
    // Nivel 3 (Blanco / Plateado neón)
    badgeColor: 'bg-slate-200/20 text-white border-slate-300/60',
    numBadge: 'bg-white text-slate-950 font-black border border-slate-200 shadow-[0_0_14px_rgba(255,255,255,0.6)]',
    borderAccent: 'border-l-white',
    subtitle: 'Nivel 3 / Altura Alta / Estiba Ligera',
  },
  {
    // Nivel 4 (Rojo / Coral neón)
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/50',
    numBadge: 'bg-red-500 text-white font-black border border-red-300 shadow-[0_0_14px_rgba(239,68,68,0.6)]',
    borderAccent: 'border-l-red-500',
    subtitle: 'Nivel 4 / Rack Superior / Sobrestiba',
  },
  {
    // Nivel 5 (Verde Esmeralda)
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
    numBadge: 'bg-emerald-400 text-slate-950 font-black border border-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.6)]',
    borderAccent: 'border-l-emerald-400',
    subtitle: 'Nivel 5 / Reserva Superior',
  },
  {
    // Nivel 6 (Azul Eléctrico)
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-400/50',
    numBadge: 'bg-blue-500 text-white font-black border border-blue-300 shadow-[0_0_14px_rgba(59,130,246,0.6)]',
    borderAccent: 'border-l-blue-400',
    subtitle: 'Nivel 6 / Estiba Pesada',
  },
  {
    // Nivel 7 (Morado / Violeta)
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/50',
    numBadge: 'bg-purple-500 text-white font-black border border-purple-300 shadow-[0_0_14px_rgba(168,85,247,0.6)]',
    borderAccent: 'border-l-purple-400',
    subtitle: 'Nivel 7 / Copete de Almacén',
  },
  {
    // Nivel 8 (Gris Carbón / Pizarra)
    badgeColor: 'bg-slate-700/40 text-slate-200 border-slate-500/50',
    numBadge: 'bg-slate-700 text-white font-black border border-slate-400 shadow-[0_0_14px_rgba(100,116,139,0.6)]',
    borderAccent: 'border-l-slate-400',
    subtitle: 'Nivel 8 / Techo / Tarima',
  },
];

function getLevelDetails(name: string, index = 0) {
  const norm = name.toUpperCase().trim();
  const match = norm.match(/\d+/);
  const numValue = match ? parseInt(match[0], 10) : index + 1;
  const paletteIndex = Math.max(0, (numValue - 1) % LEVEL_PALETTES.length);
  const palette = LEVEL_PALETTES[paletteIndex];

  return {
    num: String(numValue),
    title: norm.startsWith('NIVEL') ? norm : `NIVEL ${numValue}: ${norm}`,
    subtitle: palette.subtitle,
    badgeColor: palette.badgeColor,
    numBadge: palette.numBadge,
    borderAccent: palette.borderAccent,
  };
}

export default function LevelDropZone({
  shelfName,
  levelName,
  levelIndex = 0,
  products,
  onProductClick,
  onAddProductClick,
}: LevelDropZoneProps) {
  const dropId = `${shelfName}::${levelName}`;
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { type: 'Level', shelfName, levelName },
  });

  const { num, title, subtitle, badgeColor, numBadge, borderAccent } = getLevelDetails(levelName, levelIndex);
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


