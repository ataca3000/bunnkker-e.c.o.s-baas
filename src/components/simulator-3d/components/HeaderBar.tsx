import React from 'react';
import { Volume2, VolumeX, RotateCcw, Box, Store, Sparkles, EyeOff, Radio } from 'lucide-react';
import type { LogisticsOrder, SimulationStep } from '../types/logistics';

interface HeaderBarProps {
  currentOrder: LogisticsOrder | null;
  currentStep: SimulationStep;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onReset: () => void;
  onNewQuickOrder: () => void;
  onToggleHideUi?: () => void;
  showErpHud?: boolean;
  onToggleErpHud?: () => void;
}

const STEP_LABELS: Record<SimulationStep, { label: string; role: string; color: string }> = {
  idle: { label: 'En espera de orden', role: 'Ferretería Abierta', color: 'bg-slate-700 text-slate-300' },
  pedido_iniciado: { label: 'Paso 1: Cliente genera solicitud', role: 'Cliente en mostrador', color: 'bg-blue-600 text-white' },
  cobro_sistema: { label: 'Paso 2: Cobro y reserva de stock', role: 'Cajero / POS Central', color: 'bg-emerald-600 text-white' },
  picking_almacen: { label: 'Paso 3: Picking en racks industriales', role: 'Almacenista con montacargas', color: 'bg-amber-600 text-white' },
  empaque_control: { label: 'Paso 4: Verificación, báscula y guía', role: 'Despachador en embalaje', color: 'bg-purple-600 text-white' },
  en_transporte: { label: 'Paso 5: Traslado al cliente', role: 'Entrega en curso', color: 'bg-orange-600 text-white' },
  entregado_exito: { label: 'Paso 6: ¡Entrega completada!', role: 'Cliente satisfecho', color: 'bg-green-600 text-white' },
};

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentOrder,
  currentStep,
  soundEnabled,
  onToggleSound,
  onReset,
  onNewQuickOrder,
  onToggleHideUi,
  showErpHud,
  onToggleErpHud,
}) => {
  const stepInfo = STEP_LABELS[currentStep];

  return (
    <header className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 shadow-xl pointer-events-auto">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-white">FerreFlujo 3D</h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Diorama Logístico
            </span>
          </div>
          <p className="text-xs text-slate-400">Simulación operativa, flujo de paquetes y P&L ferretero</p>
        </div>
      </div>

      {/* Live Status Badge */}
      <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 shadow-xl pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-slate-400 font-medium">Modo:</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Simultáneo Multiusuario
          </span>
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <div className="text-xs text-slate-300 flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-semibold text-[11px]">
            4 Clientes
          </span>
          <span className="px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800 font-semibold text-[11px]">
            8 Empleados
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {onToggleHideUi && (
          <button
            onClick={onToggleHideUi}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-300 hover:text-amber-200 font-semibold text-xs shadow-lg transition active:scale-95"
            title="Ocultar barra de configuración para vista limpia 3D (Atajo: tecla H)"
          >
            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Ocultar Barra</span>
            <kbd className="hidden md:inline px-1 py-0.2 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700">H</kbd>
          </button>
        )}

        {onToggleErpHud && (
          <button
            onClick={onToggleErpHud}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-bold text-xs shadow-lg transition active:scale-95 ${
              showErpHud
                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-cyan-950/50'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title="Mostrar / Ocultar Pizarra de Control ERP Bunkker"
          >
            <Radio className={`w-3.5 h-3.5 ${showErpHud ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Bunkker ERP</span>
          </button>
        )}

        <button
          onClick={onNewQuickOrder}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg transition active:scale-95"
          title="Generar nueva orden al azar"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Lanzar Paquete</span>
        </button>

        <button
          onClick={onReset}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition active:scale-95"
          title="Reiniciar Simulación"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleSound}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition active:scale-95"
          title={soundEnabled ? 'Silenciar Efectos de Audio' : 'Activar Sonido'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
        </button>
      </div>
    </header>
  );
};
