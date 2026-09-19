'use client';

import Link from 'next/link';
import { HelpCircle, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
          <HelpCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">
            Página No Encontrada
          </h1>
          <p className="text-slate-400 text-xs leading-relaxed">
            La sección o recurso que buscas no existe o ha sido movida dentro del sistema BUNKKER E.C.O.S.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Ir al Dashboard
          </Link>
          <Link
            href="/"
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Inicio
          </Link>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-slate-600 font-medium">
        BUNKKER E.C.O.S ERP • Sistema Operativo Empresarial
      </p>
    </div>
  );
}
