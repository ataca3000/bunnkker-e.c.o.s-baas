import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';
import { Plus } from 'lucide-react';

interface LevelDropZoneProps {
  shelfName: string;
  levelName: string; // Ej. "Nivel 1", "Nivel 2", "Nivel 3"
  products: Product[];
  onProductClick?: (product: Product) => void;
  onAddProductClick?: (shelfName: string, levelName: string) => void;
}

export default function LevelDropZone({ shelfName, levelName, products, onProductClick, onAddProductClick }: LevelDropZoneProps) {
  // Generamos un ID único combinando estante y nivel
  const dropId = `${shelfName}::${levelName}`;
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { type: 'Level', shelfName, levelName },
  });

  return (
    <div className="flex flex-col gap-2 relative">
      <div className="flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <span>{levelName} ({products.length})</span>
        {onAddProductClick && (
           <button 
             onClick={() => onAddProductClick(shelfName, levelName)}
             className="bg-slate-800 border border-slate-700 hover:bg-[#0ea5e9] hover:border-[#0ea5e9] hover:text-white text-sky-400 p-1.5 rounded-md transition-all animate-pulse hover:animate-none shadow-lg"
             title={`Agregar producto al ${levelName}`}
           >
             <Plus size={14} strokeWidth={3} />
           </button>
        )}
      </div>
      
      <div 
        ref={setNodeRef}
        className={`min-h-[80px] p-2 rounded-xl flex flex-col gap-2 transition-colors border ${
          isOver ? 'border-sky-500 bg-sky-500/10' : 'border-dashed border-slate-700/50 bg-slate-900/30'
        }`}
      >
        <SortableContext 
          items={products.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onClick={() => onProductClick && onProductClick(product)}
            />
          ))}
        </SortableContext>
        
        {products.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[10px] text-slate-600 italic">
            Vacío
          </div>
        )}
      </div>
    </div>
  );
}
