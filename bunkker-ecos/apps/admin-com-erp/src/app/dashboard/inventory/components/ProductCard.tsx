import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Product } from '@bunkker/core';
import { Package } from 'lucide-react';

interface ProductCardProps {
  key?: React.Key;
  product: Product;
  onClick?: () => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
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
      className={`bg-slate-900 rounded-lg p-3 border border-slate-700 flex gap-3 cursor-grab active:cursor-grabbing hover:border-sky-500 shadow-lg transition-colors ${isDragging ? 'z-50 opacity-60' : ''}`}
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
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white text-xs truncate">{product.name}</h4>
        <p className="text-[10px] text-slate-400 mt-1 font-mono truncate">CB: {product.barcode}</p>
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded font-bold">
            {product.stock} {product.unitType || 'PZA'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {product.location?.fila || 'FILA GEN'}
          </span>
        </div>
      </div>
    </div>
  );
}
