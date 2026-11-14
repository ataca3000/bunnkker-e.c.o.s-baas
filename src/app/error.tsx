'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

const ERROR_CHUNK_RELOAD_KEY = '_bunkker_err_chunk_reload_at';

function detectChunkError(error: Error & { digest?: string }): boolean {
  const msg = String(error?.message || '');
  const name = String(error?.name || '');
  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      msg
    )
  );
}

async function clearAppCachesAndReload() {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.includes('storefront-media'))
          .map((key) => caches.delete(key))
      );
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map((r) => {
          r.active?.postMessage({ type: 'PURGE_UNUSED_CACHES' });
          return r.update().catch(() => {});
        })
      );
    }
  } catch {}
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isChunkError, setIsChunkError] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    console.error('BUNKKER E.C.O.S Error:', error);
    const chunkFailure = detectChunkError(error);
    setIsChunkError(chunkFailure);

    if (chunkFailure && typeof window !== 'undefined') {
      try {
        const lastAttempt = Number(sessionStorage.getItem(ERROR_CHUNK_RELOAD_KEY) || '0');
        if (Date.now() - lastAttempt > 15000) {
          sessionStorage.setItem(ERROR_CHUNK_RELOAD_KEY, String(Date.now()));
          setIsReloading(true);
          void clearAppCachesAndReload();
        }
      } catch {}
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="max-w-md w-full bg-slate-900 p-7 rounded-2xl border border-slate-800 shadow-2xl text-center space-y-5"
      >
        <div className="w-16 h-16 bg-red-500/15 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/25">
          <ShieldAlert size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isChunkError ? 'Actualización de módulo detectada' : 'LION dice: ¡Ups!'}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            {isChunkError
              ? 'El navegador tenía cargada una versión anterior del módulo y el servidor actualizó sus archivos. Recarga para sincronizar sin perder tus borradores locales.'
              : 'Algo interrumpió el proceso. El sistema BUNKKER conserva tus datos y borradores locales seguros en el dispositivo.'}
          </p>
        </div>

        {error?.message && (
          <div className="text-left bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-400 break-words max-h-28 overflow-y-auto">
            {error.message}
          </div>
        )}

        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            disabled={isReloading}
            onClick={() => {
              setIsReloading(true);
              void clearAppCachesAndReload();
            }}
            className="w-full min-h-[44px] py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            <RotateCcw size={17} className={isReloading ? 'animate-spin' : ''} />
            <span>{isReloading ? 'Sincronizando aplicación...' : 'Limpiar Caché y Recargar'}</span>
          </button>

          <button
            type="button"
            onClick={() => reset()}
            className="w-full min-h-[44px] py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors active:scale-[0.98] cursor-pointer"
          >
            <RefreshCw size={17} />
            <span>Reintentar Módulo</span>
          </button>
        </div>
      </motion.div>

      <p className="mt-6 text-xs text-slate-500 font-medium">
        BUNKKER E.C.O.S ERP · Recuperación segura activa
      </p>
    </div>
  );
}
