'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Building2,
  Check,
  CloudUpload,
  CreditCard,
  ExternalLink,
  FileSpreadsheet,
  HardDrive,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useSyncListener } from '@/lib/syncNotifier';
import type {
  BranchIsolationMode,
  BranchNode,
  SessionRecord,
  SubscriptionTier,
} from '@/lib/enterpriseControlPlane';
import type {
  AuditBlockVerification,
  AuditChainVerificationResult,
  ImmutableAuditEntry,
} from '@/lib/immutableAudit';
import {
  ENTERPRISE_CAPABILITY_METADATA,
  hasCapability,
} from '@/lib/enterpriseRbac';
import {
  mirrorImmutableAuditToFirestore,
  syncBranchNodeToFirestore,
} from '@/lib/enterpriseFirestore';
import WorkspaceConfirmModal from './WorkspaceConfirmModal';
import ImmutableAuditView from './ImmutableAuditView';
import ConfigHelpButton from '@/components/common/ConfigHelpButton';
import FirebaseAiDiagnosticsPanel from '@/components/admin/FirebaseAiDiagnosticsPanel';
import { toast } from '@/lib/toast';

export type ConsoleTab = 'branches' | 'sessions' | 'rbac' | 'audit' | 'workspace' | 'hybrid-ai';

const TABS: Array<{ id: ConsoleTab; label: string }> = [
  { id: 'branches', label: 'Sucursales y Nodos' },
  { id: 'sessions', label: 'Sesiones y SSO' },
  { id: 'rbac', label: 'Matriz RBAC' },
  { id: 'audit', label: 'Auditoría Inmutable' },
  { id: 'workspace', label: 'Google Workspace' },
  { id: 'hybrid-ai', label: 'IA Híbrida (Firebase)' },
];

const RBAC_ROLES = [
  { id: 'superadmin', label: 'Superadmin' },
  { id: 'admin', label: 'Admin' },
  { id: 'sales', label: 'Ventas / POS' },
  { id: 'billing', label: 'Facturación' },
  { id: 'inventory', label: 'Almacén' },
  { id: 'patio', label: 'Patio' },
  { id: 'driver', label: 'Reparto' },
  { id: 'pickup', label: 'Mostrador' },
  { id: 'marketing', label: 'Marketing' },
];

