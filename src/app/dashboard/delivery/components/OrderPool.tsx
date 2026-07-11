import React from 'react';
import type { DeliveryOrder } from './types';
import { Plus, User, MapPin, Radar } from 'lucide-react';
import { motion } from 'framer-motion';

// Acoustic feedback
const playBeep = () => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) { }
};

interface OrderPoolProps {
  orders: DeliveryOrder[];
  onClaim: (id: string) => void;
  loading: boolean;
  driverLocation?: { lat: number; lng: number } | null;
}

export default function OrderPool({ orders, onClaim, loading, driverLocation }: OrderPoolProps) {
  
  const mapCenter = driverLocation ? `${driverLocation.lat},${driverLocation.lng}` : 'Ciudad+de+Mexico';

  const emptyState = (
      <div className="text-center py-12 relative overflow-hidden bg-slate-900/40 rounded-3xl border border-white/5 backdrop-blur-md">
        <Radar size={48} className={`mx-auto mb-4 text-sky-400 ${loading ? 'animate-spin' : 'animate-pulse'}`} />
        <p className="text-sky-300 font-bold uppercase tracking-widest text-sm relative z-10">
            {loading ? 'Sincronizando satélite...' : 'Radar Limpio'}
        </p>
        <p className="text-slate-500 font-medium text-xs mt-2 relative z-10">
            {loading ? 'Buscando pedidos en tu zona operativa...' : 'No hay pedidos disponibles en este momento.'}
        </p>
        {/* Radar Ping Effect Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-sky-500/20 rounded-full blur-xl animate-ping"></div>
      </div>
  );

  return (
    <div className="space-y-6">
      {/* Global Driver Map */}
      <div className="w-full h-64 md:h-[400px] bg-slate-800 rounded-sm overflow-hidden relative shadow-lg border border-slate-700/50">
          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-sm border border-white/10 z-10 flex items-center gap-2 shadow-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Ubicación Actual
          </div>
          <iframe 
              width="100%" 
              height="100%" 
              style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) contrast(100%)' }} 
              loading="lazy" 
              allowFullScreen 
              src={`https://maps.google.com/maps?width=100%25&height=600&hl=en&q=${mapCenter}&t=&z=14&ie=UTF8&iwloc=B&output=embed`}
              title="Driver Location"
          ></iframe>
      </div>

      <div className="flex justify-between items-center px-1">
        <h2 className="text-lg font-bold text-white tracking-wide">Bolsa de Pedidos</h2>
        <span className="text-sm bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3 py-1 rounded-full font-medium">{orders.length} disponibles</span>
      </div>
      
      {(loading || orders.length === 0) ? emptyState : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map(order => (
            <motion.div 
              key={order.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/40 backdrop-blur-lg rounded-sm p-4 shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/10"
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
                  onClick={() => { playBeep(); onClaim(order.id); }}
                  className="bg-sky-500 hover:bg-sky-400 text-white px-5 py-2.5 rounded-sm text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-[0_4px_12px_rgba(14,165,233,0.4)]"
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
      )}
    </div>
  );
}
