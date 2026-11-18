import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center bg-slate-950 text-slate-100">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">404</p>
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">Ruta no encontrada</h1>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        El recurso solicitado no existe o cambió de ubicación.
      </p>
      <Link
        href="/"
        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center transition-colors"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
