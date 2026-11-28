'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Building2, MessageSquareWarning, QrCode, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { BranchNode } from '@/lib/enterpriseControlPlane';
import CommandPaletteModal from './CommandPaletteModal';
import QuickFeedbackModal from './QuickFeedbackModal';
import QuickInventoryLookupModal from './QuickInventoryLookupModal';
import UnifiedAlertDrawer from './UnifiedAlertDrawer';

export default function EnterpriseSuiteBar() {
  const { profile, isAdmin } = useAuth();
  const [branches, setBranches] = useState<BranchNode[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>('default');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [qrLookupOpen, setQrLookupOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadBranches = useCallback(async () => {
    if (!profile?.uid) return;
    try {
      const res = await fetch('/api/enterprise/branches', { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (json?.success && Array.isArray(json.data)) {
        setBranches(json.data as BranchNode[]);
      }
    } catch {
      // Non-fatal offline tolerance
    }
  }, [profile?.uid]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!profile?.uid) return null;

  const handleBranchChange = (nextBranchId: string) => {
    setActiveBranchId(nextBranchId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('bunkker_branch_context_changed', { detail: { branchId: nextBranchId } })
      );
    }
  };

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 px-4 py-2 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          {/* Left: Branch Node Context Switcher + Enterprise Console Link */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs">
              <Building2 size={14} className="shrink-0 text-sky-400" aria-hidden="true" />
              {branches.length > 0 ? (
                <select
                  aria-label="Selector de sucursal activa"
                  value={activeBranchId}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="max-w-[180px] cursor-pointer bg-transparent text-xs font-medium text-slate-200 outline-none"
                >
                  <option value="all" className="bg-slate-900 text-slate-100">
                    Vista Consolidada ({branches.length})
                  </option>
                  {branches.map((b) => (
                    <option key={b.branchId} value={b.branchId} className="bg-slate-900 text-slate-100">
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="truncate text-xs font-medium text-slate-200">Sucursal Matriz Local</span>
              )}
            </div>

            {isAdmin && (
              <Link
                href="/dashboard/enterprise"
                className="hidden items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-sky-500/50 hover:text-sky-300 md:inline-flex"
              >
                <ShieldCheck size={13} aria-hidden="true" />
                <span>Consola Central</span>
              </Link>
            )}
          </div>

          {/* Center: Global Command Palette Trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Abrir Command Palette"
            className="flex min-h-[34px] w-full max-w-sm cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
          >
            <span className="flex items-center gap-2 truncate">
              <Search size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">Buscar módulo, SKU, pedido o acción...</span>
            </span>
            <kbd className="hidden shrink-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">
              Ctrl K
            </kbd>
          </button>

          {/* Right: Quick QR Scanner + Discreet Feedback + Unified Alert Center + Operator Identity */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              data-testid="dashboard-qr-lookup-btn"
              onClick={() => setQrLookupOpen(true)}
              aria-label="Escanear código QR o de barras para consultar inventario"
              title="Escanear QR / código de barras"
              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-400/70 hover:bg-cyan-500/20 hover:text-white"
            >
              <QrCode size={15} className="shrink-0 text-cyan-400" aria-hidden="true" />
              <span className="hidden sm:inline">Escanear</span>
            </button>

            <button
              type="button"
              data-testid="dashboard-feedback-btn"
              onClick={() => setFeedbackOpen(true)}
              aria-label="Reportar falla o enviar comentario"
              title="Reportar falla / Enviar comentario"
              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-amber-500/50 hover:bg-slate-800 hover:text-amber-200"
            >
              <MessageSquareWarning size={14} className="shrink-0 text-amber-400" aria-hidden="true" />
              <span className="hidden md:inline">Reportar falla</span>
            </button>

            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              aria-label="Abrir Centro de Alertas"
              className="relative inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-700 hover:bg-slate-800"
            >
              <Bell size={14} className={unreadCount > 0 ? 'text-amber-400' : 'text-slate-400'} aria-hidden="true" />
              <span className="hidden sm:inline">Alertas</span>
              {unreadCount > 0 && (
                <span className="font-mono text-[11px] font-bold text-amber-400 tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="hidden text-right text-[11px] leading-tight lg:block">
              <p className="font-medium text-slate-200">{profile.displayName || 'Operador'}</p>
              <p className="text-slate-400">{profile.role}</p>
            </div>
          </div>
        </div>
      </div>

      <CommandPaletteModal
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenAlerts={() => setAlertsOpen(true)}
      />

      <UnifiedAlertDrawer
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        activeBranchId={activeBranchId}
        onUnreadCountChange={setUnreadCount}
      />

      <QuickInventoryLookupModal
        open={qrLookupOpen}
        onClose={() => setQrLookupOpen(false)}
      />

      <QuickFeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </>
  );
}