export default function EnterpriseConsoleView({
  initialTab = 'branches',
}: {
  initialTab?: ConsoleTab;
}) {
  const { formatCurrency, siteConfig, updateSiteConfig } = useCart();
  const [activeTab, setActiveTab] = useState<ConsoleTab>(initialTab);
  const [activeBranchFilter, setActiveBranchFilter] = useState<string>('all');
  const operationSpace: 'local' | 'business' =
    siteConfig?.operationSpace === 'business' ? 'business' : 'local';

  const [branches, setBranches] = useState<BranchNode[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<ImmutableAuditEntry[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<AuditChainVerificationResult | null>(null);
  const [auditBlockStatuses, setAuditBlockStatuses] = useState<
    Record<string, AuditBlockVerification>
  >({});
  const [totalChainCount, setTotalChainCount] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchRegion, setNewBranchRegion] = useState('México · Nodo Aislado');
  const [newBranchIsolation, setNewBranchIsolation] =
    useState<BranchIsolationMode>('isolated_local_first');
  const [newBranchTier, setNewBranchTier] = useState<SubscriptionTier>('PRO');

  const [confirmRevokeTarget, setConfirmRevokeTarget] = useState<SessionRecord | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [syncingBranchId, setSyncingBranchId] = useState<string | null>(null);

  const [workspaceModal, setWorkspaceModal] = useState<{
    open: boolean;
    target: 'drive' | 'sheets';
    title: string;
    summary: string;
  }>({ open: false, target: 'drive', title: '', summary: '' });
  const [lastWorkspaceExport, setLastWorkspaceExport] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const loadAll = useCallback(async () => {
    setLoading(true);
    setNowMs(Date.now());
    try {
      const qs =
        activeBranchFilter !== 'all'
          ? `?branchId=${encodeURIComponent(activeBranchFilter)}`
          : '';
      const [bRes, sRes, aRes] = await Promise.all([
        fetch('/api/enterprise/branches', { credentials: 'include' }),
        fetch(`/api/enterprise/sessions${qs}`, { credentials: 'include' }),
        fetch(`/api/enterprise/audit-chain${qs}`, { credentials: 'include' }),
      ]);

      if (bRes.ok) {
        const bJson = await bRes.json().catch(() => null);
        if (bJson?.success && Array.isArray(bJson.data)) setBranches(bJson.data);
      }
      if (sRes.ok) {
        const sJson = await sRes.json().catch(() => null);
        if (sJson?.success && Array.isArray(sJson.data)) {
          setSessions(sJson.data);
          setCurrentSessionId(sJson.currentSessionId || null);
        }
      }
      if (aRes.ok) {
        const aJson = await aRes.json().catch(() => null);
        if (aJson?.success) {
          if (Array.isArray(aJson.data)) setAuditEntries(aJson.data);
          if (aJson.integrity) setAuditIntegrity(aJson.integrity);
          if (aJson.blockStatuses && typeof aJson.blockStatuses === 'object') {
            setAuditBlockStatuses(aJson.blockStatuses);
          }
          if (typeof aJson.totalChainCount === 'number') {
            setTotalChainCount(aJson.totalChainCount);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeBranchFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const branchHandler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ branchId?: string }>).detail;
      if (detail?.branchId) {
        setActiveBranchFilter(detail.branchId);
      }
    };
    const tabHandler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ tab?: ConsoleTab }>).detail;
      if (detail?.tab) {
        setActiveTab(detail.tab);
      }
    };
    window.addEventListener('bunkker_branch_context_changed', branchHandler);
    window.addEventListener('bunkker_enterprise_tab', tabHandler);
    return () => {
      window.removeEventListener('bunkker_branch_context_changed', branchHandler);
      window.removeEventListener('bunkker_enterprise_tab', tabHandler);
    };
  }, []);

  useSyncListener(() => {
    void loadAll();
  }, ['settings', 'audit', 'orders']);

  const onlineBranchesCount = useMemo(
    () => branches.filter((b) => b.status === 'online').length,
    [branches]
  );
  const totalPendingSync = useMemo(
    () => branches.reduce((acc, b) => acc + b.pendingSyncCount, 0),
    [branches]
  );
  const activeSessionsCount = useMemo(
    () =>
      sessions.filter(
        (s) => !s.revokedAt && new Date(s.expiresAt).getTime() > nowMs
      ).length,
    [sessions, nowMs]
  );

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setCreatingBranch(true);
    try {
      const res = await fetch('/api/enterprise/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'CREATE_BRANCH',
          name: newBranchName.trim(),
          region: newBranchRegion.trim(),
          isolationMode: newBranchIsolation,
          subscriptionTier: newBranchTier,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'No se pudo registrar la sucursal.');
        return;
      }
      setNewBranchName('');
      toast.success(`Sucursal "${json.data.name}" registrada en el plano de control.`);
      void syncBranchNodeToFirestore(json.data);
      await loadAll();
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleSyncBranch = async (branchId: string) => {
    setSyncingBranchId(branchId);
    try {
      const res = await fetch('/api/enterprise/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'SYNC_BRANCH', branchId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Fallo al replicar el nodo.');
        return;
      }
      void syncBranchNodeToFirestore(json.data);
      toast.success(`Replicación completada en ${json.data.name}`);
      await loadAll();
    } finally {
      setSyncingBranchId(null);
    }
  };

  const handleUpdateTier = async (branchId: string, tier: SubscriptionTier) => {
    const res = await fetch('/api/enterprise/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'UPDATE_TIER',
        branchId,
        subscriptionTier: tier,
      }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) {
      void syncBranchNodeToFirestore(json.data);
      toast.success(`Plan actualizado a ${tier}`);
      await loadAll();
    } else {
      toast.error(json?.error || 'No se pudo actualizar el plan.');
    }
  };

  const handleConfirmRevoke = async () => {
    if (!confirmRevokeTarget) return;
    setRevokingId(confirmRevokeTarget.sessionId);
    try {
      const res = await fetch('/api/enterprise/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: confirmRevokeTarget.sessionId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'No se pudo revocar la sesión.');
        return;
      }
      toast.success(`Sesión de ${confirmRevokeTarget.userName} revocada al instante.`);
      setConfirmRevokeTarget(null);
      await loadAll();
    } finally {
      setRevokingId(null);
    }
  };


  const handleExecuteWorkspaceExport = async (accessToken: string) => {
    const target = workspaceModal.target;
    const isSheets = target === 'sheets';
    const payload = isSheets
      ? {
          target: 'sheets',
          title: workspaceModal.title,
          headers: [
            'Sucursal ID',
            'Nombre',
            'Código',
            'Región',
            'Estado',
            'Aislamiento',
            'Cola Pendiente',
            'Ventas Hoy',
            'Órdenes Hoy',
            'Plan SaaS',
          ],
          rows: branches.map((b) => [
            b.branchId,
            b.name,
            b.code,
            b.region,
            b.status,
            b.isolationMode,
            b.pendingSyncCount,
            b.todaySales,
            b.todayOrders,
            b.subscriptionTier,
          ]),
        }
      : {
          target: 'drive',
          fileName: `${workspaceModal.title}.json`,
          mimeType: 'application/json',
          payload: {
            exportedAt: new Date().toISOString(),
            branches,
            sessions,
            auditIntegrity,
            auditEntries: auditEntries.slice(0, 50),
          },
        };

    const res = await fetch('/api/workspace/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || 'Error al exportar hacia Google Workspace.');
    }

    setLastWorkspaceExport({ title: json.title, url: json.url });
    toast.success(
      isSheets
        ? 'Resumen multi-sucursal exportado a Google Sheets.'
        : 'Snapshot corporativo guardado en Google Drive.'
    );
  };

  const handleMirrorLatestAuditToFirestore = async (entry: ImmutableAuditEntry) => {
    const ok = await mirrorImmutableAuditToFirestore(entry);
    if (ok) {
      toast.success(`Registro #${entry.sequence} replicado en Firestore`);
    } else {
      toast.warning(
        'Inicia sesión corporativa con Google SSO para replicar directamente a Firestore.'
      );
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">
            BUNKKER Enterprise Cloud · Plano de Control Multi-Sucursal
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">
            Gobierno Cloud, Identidad SSO y Nodos Aislados
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/executive"
            className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Tablero Ejecutivo
          </Link>
          <Link
            href="/dashboard/suscripcion"
            className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <CreditCard size={14} aria-hidden="true" />
            Planes y Licencias
          </Link>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </header>

      {operationSpace === 'local' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-100">
              Sistema operando en modo tienda única (Operación Local)
            </p>
            <p className="text-amber-200/80">
              Las funciones de esta pantalla pertenecen al Modo Business (multi-sucursal, SSO y nube). No afectan tu caja ni tu inventario actual.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void updateSiteConfig?.({ operationSpace: 'business' })}
              className="min-h-[36px] rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 cursor-pointer"
            >
              Activar Modo Business
            </button>
            <ConfigHelpButton settingKey="operationSpace" />
          </div>
        </div>
      )}

      {/* 4 Single-Elevation Summary KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Sucursales en Línea</span>
            <Building2 size={15} className="text-sky-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-50 tabular-nums">
            {onlineBranchesCount} / {branches.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Aislamiento local-first con réplica central
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Sesiones Activas Revocables</span>
            <KeyRound size={15} className="text-emerald-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-50 tabular-nums">
            {activeSessionsCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Control instantáneo Google SSO y PIN
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cola de Replicación</span>
            <Activity size={15} className="text-amber-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-50 tabular-nums">
            {totalPendingSync}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Eventos pendientes hacia consola cloud
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              Integridad Bitácora SHA-256
              <ConfigHelpButton settingKey="auditChain" />
            </span>
            <ShieldCheck
              size={15}
              className={auditIntegrity?.valid === false ? 'text-rose-400' : 'text-emerald-400'}
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-50 tabular-nums">
            {auditIntegrity?.valid === false
              ? 'ALTERADA'
              : `${auditIntegrity?.checkedCount ?? auditEntries.length} bloques`}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-400 truncate">
            {auditIntegrity?.headHash
              ? `Head: ${auditIntegrity.headHash.slice(0, 14)}…`
              : 'Cadena lista'}
          </p>
        </div>
      </section>

      {lastWorkspaceExport && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-4 py-3 text-xs text-emerald-200">
          <span>
            Exportación completada: <strong>{lastWorkspaceExport.title}</strong>
          </span>
          <a
            href={lastWorkspaceExport.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-emerald-300 underline"
          >
            <span>Abrir en Google Workspace</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav
        aria-label="Secciones de Consola Enterprise"
        className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-3"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={active}
              className={`min-h-[36px] cursor-pointer whitespace-nowrap shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-sky-500 text-slate-950'
                  : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ══ TAB 1: MULTI-BRANCH ISOLATED NODES ════════════════════════════════ */}
      {activeTab === 'branches' && (
        <section className="space-y-6">
          <form
            onSubmit={handleCreateBranch}
            className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 md:grid-cols-12 md:items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-[11px] font-medium text-slate-400">
                Nombre de nueva sucursal
              </label>
              <input
                type="text"
                required
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Ej. Sucursal Industrial Norte"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-sky-400"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-medium text-slate-400">
                Región / Zona
              </label>
              <input
                type="text"
                value={newBranchRegion}
                onChange={(e) => setNewBranchRegion(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-400"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-1">
                <label className="block text-[11px] font-medium text-slate-400">
                  Topología
                </label>
                <ConfigHelpButton settingKey="branchIsolationMode" />
              </div>
              <select
                value={newBranchIsolation}
                onChange={(e) => setNewBranchIsolation(e.target.value as BranchIsolationMode)}
                className="mt-1 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 outline-none focus:border-sky-400"
              >
                <option value="isolated_local_first">Aislada Local-First</option>
                <option value="cloud_mirror">Espejo Cloud</option>
              </select>
            </div>

            <div className="md:col-span-1">
              <div className="flex items-center justify-between gap-1">
                <label className="block text-[11px] font-medium text-slate-400">Plan</label>
                <ConfigHelpButton settingKey="branchTier" />
              </div>
              <select
                value={newBranchTier}
                onChange={(e) => setNewBranchTier(e.target.value as SubscriptionTier)}
                className="mt-1 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100 outline-none focus:border-sky-400"
              >
                <option value="TRIAL">TRIAL</option>
                <option value="STARTER">STARTER</option>
                <option value="PRO">PRO</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creatingBranch || !newBranchName.trim()}
                className="inline-flex min-h-[36px] w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
              >
                <Plus size={14} aria-hidden="true" />
                {creatingBranch ? 'Registrando...' : 'Alta de Nodo'}
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Sucursal</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Aislamiento</th>
                    <th className="px-4 py-3 text-right font-medium">Cola</th>
                    <th className="px-4 py-3 text-right font-medium">Ventas Hoy</th>
                    <th className="px-4 py-3 font-medium">Plan SaaS</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {branches.map((branch) => {
                    const statusColor =
                      branch.status === 'online'
                        ? 'text-emerald-400'
                        : branch.status === 'degraded'
                          ? 'text-amber-400'
                          : 'text-rose-400';
                    const statusLabel =
                      branch.status === 'online'
                        ? 'En línea'
                        : branch.status === 'degraded'
                          ? 'Degradada'
                          : 'Offline autónoma';

                    return (
                      <tr key={branch.branchId} className="hover:bg-slate-800/35">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-100">{branch.name}</p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {branch.code} · {branch.branchId} · {branch.region}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {branch.latencyMs}ms · {new Date(branch.lastHeartbeatAt).toLocaleTimeString('es-MX')}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {branch.isolationMode === 'isolated_local_first'
                            ? 'Local-First Aislada'
                            : 'Espejo Cloud'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">
                          {branch.pendingSyncCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-100 tabular-nums">
                          {formatCurrency(branch.todaySales)}
                          <span className="block text-[11px] text-slate-400">
                            {branch.todayOrders} órdenes
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Plan de ${branch.name}`}
                            value={branch.subscriptionTier}
                            onChange={(e) =>
                              void handleUpdateTier(
                                branch.branchId,
                                e.target.value as SubscriptionTier
                              )
                            }
                            className="cursor-pointer rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-200 outline-none focus:border-sky-400"
                          >
                            <option value="TRIAL">TRIAL</option>
                            <option value="STARTER">STARTER</option>
                            <option value="PRO">PRO</option>
                            <option value="ENTERPRISE">ENTERPRISE</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleSyncBranch(branch.branchId)}
                            disabled={syncingBranchId === branch.branchId}
                            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-sky-400 hover:text-sky-300 disabled:opacity-60"
                          >
                            <CloudUpload size={13} aria-hidden="true" />
                            {syncingBranchId === branch.branchId ? 'Replicando...' : 'Sincronizar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ══ TAB 2: REVOCABLE SESSIONS & CORPORATE SSO ════════════════════════ */}
      {activeTab === 'sessions' && (
        <section className="space-y-4">
          {confirmRevokeTarget && (
            <div
              role="alertdialog"
              aria-modal="true"
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-400" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-rose-100">
                    ¿Revocar inmediatamente la sesión de {confirmRevokeTarget.userName}?
                  </p>
                  <p className="mt-0.5 text-rose-200/80">
                    La terminal ({confirmRevokeTarget.role} · {confirmRevokeTarget.branchId}) perderá acceso API y SSE en el acto.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRevokeTarget(null)}
                  className="cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmRevoke()}
                  disabled={revokingId === confirmRevokeTarget.sessionId}
                  className="cursor-pointer rounded-lg bg-rose-500 px-3 py-1.5 font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
                >
                  {revokingId === confirmRevokeTarget.sessionId ? 'Revocando...' : 'Confirmar Revocación'}
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Usuario / Identidad</th>
                    <th className="px-4 py-3 font-medium">Proveedor</th>
                    <th className="px-4 py-3 font-medium">Sucursal</th>
                    <th className="px-4 py-3 font-medium">Emitida</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        No hay sesiones registradas en este ciclo todavía.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((sess) => {
                      const isRevoked = Boolean(sess.revokedAt);
                      const isExpired =
                        !isRevoked && new Date(sess.expiresAt).getTime() <= nowMs;
                      const isCurrent = sess.sessionId === currentSessionId;
                      return (
                        <tr key={sess.sessionId} className="hover:bg-slate-800/35">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-100">
                              {sess.userName}
                              {isCurrent && (
                                <span className="ml-2 font-mono text-[11px] text-sky-400">
                                  · Sesión actual
                                </span>
                              )}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400">
                              {sess.role} · {sess.userEmail || sess.userId}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {sess.provider === 'google_sso' ? 'Google SSO' : 'Terminal PIN'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-300">{sess.branchId}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 tabular-nums">
                            {new Date(sess.issuedAt).toLocaleString('es-MX')}
                          </td>
                          <td className="px-4 py-3">
                            {isRevoked ? (
                              <span className="font-semibold text-rose-400">Revocada</span>
                            ) : isExpired ? (
                              <span className="font-semibold text-slate-400">Expirada</span>
                            ) : (
                              <span className="font-semibold text-emerald-400">Activa</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!isRevoked && !isExpired ? (
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeTarget(sess)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                                Revocar
                              </button>
                            ) : (
                              <span className="font-mono text-[11px] text-slate-500">
                                {sess.revokedBy || '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ══ TAB 3: GRANULAR RBAC CAPABILITIES MATRIX ═════════════════════════ */}
      {activeTab === 'rbac' && (
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-50">
              Matriz de Capacidades Granulares por Rol (Entra ID Pattern)
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Cada endpoint corporativo y acceso en el Command Palette valida capacidades explícitas además del rol.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Capacidad</th>
                  {RBAC_ROLES.map((r) => (
                    <th key={r.id} className="px-3 py-3 text-center font-medium">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {ENTERPRISE_CAPABILITY_METADATA.map((cap) => (
                  <tr key={cap.id} className="hover:bg-slate-800/35">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-100">{cap.label}</p>
                      <p className="font-mono text-[11px] text-slate-400">
                        {cap.id} · {cap.domain}
                      </p>
                    </td>
                    {RBAC_ROLES.map((r) => {
                      const allowed = hasCapability(r.id, cap.id);
                      return (
                        <td key={r.id} className="px-3 py-3 text-center">
                          {allowed ? (
                            <Check
                              size={15}
                              className="mx-auto text-emerald-400"
                              aria-label={`${r.label} autorizado`}
                            />
                          ) : (
                            <Lock
                              size={13}
                              className="mx-auto text-slate-600"
                              aria-label={`${r.label} restringido`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ══ TAB 4: IMMUTABLE SHA-256 AUDIT CHAIN ═════════════════════════════ */}
      {activeTab === 'audit' && (
        <ImmutableAuditView
          entries={auditEntries}
          integrity={auditIntegrity}
          blockStatuses={auditBlockStatuses}
          totalChainCount={totalChainCount}
          branchFilter={activeBranchFilter}
          loading={loading}
          onRefresh={loadAll}
          onBackupDrive={() =>
            setWorkspaceModal({
              open: true,
              target: 'drive',
              title: `bunkker-auditoria-inmutable-${new Date().toISOString().slice(0, 10)}`,
              summary: `Respaldo completo de ${auditEntries.length} registros SHA-256 y nodos multi-sucursal en Google Drive.`,
            })
          }
          onMirrorFirestore={handleMirrorLatestAuditToFirestore}
        />
      )}

      {/* ══ TAB 5: GOOGLE WORKSPACE & COMMERCIAL LICENSING ══════════════════ */}
      {activeTab === 'workspace' && (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <div>
              <div className="flex items-center gap-2 text-emerald-400">
                <FileSpreadsheet size={18} aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-50">
                  Google Sheets · Consolidado Multi-Sucursal
                </h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Crea una hoja de cálculo real en tu unidad con el estado de salud, ventas del día, cola de replicación y plan comercial de todas tus sucursales registradas.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setWorkspaceModal({
                  open: true,
                  target: 'sheets',
                  title: `BUNKKER Multi-Sucursal ${new Date().toISOString().slice(0, 10)}`,
                  summary: `Se exportarán ${branches.length} nodo(s) con métricas en vivo hacia una nueva hoja en Google Sheets.`,
                })
              }
              className="mt-5 inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 self-start rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              <FileSpreadsheet size={14} aria-hidden="true" />
              Exportar Nodos a Google Sheets
            </button>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <div>
              <div className="flex items-center gap-2 text-sky-400">
                <HardDrive size={18} aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-50">
                  Google Drive · Respaldo Corporativo Inmutable
                </h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Guarda una instantánea JSON firmada con el estado de sucursales, sesiones activas y los registros recientes de la bitácora criptográfica en Google Drive.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setWorkspaceModal({
                  open: true,
                  target: 'drive',
                  title: `bunkker-control-plane-${new Date().toISOString().slice(0, 10)}`,
                  summary: `Se creará un respaldo JSON con ${branches.length} sucursales, ${sessions.length} sesiones y auditoría verificada.`,
                })
              }
              className="mt-5 inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 self-start rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400"
            >
              <HardDrive size={14} aria-hidden="true" />
              Guardar Respaldo en Google Drive
            </button>
          </div>
        </section>
      )}

      {/* ══ TAB 6: FIREBASE AI LOGIC HYBRID DIAGNOSTICS ════════════════════ */}
      {activeTab === 'hybrid-ai' && <FirebaseAiDiagnosticsPanel />}

      <WorkspaceConfirmModal
        open={workspaceModal.open}
        target={workspaceModal.target}
        resourceTitle={workspaceModal.title}
        summaryText={workspaceModal.summary}
        onClose={() => setWorkspaceModal((prev) => ({ ...prev, open: false }))}
        onConfirm={handleExecuteWorkspaceExport}
      />
    </main>
  );
}
