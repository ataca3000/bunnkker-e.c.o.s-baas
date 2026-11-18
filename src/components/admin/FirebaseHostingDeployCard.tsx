'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  Flame,
  Globe,
  Loader2,
  Terminal,
} from 'lucide-react';
import {
  FIREBASE_HOSTING_REGIONS,
  buildDeployOneClickCommand,
  buildFirebaseDeployUrls,
  buildFirebaseRcJson,
  isValidFirebaseProjectId,
  sanitizeFirebaseProjectId,
  type FirebaseHostingRegion,
} from '@/lib/firebaseHosting';
import { toast } from '@/lib/toast';

interface FirebaseReadinessData {
  hasFirebaseJson: boolean;
  hasAppHostingYaml: boolean;
  hasFirebaseRc: boolean;
  projectId: string;
  region: FirebaseHostingRegion;
  cliInstalled: boolean;
  cliVersion: string | null;
  hasDatabaseUrl: boolean;
  hasFirebaseToken: boolean;
  urls: ReturnType<typeof buildFirebaseDeployUrls> | null;
  deployCommand: string;
}

export default function FirebaseHostingDeployCard() {
  const [status, setStatus] = useState<FirebaseReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [projectIdInput, setProjectIdInput] = useState('');
  const [region, setRegion] = useState<FirebaseHostingRegion>('us-central1');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/deploy/firebase-status', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (!active || !json?.data) return;
        const data = json.data as FirebaseReadinessData;
        setStatus(data);
        if (data.projectId) setProjectIdInput(data.projectId);
        if (data.region) setRegion(data.region);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sanitizedId = sanitizeFirebaseProjectId(projectIdInput);
  const idIsValid = isValidFirebaseProjectId(sanitizedId);
  const previewUrls = buildFirebaseDeployUrls(idIsValid ? sanitizedId : status?.projectId || 'tu-proyecto-firebase');
  const deployCmd = buildDeployOneClickCommand(idIsValid ? sanitizedId : status?.projectId || 'tu-proyecto-firebase');

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idIsValid) {
      toast.warning(
        'Ingresa un Project ID válido (6 a 30 caracteres: minúsculas, números y guiones, iniciando con letra).',
        'Project ID inválido'
      );
      return;
    }

    setSaving(true);
    setSavedNotice(null);
    try {
      const res = await fetch('/api/deploy/firebase-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: sanitizedId, region }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudo guardar la configuración de Firebase Hosting.');
      }

      setProjectIdInput(sanitizedId);
      setStatus((prev) => ({
        hasFirebaseJson: true,
        hasAppHostingYaml: true,
        hasFirebaseRc: Boolean(json.data?.savedToDisk),
        projectId: sanitizedId,
        region,
        cliInstalled: prev?.cliInstalled ?? false,
        cliVersion: prev?.cliVersion ?? null,
        hasDatabaseUrl: prev?.hasDatabaseUrl ?? false,
        hasFirebaseToken: prev?.hasFirebaseToken ?? false,
        urls: json.data?.urls ?? previewUrls,
        deployCommand: json.data?.deployCommand ?? deployCmd,
      }));
      setSavedNotice(
        json.data?.savedToDisk
          ? 'Archivos firebase.json y .firebaserc actualizados para este proyecto.'
          : 'Configuración generada. Descarga .firebaserc o ejecuta el comando desde tu terminal.'
      );
      toast.success(`Proyecto "${sanitizedId}" listo para Firebase Hosting.`, 'Configuración guardada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error configurando Firebase Hosting');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(`firebase login && ${deployCmd}`);
      toast.success('Comando copiado al portapapeles.', 'Listo para terminal');
    } catch {
      toast.info(`Ejecuta: firebase login && ${deployCmd}`, 'Comando de despliegue');
    }
  };

  const handleDownloadFirebaseRc = () => {
    if (!idIsValid) {
      toast.warning('Primero escribe un Project ID válido para generar .firebaserc.');
      return;
    }
    const content = buildFirebaseRcJson(sanitizedId);
    const blob = new Blob([content], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'firebaserc.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('Descargado. Renómbralo a .firebaserc en la raíz si despliegas desde otro equipo.', '.firebaserc');
  };

  return (
    <section className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Despliegue en Firebase Hosting (Web y Android PWA)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Publica el catálogo y tus rutas Next.js (<code className="text-amber-300">/api/*</code>) sin depender de localhost en móviles Android.
            </p>
          </div>
        </div>

        <a
          href={previewUrls.consoleAppHostingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors shrink-0"
        >
          <ExternalLink size={15} /> Abrir Firebase Console
        </a>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          Verificando manifiestos de despliegue (firebase.json y apphosting.yaml)...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">firebase.json (SSR)</span>
            <span className={`text-xs font-black ${status?.hasFirebaseJson ? 'text-emerald-400' : 'text-amber-400'}`}>
              {status?.hasFirebaseJson ? 'Listo' : 'Pendiente'}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">apphosting.yaml</span>
            <span className={`text-xs font-black ${status?.hasAppHostingYaml ? 'text-emerald-400' : 'text-amber-400'}`}>
              {status?.hasAppHostingYaml ? 'Listo' : 'Pendiente'}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Firebase CLI</span>
            <span className={`text-xs font-black tabular-nums ${status?.cliInstalled ? 'text-emerald-400' : 'text-slate-400'}`}>
              {status?.cliInstalled ? `v${status.cliVersion || 'OK'}` : 'Instalar en PC'}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveConfig} className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            1. Tu Project ID de Firebase
          </label>
          <input
            type="text"
            value={projectIdInput}
            onChange={(e) => setProjectIdInput(e.target.value)}
            placeholder="ej. mi-tienda-ecos-2026"
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-white placeholder-slate-500 focus:border-amber-400 outline-none"
          />
          {projectIdInput.trim().length > 0 && !idIsValid && (
            <p className="text-[11px] text-amber-400 mt-1">
              Usa 6–30 caracteres en minúsculas, números o guiones (iniciando con letra).
            </p>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            2. Región del Servidor SSR
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as FirebaseHostingRegion)}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-amber-400 outline-none"
          >
            {FIREBASE_HOSTING_REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={saving || !idIsValid}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload size={16} />}
          {saving ? 'Guardando...' : 'Continuar / Guardar'}
        </button>
      </form>

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/35 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Globe size={14} className="text-sky-400" /> Opción A — Sin Terminal (Firebase App Hosting)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Conecta tu repositorio en Firebase Console → <b>App Hosting</b>. El archivo <code className="text-slate-200">apphosting.yaml</code> ya está configurado para Next.js 15: solo elige tu proyecto y pulsa <b>Continuar</b>.
          </p>
          <div className="text-[11px] font-mono text-sky-300 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 truncate">
            URL pública: {previewUrls.primaryUrl}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Terminal size={14} className="text-amber-400" /> Opción B — Un Comando en PC (Firebase CLI)
          </div>
          <div className="text-xs font-mono text-amber-200 bg-slate-900 px-3 py-2.5 rounded-lg border border-slate-800 overflow-x-auto whitespace-nowrap">
            firebase login &amp;&amp; {deployCmd}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyCommand}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Copy size={13} /> Copiar comando
            </button>
            <button
              type="button"
              onClick={handleDownloadFirebaseRc}
              disabled={!idIsValid}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={13} /> Descargar .firebaserc
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
