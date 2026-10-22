import React from 'react';
import { StockFloatEvent } from '../types/logistics';
import { Store, Truck, Layers, CheckCircle2 } from 'lucide-react';

interface StockFloatToastsProps {
  events: StockFloatEvent[];
}

export const StockFloatToasts: React.FC<StockFloatToastsProps> = ({ events }) => {
  if (events.length === 0) return null;

  return (
    <div className="absolute top-20 right-4 z-40 flex flex-col gap-2.5 pointer-events-none max-w-sm">
      {events.map((ev) => {
        const dest = ev.destination || (ev.type === 'plus' ? 'carga' : 'caja');
        const isCaja = dest === 'caja';
        const isDomicilio = dest === 'domicilio';
        const isCarga = dest === 'carga';

        let badgeBg = 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200';
        let iconBg = 'bg-emerald-500 text-slate-950';
        let titleColor = 'text-emerald-300';
        let titleText = '🟢 ¡ENTREGA EN TIENDA CONFIRMADA!';
        let impactText = '✓ Cobrado en Mostrador • Stock Tienda -1';
        let IconComp = Store;

        if (isDomicilio) {
          badgeBg = 'bg-orange-950/95 border-orange-500/80 text-orange-200';
          iconBg = 'bg-orange-500 text-slate-950';
          titleColor = 'text-orange-300';
          titleText = '🟠 ¡ENTREGA A DOMICILIO EXITOSA!';
          impactText = '✓ Entregado en Puerta • Stock -1';
          IconComp = Truck;
        } else if (isCarga) {
          badgeBg = 'bg-cyan-950/95 border-cyan-500/80 text-cyan-200';
          iconBg = 'bg-cyan-500 text-slate-950';
          titleColor = 'text-cyan-300';
          titleText = '🔵 ¡REABASTECIMIENTO COMPLETADO!';
          impactText = '✓ Ubicado en Racks Bodega • Stock +1';
          IconComp = Layers;
        }

        return (
          <div
            key={ev.id}
            className={`flex flex-col gap-1.5 p-3 rounded-2xl border shadow-2xl backdrop-blur-md animate-bounce transition-all ${badgeBg}`}
          >
            {/* Top row: Destination badge & tracking ID */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${iconBg}`}>
                  <IconComp className="w-3.5 h-3.5" />
                </div>
                <span className={`text-[11px] font-black tracking-wide ${titleColor}`}>
                  {titleText}
                </span>
              </div>
              {ev.trackingId && (
                <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
                  {ev.trackingId}
                </span>
              )}
            </div>

            {/* Middle: Product Name */}
            {ev.productName && (
              <div className="text-xs font-bold text-white truncate pl-1">
                📦 {ev.productName}
              </div>
            )}

            {/* Bottom: Destination & Stock impact */}
            <div className="flex items-center justify-between text-[10px] opacity-90 pl-1 pt-0.5 border-t border-white/10">
              <span className="text-slate-300">{ev.zone}</span>
              <span className="font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-current" />
                {impactText}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

