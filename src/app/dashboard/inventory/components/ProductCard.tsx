import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Product } from '@/lib/types';
import { Package, Lock } from 'lucide-react';
import { useERPStore } from '@/store/useERPStore';

interface ProductCardProps {
  key?: React.Key;
  product: Product;
  onClick?: () => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  const floatingStock = useERPStore((s) => s.floatingStock || {});
  const reservedQty = floatingStock[product.id] || 0;
  const availableQty = Math.max(0, product.stock - reservedQty);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id, data: product });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Determinar color de la fila para ubicarlos rápido
  let borderClass = 'border-slate-700';
  let badgeClass = 'bg-slate-700/50 text-slate-400';
  
  const filaStr = (product.location?.fila || 'GENERAL').toUpperCase();
  if (filaStr.includes('1')) {
    borderClass = 'border-l-4 border-l-blue-500 border-y-slate-700 border-r-slate-700';
    badgeClass = 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
  } else if (filaStr.includes('2')) {
    borderClass = 'border-l-4 border-l-emerald-500 border-y-slate-700 border-r-slate-700';
    badgeClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  } else if (filaStr.includes('3')) {
    borderClass = 'border-l-4 border-l-amber-500 border-y-slate-700 border-r-slate-700';
    badgeClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
  } else if (filaStr !== 'GENERAL') {
    borderClass = 'border-l-4 border-l-purple-500 border-y-slate-700 border-r-slate-700';
    badgeClass = 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
          // If not dragging, trigger click
          if (!isDragging && onClick) {
              onClick();
          }
      }}
      className={`bg-slate-900 rounded-lg p-3 border flex gap-3 cursor-grab active:cursor-grabbing hover:border-sky-500 shadow-lg transition-colors ${borderClass} ${isDragging ? 'z-50 opacity-60' : ''}`}
    >
      <div className="w-12 h-12 bg-slate-800 rounded overflow-hidden flex-shrink-0 flex items-center justify-center relative">
        {product.image && product.image.startsWith('http') ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800"></div>
            <Package className="w-5 h-5 text-slate-400 relative z-10" />
          </>
        )}
        {reservedQty > 0 && (
          <div className="absolute inset-0 bg-amber-500/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-20">
            <Lock className="w-4 h-4 text-white drop-shadow-md" />
            <span className="text-[9px] font-bold text-white mt-0.5">{reservedQty}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white text-xs truncate">{product.name}</h4>
        <p className="text-[10px] text-slate-400 mt-1 font-mono truncate">CB: {product.barcode}</p>
        <div className="flex justify-between items-center mt-2">
          <div className="flex gap-1 items-center">
            <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded font-bold" title="Stock Total">
              {product.stock} {product.unitType || 'PZA'}
            </span>
            {reservedQty > 0 && (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold" title="En Tránsito (Reservado)">
                -{reservedQty}
              </span>
            )}
          </div>
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black tracking-wider ${badgeClass}`}>
            {filaStr}
          </span>
        </div>
      </div>
    </div>
  );
}
