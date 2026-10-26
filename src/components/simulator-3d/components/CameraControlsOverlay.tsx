import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Compass, Gauge, Eye, EyeOff } from 'lucide-react';
import type { PerspectiveType } from '../types/logistics';

interface CameraControlsOverlayProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetOverview: () => void;
  currentPerspective: PerspectiveType;
  simSpeed: number;
  onChangeSpeed: (speed: number) => void;
  isUiHidden?: boolean;
  onToggleHideUi?: () => void;
}

export const CameraControlsOverlay: React.FC<CameraControlsOverlayProps> = ({
  onZoomIn,
  onZoomOut,
  onResetOverview,
  currentPerspective,
  simSpeed,
  onChangeSpeed,
  isUiHidden = false,
  onToggleHideUi,
}) => {
  return (
    <div className="absolute right-4 top-20 z-20 flex flex-col items-end gap-2 pointer-events-auto">
      {/* 3D Navigation & Zoom Controls Pill */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md">
        <button
          onClick={onZoomIn}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition active:scale-95"
          title="Acercar (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={onZoomOut}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition active:scale-95"
          title="Alejar (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-slate-700 mx-0.5" />

        <button
          onClick={onResetOverview}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 ${
            currentPerspective === 'alejada_panoramica'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Restablecer Vista Alejada Panorámica"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Vista Alejada</span>
        </button>

        {onToggleHideUi && (
          <>
            <div className="w-[1px] h-5 bg-slate-700 mx-0.5" />
            <button
              onClick={onToggleHideUi}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                isUiHidden
                  ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-300 shadow-lg'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
              title={isUiHidden ? 'Mostrar Barra de Configuración (H)' : 'Ocultar Barra de Configuración (Modo Zen 3D) (H)'}
            >
              {isUiHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isUiHidden ? 'Mostrar Barra' : 'Ocultar Barra'}</span>
            </button>
          </>
        )}
      </div>

      {/* Speed Selector (Pausado / Representativo vs Normal) */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs">
        <div className="flex items-center gap-1 px-2 py-1 text-slate-400 font-semibold">
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Ritmo:</span>
        </div>
        {[
          { val: 0.6, label: '0.6x Pausado' },
          { val: 1.0, label: '1.0x Normal' },
          { val: 1.5, label: '1.5x Ágil' },
        ].map((s) => (
          <button
            key={s.val}
            onClick={() => onChangeSpeed(s.val)}
            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition ${
              Math.abs(simSpeed - s.val) < 0.1
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Free 360° Drag & Zoom Hint */}
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-[10px] text-slate-400 shadow">
        <Compass className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
        <span>Arrastra para rotar 360° libremente • Rueda o pinza para zoom</span>
      </div>
    </div>
  );
};
