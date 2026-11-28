'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  QrCode,
  ShoppingCart,
  X,
} from 'lucide-react';

const TOUR_STORAGE_KEY = 'bunkker_mobile_welcome_done';

const TOUR_STEPS = [
  {
    title: '1. Caja y Punto de Venta Rápido',
    description:
      'Cobra pedidos, aplica pagos y genera tickets al instante incluso si trabajas sin internet estable.',
    actionLabel: 'Ir a Caja / Ventas',
    actionPath: '/dashboard/sales',
    icon: ShoppingCart,
  },
  {
    title: '2. Almacén con Escáner QR',
    description:
      'Usa el botón "Escanear" en la barra superior para consultar existencia, precio y estante desde cualquier módulo.',
    actionLabel: 'Abrir Almacén',
    actionPath: '/dashboard/inventory',
    icon: QrCode,
  },
  {
    title: '3. IA Híbrida y Reporte Beta',
    description:
      'Consulta resúmenes operativos con Firebase AI Logic y reporta cualquier falla desde "Reportar falla" en el encabezado.',
    actionLabel: 'Explorar Diagnóstico IA',
    actionPath: '/dashboard/enterprise?tab=hybrid-ai',
    icon: Cpu,
  },
] as const;

export function BunkAssistantTour() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    let pendingFromStorage = false;
    try {
      if (sessionStorage.getItem('bunkker_pending_welcome_tour') === '1') {
        pendingFromStorage = true;
        sessionStorage.removeItem('bunkker_pending_welcome_tour');
      }
    } catch {}

    if (params.get('welcome') === '1' || pendingFromStorage) {
      setStepIdx(0);
      setOpen(true);
    }

    const onOpenTour = () => {
      setStepIdx(0);
      setOpen(true);
    };
    window.addEventListener('bunkker_open_welcome_tour', onOpenTour);
    return () => window.removeEventListener('bunkker_open_welcome_tour', onOpenTour);
  }, []);

  if (!open || typeof document === 'undefined') return null;

  const current = TOUR_STEPS[stepIdx];
  const Icon = current.icon;

  const dismissTour = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, '1');
    } catch {}
    setOpen(false);
    if (typeof window !== 'undefined' && window.location.search.includes('welcome=1')) {
      const nextUrl = window.location.pathname;
      window.history.replaceState({}, '', nextUrl);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guía rápida de bienvenida BUNKKER"
      data-testid="mobile-welcome-tour"
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-950 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
              <Icon size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-cyan-400">
                Guía Rápida Demo · Paso {stepIdx + 1} de {TOUR_STEPS.length}
              </p>
              <h2 className="text-base font-bold text-white leading-snug">{current.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissTour}
            aria-label="Cerrar guía rápida"
            className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3.5 text-sm text-slate-300 leading-relaxed">{current.description}</p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {TOUR_STEPS.map((step, idx) => (
            <span
              key={step.title}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx <= stepIdx ? 'bg-cyan-400' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3.5">
          <button
            type="button"
            onClick={() => {
              dismissTour();
              router.push(current.actionPath);
            }}
            className="min-h-[42px] cursor-pointer rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
          >
            {current.actionLabel}
          </button>

          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span>Atrás</span>
              </button>
            )}

            {stepIdx < TOUR_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStepIdx((s) => Math.min(TOUR_STEPS.length - 1, s + 1))}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-1 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                <span>Siguiente</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={dismissTour}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>Empezar a probar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
