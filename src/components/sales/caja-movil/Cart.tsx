import React from 'react';
import { Minus, Plus, Trash2, Truck, Store, X, Package2 } from 'lucide-react';
import type { Product } from '@/context/CartContext';

export type OrderType = 'local' | 'delivery';

interface CartProps {
  items: (Product & { quantity: number })[];
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  updateQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  onCheckout: () => void;
  onClear: () => void;
}

export function Cart({ items, orderType, setOrderType, updateQuantity, removeItem, onCheckout, onClear }: CartProps) {
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

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
          items.map(item => (
            <div key={item.id} className="flex gap-3 bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10 items-center animate-in fade-in slide-in-from-bottom-2">
              <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-zinc-800 mix-blend-overlay opacity-60 border border-white/10 overflow-hidden`}>
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <Package2 className="w-6 h-6 text-zinc-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-white truncate">{item.name}</h4>
                <p className="text-xs text-zinc-400">${item.price.toFixed(2)} c/u</p>
              </div>

              <div className="flex flex-col items-end gap-2">
                 <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg shadow-sm p-0.5">
                   <button 
                     onClick={() => updateQuantity(item.id, item.quantity - 1)}
                     className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-white rounded-md transition-colors"
                   >
                     <Minus className="h-4 w-4" />
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
                      className="w-12 text-center text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded bg-transparent text-white hide-arrows"
                   />
                   <button 
                     onClick={() => updateQuantity(item.id, item.quantity + 1)}
                     className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-white rounded-md transition-colors"
                   >
                     <Plus className="h-4 w-4" />
                   </button>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="text-sm font-bold text-white">${(item.price * item.quantity).toFixed(2)}</span>
                   <button 
                     onClick={() => removeItem(item.id)}
                     className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-white/5"
                   >
                     <X className="h-4 w-4" />
                   </button>
                 </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Checkout Area */}
      <div className="p-4 border-t border-white/10 bg-black/60 backdrop-blur-xl shrink-0">
         
         <div className="flex bg-white/5 p-1 rounded-xl mb-4 border border-white/5">
           <button
             onClick={() => setOrderType('local')}
             className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${
               orderType === 'local' ? 'bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)] border border-white/10' : 'text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.02]'
             }`}
           >
             <Store className="h-4 w-4 mr-2" />
             Entrega en Píso
           </button>
           <button
             onClick={() => setOrderType('delivery')}
             className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${
               orderType === 'delivery' ? 'bg-blue-600/20 text-blue-300 shadow-[0_0_10px_rgba(37,99,235,0.2)] border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.02]'
             }`}
           >
             <Truck className="h-4 w-4 mr-2" />
             Envío Domicilio
           </button>
         </div>

         <div className="space-y-2 mb-4 px-1">
           <div className="flex justify-between text-sm text-zinc-400">
             <span>Subtotal</span>
             <span>${total.toFixed(2)}</span>
           </div>
           <div className="flex justify-between text-lg font-display font-bold text-white">
             <span>Total a Cobrar</span>
             <span>${total.toFixed(2)}</span>
           </div>
         </div>

         <div className="flex gap-3">
           <button
             onClick={onClear}
             disabled={items.length === 0}
             className={`flex-[1] py-5 rounded-2xl flex items-center justify-center text-sm font-black tracking-widest uppercase transition-all ${
               items.length === 0
                 ? 'bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed'
                 : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 active:scale-95'
             }`}
           >
             <X className="mr-1" size={18} /> Cancelar
           </button>
           
           <button
             onClick={onCheckout}
             disabled={items.length === 0}
             className={`flex-[2] py-5 rounded-2xl flex flex-col items-center justify-center text-xl font-black uppercase tracking-wider transition-all relative overflow-hidden ${
               items.length === 0 
                 ? 'bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed'
                 : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400/50 active:scale-95'
             }`}
           >
             {items.length > 0 ? (
               <>
                 <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
                 {orderType === 'delivery' ? 'Datos Envío' : 'Cobrar'}
                 <span className="text-sm font-bold opacity-80">${total.toFixed(2)}</span>
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
