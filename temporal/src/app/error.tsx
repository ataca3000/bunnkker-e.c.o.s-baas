'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Aquí podríamos mandar el log a nuestro backend o Sentry
    console.error('BUNKKER E.C.O.S Fatal Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-200">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl border border-red-500/20 shadow-2xl shadow-red-900/20 text-center"
      >
        <div className="w-20 h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-red-500/30">
          <ShieldAlert size={40} />
        </div>
        
        <h2 className="text-2xl font-black mb-3 tracking-wide">El Camaleón dice: ¡Ups!</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          Algo interrumpió el proceso. No te preocupes, el sistema BUNKKER está diseñado para recuperarse sin perder tus datos locales.
        </p>
        
        <button
          onClick={() => reset()}
          className="w-full py-4 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg active:scale-95"
        >
          <RefreshCw size={18} />
          Reiniciar Módulo
        </button>
      </motion.div>
      
      <p className="mt-8 text-xs text-slate-600 font-medium">BUNKKER E.C.O.S ERP • Modo Seguro Activo</p>
    </div>
  );
}
