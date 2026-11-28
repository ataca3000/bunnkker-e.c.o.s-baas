'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Mail, Trash2 } from 'lucide-react';
import { buildSupportTicketPayload, validateFeedbackInput } from '@/lib/testerFeedback';

export default function AccountDeletionForm() {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [folio, setFolio] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Ingresa el correo o identificador de la cuenta que deseas eliminar.');
      return;
    }
    if (!confirmed) {
      setError('Confirma que comprendes que la eliminación de datos en la nube es irreversible.');
      return;
    }

    const messageText =
      reason.trim() ||
      `Solicitud de eliminación definitiva de cuenta y datos asociados para ${email.trim()}.`;

    const check = validateFeedbackInput({
      category: 'account_deletion',
      message: messageText,
      contactEmail: email.trim(),
    });
    if (!check.valid) {
      setError(check.error || 'Revisa los datos ingresados.');
      return;
    }

    setBusy(true);
    try {
      const payload = buildSupportTicketPayload({
        category: 'account_deletion',
        message: messageText,
        contactEmail: email.trim(),
        reporterName: 'Solicitud Play Store / Usuario',
        route: '/privacidad#eliminacion-cuenta',
      });

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudo registrar la solicitud.');
      }
      setFolio(json.data?.folio || payload.folio);
      setEmail('');
      setReason('');
      setConfirmed(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error enviando la solicitud. Usa el correo directo luishalo69@gmail.com.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-rose-500/30 bg-slate-950/80 p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
        <Trash2 size={16} className="text-rose-400" aria-hidden="true" />
        Solicitar Eliminación de Cuenta y Datos (Google Play Data Safety)
      </h3>
      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
        Procesamos la eliminación de cuentas de cliente, perfiles de personal y registros asociados en
        Firestore/servidor dentro de un plazo máximo de <strong className="text-slate-200">7 días hábiles</strong>.
        Para borrar también el caché local en tu teléfono, selecciona{' '}
        <strong className="text-slate-200">Configuración &gt; Aplicaciones &gt; BUNKKER &gt; Borrar datos</strong>.
      </p>

      {folio ? (
        <div
          data-testid="account-deletion-success"
          className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-200"
        >
          <p className="flex items-center gap-2 font-bold text-emerald-300">
            <CheckCircle2 size={16} aria-hidden="true" />
            Solicitud registrada correctamente · Folio {folio}
          </p>
          <p className="mt-1 text-slate-300">
            Conserva este folio. Recibirás confirmación en cuanto se complete la purga en la nube.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3" data-testid="account-deletion-form">
          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="del-email" className="block text-xs font-semibold text-slate-300 mb-1">
              Correo de la cuenta *
            </label>
            <input
              id="del-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              className="w-full min-h-[42px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label htmlFor="del-reason" className="block text-xs font-semibold text-slate-300 mb-1">
              Motivo o alcance (opcional)
            </label>
            <textarea
              id="del-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Eliminar cuenta de prueba cerrada y todos mis tickets/pedidos..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
            />
          </div>
          <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-rose-500"
            />
            <span>
              Confirmo que deseo eliminar permanentemente mi cuenta y los datos almacenados en la nube.
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              <span>Enviar solicitud de eliminación</span>
            </button>
            <a
              href="mailto:luishalo69@gmail.com?subject=Eliminacion%20de%20Cuenta%20BUNKKER"
              className="inline-flex min-h-[42px] items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              <Mail size={14} aria-hidden="true" />
              <span>Escribir directo a luishalo69@gmail.com</span>
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
