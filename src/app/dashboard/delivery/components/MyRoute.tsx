import React, { useState } from 'react';
import type { DeliveryOrder } from './types';
import { Map, Zap, ChevronRight, User, MapPin, Navigation, CloudOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { isNube } from '@/lib/envConfig';
import AdvancedMap from '@/components/AdvancedMap';
import { optimizeRoute } from '@/lib/tspRouter';

// Formula Haversine se movió a tspRouter.ts

export default function MyRoute({ 
  orders, 
  onStartDelivery, 
  onBackToPool
}: { 
  orders: DeliveryOrder[]; 
  onStartDelivery: (id: string) => void;
  onBackToPool: () => void;
}) {
  const [localOrders, setLocalOrders] = useState<DeliveryOrder[]>([]);

  // Sync localOrders when orders prop changes
  React.useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = () => {
    setIsOptimizing(true);
    // Usa GPS del navegador
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
             optimizeFrom(pos.coords.latitude, pos.coords.longitude);
        }, () => {
             // Default if denied
             optimizeFrom(19.4326, -99.1332);
        });
    } else {
        optimizeFrom(19.4326, -99.1332);
    }
  };

  const optimizeFrom = (lat: number, lng: number) => {
    setTimeout(() => {
      setLocalOrders(prev => {
        const routeOrders = prev.filter(o => orders.some(ro => ro.id === o.id));
        const otherOrders = prev.filter(o => !orders.some(ro => ro.id === o.id));
        
        let currentLocation = { lat, lng };
        const points = routeOrders.map(o => ({ id: o.id, lat: o.lat || lat, lng: o.lng || lng }));
        const optimizedIndices = optimizeRoute({ lat, lng }, points);
        
        const sorted = optimizedIndices.map(idx => points[idx]).map(p => routeOrders.find(o => o.id === p.id)!);
        
        return [...otherOrders, ...sorted];
      });
      setIsOptimizing(false);
    }, 400);
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20">
        <Map className="mx-auto text-slate-500 mb-4" size={48} />
        <h3 className="text-lg font-bold text-slate-300">Tu ruta está vacía</h3>
        <p className="text-slate-400 mt-2 mb-6">Toma pedidos de la bolsa para comenzar tu ruta.</p>
        <button 
          onClick={onBackToPool}
          className="bg-sky-600/80 hover:bg-sky-600 border border-sky-500/50 text-white px-6 py-2 rounded-xl font-bold backdrop-blur-md transition-all active:scale-95"
        >
          Ver Disponibles
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Route Preview Map */}
      <div className="bg-slate-900/40 backdrop-blur-lg rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/10 overflow-hidden relative mb-2">
        <div className="h-64 w-full bg-slate-800 relative z-0 flex items-center justify-center">
          <AdvancedMap 
            mode="route" 
            markers={localOrders.map(o => ({ id: o.id, lat: o.lat || 19.4326, lng: o.lng || -99.1332, title: o.customerName, description: o.address }))}
            routeIndices={localOrders.map((_, i) => i)}
            useOfflineTiles={true}
          />
        </div>
        <div className="p-4 relative z-20 -mt-10">
            <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl flex items-center justify-between">
               <div>
                 <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Siguiente Parada</span>
                 <h2 className="text-md font-bold text-white line-clamp-1">{orders[0].address}</h2>
               </div>
               <button 
                  onClick={() => {
                    const waypoints = orders.slice(1).map(o => encodeURIComponent(o.address)).join('|');
                    const dest = encodeURIComponent(orders[0].address);
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}${waypoints ? `&waypoints=${waypoints}` : ''}`;
                    window.open(url, '_blank');
                  }}
                  className="bg-sky-600/90 text-white rounded-xl p-3 hover:bg-sky-500 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.5)] border border-sky-400/50 active:scale-95 flex-shrink-0"
               >
                 <Map size={20} />
               </button>
            </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white tracking-wide">Mi Ruta de Entregas</h2>
        <button 
          onClick={handleOptimize}
          disabled={isOptimizing || orders.length < 2}
          className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
        >
          <Zap size={16} className={isOptimizing ? "animate-pulse" : ""} />
          {isOptimizing ? 'Optimizando...' : 'Optimizar'}
        </button>
      </div>

      <div className="relative pt-2">
        <div className="absolute left-[23px] top-6 bottom-12 w-[2px] z-0">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
            <line x1="1" y1="0" x2="1" y2="100%" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
            <motion.line 
              x1="1" y1="0" x2="1" y2="100%" 
              stroke="#0ea5e9" 
              strokeWidth="2" 
              strokeDasharray="6 6"
              animate={{ strokeDashoffset: [0, -12] }}
              transition={{ repeat: Infinity, ease: "linear", duration: 1 }}
              style={{ filter: "drop-shadow(0 0 4px rgba(14,165,233,0.6))" }}
            />
          </svg>
        </div>

        <div className="relative z-10 flex items-center mb-6 ml-12">
            <div className="absolute -left-[38px] w-7 h-7 bg-sky-600 border-2 border-slate-900 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.6)]">
               <Navigation size={12} className="text-white fill-white" />
            </div>
            <div>
               <p className="font-bold text-sky-400 text-sm">Tu ubicación</p>
               <p className="text-xs text-slate-400">En ruta al destino</p>
            </div>
        </div>

        {localOrders.map((order, index) => (
          <motion.div 
            layout
            key={order.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-900/60 backdrop-blur-lg rounded-2xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/10 mb-4 ml-12 relative z-10"
          >
            <div className="absolute -left-[38px] top-1/2 -translate-y-1/2 w-7 h-7 bg-slate-900 border-2 border-sky-500 rounded-full flex items-center justify-center text-xs font-bold text-sky-400 z-10 shadow-[0_0_10px_rgba(14,165,233,0.3)]">
              {index + 1}
            </div>

            <div className="flex justify-between items-center">
              <div>
                 <span className="text-xs font-bold text-sky-400 block mb-1 uppercase tracking-wider">{order.id.slice(-6)}</span>
                 <p className="font-bold text-white flex items-center gap-2 text-lg">
                   <User size={16} className="text-slate-400" /> {order.customerName}
                 </p>
                 <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-1.5">
                    <MapPin size={14} className="text-sky-400" /> <span className="line-clamp-1">{order.address}</span>
                 </p>
              </div>
              <button 
                onClick={() => onStartDelivery(order.id)}
                className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-sky-500/30 border border-white/10 hover:border-sky-500/50 transition-all active:scale-95"
                aria-label="Ir a entrega"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
