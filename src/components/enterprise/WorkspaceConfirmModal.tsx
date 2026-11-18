'use client';

import { useState } from 'react';
import { FileSpreadsheet, HardDrive, Loader2, ShieldAlert, X } from 'lucide-react';
import { getCachedWorkspaceToken, signInWithGoogleWorkspace } from '@/lib/workspaceClient';

interface WorkspaceConfirmModalProps {
  open: boolean;
  target: 'sheets' | 'drive';
  resourceTitle: string;
  summaryText: string;
  onClose: () => void;
  onConfirm: (accessToken: string) => Promise<void>;
}

export default function WorkspaceConfirmModal({
  open,
  target,
  resourceTitle,
  summaryText,
  onClose,
  onConfirm,
}: WorkspaceConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const hasToken = Boolean(getCachedWorkspaceToken());
  const isSheets = target === 'sheets';

  const handleAuthorizeAndExecute = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let token = getCachedWorkspaceToken();
      if (!token) {
        const popup = await signInWithGoogleWorkspace({ includeWorkspaceScopes: true });
        token = popup.accessToken;
      }
      if (!token) {
        throw new Error('Google no entregó un token OAuth de escritura. Autoriza el acceso en la ventana emergente.');
      }
      await onConfirm(token);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación en Google Workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            {isSheets ? (
              <FileSpreadsheet size={18} className="shrink-0 text-emerald-400" aria-hidden="true" />
            ) : (
              <HardDrive size={18} className="shrink-0 text-sky-400" aria-hidden="true" />
            )}
            <div>
              <h2 id="workspace-confirm-title" className="text-sm font-semibold text-slate-50">
                {isSheets ? 'Exportar hacia Google Sheets' : 'Respaldar en Google Drive'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Confirmación explícita de escritura en tu cuenta Google
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Cerrar diálogo"
            className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="font-medium text-slate-300">Archivo destino</p>
            <p className="mt-0.5 font-mono text-slate-100">{resourceTitle}</p>
            <p className="mt-2 text-slate-400">{summaryText}</p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-300">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-sky-400" aria-hidden="true" />
            <span>
              BUNKKER únicamente utiliza el permiso temporal en memoria (<code>drive.file</code> / <code>spreadsheets</code>) para crear este archivo en tu unidad.
            </span>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-rose-200">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[38px] cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Cancelar
          </button>

          {hasToken ? (
            <button
              type="button"
              onClick={() => void handleAuthorizeAndExecute()}
              disabled={submitting}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {submitting ? 'Enviando a Workspace...' : 'Confirmar y Exportar'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleAuthorizeAndExecute()}
              disabled={submitting}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-2.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin text-slate-700" aria-hidden="true" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
              )}
              <span>{submitting ? 'Conectando...' : 'Autorizar con Google y Exportar'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
