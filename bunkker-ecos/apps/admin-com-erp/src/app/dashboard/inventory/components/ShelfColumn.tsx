import React from 'react';
import type { Product } from '@bunkker/core';
import LevelDropZone from './LevelDropZone';
import { Plus } from 'lucide-react';

interface ShelfColumnProps {
  key?: React.Key;
  shelfName: string;
  products: Product[];
  onProductClick?: (product: Product) => void;
  onAddProductClick?: (shelfName: string, levelName: string) => void;
}

export default function ShelfColumn({ shelfName, products, onProductClick, onAddProductClick }: ShelfColumnProps) {
  
  // Categorizar productos por nivel (asumimos que formData.fila guarda el nivel, ej "Nivel 1")
  const level1 = products.filter(p => p.location?.fila?.toLowerCase().includes('1') || p.location?.fila?.toLowerCase() === 'nivel 1');
  const level2 = products.filter(p => p.location?.fila?.toLowerCase().includes('2') || p.location?.fila?.toLowerCase() === 'nivel 2');
  const level3 = products.filter(p => p.location?.fila?.toLowerCase().includes('3') || p.location?.fila?.toLowerCase() === 'nivel 3');
  
  // Los que no tengan "1", "2" o "3" en su fila, los mandamos a "Sin Asignar" u otro dropzone
  const unassignedLevels = products.filter(p => 
    !p.location?.fila?.toLowerCase().includes('1') && 
    !p.location?.fila?.toLowerCase().includes('2') && 
    !p.location?.fila?.toLowerCase().includes('3')
  );

  return (
    <div className="w-[340px] flex-shrink-0 flex flex-col bg-slate-900/80 rounded-2xl h-full border border-slate-800 shadow-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 sticky top-0 z-10">
        <div>
          <h2 className="text-base font-black text-white uppercase tracking-tight">{shelfName === 'Sin Asignar' ? 'BODEGA GENERAL' : shelfName}</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">ESTANTE</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 bg-[#0ea5e9]/10 text-[#0ea5e9] text-[10px] rounded-full font-black tracking-widest">
            {products.length} ITEM{products.length !== 1 ? 'S' : ''}
          </span>
          {onAddProductClick && (
             <button 
               onClick={() => onAddProductClick(shelfName, 'Nivel 1')}
               className="bg-[#0ea5e9] hover:bg-sky-400 text-white p-2 rounded-xl transition-all shadow-[0_0_15px_rgba(14,165,233,0.5)] animate-pulse hover:animate-none active:scale-95"
               title={`Nuevo Ingreso en ${shelfName}`}
             >
               <Plus size={18} strokeWidth={3} />
             </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 hide-scrollbar relative bg-slate-900/40">
        <LevelDropZone 
          shelfName={shelfName} 
          levelName="Nivel 1" 
          products={level1} 
          onProductClick={onProductClick} 
          onAddProductClick={onAddProductClick} 
        />
        
        <LevelDropZone 
          shelfName={shelfName} 
          levelName="Nivel 2" 
          products={level2} 
          onProductClick={onProductClick} 
          onAddProductClick={onAddProductClick} 
        />
        
        <LevelDropZone 
          shelfName={shelfName} 
          levelName="Nivel 3" 
          products={level3} 
          onProductClick={onProductClick} 
          onAddProductClick={onAddProductClick} 
        />

        {unassignedLevels.length > 0 && (
          <LevelDropZone 
            shelfName={shelfName} 
            levelName="Otros Niveles" 
            products={unassignedLevels} 
            onProductClick={onProductClick} 
            onAddProductClick={onAddProductClick} 
          />
        )}
      </div>
    </div>
  );
}
