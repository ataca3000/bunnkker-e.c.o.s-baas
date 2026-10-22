import React from 'react';
import { CameraPreset } from '../types/logistics';

interface ScreenLabel {
  name: string;
  x: number;
  y: number;
  visible: boolean;
  cameraPreset: CameraPreset;
  color: string;
}

interface ZoneLabelsOverlayProps {
  labels: ScreenLabel[];
  onSelectCamera: (cam: CameraPreset) => void;
  showLabels: boolean;
}

export const ZoneLabelsOverlay: React.FC<ZoneLabelsOverlayProps> = ({
  labels,
  onSelectCamera,
  showLabels,
}) => {
  if (!showLabels) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {labels.map((lbl, idx) => {
        if (!lbl.visible) return null;
        return (
          <div
            key={idx}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-transform duration-75"
            style={{ left: `${lbl.x}px`, top: `${lbl.y}px` }}
          >
            <button
              onClick={() => onSelectCamera(lbl.cameraPreset)}
              className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 hover:border-amber-400 text-white shadow-lg text-[11px] font-bold tracking-tight hover:scale-105 active:scale-95 transition"
              title={`Enfocar cámara en ${lbl.name}`}
            >
              <span className={`w-2 h-2 rounded-full ${lbl.color}`} />
              <span className="group-hover:text-amber-300">{lbl.name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
