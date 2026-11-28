'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Copy,
  FileSearch,
  FlaskConical,
  HardDrive,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  AuditBlockVerification,
  AuditChainVerificationResult,
  ImmutableAuditEntry,
  TamperSimulationResult,
} from '@/lib/immutableAudit';
import { toast } from '@/lib/toast';

interface ImmutableAuditViewProps {
  entries: ImmutableAuditEntry[];
  integrity: AuditChainVerificationResult | null;
  blockStatuses: Record<string, AuditBlockVerification>;
  totalChainCount: number;
  branchFilter: string;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onBackupDrive: () => void;
  onMirrorFirestore: (entry: ImmutableAuditEntry) => Promise<void>;
}

interface BrowserDigestCheck {
  entryId: string;
  payloadMatch: boolean;
  entryMatch: boolean;
  recomputedPayloadHash: string;
  recomputedEntryHash: string;
}

async function sha256HexClient(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyEntryInBrowser(entry: ImmutableAuditEntry): Promise<BrowserDigestCheck> {
  const canonicalPayload = JSON.stringify({
    branchId: entry.branchId,
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
    resourceRef: entry.resourceRef,
    details: entry.details || {},
    timestamp: entry.timestamp,
  });
  const recomputedPayloadHash = await sha256HexClient(canonicalPayload);
  const recomputedEntryHash = await sha256HexClient(
    `${entry.sequence}|${entry.entryId}|${entry.branchId}|${entry.payloadHash}|${entry.previousHash}|${entry.timestamp}`
  );
  return {
    entryId: entry.entryId,
    payloadMatch: recomputedPayloadHash === entry.payloadHash,
    entryMatch: recomputedEntryHash === entry.entryHash,
    recomputedPayloadHash,
    recomputedEntryHash,
  };
}

export default function ImmutableAuditView({
  entries,
  integrity,
  blockStatuses,
  totalChainCount,
  branchFilter,
  loading,
  onRefresh,
  onBackupDrive,
  onMirrorFirestore,
}: ImmutableAuditViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [creatingCheckpoint, setCreatingCheckpoint] = useState(false);
  const [checkpointNote, setCheckpointNote] = useState('');
  const [simulatingTamper, setSimulatingTamper] = useState(false);
  const [tamperSimulation, setTamperSimulation] = useState<TamperSimulationResult | null>(null);
  const [localIntegrity, setLocalIntegrity] = useState<AuditChainVerificationResult | null>(null);

  const [browserSummary, setBrowserSummary] = useState<{
    verifiedCount: number;
    mismatchCount: number;
    checkedAt: string;
  } | null>(null);
  const [selectedBrowserCheck, setSelectedBrowserCheck] = useState<BrowserDigestCheck | null>(null);

  const effectiveIntegrity = localIntegrity ?? integrity;

  const availableActions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
      if (!q) return true;
      const haystack = `${entry.sequence} ${entry.entryId} ${entry.branchId} ${entry.actorName} ${entry.actorRole} ${entry.action} ${entry.resourceRef} ${entry.entryHash} ${entry.payloadHash} ${entry.previousHash}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, actionFilter, searchQuery]);

  const activeEntry = useMemo(() => {
    if (filteredEntries.length === 0) return null;
    if (selectedEntryId) {
      const found = filteredEntries.find((e) => e.entryId === selectedEntryId);
      if (found) return found;
    }
    return filteredEntries[0];
  }, [filteredEntries, selectedEntryId]);

  useEffect(() => {
    if (!activeEntry || typeof window === 'undefined' || !window.crypto?.subtle) return;
    let cancelled = false;
    void verifyEntryInBrowser(activeEntry).then((check) => {
      if (!cancelled) {
        setSelectedBrowserCheck(check);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeEntry]);

  const handleFullSha256Verification = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/enterprise/audit-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'VERIFY' }),
      });
      const json = await res.json().catch(() => null);

      let browserVerified = 0;
      let browserMismatches = 0;
      if (typeof window !== 'undefined' && window.crypto?.subtle && entries.length > 0) {
        const checks = await Promise.all(entries.map((entry) => verifyEntryInBrowser(entry)));
        for (const c of checks) {
          browserVerified++;
          if (!c.payloadMatch || !c.entryMatch) browserMismatches++;
        }
        setBrowserSummary({
          verifiedCount: browserVerified,
          mismatchCount: browserMismatches,
          checkedAt: new Date().toLocaleTimeString('es-MX'),
        });
      }

      if (res.ok && json?.success && json.integrity) {
        setLocalIntegrity(json.integrity);
        if (json.integrity.valid && browserMismatches === 0) {
          toast.success(
            `Integridad SHA-256 verificada: ${json.integrity.checkedCount} bloques en servidor y ${browserVerified} en navegador.`
          );
        } else {
          toast.error(
            json.integrity.reason || 'Se detectó inconsistencia criptográfica en la bitácora.'
          );
        }
      } else {
        toast.error(json?.error || 'No se pudo completar la verificación SHA-256.');
      }
      await onRefresh();
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateCheckpoint = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCreatingCheckpoint(true);
    try {
      const res = await fetch('/api/enterprise/audit-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'CHECKPOINT',
          branchId: branchFilter,
          note: checkpointNote.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'No se pudo sellar el checkpoint.');
        return;
      }
      setCheckpointNote('');
      if (json.integrity) setLocalIntegrity(json.integrity);
      if (json.createdEntry?.entryId) setSelectedEntryId(json.createdEntry.entryId);
      toast.success(
        `Bloque #${json.createdEntry?.sequence ?? ''} sellado e incorporado a la cadena SHA-256.`
      );
      await onRefresh();
    } finally {
      setCreatingCheckpoint(false);
    }
  };

  const handleSimulateTamper = async () => {
    setSimulatingTamper(true);
    try {
      const res = await fetch('/api/enterprise/audit-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'SIMULATE_TAMPER_CHECK',
          targetSequence: activeEntry?.sequence,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json.simulation) {
        toast.error(json?.error || 'No se pudo ejecutar la prueba forense.');
        return;
      }
      setTamperSimulation(json.simulation);
      toast.warning(
        `Simulación forense completada: alteración detectada en bloque #${json.simulation.targetSequence}.`
      );
    } finally {
      setSimulatingTamper(false);
    }
  };

  const copyHash = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado al portapapeles.`);
    } catch {
      toast.error('No se pudo copiar al portapapeles.');
    }
  };

  const activeBlockStatus = activeEntry ? blockStatuses[activeEntry.entryId] : undefined;
  const isChainValid = effectiveIntegrity?.valid !== false;

  return (
    <section className="space-y-5" aria-label="Auditoría Inmutable SHA-256">
      {/* ── Cryptographic Chain Status Header (Single Elevation) ── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            {isChainValid ? (
              <ShieldCheck
                size={20}
                className="mt-0.5 shrink-0 text-emerald-400"
                aria-hidden="true"
              />
            ) : (
              <ShieldAlert
                size={20}
                className="mt-0.5 shrink-0 text-rose-400"
                aria-hidden="true"
              />
            )}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <h2 className="text-sm font-semibold text-slate-50">
                  {isChainValid
                    ? 'Bitácora Append-Only SHA-256 Íntegra'
                    : 'Alerta Crítica: Ruptura Detectada en la Cadena SHA-256'}
                </h2>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span
                  className={`font-semibold ${
                    isChainValid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isChainValid ? 'Integridad Verificada' : 'Secuencia Comprometida'}
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                {effectiveIntegrity?.checkedCount ?? totalChainCount} bloques validados
                <span aria-hidden="true"> · </span>
                Total en libro mayor: {totalChainCount}
                <span aria-hidden="true"> · </span>
                Head: {(effectiveIntegrity?.headHash || '0'.repeat(64)).slice(0, 22)}…
                {browserSummary && (
                  <>
                    <span aria-hidden="true"> · </span>
                    WebCrypto ({browserSummary.checkedAt}): {browserSummary.verifiedCount - browserSummary.mismatchCount}/
                    {browserSummary.verifiedCount} OK
                  </>
                )}
              </p>
              {!isChainValid && effectiveIntegrity?.reason && (
                <p className="text-xs font-medium text-rose-300">{effectiveIntegrity.reason}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleFullSha256Verification()}
              disabled={verifying}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              <ShieldCheck size={14} aria-hidden="true" />
              {verifying ? 'Validando SHA-256...' : 'Validar Integridad SHA-256'}
            </button>

            <button
              type="button"
              onClick={() => void handleSimulateTamper()}
              disabled={simulatingTamper}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"
            >
              <FlaskConical size={14} aria-hidden="true" />
              {simulatingTamper ? 'Ejecutando...' : 'Prueba Forense'}
            </button>

            <button
              type="button"
              onClick={onBackupDrive}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-400 hover:text-sky-300"
            >
              <HardDrive size={14} aria-hidden="true" />
              Respaldar en Drive
            </button>
          </div>
        </div>

        {/* Hairline separated Checkpoint & Search Strip */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-800 pt-4 lg:grid-cols-12">
          <form
            onSubmit={handleCreateCheckpoint}
            className="flex flex-col gap-2 sm:flex-row lg:col-span-6"
          >
            <input
              type="text"
              value={checkpointNote}
              onChange={(e) => setCheckpointNote(e.target.value)}
              placeholder="Nota de sellado (ej. Cierre de turno vespertino o auditoría mensual)"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={creatingCheckpoint}
              className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
            >
              <Plus size={14} aria-hidden="true" />
              {creatingCheckpoint ? 'Sellando...' : 'Sellar Checkpoint'}
            </button>
          </form>

          <div className="flex flex-col gap-2 sm:flex-row lg:col-span-6">
            <div className="relative flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por actor, recurso, acción o prefijo SHA-256..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pr-3 pl-8 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-sky-400"
              />
            </div>

            <select
              aria-label="Filtrar por tipo de evento"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-400"
            >
              <option value="all">Todas las acciones ({entries.length})</option>
              {availableActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Non-Destructive Forensic Tamper Simulation Diagnostic ── */}
      {tamperSimulation && (
        <div
          role="region"
          aria-label="Resultado de simulación forense SHA-256"
          className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 text-xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <FlaskConical
                size={16}
                className="mt-0.5 shrink-0 text-amber-300"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100">
                  Simulación Forense en Copia Aislada: Alteración detectada al instante en bloque #
                  {tamperSimulation.targetSequence}
                </p>
                <p className="text-amber-200/90">
                  {tamperSimulation.integrity.reason} · Campo mutado en prueba:{' '}
                  <span className="font-mono">{tamperSimulation.tamperedField}</span> (
                  <span className="font-mono">{tamperSimulation.originalValue}</span> →{' '}
                  <span className="font-mono text-rose-300">{tamperSimulation.tamperedValue}</span>)
                </p>
                <p className="font-mono text-[11px] text-slate-300">
                  Hash contenido válido:{' '}
                  {tamperSimulation.brokenBlock?.payloadValid ? 'Sí' : 'No (Corrupto)'} · Hash bloque
                  válido: {tamperSimulation.brokenBlock?.hashValid ? 'Sí' : 'No'} · Libro mayor
                  real intacto: {tamperSimulation.realLedgerUntouched ? 'Confirmado' : 'Error'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTamperSimulation(null)}
              aria-label="Cerrar diagnóstico forense"
              className="cursor-pointer rounded p-1 text-amber-200 hover:bg-amber-900/40"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Ledger Workbench: 8-col Table + 4-col Block Inspector ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 xl:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs">
            <span className="font-semibold text-slate-100">
              Cadena de Registros Encadenados
            </span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {filteredEntries.length} visible(s)
              {branchFilter !== 'all' && ` · Nodo ${branchFilter}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-3.5 py-3 font-medium">#</th>
                  <th className="px-3.5 py-3 font-medium">Fecha y Hora</th>
                  <th className="px-3.5 py-3 font-medium">Actor · Rol</th>
                  <th className="px-3.5 py-3 font-medium">Acción</th>
                  <th className="px-3.5 py-3 font-medium">Recurso</th>
                  <th className="px-3.5 py-3 font-medium">Huella Bloque</th>
                  <th className="px-3.5 py-3 font-medium">SHA-256</th>
                  <th className="px-3.5 py-3 text-right font-medium">Nube</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading && entries.length === 0 ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`}>
                      <td colSpan={8} className="px-4 py-3.5">
                        <div className="h-4 w-full rounded bg-slate-800/70" />
                      </td>
                    </tr>
                  ))
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <FileSearch
                        size={22}
                        className="mx-auto text-slate-500"
                        aria-hidden="true"
                      />
                      <p className="mt-2 text-xs font-medium text-slate-200">
                        {entries.length === 0
                          ? 'Aún no hay bloques en la cadena inmutable SHA-256.'
                          : 'Ningún bloque coincide con los filtros actuales.'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {entries.length === 0
                          ? 'Cada inicio SSO, revocación de sesión, creación de nodo y checkpoint genera un bloque encadenado.'
                          : 'Prueba limpiando el campo de búsqueda o seleccionando todas las acciones.'}
                      </p>
                      {entries.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => void handleCreateCheckpoint()}
                          disabled={creatingCheckpoint}
                          className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
                        >
                          <Plus size={14} aria-hidden="true" />
                          Generar Primer Bloque Checkpoint
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setActionFilter('all');
                          }}
                          className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => {
                    const isSelected = activeEntry?.entryId === entry.entryId;
                    const blockState = blockStatuses[entry.entryId];
                    const blockOk = blockState ? blockState.valid : true;
                    return (
                      <tr
                        key={entry.entryId}
                        onClick={() => setSelectedEntryId(entry.entryId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-500/10' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-3.5 py-2.5 font-mono text-slate-300 tabular-nums">
                          {entry.sequence}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleString('es-MX')}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="font-medium text-slate-100">{entry.actorName}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-slate-400">
                            · {entry.actorRole}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-semibold text-sky-300">
                          {entry.action}
                        </td>
                        <td className="max-w-[160px] truncate px-3.5 py-2.5 font-mono text-[11px] text-slate-300">
                          {entry.resourceRef}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-300 tabular-nums">
                          {entry.entryHash.slice(0, 12)}…
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          {blockOk ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-400">
                              <CheckCircle2 size={13} aria-hidden="true" />
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-rose-400">
                              <ShieldAlert size={13} aria-hidden="true" />
                              Roto
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onMirrorFirestore(entry);
                            }}
                            className="cursor-pointer whitespace-nowrap text-[11px] font-medium text-sky-400 hover:text-sky-300"
                          >
                            Espejar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Cryptographic Block Inspector (4 cols) ── */}
        <aside
          aria-label="Inspector Criptográfico SHA-256"
          className="rounded-xl border border-slate-800 bg-slate-900/80 xl:col-span-4"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
              <Lock size={14} className="text-sky-400" aria-hidden="true" />
              <span>Inspector Criptográfico</span>
            </div>
            {activeEntry && (
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                Bloque #{activeEntry.sequence}
              </span>
            )}
          </div>

          {!activeEntry ? (
            <div className="px-4 py-10 text-center text-xs text-slate-400">
              Selecciona cualquier registro de la tabla para auditar su encadenamiento SHA-256.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 text-xs">
              <div className="space-y-1.5 px-4 py-3.5">
                <p className="font-semibold text-slate-100">{activeEntry.action}</p>
                <p className="font-mono text-[11px] text-slate-400">
                  ID: {activeEntry.entryId} · Sucursal: {activeEntry.branchId}
                </p>
                <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                  {new Date(activeEntry.timestamp).toLocaleString('es-MX')} · {activeEntry.actorName} (
                  {activeEntry.actorRole})
                </p>
              </div>

              <div className="space-y-3 px-4 py-3.5">
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-300">
                      Previous Hash (Ancla Anterior)
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-medium ${
                          activeBlockStatus?.linkValid !== false
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {activeEntry.sequence === 1
                          ? 'Génesis OK'
                          : activeBlockStatus?.linkValid !== false
                            ? 'Enlace OK'
                            : 'Enlace Roto'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyHash('Previous Hash', activeEntry.previousHash)}
                        aria-label="Copiar Previous Hash"
                        className="cursor-pointer text-slate-400 hover:text-slate-100"
                      >
                        <Copy size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-400 tabular-nums">
                    {activeEntry.previousHash}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-300">
                      Payload Hash (SHA-256 Contenido)
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-medium ${
                          activeBlockStatus?.payloadValid !== false &&
                          selectedBrowserCheck?.payloadMatch !== false
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {selectedBrowserCheck
                          ? selectedBrowserCheck.payloadMatch
                            ? 'WebCrypto OK'
                            : 'Alterado'
                          : activeBlockStatus?.payloadValid !== false
                            ? 'OK'
                            : 'Alterado'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyHash('Payload Hash', activeEntry.payloadHash)}
                        aria-label="Copiar Payload Hash"
                        className="cursor-pointer text-slate-400 hover:text-slate-100"
                      >
                        <Copy size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-400 tabular-nums">
                    {activeEntry.payloadHash}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-300">
                      Entry Hash (Sello Final Bloque)
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-medium ${
                          activeBlockStatus?.hashValid !== false &&
                          selectedBrowserCheck?.entryMatch !== false
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {selectedBrowserCheck
                          ? selectedBrowserCheck.entryMatch
                            ? 'WebCrypto OK'
                            : 'Inválido'
                          : activeBlockStatus?.hashValid !== false
                            ? 'OK'
                            : 'Inválido'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyHash('Entry Hash', activeEntry.entryHash)}
                        aria-label="Copiar Entry Hash"
                        className="cursor-pointer text-slate-400 hover:text-slate-100"
                      >
                        <Copy size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] text-sky-300 tabular-nums">
                    {activeEntry.entryHash}
                  </p>
                </div>
              </div>

              <div className="space-y-2 px-4 py-3.5">
                <p className="text-[11px] font-medium text-slate-300">
                  Metadatos Canónicos Firmados
                </p>
                <pre className="max-h-36 overflow-auto rounded-lg bg-slate-950 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300">
                  {JSON.stringify(
                    {
                      resourceRef: activeEntry.resourceRef,
                      actorId: activeEntry.actorId,
                      details: activeEntry.details || {},
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              <div className="flex items-center justify-between gap-2 px-4 py-3.5">
                <button
                  type="button"
                  onClick={() => void onMirrorFirestore(activeEntry)}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400 hover:text-sky-300"
                >
                  <CloudUpload size={14} aria-hidden="true" />
                  Espejar Bloque #{activeEntry.sequence} en Firestore
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
