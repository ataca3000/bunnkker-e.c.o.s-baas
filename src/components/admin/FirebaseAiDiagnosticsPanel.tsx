'use client';

import { useCallback, useEffect, useState } from 'react';
import { InferenceMode } from 'firebase/ai';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Cpu,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react';
import {
  getHybridExecutionHistory,
  probeFirebaseAiDiagnostics,
  runDirectFirebaseAiProbe,
  subscribeHybridExecutionHistory,
  type DirectFirebaseProbeResult,
  type FirebaseAiDiagnosticReport,
  type HybridTaskExecutionRecord,
} from '@/lib/firebaseAiLogic';
import HybridInferenceBadge from '@/components/ai/HybridInferenceBadge';
import HybridOperationalSummaryCard from '@/components/ai/HybridOperationalSummaryCard';

export default function FirebaseAiDiagnosticsPanel() {
  const [report, setReport] = useState<FirebaseAiDiagnosticReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [probeBusyMode, setProbeBusyMode] = useState<InferenceMode | null>(null);
  const [probeResult, setProbeResult] = useState<DirectFirebaseProbeResult | null>(null);
  const [history, setHistory] = useState<HybridTaskExecutionRecord[]>(() =>
    getHybridExecutionHistory()
  );

  const refreshDiagnostics = useCallback(async () => {
    setLoadingReport(true);
    try {
      const diag = await probeFirebaseAiDiagnostics();
      setReport(diag);
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    void refreshDiagnostics();
    return subscribeHybridExecutionHistory(setHistory);
  }, [refreshDiagnostics]);

  const handleRunProbe = async (mode: InferenceMode) => {
    setProbeBusyMode(mode);
    try {
      const prompt =
        mode === InferenceMode.ONLY_IN_CLOUD
          ? 'Confirma brevemente en español que la nube de Firebase AI Logic responde para análisis complejos de BUNKKER.'
          : 'Confirma brevemente en español que la inferencia híbrida PREFER_ON_DEVICE está lista en BUNKKER E.C.O.S.';
      const res = await runDirectFirebaseAiProbe({ mode, prompt });
      setProbeResult(res);
    } finally {
      setProbeBusyMode(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Estado de SDK & Capacidades del Dispositivo */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-50">
              <Activity size={17} className="text-sky-400" aria-hidden="true" />
              Diagnóstico en Vivo · Firebase AI Logic Hybrid SDK
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Verifica en tiempo real si el navegador dispone de Gemini Nano On-Device y si la nube
              de Firebase AI Logic responde sin errores de consola.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshDiagnostics()}
            disabled={loadingReport}
            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60"
          >
            <RefreshCw size={13} className={loadingReport ? 'animate-spin' : ''} />
            Re-escanear navegador
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5">
            <p className="text-[11px] font-medium text-slate-400">Proyecto Firebase</p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-100 truncate">
              {report?.projectId || 'Verificando...'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {report?.hasFirebaseCredentials
                ? 'Credenciales reales activas'
                : 'Sin credenciales reales'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5">
            <p className="text-[11px] font-medium text-slate-400">Gemini Nano (On-Device)</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-100">
              <Cpu
                size={14}
                className={
                  report?.onDeviceAvailability === 'available'
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }
                aria-hidden="true"
              />
              <span className="uppercase font-mono">
                {report?.onDeviceAvailability || 'checking'}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
              {report?.onDeviceDetails || 'Inspeccionando Chrome LanguageModel...'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5">
            <p className="text-[11px] font-medium text-slate-400">Respaldo Cloud</p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-xs font-semibold text-sky-300">
              <Cloud size={14} aria-hidden="true" />
              {report?.cloudModel || 'gemini-2.5-flash'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {report?.isOnline ? 'Red en línea disponible' : 'Modo offline detectado'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5">
            <p className="text-[11px] font-medium text-slate-400">Cobertura Multiplataforma</p>
            <p className="mt-1 text-xs font-semibold text-slate-100">
              Web (Chrome) + Android (Kotlin)
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              firebase/ai + firebase-ai KTX
            </p>
          </div>
        </div>

        {/* Botones de prueba directa del SDK (sin enmascarar errores con fallback servidor) */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={probeBusyMode !== null}
            onClick={() => void handleRunProbe(InferenceMode.PREFER_ON_DEVICE)}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {probeBusyMode === InferenceMode.PREFER_ON_DEVICE ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Probar SDK Híbrido (PREFER_ON_DEVICE)
          </button>

          <button
            type="button"
            disabled={probeBusyMode !== null}
            onClick={() => void handleRunProbe(InferenceMode.ONLY_IN_CLOUD)}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-950/40 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-900/50 disabled:opacity-60"
          >
            {probeBusyMode === InferenceMode.ONLY_IN_CLOUD ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Cloud size={14} />
            )}
            Probar Solo Nube (ONLY_IN_CLOUD)
          </button>

          <button
            type="button"
            disabled={probeBusyMode !== null}
            onClick={() => void handleRunProbe(InferenceMode.ONLY_ON_DEVICE)}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60"
          >
            {probeBusyMode === InferenceMode.ONLY_ON_DEVICE ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Cpu size={14} />
            )}
            Forzar On-Device (ONLY_ON_DEVICE)
          </button>
        </div>

        {/* Resultado real de la sonda */}
        {probeResult && (
          <div
            data-testid="firebase-ai-probe-result"
            className={`mt-4 rounded-lg border p-4 text-xs ${
              probeResult.ok
                ? 'border-emerald-500/35 bg-emerald-950/20 text-slate-100'
                : 'border-amber-500/40 bg-amber-950/20 text-amber-100'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                {probeResult.ok ? (
                  <CheckCircle2 size={15} className="text-emerald-400" />
                ) : (
                  <AlertTriangle size={15} className="text-amber-400" />
                )}
                <span>
                  {probeResult.ok
                    ? `Inferencia confirmada (${probeResult.requestedMode})`
                    : `Prueba ${probeResult.requestedMode} no completada`}
                </span>
              </div>

              {probeResult.ok ? (
                <HybridInferenceBadge
                  source={probeResult.source === 'on_device' ? 'on_device' : 'in_cloud'}
                  model={probeResult.model}
                  latencyMs={probeResult.latencyMs}
                />
              ) : (
                <span className="font-mono text-[11px] text-amber-300 tabular-nums">
                  {probeResult.latencyMs} ms
                </span>
              )}
            </div>

            {probeResult.text && (
              <p className="mt-2.5 text-slate-200 leading-relaxed">{probeResult.text}</p>
            )}
            {probeResult.error && (
              <p className="mt-2 font-mono text-[11px] text-rose-300 break-words">
                Detalle técnico: {probeResult.error}
              </p>
            )}
            {probeResult.remediation && (
              <p className="mt-1.5 text-[11px] text-amber-200/90 leading-relaxed">
                Acción recomendada: {probeResult.remediation}
              </p>
            )}
          </div>
        )}

        {/* Guía rápida de Chrome Gemini Nano y Consola Firebase */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-[11px] text-slate-400">
          <span>
            En Chrome Desktop/Android habilita{' '}
            <code className="text-slate-200">chrome://flags/#prompt-api-for-gemini-nano</code> para
            probar ejecución local <strong className="text-emerald-300">on_device</strong>.
          </span>
          {report?.projectId && report.projectId !== 'no-configurado' && (
            <a
              href={`https://console.firebase.google.com/project/${report.projectId}/ailogic`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300"
            >
              <span>Abrir Firebase AI Logic Console</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </section>

      {/* 2. Caso práctico multi-escenario (On-Device vs Cloud) */}
      <HybridOperationalSummaryCard defaultScope="inventory_brief" />

      {/* 3. Bitácora real de ejecuciones en la sesión */}
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
        <div className="border-b border-slate-800 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-100">
            Registro de Ejecuciones Híbridas en Esta Sesión
          </h3>
          <p className="text-xs text-slate-400">
            Traza real de qué motor respondió cada llamada (chat LION, clasificación de productos,
            resúmenes operativos o sondas).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Hora</th>
                <th className="px-4 py-2.5 font-medium">Tarea</th>
                <th className="px-4 py-2.5 font-medium">Modo Solicitado</th>
                <th className="px-4 py-2.5 font-medium">Motor Activo</th>
                <th className="px-4 py-2.5 font-medium text-right">Latencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Aún no se han ejecutado llamadas híbridas en esta sesión. Usa cualquiera de los
                    botones de prueba arriba o genera un resumen operativo.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/35">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(item.timestamp).toLocaleTimeString('es-MX')}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-200">{item.task}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-300">
                      {item.requestedMode}
                    </td>
                    <td className="px-4 py-2.5">
                      <HybridInferenceBadge source={item.source} model={item.model} compact />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300 tabular-nums">
                      {item.latencyMs} ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
