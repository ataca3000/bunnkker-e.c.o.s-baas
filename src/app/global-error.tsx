'use client';

import { useEffect } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const message = String(error?.message || '');
    const isAbort = error?.name === 'AbortError' || /\baborted\b/i.test(message);
    if (!isAbort) {
      console.error('BUNKKER Global Error:', error);
    }
  }, [error]);

  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans antialiased">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <ShieldAlert size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Conexión interrumpida</h2>
            <p className="text-sm text-slate-400">
              Una petición en curso se interrumpió al actualizar. Tus datos locales permanecen seguros.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw size={16} /> Reintentar vista
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
