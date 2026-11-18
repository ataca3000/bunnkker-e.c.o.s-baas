'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCheck,
  Package,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useSyncListener } from '@/lib/syncNotifier';
import type { UnifiedAlertCategory, UnifiedAlertEvent } from '@/lib/enterpriseControlPlane';

interface UnifiedAlertDrawerProps {
  open: boolean;
  onClose: () => void;
  activeBranchId: string;
  onUnreadCountChange?: (count: number) => void;
}

type CategoryFilter = 'all' | 'critical' | UnifiedAlertCategory;

const FILTER_TABS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'critical', label: 'Críticas' },
  { id: 'stock', label: 'Stock' },
  { id: 'order', label: 'Pedidos' },
  { id: 'security', label: 'Seguridad' },
  { id: 'sync', label: 'Sincronización' },
];

export default function UnifiedAlertDrawer({
  open,
  onClose,
  activeBranchId,
  onUnreadCountChange,
}: UnifiedAlertDrawerProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<UnifiedAlertEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = activeBranchId && activeBranchId !== 'all' ? `?branchId=${encodeURIComponent(activeBranchId)}` : '';
      const res = await fetch(`/api/enterprise/alerts${qs}`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (json?.success && Array.isArray(json.data)) {
        setAlerts(json.data as UnifiedAlertEvent[]);
      }
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  useSyncListener(() => {
    void fetchAlerts();
  }, ['orders', 'products', 'audit', 'settings', 'all']);

  const unreadAlerts = useMemo(
    () => alerts.filter((a) => !acknowledgedIds.includes(a.alertId)),
    [alerts, acknowledgedIds]
  );

  useEffect(() => {
    onUnreadCountChange?.(unreadAlerts.length);
  }, [unreadAlerts.length, onUnreadCountChange]);

  const visibleAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (filter === 'all') return true;
      if (filter === 'critical') return a.severity === 'critical';
      return a.category === filter;
    });
  }, [alerts, filter]);

  if (!open) return null;

  const markAcknowledged = (alertId: string) => {
    setAcknowledgedIds((prev) => (prev.includes(alertId) ? prev : [...prev, alertId]));
  };

  const renderCategoryIcon = (category: UnifiedAlertCategory) => {
    switch (category) {
      case 'stock':
        return <Package size={15} className="shrink-0 text-amber-400" aria-hidden="true" />;
      case 'order':
        return <ShoppingBag size={15} className="shrink-0 text-sky-400" aria-hidden="true" />;
      case 'security':
        return <ShieldAlert size={15} className="shrink-0 text-rose-400" aria-hidden="true" />;
      case 'sync':
        return <RefreshCw size={15} className="shrink-0 text-indigo-400" aria-hidden="true" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Centro Unificado de Alertas"
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Bell size={17} className="text-sky-400" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-50">Centro Unificado de Alertas</h2>
              <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                {unreadAlerts.length} activa(s) · {alerts.length} detectada(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void fetchAlerts()}
              disabled={loading}
              title="Actualizar señales"
              aria-label="Actualizar alertas"
              className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar alertas"
              className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-800 px-4 py-2.5">
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
          {visibleAlerts.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
              <CheckCheck size={28} className="text-emerald-400" aria-hidden="true" />
              <p className="mt-3 text-xs font-semibold text-slate-200">
                Operación nominal sin alertas pendientes
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Stock, cola de cobro, replicación y seguridad se encuentran en orden.
              </p>
            </div>
          ) : (
            visibleAlerts.map((alert) => {
              const isAck = acknowledgedIds.includes(alert.alertId);
              const severityLabel =
                alert.severity === 'critical'
                  ? 'Crítica'
                  : alert.severity === 'warning'
                    ? 'Atención'
                    : 'Info';
              const severityTextClass =
                alert.severity === 'critical'
                  ? 'text-rose-400'
                  : alert.severity === 'warning'
                    ? 'text-amber-400'
                    : 'text-sky-400';

              return (
                <div
                  key={alert.alertId}
                  className={`px-5 py-3.5 transition-colors ${isAck ? 'opacity-55' : 'hover:bg-slate-800/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5">{renderCategoryIcon(alert.category)}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className={`font-semibold ${severityTextClass}`}>
                            {alert.severity === 'critical' && (
                              <AlertTriangle size={11} className="mr-1 inline" aria-hidden="true" />
                            )}
                            {severityLabel}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400">{alert.branchName}</span>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-slate-100">{alert.title}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{alert.detail}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 pl-6 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(alert.targetUrl);
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 font-medium text-sky-400 hover:text-sky-300"
                    >
                      <span>Abrir módulo</span>
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </button>

                    {!isAck && (
                      <button
                        type="button"
                        onClick={() => markAcknowledged(alert.alertId)}
                        className="cursor-pointer text-slate-400 hover:text-slate-200"
                      >
                        Marcar leída
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
