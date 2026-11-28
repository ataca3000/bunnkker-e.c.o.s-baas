'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Loader2, MessageSquareWarning, Send, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  buildSupportTicketPayload,
  type TesterFeedbackCategory,
  validateFeedbackInput,
} from '@/lib/testerFeedback';

interface QuickFeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

const LOCAL_QUEUE_KEY = '_bunkker_pending_tester_feedback';

export default function QuickFeedbackModal({ open, onClose }: QuickFeedbackModalProps) {
  const pathname = usePathname();
  const { profile } = useAuth();

  const [category, setCategory] = useState<TesterFeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentFolio, setSentFolio] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);

  useEffect(() => {
    if (!open) {
      setError('');
      setSentFolio(null);
      setSavedOffline(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = validateFeedbackInput({
      category,
      message,
      contactEmail,
    });
    if (!validation.valid) {
      setError(validation.error || 'Verifica los datos ingresados.');
      return;
    }

    const deviceInfo =
      typeof window !== 'undefined'
        ? `${window.innerWidth}x${window.innerHeight}`
        : 'web';

    const payload = buildSupportTicketPayload({
      category,
      message,
      contactEmail: contactEmail || profile?.email || undefined,
      reporterName: profile?.displayName || 'Tester Beta',
      route: pathname || '/dashboard',
      role: profile?.role || 'operator',
      deviceInfo,
    });

    setBusy(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Error guardando reporte');
      }
      setSentFolio(json.data?.folio || payload.folio);
      setMessage('');
      setSavedOffline(false);
    } catch {
      try {
        const existing = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || '[]');
        existing.unshift({ ...payload, createdAt: new Date().toISOString() });
        localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(existing.slice(0, 30)));
        setSentFolio(payload.folio);
        setMessage('');
        setSavedOffline(true);
      } catch {
        setError('No se pudo guardar el reporte. Intenta de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reportar falla o enviar comentario"
      data-testid="quick-feedback-modal"
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-950 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300">
              <MessageSquareWarning size={18} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Reportar falla / Enviar comentario</h2>
              <p className="text-xs text-slate-400">
                Tu reporte queda registrado en Soporte para mejora continua.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de reporte"
            className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {sentFolio ? (
          <div data-testid="quick-feedback-success" className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs">
              <p className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 size={16} aria-hidden="true" />
                Comentario recibido · Folio {sentFolio}
              </p>
              <p className="mt-1.5 text-slate-300 leading-relaxed">
                {savedOffline
                  ? 'Sin conexión al servidor en este momento: el reporte se guardó localmente en tu dispositivo.'
                  : 'Registrado en el panel de Soporte (/dashboard/soporte) con ruta y contexto técnico.'}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] cursor-pointer rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            {error && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            )}

            <div>
              <span className="block text-xs font-semibold text-slate-300 mb-1.5">Tipo de aviso</span>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-900 p-1">
                {[
                  { id: 'bug' as const, label: 'Falla' },
                  { id: 'ux' as const, label: 'Pantalla móvil' },
                  { id: 'suggestion' as const, label: 'Sugerencia' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCategory(opt.id)}
                    className={`min-h-[36px] cursor-pointer rounded-lg text-xs font-semibold transition-colors ${
                      category === opt.id
                        ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="feedback-msg" className="block text-xs font-semibold text-slate-300 mb-1">
                ¿Qué pasó o qué mejorarías? *
              </label>
              <textarea
                id="feedback-msg"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ej. Al abrir inventario desde el celular, el botón de escáner..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label htmlFor="feedback-email" className="block text-xs font-semibold text-slate-300 mb-1">
                Correo de contacto (opcional)
              </label>
              <input
                id="feedback-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Enviar comentario</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
