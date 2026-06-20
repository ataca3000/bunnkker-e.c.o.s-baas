import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';

interface ShelfColumnProps {
  key?: React.Key;
  shelfName: string;
  products: Product[];
  onProductClick?: (productId: string) => void;
}

export default function ShelfColumn({ shelfName, products, onProductClick }: ShelfColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: shelfName,
    data: { type: 'Shelf', shelfName },
  });

  return (
    <div 
      className={`w-[300px] flex-shrink-0 flex flex-col bg-slate-900/50 rounded-xl h-full transition-colors ${
        isOver ? 'border-2 border-dashed border-sky-500/50 bg-sky-500/5' : 'border border-slate-800'
      }`}
    >
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 rounded-t-xl sticky top-0 z-10">
        <div>
          <h2 className="text-sm font-semibold text-white uppercase">{shelfName === 'Sin Asignar' ? 'BODEGA GENERAL' : shelfName}</h2>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">
            ESTANTE
          </p>
        </div>
        <span className="px-2 py-1 bg-slate-800 text-[10px] rounded text-slate-400 font-bold tracking-wider">
          {products.length} ITEM{products.length !== 1 ? 'S' : ''}
        </span>
      </div>

      <div 
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-[300px] relative"
      >
        <SortableContext 
          items={products.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onClick={() => onProductClick && onProductClick(product.id)}
            />
          ))}
        </SortableContext>
        
        {products.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg h-full min-h-[150px]">
             <div className="w-10 h-10 rounded-full border-2 border-slate-800 flex items-center justify-center mb-4">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
             </div>
             Estante Vacío
          </div>
        )}

        {/* More Items Gradient Mask Effect */}
        {products.length > 5 && (
          <div className="pointer-events-none sticky bottom-0 left-0 w-full h-10 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
        )}
      </div>
    </div>
  );
}
