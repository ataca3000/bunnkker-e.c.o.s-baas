import React from 'react';
import type { ViewState } from './types';
import { PackageSearch, Map, Clock, Navigation as NavIcon } from 'lucide-react';
import { cn } from '@bunkker/core';

export default function Navigation({ 
  currentView, 
  onViewChange, 
  activeDeliveryId,
  routeCount
}: { 
  currentView: ViewState; 
  onViewChange: (v: ViewState) => void;
  activeDeliveryId: string | null;
  routeCount: number;
}) {
  return (
    <nav className="bg-slate-950/90 backdrop-blur-xl border-t border-white/10 fixed bottom-0 w-full z-40 pb-safe left-0 right-0">
      <div className="max-w-lg mx-auto flex justify-around items-center p-2">
        <button 
          onClick={() => onViewChange('pool')}
          className={cn("flex flex-col items-center p-2 text-slate-400 hover:text-slate-200 transition-colors", currentView === 'pool' && "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]")}
        >
          <PackageSearch size={24} />
          <span className="text-[10px] font-medium mt-1 uppercase tracking-wider">Disponibles</span>
        </button>
        
        <button 
          onClick={() => onViewChange('route')}
          className={cn("flex flex-col items-center p-2 text-slate-400 hover:text-slate-200 transition-colors relative", currentView === 'route' && "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]")}
        >
          <div className="relative">
             <Map size={24} />
             {routeCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-sky-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-[0_0_10px_rgba(56,189,248,0.6)]">
                  {routeCount}
                </span>
             )}
          </div>
          <span className="text-[10px] font-medium mt-1 uppercase tracking-wider">Mi Ruta</span>
        </button>

        {activeDeliveryId && (
          <button 
            onClick={() => onViewChange('delivery')}
            className={cn("flex flex-col items-center p-2 text-slate-400 hover:text-slate-200 transition-colors", currentView === 'delivery' && "text-sky-400")}
          >
            <div className="p-3 bg-sky-600/90 backdrop-blur-md border border-white/20 text-white rounded-full -mt-8 shadow-[0_0_20px_rgba(56,189,248,0.5)]">
               <NavIcon size={24} />
            </div>
            <span className="text-[10px] font-medium mt-1 uppercase tracking-wider">En Curso</span>
          </button>
        )}

        <button 
          onClick={() => onViewChange('history')}
          className={cn("flex flex-col items-center p-2 text-slate-400 hover:text-slate-200 transition-colors", currentView === 'history' && "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]")}
        >
          <Clock size={24} />
          <span className="text-[10px] font-medium mt-1 uppercase tracking-wider">Historial</span>
        </button>
      </div>
    </nav>
  );
}
