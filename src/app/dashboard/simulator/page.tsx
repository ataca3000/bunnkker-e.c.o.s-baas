"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const FerreflujoSimulator3D = dynamic(
  () => import('@/components/simulator-3d/FerreflujoSimulator3D'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-slate-950 text-cyan-400 gap-4 rounded-2xl border border-cyan-500/30">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <div className="text-center">
          <p className="text-base font-black uppercase tracking-wider text-white">
            Cargando Gemelo Digital FerreFlujo 3D...
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Inicializando WebGL, Racks de Almacén, Haces Neón y Malla de Radio Local
          </p>
        </div>
      </div>
    ),
  }
);

export default function SimulatorPage() {
  return (
    <div className="p-2 md:p-6 w-full max-w-7xl mx-auto space-y-4">
      <FerreflujoSimulator3D />
    </div>
  );
}
