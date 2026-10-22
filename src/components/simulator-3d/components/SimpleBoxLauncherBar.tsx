import React from 'react';
import { Store, Truck, ArrowDownToLine, Sparkles, Trash2, Layers } from 'lucide-react';
import { BoxDestination } from '../types/logistics';

interface SimpleBoxLauncherBarProps {
  activeBoxCount: number;
  maxBoxes: number;
  onLaunchBox: (destination: BoxDestination) => void;
  onLaunchTrio: () => void;
  onClearBoxes: () => void;
  disabled?: boolean;
}

export const SimpleBoxLauncherBar: React.FC<SimpleBoxLauncherBarProps> = ({
  activeBoxCount,
  maxBoxes,
  onLaunchBox,
  onLaunchTrio,
  onClearBoxes,
  disabled = false,
}) => {
  const isFull = activeBoxCount >= maxBoxes;

  return (
    <div className="w-full p-2.5 sm:p-3 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl mb-3">
      {/* Top Status & Capacity Row */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Lanzador Rápido de Cajas (Máximo 9 Cajas Simultáneas)
          </span>
        </div>

        {/* Live Slot Dots & Counter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: maxBoxes }).map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < activeBoxCount ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              isFull
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {activeBoxCount} / {maxBoxes} cajas
          </span>

          {activeBoxCount > 0 && (
            <button
              onClick={onClearBoxes}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Limpiar todas las cajas en curso"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main 3 Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* 1. Box a Caja */}
        <button
          onClick={() => onLaunchBox('caja')}
          disabled={isFull || disabled}
          className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left border transition active:scale-95 ${
            isFull || disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-800/50 border-slate-700/50 text-slate-500'
              : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-500/50 hover:border-emerald-400 text-white shadow-lg'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <span>+1 Box a Caja</span>
              <span className="text-[10px] font-mono px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                -1 Stock
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">Venta local directa en mostrador</p>
          </div>
        </button>

        {/* 2. Box a Domicilio */}
        <button
          onClick={() => onLaunchBox('domicilio')}
          disabled={isFull || disabled}
          className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left border transition active:scale-95 ${
            isFull || disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-800/50 border-slate-700/50 text-slate-500'
              : 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-500/50 hover:border-amber-400 text-white shadow-lg'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <span>+1 Box a Domicilio</span>
              <span className="text-[10px] font-mono px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                -1 Stock
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">Camión de reparto a casa</p>
          </div>
        </button>

        {/* 3. Box a Carga (Entrada Proveedor) */}
        <button
          onClick={() => onLaunchBox('carga')}
          disabled={isFull || disabled}
          className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left border transition active:scale-95 ${
            isFull || disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-800/50 border-slate-700/50 text-slate-500'
              : 'bg-blue-950/40 hover:bg-blue-900/60 border-blue-500/50 hover:border-blue-400 text-white shadow-lg'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-blue-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow">
            <ArrowDownToLine className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <span>+1 Box a Carga</span>
              <span className="text-[10px] font-mono px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                +1 Stock
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">Llega proveedor y montacargas surte</p>
          </div>
        </button>
      </div>

      {/* Batch combo button */}
      <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400">
          💡 <strong>Tip:</strong> Puedes lanzar hasta 9 cajas a la vez para simular el tráfico logístico sin saturar.
        </span>

        <button
          onClick={onLaunchTrio}
          disabled={activeBoxCount + 3 > maxBoxes || disabled}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
            activeBoxCount + 3 > maxBoxes || disabled
              ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow active:scale-95'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Lanzar Trío (1 Caja a cada canal)</span>
        </button>
      </div>
    </div>
  );
};
