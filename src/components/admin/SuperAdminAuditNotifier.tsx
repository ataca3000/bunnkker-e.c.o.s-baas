'use client';

import { useEffect, useRef, useState } from 'react';
import { BellOff, BellRing } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';
import {
  AUDIT_NOTIF_DOM_EVENT,
  AUDIT_NOTIF_PREF_KEY,
  AUDIT_PREF_CHANGE_EVENT,
  formatAuditChangeNotification,
  isAuditNotificationAction,
  loadAuditNotificationPreference,
  saveAuditNotificationPreference,
  shouldNotifySuperAdminAudit,
} from '@/lib/auditNotifications';

interface IncomingAuditDetail {
  action?: string;
  scope?: string;
  details?: unknown;
  payload?: { details?: unknown; actorUid?: string };
  actorName?: string;
  id?: string;
  entityId?: string;
  txId?: string;
}

export default function SuperAdminAuditNotifier() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'superadmin';
  const [enabled, setEnabled] = useState<boolean>(true);
  const enabledRef = useRef<boolean>(true);
  const roleRef = useRef<string | undefined>(profile?.role);
  const seenKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    roleRef.current = profile?.role;
  }, [profile?.role]);

  useEffect(() => {
    if (!isSuperAdmin || typeof window === 'undefined') return;

    const initial = loadAuditNotificationPreference();
    setEnabled(initial);
    enabledRef.current = initial;

    const handlePrefChanged = (ev: Event) => {
      const next = (ev as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      const resolved = typeof next === 'boolean' ? next : loadAuditNotificationPreference();
      setEnabled(resolved);
      enabledRef.current = resolved;
    };

    const handleStorage = (ev: StorageEvent) => {
      if (ev.key === AUDIT_NOTIF_PREF_KEY) {
        const resolved = loadAuditNotificationPreference();
        setEnabled(resolved);
        enabledRef.current = resolved;
      }
    };

    const emitToastIfEligible = (detail?: IncomingAuditDetail) => {
      if (!shouldNotifySuperAdminAudit(roleRef.current, enabledRef.current)) return;
      if (!detail || !isAuditNotificationAction(detail.action, detail.scope)) return;

      const entity = detail.entityId || detail.id || '';
      const timeBucket = Math.floor(Date.now() / 2000);
      const dedupKey = detail.txId || `${detail.action}:${entity}:${timeBucket}`;

      if (seenKeysRef.current.has(dedupKey)) return;
      if (seenKeysRef.current.size >= 300) {
        const oldest = seenKeysRef.current.values().next().value;
        if (oldest) seenKeysRef.current.delete(oldest);
      }
      seenKeysRef.current.add(dedupKey);

      const formatted = formatAuditChangeNotification({
        action: detail.action,
        details: detail.details ?? detail.payload?.details ?? detail.payload,
        actorName: detail.actorName,
        entityId: entity,
      });

      if (formatted.level === 'warning') {
        toast.warning(formatted.message, formatted.title, 6500);
      } else {
        toast.info(formatted.message, formatted.title, 5500);
      }
    };

    const handleDomAudit = (ev: Event) => {
      emitToastIfEligible((ev as CustomEvent<IncomingAuditDetail>).detail);
    };

    const handleSyncEvent = (ev: Event) => {
      emitToastIfEligible((ev as CustomEvent<IncomingAuditDetail>).detail);
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('bunkker_tab_sync');
        channel.onmessage = (event) => {
          if (event.data?.type === 'SYNC_REFETCH') {
            emitToastIfEligible(event.data.payload as IncomingAuditDetail);
          }
        };
      }
    } catch {
      channel = null;
    }

    window.addEventListener(AUDIT_PREF_CHANGE_EVENT, handlePrefChanged);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(AUDIT_NOTIF_DOM_EVENT, handleDomAudit);
    window.addEventListener('bunkker_sync_event', handleSyncEvent);

    return () => {
      try {
        channel?.close();
      } catch {}
      window.removeEventListener(AUDIT_PREF_CHANGE_EVENT, handlePrefChanged);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AUDIT_NOTIF_DOM_EVENT, handleDomAudit);
      window.removeEventListener('bunkker_sync_event', handleSyncEvent);
    };
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return null;
  }

  const toggleNotifications = () => {
    const next = !enabled;
    setEnabled(next);
    enabledRef.current = next;
    saveAuditNotificationPreference(next);
    if (next) {
      toast.success('Alertas de auditoría activadas para SuperAdmin.', 'Auditoría Activa');
    } else {
      toast.info('Notificaciones de auditoría silenciadas temporalmente.', 'Auditoría Silenciada');
    }
  };

  return (
    <button
      type="button"
      onClick={toggleNotifications}
      aria-pressed={enabled}
      title={enabled ? 'Silenciar notificaciones de auditoría' : 'Activar notificaciones de auditoría'}
      className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
        enabled
          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25'
          : 'bg-slate-800/80 border-white/15 text-slate-400 hover:text-white hover:bg-slate-700'
      }`}
    >
      {enabled ? <BellRing size={14} className="shrink-0" /> : <BellOff size={14} className="shrink-0" />}
      <span className="hidden md:inline whitespace-nowrap">
        {enabled ? 'Auditoría: Activa' : 'Auditoría: Silenciada'}
      </span>
    </button>
  );
}
