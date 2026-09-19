import React, { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Product } from '@/lib/types';
import { Package, Lock, Trash2, X, AlertTriangle } from 'lucide-react';
import { useERPStore } from '@/store/useERPStore';

interface ProductCardProps {
  key?: React.Key;
  product: Product;
  onClick?: () => void;
  onDelete?: (product: Product) => void;
  onToggleTagForDeletion?: (product: Product) => void;
}

export default function ProductCard({ product, onClick, onDelete, onToggleTagForDeletion }: ProductCardProps) {
  const floatingStock = useERPStore((s) => s.floatingStock || {});
  const reservedQty = floatingStock[product.id] || 0;

  const [showTrashConfirm, setShowTrashConfirm] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startPressTimer = () => {
    timerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(60);
      }
      setShowTrashConfirm(true);
    }, 550);
  };

  const cancelPressTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

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

  const minStockThreshold = product.minStock !== undefined && product.minStock !== null ? Number(product.minStock) : 10;
  const isLowStock = product.stock <= minStockThreshold;
  const isCriticalStock = product.stock <= Math.ceil(minStockThreshold * 0.5);
  const isTaggedForDeletion = Boolean(product.taggedForDeletion || product.isTrash || product.status === 'trash' || product.stock === 0);

  // Determinar color de la fila para ubicarlos rápido
  let borderClass = 'border-slate-700';
  let badgeClass = 'bg-slate-700/50 text-slate-400';
  
  const filaStr = (product.location?.fila || 'GENERAL').toUpperCase();
  if (isTaggedForDeletion) {
    borderClass = 'border-2 border-dashed border-rose-500/80 bg-rose-950/30 shadow-[0_0_12px_rgba(244,63,94,0.3)]';
  } else if (isCriticalStock) {
    borderClass = 'border-2 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.3)] bg-rose-950/20';
  } else if (isLowStock) {
    borderClass = 'border-2 border-amber-500/80 bg-amber-950/20';
  } else if (filaStr.includes('1')) {
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
      onPointerDown={() => startPressTimer()}
      onPointerUp={() => cancelPressTimer()}
      onPointerMove={() => cancelPressTimer()}
      onPointerLeave={() => cancelPressTimer()}
      onClick={(e) => {
        if (!isDragging && onClick && !showTrashConfirm) {
          onClick();
        }
      }}
      className={`group relative bg-slate-900 rounded-lg p-3 border flex gap-3 cursor-grab active:cursor-grabbing hover:border-sky-500 shadow-lg transition-colors ${borderClass} ${isDragging ? 'z-50 opacity-60' : ''}`}
    >
      {/* Cesto de Basura Confirmación overlay en Long Press o Hover button */}
      {showTrashConfirm ? (
        <div 
          className="absolute inset-0 bg-rose-950/95 backdrop-blur-sm rounded-lg z-30 p-2 flex items-center justify-between border border-rose-500/80 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 min-w-0 pr-1">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 animate-bounce" />
            <span className="text-[11px] font-black text-rose-200 uppercase truncate">¿Eliminar producto?</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTrashConfirm(false);
                if (onDelete) onDelete(product);
              }}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-black uppercase flex items-center gap-1 shadow-md active:scale-95 transition-all"
              title="Confirmar eliminación"
            >
              <Trash2 size={12} /> Eliminar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTrashConfirm(false);
              }}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] active:scale-95 transition-all"
              title="Cancelar"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
          {onToggleTagForDeletion && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTagForDeletion(product);
              }}
              className={`p-1 rounded border transition-all ${
                product.taggedForDeletion
                  ? 'bg-rose-600 text-white border-rose-400 opacity-100'
                  : 'opacity-0 group-hover:opacity-100 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border-slate-700'
              }`}
              title={product.taggedForDeletion ? 'Quitar marca de basura' : 'Marcar para eliminar / basura'}
            >
              <Trash2 size={12} />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTrashConfirm(true);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white rounded border border-rose-500/40 shadow-md"
              title="Mantén presionado o clic para eliminar"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

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
        <div className="flex items-start justify-between gap-1 pr-4">
          <h4 className="font-medium text-white text-xs truncate">{product.name}</h4>
          {isCriticalStock ? (
            <span className="text-[9px] bg-rose-500 text-white font-black px-1.5 py-0.5 rounded animate-pulse" title={`Stock Crítico (Mínimo: ${minStockThreshold})`}>
              🚨 CRÍTICO
            </span>
          ) : isLowStock ? (
            <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold px-1.5 py-0.5 rounded" title={`Bajo Mínimo (${minStockThreshold})`}>
              ⚠️ REABASTECER
            </span>
          ) : null}
        </div>
        <p className="text-[10px] text-slate-400 mt-1 font-mono truncate">CB: {product.barcode}</p>
        <div className="flex justify-between items-center mt-2">
          <div className="flex gap-1 items-center">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              isCriticalStock ? 'bg-rose-500/20 text-rose-400' :
              isLowStock ? 'bg-amber-500/20 text-amber-400' :
              'bg-sky-500/10 text-sky-400'
            }`} title={`Stock Total (Mínimo: ${minStockThreshold})`}>
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
