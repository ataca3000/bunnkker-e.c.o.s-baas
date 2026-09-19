import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Product } from '@/lib/types';
import LevelDropZone from './LevelDropZone';
import { Plus, FolderInput, X, ArrowRight, Check, Trash2 } from 'lucide-react';

interface ShelfColumnProps {
  key?: React.Key;
  shelfName: string;
  products: Product[];
  allEstantes?: string[];
  isDragging?: boolean;
  onProductClick?: (product: Product) => void;
  onAddProductClick?: (shelfName: string, levelName: string) => void;
  onReassignAllShelf?: (sourceShelf: string, targetShelf: string) => void;
  onDeleteProduct?: (product: Product) => void;
  onClearTrashShelf?: (shelfName: string, productIdsToDelete: string[]) => void;
  onToggleTagForDeletion?: (product: Product) => void;
}

export default function ShelfColumn({ 
  shelfName, 
  products, 
  allEstantes = [], 
  isDragging = false,
  onProductClick, 
  onAddProductClick, 
  onReassignAllShelf,
  onDeleteProduct,
  onClearTrashShelf,
  onToggleTagForDeletion
}: ShelfColumnProps) {
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showClearTrashModal, setShowClearTrashModal] = useState(false);
  const [targetShelf, setTargetShelf] = useState('');
  const [customShelfInput, setCustomShelfInput] = useState('');

  const trashDropId = `TRASH::${shelfName}`;
  const { setNodeRef: setTrashNodeRef, isOver: isTrashOver } = useDroppable({
    id: trashDropId,
    data: { type: 'Trash', shelfName },
  });

  // Productos marcados para basura/eliminación en este estante
  const trashProducts = products.filter(
    p => p.taggedForDeletion || p.isTrash || p.status === 'trash' || p.stock === 0
  );

  // Agrupar productos dinámicamente por su nivel / fila
  const levelsMap: Record<string, Product[]> = {};
  
  products.forEach(p => {
      const fila = p.location?.fila || 'GENERAL';
      if (!levelsMap[fila]) levelsMap[fila] = [];
      levelsMap[fila].push(p);
  });

  // Si el estante está totalmente vacío, mostramos una zona general para poder arrastrar cosas
  if (Object.keys(levelsMap).length === 0) {
      levelsMap['GENERAL'] = [];
  }

  // Ordenar los niveles alfabéticamente (ej: A1, A2, B1, Nivel 1, Nivel 2...)
  const sortedLevels = Object.keys(levelsMap).sort();

  const otherShelves = allEstantes.filter(
    s => s.toUpperCase().trim() !== shelfName.toUpperCase().trim()
  );

  const handleConfirmReassign = () => {
    const finalTarget = (targetShelf === 'NEW' ? customShelfInput : targetShelf).trim();
    if (!finalTarget) return;
    if (onReassignAllShelf) {
      onReassignAllShelf(shelfName, finalTarget);
    }
    setShowReassignModal(false);
    setTargetShelf('');
    setCustomShelfInput('');
  };

  return (
    <div className="w-[340px] flex-shrink-0 flex flex-col bg-slate-900/80 rounded-2xl h-full border border-slate-800 shadow-xl overflow-hidden relative">
      {/* Shelf Header with CSS Selector .shelf-column-header */}
      <div 
        ref={setTrashNodeRef}
        className={`shelf-column-header p-4 border-b flex justify-between items-center sticky top-0 z-10 transition-all duration-200 ${
          isTrashOver
            ? 'bg-red-600 border-red-400 text-white shadow-[0_0_25px_rgba(239,68,68,0.8)] scale-[1.02]'
            : isDragging
            ? 'bg-red-950/90 border-red-500/70 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse'
            : 'bg-slate-800/50 border-slate-800'
        }`}
      >
        {isDragging ? (
          <div className="flex items-center justify-between w-full py-0.5">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl transition-all ${
                isTrashOver ? 'bg-white text-red-600 scale-125 animate-bounce shadow-lg' : 'bg-red-500/30 text-red-400 border border-red-500/40'
              }`}>
                <Trash2 size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-white">
                  {isTrashOver ? '¡SOLTAR AQUÍ PARA ELIMINAR!' : 'ZONA DE ELIMINACIÓN'}
                </h2>
                <p className="text-[10px] font-bold text-red-300 uppercase tracking-tight">
                  {isTrashOver ? 'Se eliminará inmediatamente' : 'Suelta para borrar producto'}
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase transition-all ${
              isTrashOver ? 'bg-white text-red-600 shadow-md' : 'bg-red-500/20 text-red-300 border border-red-500/40'
            }`}>
              {isTrashOver ? 'ELIMINAR' : 'BASURA'}
            </span>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-tight">{shelfName === 'Sin Asignar' ? 'BODEGA GENERAL' : shelfName}</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">ESTANTE</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-[#0ea5e9]/10 text-[#0ea5e9] text-[10px] rounded-full font-black tracking-widest">
                {products.length} ITEM{products.length !== 1 ? 'S' : ''}
              </span>

              {/* Botón Clear All Trash en .shelf-column-header */}
              <button
                type="button"
                onClick={() => setShowClearTrashModal(true)}
                className={`p-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1 ${
                  trashProducts.length > 0
                    ? 'bg-rose-500/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/60 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
                title={
                  trashProducts.length > 0
                    ? `Vaciar Basura: Eliminar ${trashProducts.length} producto(s) marcados en ${shelfName}`
                    : `Vaciar Basura en ${shelfName}`
                }
              >
                <Trash2 size={18} strokeWidth={2.5} />
                {trashProducts.length > 0 && (
                  <span className="text-[10px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded-full">
                    {trashProducts.length}
                  </span>
                )}
              </button>

              {/* Botón Reasignar Todo */}
              {products.length > 0 && onReassignAllShelf && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetShelf(otherShelves[0] || 'NEW');
                    setShowReassignModal(true);
                  }}
                  className="bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white border border-purple-500/30 p-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center"
                  title={`Reasignar todos los ${products.length} productos a otro estante`}
                >
                  <FolderInput size={18} strokeWidth={2.5} />
                </button>
              )}

              {onAddProductClick && (
                 <button 
                   onClick={() => onAddProductClick(shelfName, sortedLevels[0] || 'GENERAL')}
                   className="bg-[#0ea5e9] hover:bg-sky-400 text-white p-2 rounded-xl transition-all shadow-[0_0_15px_rgba(14,165,233,0.5)] animate-pulse hover:animate-none active:scale-95"
                   title={`Nuevo Ingreso en ${shelfName}`}
                 >
                   <Plus size={18} strokeWidth={3} />
                 </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Reassign All Modal */}
      {showReassignModal && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 p-4 flex flex-col justify-between border-2 border-purple-500/50 rounded-2xl animate-in fade-in duration-200">
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-purple-500/30">
              <div className="flex items-center gap-2 text-purple-400">
                <FolderInput size={20} />
                <h3 className="font-black text-xs uppercase tracking-wider text-white">Reasignar Todo ({products.length})</h3>
              </div>
              <button 
                onClick={() => setShowReassignModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[11px] text-slate-300 font-medium mb-4 leading-relaxed">
              Moverás <strong className="text-purple-300">{products.length} productos</strong> de <span className="underline decoration-purple-500">{shelfName}</span> a un nuevo estante:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Estante de Destino
                </label>
                <select
                  value={targetShelf}
                  onChange={(e) => setTargetShelf(e.target.value)}
                  className="w-full bg-slate-900 border border-purple-500/40 rounded-xl p-2.5 text-xs text-white font-bold outline-none focus:border-purple-400"
                >
                  {otherShelves.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="NEW">+ Crear Nuevo Estante</option>
                </select>
              </div>

              {targetShelf === 'NEW' && (
                <div>
                  <label className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block mb-1">
                    Nombre del Nuevo Estante
                  </label>
                  <input
                    type="text"
                    value={customShelfInput}
                    onChange={(e) => setCustomShelfInput(e.target.value)}
                    placeholder="Ej. PASILLO B2"
                    className="w-full bg-slate-900 border border-purple-500/60 rounded-xl p-2.5 text-xs text-white font-bold outline-none uppercase placeholder-slate-600 focus:border-purple-400"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowReassignModal(false)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmReassign}
              disabled={targetShelf === 'NEW' && !customShelfInput.trim()}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all active:scale-95"
            >
              <Check size={14} /> Mover Todo
            </button>
          </div>
        </div>
      )}

      {/* Clear Trash Modal */}
      {showClearTrashModal && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-30 p-4 flex flex-col justify-between border-2 border-rose-500/60 rounded-2xl animate-in fade-in duration-200">
          <div>
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-rose-500/30">
              <div className="flex items-center gap-2 text-rose-400">
                <Trash2 size={20} />
                <h3 className="font-black text-xs uppercase tracking-wider text-white">Vaciar Basura de Estante</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowClearTrashModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {trashProducts.length > 0 ? (
              <>
                <p className="text-[11px] text-slate-300 font-medium mb-3 leading-relaxed">
                  Se eliminarán permanentemente <strong className="text-rose-400">{trashProducts.length} producto(s)</strong> marcados como basura o agotados en <span className="underline decoration-rose-500">{shelfName}</span>:
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1.5 mb-3 pr-1">
                  {trashProducts.map(tp => (
                    <div key={tp.id} className="text-[10px] bg-slate-900 p-2 rounded-lg border border-rose-500/30 flex justify-between items-center">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-200 truncate">{tp.name}</p>
                        <p className="text-[9px] text-slate-500 font-mono">CB: {tp.barcode || 'S/N'}</p>
                      </div>
                      <span className="text-rose-400 font-mono font-bold flex-shrink-0">Stock: {tp.stock}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <Trash2 size={32} className="mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-400 font-bold mb-1">No hay productos marcados en {shelfName}</p>
                <p className="text-[10px] text-slate-500">Puedes marcar cualquier producto con el icono de papelera en su tarjeta.</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowClearTrashModal(false)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase transition-colors"
            >
              Cancelar
            </button>
            {trashProducts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (onClearTrashShelf) {
                    onClearTrashShelf(shelfName, trashProducts.map(p => p.id));
                  }
                  setShowClearTrashModal(false);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 shadow-lg shadow-rose-600/40 transition-all active:scale-95"
              >
                <Trash2 size={14} /> Vaciar ({trashProducts.length})
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 hide-scrollbar relative bg-slate-900/40">
        {sortedLevels.map(level => (
          <LevelDropZone 
            key={level}
            shelfName={shelfName} 
            levelName={level} 
            products={levelsMap[level]} 
            onProductClick={onProductClick} 
            onAddProductClick={onAddProductClick}
            onDeleteProduct={onDeleteProduct}
            onToggleTagForDeletion={onToggleTagForDeletion}
          />
        ))}
      </div>
    </div>
  );
}
