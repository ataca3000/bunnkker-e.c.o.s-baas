import React from 'react';
import type { DeliveryOrder } from './types';
import { Plus, User, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OrderPool({ orders, onClaim, loading }: { orders: DeliveryOrder[], onClaim: (id: string) => void, loading: boolean }) {
  if (loading) {
     return (
      <div className="text-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500 mx-auto mb-4"></div>
        <p className="text-slate-400 font-medium">Buscando pedidos disponibles...</p>
      </div>
     );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-slate-400 font-medium">No hay pedidos disponibles en este momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-white tracking-wide">Bolsa de Pedidos</h2>
        <span className="text-sm bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3 py-1 rounded-full font-medium">{orders.length} disponibles</span>
      </div>
      
      {orders.map(order => (
        <motion.div 
          key={order.id} 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900/40 backdrop-blur-lg rounded-2xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/10"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-xs font-bold text-sky-400 mb-1 block uppercase tracking-wider">{order.id.slice(-6)}</span>
              <div className="flex items-center gap-2 text-white font-medium text-lg">
                <User size={18} className="text-slate-400" />
                {order.customerName}
              </div>
            </div>
            <button 
              onClick={() => onClaim(order.id)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Plus size={16} />
              Tomar
            </button>
          </div>
          <div className="flex items-start gap-2 text-sm text-slate-300">
            <MapPin size={16} className="text-sky-400 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{order.address}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
