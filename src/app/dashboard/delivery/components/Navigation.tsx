import React from 'react';
import type { ViewState } from './types';
import { PackageSearch, Map, Clock, Navigation as NavIcon, LayoutGrid, Truck, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Navigation({ 
  currentView, 
  onViewChange, 
  activeDeliveryId,
  routeCount,
  poolCount = 0,
  historyCount = 0,
  isSuperAdmin = false,
}: { 
  currentView: ViewState; 
  onViewChange: (v: ViewState) => void;
  activeDeliveryId: string | null;
  routeCount: number;
  poolCount?: number;
  historyCount?: number;
  isSuperAdmin?: boolean;
}) {
  return (
    <div className="w-full z-20 mb-3 pointer-events-auto">
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/90 rounded-2xl p-1.5 shadow-xl backdrop-blur-xl gap-1 overflow-x-auto">
        <div className="flex items-center gap-1 shrink-0">
          {/* Tablero Cockpit (3 Columnas) */}
          <button 
            onClick={() => onViewChange('cockpit')}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0",
              currentView === 'cockpit'
                ? "bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            )}
            title="Ver Bolsa, Listos e Historial simultáneamente en 3 columnas"
          >
            <LayoutGrid size={15} />
            <span>Tablero (3 Columnas)</span>
          </button>

          {/* Bolsa de Pedidos */}
          <button 
            onClick={() => onViewChange('pool')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0",
              currentView === 'pool'
                ? "bg-sky-500 text-slate-950 font-black shadow-md shadow-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            )}
          >
            <PackageSearch size={15} />
            <span>Bolsa</span>
            {poolCount > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                currentView === 'pool' ? "bg-slate-950 text-sky-400" : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
              )}>
                {poolCount}
              </span>
            )}
          </button>
          
          {/* Listo / Mi Ruta */}
          <button 
            onClick={() => onViewChange('route')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 relative",
              currentView === 'route'
                ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            )}
          >
            <Truck size={15} />
            <span>Listo / Mi Ruta</span>
            {routeCount > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                currentView === 'route' ? "bg-slate-950 text-amber-300" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              )}>
                {routeCount}
              </span>
            )}
          </button>

          {/* Mapa GPS */}
          <button 
            onClick={() => onViewChange('map')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0",
              currentView === 'map'
                ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            )}
          >
            <Map size={15} />
            <span>Mapa GPS</span>
          </button>

          {/* Historial */}
          <button 
            onClick={() => onViewChange('history')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0",
              currentView === 'history'
                ? "bg-purple-500 text-slate-950 font-black shadow-md shadow-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            )}
          >
            <Clock size={15} />
            <span>Historial</span>
            {historyCount > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                currentView === 'history' ? "bg-slate-950 text-purple-300" : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              )}>
                {historyCount}
              </span>
            )}
          </button>

          {/* Delimitar Cobertura (SuperAdmin Exclusivo) */}
          {isSuperAdmin && (
            <button 
              onClick={() => onViewChange('zone')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border",
                currentView === 'zone'
                  ? "bg-rose-500 text-slate-950 font-black border-rose-400 shadow-md shadow-rose-500/30"
                  : "text-rose-400/90 border-rose-500/30 bg-rose-500/10 hover:text-white hover:bg-rose-500/20"
              )}
              title="Delimitar y configurar el radio de alcance y cobertura de la tienda"
            >
              <Crosshair size={15} />
              <span>Zona de Alcance</span>
            </button>
          )}
        </div>

        {/* Entrega en Curso (Acción Rápida) */}
        {activeDeliveryId && (
          <button 
            onClick={() => onViewChange('delivery')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-pulse shrink-0"
          >
            <NavIcon size={14} />
            <span>En Entrega</span>
          </button>
        )}
      </div>
    </div>
  );
}
