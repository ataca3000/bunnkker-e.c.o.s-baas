import React from 'react';
import { Minus, Plus, Trash2, Truck, Store, X, Package2, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import type { Product } from '@/context/CartContext';

export type OrderType = 'local' | 'delivery';

interface CartProps {
  items: (Product & { quantity: number })[];
  products?: Product[];
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  updateQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  onCheckout: () => void;
  onClear: () => void;
}

export function Cart({ items, products = [], orderType, setOrderType, updateQuantity, removeItem, onCheckout, onClear }: CartProps) {
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const getAvailableStock = (item: Product) => {
    const liveProduct = products.find(p => p.id === item.id) || item;
    return Math.max(0, (liveProduct.stock ?? item.stock ?? 0) - (liveProduct.reservedStock ?? 0));
  };

  const stockExceededItems = items.filter(item => {
    const available = getAvailableStock(item);
    return item.quantity > available;
  });

  const hasStockBlocked = stockExceededItems.length > 0;

  const handleInputChange = (item: any, e: React.ChangeEvent<HTMLInputElement>) => {
    let val = item.isBulk ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
    if (e.target.value === '') val = 0;
    if (!isNaN(val) && val >= 0) {
      updateQuantity(item.id, val);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl border-l border-white/10 text-white relative z-10 w-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-lg font-display font-bold text-white">Pedido Actual</h2>
          <p className="text-xs text-zinc-400">{itemCount} artículos en carrito</p>
        </div>
        {hasStockBlocked && (
          <span className="px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-[11px] font-black text-red-300 uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
            <AlertOctagon size={13} className="text-red-400" />
            Stock Insuficiente ({stockExceededItems.length})
          </span>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500">
             <div className="w-24 h-24 border-2 border-dashed border-white/10 rounded-full flex items-center justify-center mb-4 bg-white/5">
                <Store className="h-8 w-8 text-zinc-600" />
             </div>
             <p className="font-medium text-sm text-zinc-400">El pedido está vacío</p>
             <p className="text-xs mt-1 text-zinc-600">Agrega productos por búsqueda o escáner</p>
          </div>
        ) : (
          items.map(item => {
            const availableStock = getAvailableStock(item);
            const isExceeded = item.quantity > availableStock;
            const isAtMax = item.quantity >= availableStock;

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 p-3 rounded-xl border transition-all animate-in fade-in slide-in-from-bottom-2 ${
                  isExceeded
                    ? 'bg-red-950/30 border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                    : 'bg-white/5 backdrop-blur-sm border-white/10'
                }`}
              >
                <div className="flex gap-3 items-center">
                  <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-zinc-800 mix-blend-overlay opacity-60 border border-white/10 overflow-hidden`}>
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package2 className="w-6 h-6 text-zinc-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">{item.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-zinc-400">${item.price.toFixed(2)} c/u</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        availableStock <= 0
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : isExceeded
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-white/5 text-zinc-400 border-white/10'
                      }`}>
                        Stock Disp: {availableStock}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                     <div className={`flex items-center gap-1 rounded-xl shadow-sm p-1 border ${
                       isExceeded
                         ? 'bg-red-950/60 border-red-500/80 ring-2 ring-red-500/30'
                         : 'bg-black/50 border-white/10'
                     }`}>
                       <button 
                         onClick={() => updateQuantity(item.id, item.quantity - 1)}
                         className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-colors active:scale-95"
                         title="Reducir cantidad"
                       >
                         <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
                       </button>
                       <input
                          type="number"
                          step={item.isBulk ? "any" : "1"}
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => handleInputChange(item, e)}
                          onBlur={(e) => {
                             if (!e.target.value) updateQuantity(item.id, 1);
                             if (item.quantity === 0) removeItem(item.id);
                          }}
                          className={`w-12 sm:w-14 text-center text-sm sm:text-base font-black focus:outline-none rounded bg-transparent hide-arrows ${
                            isExceeded ? 'text-red-300' : 'text-white'
                          }`}
                       />
                       <button 
                         onClick={() => updateQuantity(item.id, item.quantity + 1)}
                         disabled={isAtMax}
                         className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg transition-colors active:scale-95 ${
                           isAtMax
                             ? 'text-zinc-600 bg-white/5 cursor-not-allowed'
                             : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                         }`}
                         title={isAtMax ? `Stock máximo alcanzado (${availableStock})` : "Incrementar cantidad"}
                       >
                         <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                       </button>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className="text-sm sm:text-base font-bold text-white">${(item.price * item.quantity).toFixed(2)}</span>
                       <button 
                         onClick={() => removeItem(item.id)}
                         className="text-zinc-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/10 active:scale-95"
                         title="Eliminar del pedido"
                       >
                         <X className="h-4 w-4 sm:h-5 sm:w-5" />
                       </button>
                     </div>
                  </div>
                </div>

                {/* Alerta visual por fila si excede stock disponible */}
                {isExceeded && (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-[11px] text-red-200">
                    <div className="flex items-center gap-1.5 truncate">
                      <AlertTriangle size={13} className="text-red-400 shrink-0" />
                      <span className="truncate">
                        <strong>Excede stock:</strong> Solicitas {item.quantity}, solo hay {availableStock} disponible(s).
                      </span>
                    </div>
                    {availableStock > 0 ? (
                      <button
                        onClick={() => updateQuantity(item.id, availableStock)}
                        className="px-2.5 py-1 rounded-md bg-amber-500/30 hover:bg-amber-500/40 border border-amber-500/50 text-amber-200 text-xs font-black shrink-0 transition-colors"
                        title="Ajustar cantidad al stock máximo disponible"
                      >
                        Ajustar a {availableStock}
                      </button>
                    ) : (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="px-2.5 py-1 rounded-md bg-red-600/40 hover:bg-red-600/60 border border-red-500/50 text-red-200 text-xs font-black shrink-0 transition-colors"
                        title="Quitar producto sin stock del pedido"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Checkout Area */}
      <div className="p-4 sm:p-5 border-t border-white/10 bg-black/60 backdrop-blur-xl shrink-0">
         
         {/* Banner de bloqueo si hay stock insuficiente */}
         {hasStockBlocked && (
           <div className="bg-red-950/80 border-2 border-red-500/80 rounded-2xl p-3.5 mb-3.5 flex items-start gap-3 text-red-200 shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-pulse">
             <AlertOctagon className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
             <div className="flex-1 min-w-0 text-xs sm:text-sm">
               <span className="font-black text-white uppercase tracking-wider block">
                 Venta Bloqueada: Stock Insuficiente
               </span>
               <span className="text-xs text-red-200/90 leading-tight block mt-0.5">
                 {stockExceededItems.length === 1
                   ? `"${stockExceededItems[0].name}" supera el stock disponible.`
                   : `${stockExceededItems.length} productos en el pedido superan las existencias físicas.`
                 }
               </span>
             </div>
           </div>
         )}

         <div className="flex bg-white/5 p-1.5 rounded-2xl mb-4 border border-white/10 gap-1.5">
           <button
             onClick={() => setOrderType('local')}
             className={`flex-1 flex items-center justify-center py-3 sm:py-3.5 text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 ${
               orderType === 'local' ? 'bg-white/15 text-white shadow-[0_0_15px_rgba(255,255,255,0.08)] border border-white/20' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
             }`}
           >
             <Store className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
             Entrega en Piso
           </button>
           <button
             onClick={() => setOrderType('delivery')}
             className={`flex-1 flex items-center justify-center py-3 sm:py-3.5 text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 ${
               orderType === 'delivery' ? 'bg-blue-600/30 text-blue-300 shadow-[0_0_15px_rgba(37,99,235,0.25)] border border-blue-500/40' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
             }`}
           >
             <Truck className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
             Envío Domicilio
           </button>
         </div>

         <div className="space-y-2 mb-4 px-1">
           <div className="flex justify-between text-xs sm:text-sm text-zinc-400">
             <span>Subtotal</span>
             <span>${total.toFixed(2)}</span>
           </div>
           <div className="flex justify-between text-base sm:text-xl font-display font-black text-white">
             <span>Total a Cobrar</span>
             <span className="text-emerald-400">${total.toFixed(2)}</span>
           </div>
         </div>

         <div className="flex gap-3">
           <button
             onClick={onClear}
             disabled={items.length === 0}
             className={`flex-[1] py-4 sm:py-5 rounded-2xl flex items-center justify-center text-xs sm:text-sm font-black tracking-widest uppercase transition-all shadow-sm ${
               items.length === 0
                 ? 'bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed'
                 : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 active:scale-95'
             }`}
           >
             <X className="mr-1.5" size={18} /> Cancelar
           </button>
           
           <button
             onClick={onCheckout}
             disabled={items.length === 0}
             className={`flex-[2] py-4 sm:py-5 rounded-2xl flex flex-col items-center justify-center text-lg sm:text-xl font-black uppercase tracking-wider transition-all relative overflow-hidden shadow-lg ${
               items.length === 0 
                 ? 'bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed'
                 : hasStockBlocked
                   ? 'bg-gradient-to-r from-red-700 via-rose-700 to-red-800 text-white hover:from-red-600 hover:to-rose-600 shadow-[0_0_25px_rgba(239,68,68,0.5)] border-2 border-red-400 active:scale-95'
                   : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)] border border-emerald-400/50 active:scale-95'
             }`}
           >
             {items.length > 0 ? (
               <>
                 <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
                 {hasStockBlocked ? (
                   <span className="flex items-center gap-2 text-base sm:text-lg text-white font-black">
                     <AlertOctagon size={22} className="text-red-300 animate-bounce" />
                     Venta Bloqueada
                   </span>
                 ) : (
                   <span className="text-base sm:text-lg">
                     {orderType === 'delivery' ? 'Datos Envío' : 'Cobrar'}
                   </span>
                 )}
                 <span className={`text-xs sm:text-sm font-bold ${hasStockBlocked ? 'text-red-200' : 'opacity-90'}`}>
                   {hasStockBlocked ? '⚠️ Clic para resolver faltantes' : `$${total.toFixed(2)}`}
                 </span>
               </>
             ) : 'Cobrar'}
           </button>
         </div>
      </div>

      <style dangerouslySetInnerHTML={{__html:`
        /* Hide number input arrows */
        input[type="number"]::-webkit-inner-spin-button, 
        input[type="number"]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}} />
    </div>
  );
}

